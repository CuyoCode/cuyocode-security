// Escáner TCP propio (sin Nmap): conecta a puertos candidatos dentro del
// alcance, con concurrencia y timeout acotados. Solo banner pasivo.

import net from 'node:net';
import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { resolveHost, assertScopeIps } from '../scope/network';

export const PORTS_VERSION = 'cuyocode-ports/1.0';

const CANDIDATES: Array<{ port: number; service: string }> = [
  { port: 22, service: 'ssh' },
  { port: 80, service: 'http' },
  { port: 443, service: 'https' },
  { port: 21, service: 'ftp' },
  { port: 25, service: 'smtp' },
  { port: 53, service: 'dns' },
  { port: 110, service: 'pop3' },
  { port: 143, service: 'imap' },
  { port: 445, service: 'smb' },
  { port: 1433, service: 'mssql' },
  { port: 1521, service: 'oracle' },
  { port: 3306, service: 'mysql' },
  { port: 3389, service: 'rdp' },
  { port: 5432, service: 'postgres' },
  { port: 6379, service: 'redis' },
  { port: 27017, service: 'mongodb' },
  { port: 8080, service: 'http-alt' },
  { port: 8443, service: 'https-alt' },
  { port: 3000, service: 'node-dev' },
  { port: 5000, service: 'dev-api' },
  { port: 8000, service: 'http-alt2' },
  { port: 9000, service: 'admin-alt' },
  { port: 9090, service: 'admin-alt2' },
  { port: 10000, service: 'webmin' },
];

const DB_PORTS = new Set([1433, 1521, 3306, 5432, 6379, 27017]);
const ADMIN_PORTS = new Set([3389, 10000, 9090, 9000]);

interface OpenPort {
  port: number;
  service: string;
  banner: string;
}

/** Extrae host y puerto de "host", "host:puerto" o URL completa. */
export function parseTarget(target: string): { host: string; port: number } {
  const withScheme = target.includes('://') ? target : `ssh://${target}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`Objetivo inválido: ${target}`);
  }
  if (!/^[A-Za-z0-9.-]+$/.test(url.hostname)) throw new Error(`Host inválido: ${url.hostname}`);
  const port = url.port ? Number(url.port) : 22;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido');
  return { host: url.hostname, port };
}

function probe(ip: string, port: number, timeoutMs: number): Promise<OpenPort | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let banner = '';
    let done = false;
    const finish = (open: boolean): void => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {
        /* cerrado */
      }
      resolve(open ? { port, service: '', banner: banner.slice(0, 200) } : null);
    };
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
    socket.on('data', (d: Buffer) => {
      banner += d.toString('utf8', 0, 256 - banner.length);
    });
    socket.connect(port, ip, () => {
      // Puerto abierto: esperar banner breve y cerrar.
      setTimeout(() => finish(true), 800).unref?.();
    });
  });
}

export async function portsEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const findings: Finding[] = [];
  const now = new Date().toISOString();

  const { host, port: expected } = parseTarget(job.target);

  let resolved;
  try {
    resolved = await resolveHost(host);
    assertScopeIps(resolved, { allowPrivate: job.allowPrivate });
  } catch (e) {
    errors.push({ engine: 'ports-tcp', message: e instanceof Error ? e.message : 'resolución fallida' });
    return { engine: 'ports-tcp', version: PORTS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const ip = resolved.ips[0] as string;
  const maxPorts = Math.min(job.limits.maxPorts ?? 64, CANDIDATES.length);
  const concurrency = Math.min(job.limits.concurrency ?? 16, 32);
  const queue = CANDIDATES.slice(0, maxPorts);
  const open: OpenPort[] = [];

  for (let i = 0; i < queue.length; i += concurrency) {
    if (job.signal.aborted) break;
    const batch = queue.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((c) => probe(ip, c.port, 3000)));
    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      const cand = batch[j] as { port: number; service: string };
      if (r) open.push({ ...r, service: cand.service });
    }
  }

  for (const o of open) {
    const severity: Finding['severity'] = DB_PORTS.has(o.port)
      ? 'high'
      : ADMIN_PORTS.has(o.port)
        ? 'medium'
        : o.port === expected
          ? 'info'
          : 'low';
    const title = DB_PORTS.has(o.port)
      ? `Base de datos accesible en red: ${o.service}:${o.port}`
      : `Puerto abierto: ${o.service}:${o.port}`;
    const id = stableFindingId({
      source: PORTS_VERSION, ruleId: 'open-port@1', target: job.target,
      file: null, lineStart: null, evidenceKind: 'port', evidenceSnippet: `${ip}:${o.port}`,
    });
    findings.push({
      id,
      title,
      category: 'network-exposure',
      severity,
      confidence: 'high',
      verificationStatus: 'evidence-found',
      source: PORTS_VERSION,
      ruleId: 'open-port@1',
      target: job.target,
      location: { file: null, lineStart: null, lineEnd: null },
      evidence: [{
        kind: 'port',
        snippet: `${ip}:${o.port} abierto (${o.service})${o.banner ? ` banner: ${o.banner.replace(/[\r\n]+/g, ' ').slice(0, 120)}` : ''}`,
        detail: `Conexión TCP aceptada en ${ip}:${o.port}. Puerto esperado del perfil: ${expected}.`,
      }],
      impact: DB_PORTS.has(o.port)
        ? 'Base de datos alcanzable desde red: verificar autenticación, cifrado yallowlist; un puerto abierto no prueba datos expuestos.'
        : 'Superficie de ataque: cada servicio abierto debe estar justificado y actualizado.',
      reproduction: [`Repetir conexión TCP a ${ip}:${o.port}.`],
      remediation: [
        'Cerrar lo no necesario en firewall/grupo de seguridad.',
        'Bases de datos: solo red privada, auth fuerte y TLS.',
      ],
      references: [],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return { engine: 'ports-tcp', version: PORTS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
