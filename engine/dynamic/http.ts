// Comprobaciones HTTP pasivas: cabeceras, redirección a HTTPS, divulgación,
// rutas sensibles conocidas. Solo GET no mutantes, con presupuesto de requests.

import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { redactCode } from '../finding/redact';
import { guardedFetch, type GuardResponse } from './fetch-guard';

export const HTTP_VERSION = 'cuyocode-http/1.0';

const SENSITIVE_PATHS = [
  '/.env',
  '/.git/HEAD',
  '/server-status',
  '/actuator/health',
  '/api/docs',
  '/swagger.json',
  '/openapi.json',
  '/phpinfo.php',
  '/.well-known/security.txt',
];

interface Check {
  id: string;
  title: string;
  category: string;
  severity: Finding['severity'];
  confidence: Finding['confidence'];
  verification: Finding['verificationStatus'];
  impact: string;
  remediation: string[];
  references: string[];
}

function mkFinding(
  job: EngineJob,
  check: Check,
  evidence: { kind: string; snippet: string; detail: string },
  now: string,
): Finding {
  const id = stableFindingId({
    source: HTTP_VERSION,
    ruleId: `${check.id}@1`,
    target: job.target,
    file: null,
    lineStart: null,
    evidenceKind: check.id,
    evidenceSnippet: evidence.snippet.slice(0, 160),
  });
  return {
    id,
    title: check.title,
    category: check.category,
    severity: check.severity,
    confidence: check.confidence,
    verificationStatus: check.verification,
    source: HTTP_VERSION,
    ruleId: `${check.id}@1`,
    target: job.target,
    location: { file: null, lineStart: null, lineEnd: null },
    evidence: [evidence],
    impact: check.impact,
    reproduction: ['Repetir la petición GET indicada e inspeccionar la respuesta.'],
    remediation: check.remediation,
    references: check.references,
    firstSeen: now,
    lastSeen: now,
    status: 'open',
  };
}

