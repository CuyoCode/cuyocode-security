// Fetch con guardia de alcance: resuelve y fija IPs, bloquea destinos
// sensibles, controla redirecciones manualmente y detecta DNS rebinding.
// Todo lo que sale del equipo pasa por aquí (motores web y API).

import { assertNoRebinding, assertScopeIps, isSensitiveIp, resolveHost } from '../scope/network';

export interface GuardOptions {
  allowPrivate: boolean;
  maxRedirects: number;
  timeoutMs: number;
  maxBodyBytes: number;
  /** Hostnames adicionales aprobados para redirección (vacío = solo el mismo host). */
  extraHosts?: string[];
}

export interface GuardResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  /** Cookies sin combinar (getSetCookie); el header puede perder valores. */
  setCookies: string[];
  body: string;
  redirects: string[];
  resolvedIps: string[];
}

function isIpLiteral(host: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':');
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0));
  const bytes = new Uint8Array(buf).slice(0, maxBytes);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function headersToRecord(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}

export async function guardedFetch(startUrl: string, options: GuardOptions, signal?: AbortSignal): Promise<GuardResponse> {
  let current = startUrl;
  const redirects: string[] = [];
  let pinnedIps: string[] | null = null;

  for (let hop = 0; hop <= options.maxRedirects; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Esquema no permitido: ${parsed.protocol}`);
    }
    const host = parsed.hostname.toLowerCase();
    if (isIpLiteral(host) && isSensitiveIp(host) && !options.allowPrivate) {
      throw new Error(`Destino bloqueado por alcance: ${host}`);
    }
    const resolved = await resolveHost(host);
    assertScopeIps(resolved, { allowPrivate: options.allowPrivate });
    if (pinnedIps) {
      assertNoRebinding(pinnedIps, resolved.ips, host);
    } else {
      pinnedIps = resolved.ips;
    }
    if (hop > 0) {
      const original = new URL(startUrl).hostname.toLowerCase();
      const allowed = new Set([original, ...(options.extraHosts ?? []).map((h) => h.toLowerCase())]);
      if (!allowed.has(host)) {
        throw new Error(`Redirección fuera del alcance aprobado: ${host}`);
      }
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error('timeout')), options.timeoutMs);
    timer.unref?.();
    const onAbort = (): void => ctrl.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw signal.reason instanceof Error ? signal.reason : new Error('cancelado');
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    let res: Response;
    try {
      res = await fetch(current, { redirect: 'manual', signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      await res.arrayBuffer().catch(() => new ArrayBuffer(0));
      if (!loc) throw new Error(`Redirección ${res.status} sin Location`);
      redirects.push(current);
      current = new URL(loc, current).toString();
      if (hop === options.maxRedirects) throw new Error('Demasiadas redirecciones');
      continue;
    }

    const after = await resolveHost(host);
    assertNoRebinding(pinnedIps ?? [], after.ips, host);
    const hdrs = res.headers as Headers & { getSetCookie?: () => string[] };
    let setCookies: string[] = [];
    try {
      setCookies = typeof hdrs.getSetCookie === 'function' ? hdrs.getSetCookie() : [];
    } catch {
      setCookies = [];
    }
    return {
      url: current,
      status: res.status,
      headers: headersToRecord(res),
      setCookies,
      body: await readCapped(res, options.maxBodyBytes),
      redirects,
      resolvedIps: pinnedIps ?? [],
    };
  }
  throw new Error('Demasiadas redirecciones');
}
