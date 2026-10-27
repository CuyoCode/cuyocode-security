// Revisión de cookies: flags por tipo. Distingue sesión/autenticación de
// funcionales; nunca declara crítico solo por falta de HttpOnly.

import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { guardedFetch } from './fetch-guard';

export const COOKIES_VERSION = 'cuyocode-cookies/1.0';

interface Cookie {
  name: string;
  value: string;
  attrs: Record<string, string | true>;
}

function parseSetCookie(header: string): Cookie | null {
  const parts = header.split(';').map((p) => p.trim());
  const first = parts[0];
  if (!first) return null;
  const eq = first.indexOf('=');
  if (eq <= 0) return null;
  const attrs: Record<string, string | true> = {};
  for (const p of parts.slice(1)) {
    const i = p.indexOf('=');
    if (i < 0) attrs[p.toLowerCase()] = true;
    else attrs[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
  }
  return { name: first.slice(0, eq), value: first.slice(eq + 1), attrs };
}

function cookieKind(name: string): 'session' | 'auth' | 'functional' {
  const n = name.toLowerCase();
  if (/sess|sid|phpsessid|jsessionid|session/.test(n)) return 'session';
  if (/auth|token|jwt|login|remember|user/.test(n)) return 'auth';
  return 'functional';
}

export async function cookiesEngine(job: EngineJob): Promise<EngineResult> {
  const started = Date.now();
  const errors: EngineResult['errors'] = [];
  const skipped: EngineResult['skipped'] = [];
  const findings: Finding[] = [];
  const now = new Date().toISOString();

  let res;
  try {
    res = await guardedFetch(
      job.target.endsWith('/') ? job.target : `${job.target}/`,
      { allowPrivate: job.allowPrivate, maxRedirects: job.limits.maxRedirects ?? 3, timeoutMs: 20000, maxBodyBytes: 256 * 1024 },
      job.signal,
    );
  } catch (e) {
    errors.push({ engine: 'cookies-review', message: e instanceof Error ? e.message : 'sin respuesta' });
    return { engine: 'cookies-review', version: COOKIES_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }

  const raw = res.setCookies.length > 0 ? res.setCookies : [];
  const combined = res.headers['set-cookie'];
  const chunks = raw.length > 0
    ? raw
    : (combined ? combined.split(/,(?=[^;,=\s]+=)/).map((s) => s.trim()).filter(Boolean) : []);
  if (chunks.length === 0) {
    skipped.push({ engine: 'cookies-review', reason: 'el objetivo no emitió cookies' });
    return { engine: 'cookies-review', version: COOKIES_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
  }
  const seen = new Map<string, number>();
  for (const c of chunks) {
    const ck = parseSetCookie(c);
    if (!ck) continue;
    seen.set(ck.name, (seen.get(ck.name) ?? 0) + 1);
    const kind = cookieKind(ck.name);
    const isHttps = res.url.startsWith('https://');
    const missing: string[] = [];
    if (isHttps && !ck.attrs['secure']) missing.push('Secure');
    if ((kind === 'session' || kind === 'auth') && !ck.attrs['httponly']) missing.push('HttpOnly');
    if (!ck.attrs['samesite']) missing.push('SameSite');
    if (missing.length === 0) continue;
    const severity: Finding['severity'] =
      kind === 'functional' ? 'info' : missing.includes('Secure') && isHttps ? 'medium' : 'low';
    const id = stableFindingId({
      source: COOKIES_VERSION,
      ruleId: 'cookie-flags@1',
      target: job.target,
      file: null,
      lineStart: null,
      evidenceKind: 'cookie',
      evidenceSnippet: `${ck.name}:${missing.join(',')}`,
    });
    findings.push({
      id,
      title: `Cookie ${kind} "${ck.name}" sin ${missing.join(', ')}`,
      category: 'cookies',
      severity,
      confidence: 'high',
      verificationStatus: 'evidence-found',
      source: COOKIES_VERSION,
      ruleId: 'cookie-flags@1',
      target: job.target,
      location: { file: null, lineStart: null, lineEnd: null },
      evidence: [{
        kind: 'cookie',
        snippet: `${ck.name}=<valor omitido>; ${Object.keys(ck.attrs).join('; ') || '(sin atributos)'}`,
        detail: `Cookie de tipo ${kind}. Atributos presentes: ${Object.keys(ck.attrs).join(', ') || 'ninguno'}. Faltan: ${missing.join(', ')}.`,
      }],
      impact: kind === 'functional'
        ? 'Bajo: cookie funcional; los flags suman defensa en profundidad.'
        : 'Sesión/autenticación expuesta a robo vía XSS (sin HttpOnly) o envío por HTTP (sin Secure).',
      reproduction: ['Repetir GET y leer la cabecera Set-Cookie.'],
      remediation: ['Secure + HttpOnly + SameSite=Lax/Strict en cookies de sesión; Domain/Path mínimos; expiración acotada.'],
      references: ['https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html'],
      firstSeen: now,
      lastSeen: now,
      status: 'open',
    });
  }
  for (const [name, count] of seen) {
    if (count > 1) {
      const id = stableFindingId({
        source: COOKIES_VERSION, ruleId: 'cookie-conflict@1', target: job.target,
        file: null, lineStart: null, evidenceKind: 'cookie-conflict', evidenceSnippet: name,
      });
      findings.push({
        id,
        title: `Cookie duplicada "${name}" (${count} emisiones)`,
        category: 'cookies',
        severity: 'info',
        confidence: 'medium',
        verificationStatus: 'evidence-found',
        source: COOKIES_VERSION,
        ruleId: 'cookie-conflict@1',
        target: job.target,
        location: { file: null, lineStart: null, lineEnd: null },
        evidence: [{ kind: 'cookie-conflict', snippet: name, detail: `La cookie "${name}" se emitió ${count} veces (posible conflicto de Path/Domain).` }],
        impact: 'Comportamiento de sesión ambiguo.',
        reproduction: ['Inspeccionar las cabeceras Set-Cookie completas.'],
        remediation: ['Unificar Path/Domain de la cookie de sesión.'],
        references: [],
        firstSeen: now,
        lastSeen: now,
        status: 'open',
      });
    }
  }
  return { engine: 'cookies-review', version: COOKIES_VERSION, findings, errors, skipped, durationMs: Date.now() - started };
}
