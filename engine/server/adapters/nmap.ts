// Adaptador Nmap opcional: fingerprinting real con -sV cuando el binario
// existe. Nunca rangos masivos: un único host del alcance. Si falta → omitido.

import type { EngineJob, EngineResult } from '../../orchestrator/types';
import type { Finding } from '../../../shared/finding-schema';
import { stableFindingId } from '../../finding/dedup';
import { runTool } from '../../process/runner';
import { resolveHost, assertScopeIps } from '../../scope/network';

export const NMAP_VERSION = 'cuyocode-nmap-adapter/1.0';

interface NmapPort {
  port: number;
  protocol: string;
  state: string;
  service: string;
  version: string;
}

export function parseNmapXml(xml: string): NmapPort[] {
  const out: NmapPort[] = [];
  const portRe = /<port protocol="([^"]+)" portid="(\d+)">([\s\S]*?)<\/port>/g;
  let m: RegExpExecArray | null;
  while ((m = portRe.exec(xml)) !== null) {
    const body = m[3] ?? '';
    const state = /<state state="([^"]+)"/.exec(body)?.[1] ?? '?';
    const svc = /<service name="([^"]+)"(?:[^>]*product="([^"]*)")?(?:[^>]*version="([^"]*)")?/.exec(body);
    out.push({
      port: Number(m[2]),
      protocol: m[1] ?? 'tcp',
      state,
      service: svc?.[1] ?? '?',
      version: [svc?.[2], svc?.[3]].filter(Boolean).join(' '),
    });
  }
  return out;
}

export async function nmapEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const skipped: EngineResult['skipped'] = [];
  const errors: EngineResult['errors'] = [];
  const now = new Date().toISOString();

  const ver = await runTool('nmap', { args: ['--version'], timeoutMs: 15000, maxOutputBytes: 4096 });
  if (ver.exitCode === null) {
    skipped.push({ engine: 'nmap', reason: 'nmap no instalado: se usa el escáner TCP propio (ver Herramientas)' });
    return { engine: 'nmap', version: `${NMAP_VERSION}/no-disponible`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const nmapVersion = /Nmap version ([^\s]+)/.exec(ver.stdout)?.[1] ?? 'desconocida';

  const [host] = job.target.split(':');
  try {
    const resolved = await resolveHost(host ?? '');
    assertScopeIps(resolved, { allowPrivate: job.allowPrivate });
  } catch (e) {
    errors.push({ engine: 'nmap', message: e instanceof Error ? e.message : 'alcance bloqueado' });
    return { engine: 'nmap', version: `nmap/${nmapVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
  }

  const res = await runTool('nmap', {
    args: ['-sV', '-T4', '--top-ports', '50', '--open', '-oX', '-', host ?? ''],
    timeoutMs: job.limits.timeoutMs,
    maxOutputBytes: 4 * 1024 * 1024,
  });
  if (res.timedOut || res.exitCode === null) {
    errors.push({ engine: 'nmap', message: 'nmap no respondió dentro del límite' });
    return { engine: 'nmap', version: `nmap/${nmapVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const ports = parseNmapXml(res.stdout).filter((p) => p.state === 'open');
  for (const p of ports.slice(0, 64)) {
    const id = stableFindingId({
      source: `nmap/${nmapVersion}`, ruleId: 'nmap-service@1', target: job.target,
      file: null, lineStart: null, evidenceKind: 'nmap', evidenceSnippet: `${p.port}/${p.service}`,
    });
    findings.push({
      id,
      title: `Nmap: ${p.port}/${p.protocol} abierto (${p.service}${p.version ? ` ${p.version}` : ''})`,
      category: 'network-exposure',
      severity: 'info',
      confidence: 'high',
      verificationStatus: 'evidence-found',
      source: `nmap/${nmapVersion}`,
      ruleId: 'nmap-service@1',
      target: job.target,
      location: { file: null, lineStart: null, lineEnd: null },
      evidence: [{ kind: 'nmap', snippet: `${p.port}/${p.protocol} ${p.state} ${p.service} ${p.version}`, detail: `Detección -sV sobre el host del alcance.` }],
      impact: 'Inventario de superficie expuesta para comparar con los puertos esperados.',
      reproduction: [`Repetir nmap -sV contra ${host}.`],
      remediation: ['Comparar con la lista de puertos esperados y cerrar el resto.'],
      references: [],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  return { engine: 'nmap', version: `nmap/${nmapVersion}`, findings, errors, skipped, durationMs: Date.now() - started };
}