export async function httpEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const findings: Finding[] = [];
  const now = new Date().toISOString();
  const maxRequests = job.limits.maxRequests ?? 60;
  let used = 0;

  const get = async (url: string): Promise<GuardResponse | null> => {
    if (used >= maxRequests) return null;
    used += 1;
    try {
      return await guardedFetch(
        url,
        { allowPrivate: job.allowPrivate, maxRedirects: job.limits.maxRedirects ?? 3, timeoutMs: 20000, maxBodyBytes: 512 * 1024 },
        job.signal,
      );
    } catch (e) {
      errors.push({ engine: 'http-passive', message: `${url}: ${e instanceof Error ? e.message : '?'}` });
      return null;
    }
  };

  const base = await get(job.target.endsWith('/') ? job.target : `${job.target}/`);
  if (!base) {
    errors.push({ engine: 'http-passive', message: 'sin respuesta del objetivo base' });
    return { engine: 'http-passive', version: HTTP_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const h = base.headers;
  const isHttps = base.url.startsWith('https://');

  const headerCheck = (
    id: string,
    title: string,
    missing: boolean,
    check: Omit<Check, 'id' | 'title'>,
    detail: string,
  ): void => {
    if (missing) {
      findings.push(mkFinding(job, { id, title, ...check }, { kind: id, snippet: `${base.status} ${base.url}`, detail }, now));
    }
  };

  headerCheck('http-hsts', 'HSTS ausente en HTTPS', isHttps && !h['strict-transport-security'], {
    category: 'http-headers',
    severity: 'medium',
    confidence: 'high',
    verification: 'evidence-found',
    impact: 'Sin HSTS, la primera visita o redes hostiles pueden degradar a HTTP.',
    remediation: ['Strict-Transport-Security: max-age=31536000; includeSubDomains (y preload si aplica).'],
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html'],
  }, `Respuesta ${base.status} sin Strict-Transport-Security en ${base.url}.`);

  if (!isHttps && new URL(job.target).protocol === 'http:') {
    findings.push(mkFinding(job, {
      id: 'http-no-tls',
      title: 'Sitio servido por HTTP sin redirección visible a HTTPS',
      category: 'crypto',
      severity: 'medium',
      confidence: 'medium',
      verification: 'evidence-found',
      impact: 'Tráfico legible y modificable en red.',
      remediation: ['Redirigir todo HTTP a HTTPS con 301 y habilitar HSTS.'],
      references: ['https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html'],
    }, { kind: 'http-no-tls', snippet: base.url, detail: `URL final tras redirecciones: ${base.url} (estado ${base.status}).` }, now));
  }

  headerCheck('http-xcto', 'X-Content-Type-Options ausente', !h['x-content-type-options'], {
    category: 'http-headers',
    severity: 'low',
    confidence: 'high',
    verification: 'evidence-found',
    impact: 'Navegadores antiguos podrían adivinar (sniff) el tipo de contenido.',
    remediation: ['X-Content-Type-Options: nosniff.'],
    references: ['https://owasp.org/www-project-secure-headers/'],
  }, `Respuesta ${base.status} sin X-Content-Type-Options.`);

  const framing = h['x-frame-options'] ?? h['content-security-policy'];
  headerCheck('http-framing', 'Sin política anti-framing (X-Frame-Options/CSP frame-ancestors)', !framing, {
    category: 'http-headers',
    severity: 'low',
    confidence: 'medium',
    verification: 'evidence-found',
    impact: 'La página podría ser embebida para clickjacking según su funcionalidad. No toda página lo requiere.',
    remediation: ['X-Frame-Options: DENY/SAMEORIGIN o CSP frame-ancestors según necesidad.'],
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html'],
  }, 'Sin X-Frame-Options ni Content-Security-Policy en la respuesta base.');

  if (!h['content-security-policy']) {
    findings.push(mkFinding(job, {
      id: 'http-csp',
      title: 'Sin Content-Security-Policy',
      category: 'http-headers',
      severity: 'info',
      confidence: 'high',
      verification: 'evidence-found',
      impact: 'CSP mitiga XSS; su ausencia no es vulnerabilidad por sí misma.',
      remediation: ['Definir CSP restrictiva acorde a los recursos que la app necesita.'],
      references: ['https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html'],
    }, { kind: 'http-csp', snippet: `${base.status} ${base.url}`, detail: 'Respuesta base sin Content-Security-Policy.' }, now));
  }

  const server = h['server'] ?? h['x-powered-by'];
  if (server) {
    findings.push(mkFinding(job, {
      id: 'http-disclose',
      title: `Divulgación de tecnología: ${server.slice(0, 80)}`,
      category: 'information-disclosure',
      severity: 'info',
      confidence: 'high',
      verification: 'evidence-found',
      impact: 'Facilita fingerprinting; no es vulnerabilidad por sí misma.',
      remediation: ['Minimizar banners (Server, X-Powered-By) si no aportan valor.'],
      references: ['https://owasp.org/www-project-secure-headers/'],
    }, { kind: 'http-disclose', snippet: server.slice(0, 160), detail: `Cabecera Server/X-Powered-By: ${server.slice(0, 160)}` }, now));
  }

  // Stack traces ante 404.
  const probe = await get(`${base.url.replace(/\/$/, '')}/cuyosec-noexiste-${Date.now().toString(36)}`);
  if (probe && /stack trace|traceback|at [a-zA-Z_$][\w$]* \(|NullPointerException|ORA-|SQL syntax/i.test(probe.body)) {
    findings.push(mkFinding(job, {
      id: 'http-stacktrace',
      title: 'Posible stack trace expuesto en errores 404',
      category: 'information-disclosure',
      severity: 'medium',
      confidence: 'medium',
      verification: 'evidence-found',
      impact: 'Rutas internas, versiones y lógica expuestas facilitan ataques dirigidos.',
      remediation: ['Páginas de error genéricas; log detallado solo en servidor.'],
      references: ['https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html'],
    }, { kind: 'http-stacktrace', snippet: redactCode(probe.body.slice(0, 200)), detail: `Estado ${probe.status} con trazas en el cuerpo.` }, now));
  }

  // Rutas sensibles conocidas (una petición GET cada una, dentro del presupuesto).
  for (const p of SENSITIVE_PATHS) {
    if (job.signal.aborted || used >= maxRequests) break;
    const r = await get(`${base.url.replace(/\/$/, '')}${p}`);
    if (!r) continue;
    if (r.status === 200 && r.body.length > 0 && !/not found|no encontrado|404/i.test(r.body.slice(0, 200))) {
      findings.push(mkFinding(job, {
        id: 'http-sensitive-path',
        title: `Ruta sensible accesible: ${p} (${r.status})`,
        category: 'information-disclosure',
        severity: p === '/.env' || p === '/.git/HEAD' ? 'high' : 'medium',
        confidence: 'medium',
        verification: 'evidence-found',
        impact: 'Archivos de configuración, documentación o metadatos expuestos.',
        remediation: ['Bloquear la ruta en el reverse proxy/app; verificar qué contenido se expone.'],
        references: [],
      }, { kind: 'http-sensitive-path', snippet: `${r.status} ${p}`, detail: `GET ${p} → ${r.status} (${r.body.length} bytes). Contenido no incluido.` }, now));
    }
  }

  return { engine: 'http-passive', version: HTTP_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
