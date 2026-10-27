// Guardia de red: resuelve el objetivo, fija sus IPs y bloquea destinos
// no autorizados (loopback, link-local, metadata cloud, redes privadas salvo
// autorización explícita). Detecta cambios DNS entre resoluciones (rebinding).

import dns from 'node:dns';

export interface ResolvedTarget {
  host: string;
  ips: string[];
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

/** IPs que nunca son objetivo válido sin autorización de laboratorio. */
export function isSensitiveIp(ip: string): boolean {
  const low = ip.toLowerCase();
  if (low === 'localhost') return true;
  if (low === '::1' || low === '::ffff:127.0.0.1') return true;
  if (low.startsWith('fe80:') || low.startsWith('fc00:') || low.startsWith('fd00:')) return true;
  // Metadata cloud (AWS/GCP/Azure).
  if (ip === '169.254.169.254') return true;
  if (inCidr(ip, '127.0.0.0', 8)) return true;
  if (inCidr(ip, '10.0.0.0', 8)) return true;
  if (inCidr(ip, '172.16.0.0', 12)) return true;
  if (inCidr(ip, '192.168.0.0', 16)) return true;
  if (inCidr(ip, '169.254.0.0', 16)) return true;
  if (inCidr(ip, '0.0.0.0', 8)) return true;
  return false;
}

export async function resolveHost(host: string): Promise<ResolvedTarget> {
  let records: string[];
  try {
    records = await dns.promises.lookup(host, { all: true }).then((r) => r.map((x) => x.address));
  } catch {
    throw new Error(`No se pudo resolver "${host}"`);
  }
  if (records.length === 0) throw new Error(`"${host}" no resolvió a ninguna dirección`);
  return { host, ips: [...new Set(records)] };
}

/**
 * Valida el objetivo resuelto contra el alcance aprobado.
 * allowPrivate: solo para laboratorio aislado o red local expresamente autorizada.
 */
export function assertScopeIps(resolved: ResolvedTarget, options: { allowPrivate: boolean }): string[] {
  if (!options.allowPrivate) {
    const bad = resolved.ips.filter(isSensitiveIp);
    if (bad.length > 0) {
      throw new Error(
        `Alcance bloqueado: "${resolved.host}" resuelve a ${bad.join(', ')} (red privada/local). ` +
          `Solo laboratorio aislado puede autorizarlo.`,
      );
    }
  }
  return resolved.ips;
}

/** Compara dos resoluciones y falla si aparecieron IPs nuevas (posible rebinding). */
export function assertNoRebinding(before: string[], after: string[], host: string): void {
  const known = new Set(before);
  const fresh = after.filter((ip) => !known.has(ip));
  if (fresh.length > 0) {
    throw new Error(`DNS rebinding en "${host}": nuevas IPs ${fresh.join(', ')}. Auditoría detenida.`);
  }
}
