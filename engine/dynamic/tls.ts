// Comprobaciones TLS: validez del certificado, cadena, hostname, protocolo.
// No califica cabeceras como obligatorias fuera de contexto: cada hallazgo
// explica aplicabilidad y excepciones.

import tls, { checkServerIdentity } from 'node:tls';
import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { resolveHost, assertScopeIps } from '../scope/network';

export const TLS_VERSION = 'cuyocode-tls/1.0';

function mkFinding(
  job: EngineJob,
  id: string,
  title: string,
  severity: Finding['severity'],
  detail: string,
  impact: string,
  remediation: string[],
  now: string,
): Finding {
  const fid = stableFindingId({
    source: TLS_VERSION,
    ruleId: `${id}@1`,
    target: job.target,
    file: null,
    lineStart: null,
    evidenceKind: id,
    evidenceSnippet: detail.slice(0, 160),
  });
  return {
    id: fid,
    title,
    category: 'tls',
    severity,
    confidence: 'high',
    verificationStatus: 'evidence-found',
    source: TLS_VERSION,
    ruleId: `${id}@1`,
    target: job.target,
    location: { file: null, lineStart: null, lineEnd: null },
    evidence: [{ kind: id, snippet: detail.slice(0, 300), detail }],
    impact,
    reproduction: ['Repetir el handshake TLS contra el host:puerto indicado.'],
    remediation,
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html'],
    firstSeen: now,
    lastSeen: now,
    status: 'open',
  };
}

export async function tlsEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const findings: Finding[] = [];
  const now = new Date().toISOString();

  let url: URL;
  try {
    url = new URL(job.target);
  } catch {
    skipped.push({ engine: 'tls-check', reason: 'objetivo no es URL' });
    return { engine: 'tls-check', version: TLS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  if (url.protocol !== 'https:') {
    skipped.push({ engine: 'tls-check', reason: 'objetivo no HTTPS' });
    return { engine: 'tls-check', version: TLS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const host = url.hostname;
  const port = url.port ? Number(url.port) : 443;

  let resolved;
  try {
    resolved = await resolveHost(host);
    assertScopeIps(resolved, { allowPrivate: job.allowPrivate });
  } catch (e) {
    errors.push({ engine: 'tls-check', message: e instanceof Error ? e.message : 'resolución fallida' });
    return { engine: 'tls-check', version: TLS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }

  const result = await new Promise<{
    authorized: boolean;
    authError: string;
    protocol: string;
    cipher: string;
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    hostnameOk: boolean;
    hostnameMsg: string;
  } | null>((resolve) => {
    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: 15000 },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const protocol = socket.getProtocol() ?? '?';
          const cipher = socket.getCipher()?.name ?? '?';
          const authorized = socket.authorized;
          const authError = socket.authorizationError?.toString() ?? '';
          let hostnameOk = true;
          let hostnameMsg = 'coincide';
          const hostErr = checkServerIdentity(host, cert);
          if (hostErr) {
            hostnameOk = false;
            hostnameMsg = hostErr.message;
          }
          resolve({
            authorized,
            authError,
            protocol,
            cipher,
            subject: cert?.subject ? JSON.stringify(cert.subject) : '?',
            issuer: cert?.issuer ? JSON.stringify(cert.issuer) : '?',
            validFrom: cert?.valid_from ?? '?',
            validTo: cert?.valid_to ?? '?',
            hostnameOk,
            hostnameMsg,
          });
        } catch (e) {
          void e;
          resolve(null);
        } finally {
          socket.destroy();
        }
      },
    );
    socket.setTimeout(15000);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
    socket.on('error', () => resolve(null));
  });

  if (!result) {
    errors.push({ engine: 'tls-check', message: `sin handshake TLS con ${host}:${port}` });
    return { engine: 'tls-check', version: TLS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }

  if (!result.authorized) {
    findings.push(mkFinding(job, 'tls-untrusted', `Certificado no confiable: ${result.authError || 'cadena inválida'}`,
      'high', `authorized=false (${result.authError}). Emisor: ${result.issuer}.`,
      'MITM trivial o certificado mal instalado; clientes estrictos rechazarán la conexión.',
      ['Instalar cadena completa de una CA pública; renovar si venció o el CN no coincide.'], now));
  }
  if (!result.hostnameOk) {
    findings.push(mkFinding(job, 'tls-hostname', `Certificado no válido para este host: ${result.hostnameMsg}`,
      'high', `Hostname: ${host}. Subject: ${result.subject}.`,
      'El certificado pertenece a otro nombre; posible despliegue incorrecto.',
      ['Emitir certificado con el SAN correcto.'], now));
  }
  const validTo = Date.parse(result.validTo);
  if (!Number.isNaN(validTo)) {
    const days = Math.ceil((validTo - Date.now()) / 86400000);
    if (days < 0) {
      findings.push(mkFinding(job, 'tls-expired', 'Certificado vencido', 'high',
        `Válido hasta: ${result.validTo}.`, 'Los clientes rechazan la conexión; el sitio queda inaccesible o inseguro.',
        ['Renovar de inmediato y automatizar la renovación.'], now));
    } else if (days < 30) {
      findings.push(mkFinding(job, 'tls-expiring', `Certificado por vencer en ${days} días`, 'low',
        `Válido hasta: ${result.validTo}. Emisor: ${result.issuer}.`,
        'Riesgo operativo de caída del servicio.',
        ['Renovar y automatizar (ACME/REL).'], now));
    }
  }
  if (result.protocol === 'TLSv1' || result.protocol === 'TLSv1.1' || result.protocol.startsWith('SSL')) {
    findings.push(mkFinding(job, 'tls-old-protocol', `Protocolo obsoleto negociado: ${result.protocol}`, 'high',
      `Protocolo: ${result.protocol}. Cipher: ${result.cipher}.`,
      'POODLE/BEAST y descifrado práctico en protocolos viejos.',
      ['Mínimo TLS 1.2; recomendado solo 1.2+1.3 con suites modernas.'], now));
  }
  return { engine: 'tls-check', version: TLS_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
