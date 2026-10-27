// Redacción de secretos — canónica para logs, evidencias, vistas e informes.
// Regla: jamás persiste ni sale del equipo un secreto completo.

export const MAX_MSG = 4096;

const SECRET_PATTERNS: RegExp[] = [
  // key=value, key: value, "key": "value" — conserva la clave, oculta el valor.
  /((?:password|passwd|pwd|secret|token|api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|session[_-]?id)["']?[^\S\r\n]*[:=][^\S\r\n]*["']?)([^"'\s,}]+)(["']?)/gi,
  // Authorization: Bearer xxx / Basic xxx
  /((?:authorization|proxy-authorization)[^\S\r\n]*:[^\S\r\n]*(?:bearer|basic)[^\S\r\n]+)(\S+)/gi,
  // Bloques PEM accidentales.
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]{0,200}?/g,
];

/** Redacta secretos de un texto libre y lo trunca a un tamaño seguro. */
export function redact(input: string): string {
  let out = input.length > MAX_MSG ? input.slice(0, MAX_MSG) + '…[truncado]' : input;
  for (const rx of SECRET_PATTERNS) {
    rx.lastIndex = 0;
    out = out.replace(rx, (_m, head: string, _secret: string, tail: string) =>
      tail === undefined ? `${head}[REDACTED]` : `${head}[REDACTED]${tail}`,
    );
  }
  return out;
}

/**
 * Huella estable de un posible secreto para comparar hallazgos entre corridas
 * sin conservar su valor. No reversible.
 */
export function secretFingerprint(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = `cuyosec|${value.length}|${value}`;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 + c, 31);
  }
  return `fp${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * Redacción para fragmentos de código/respuestas: además de redact(),
 * enmascara formas conocidas de tokens, credenciales en URIs y literales
 * entrecomillados de alta entropía. Para evidencias, nunca código crudo.
 */
export function redactCode(input: string): string {
  let out = redact(input);
  out = out.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED-AKIA]');
  out = out.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED-GITHUB]');
  out = out.replace(/\b(APP_USR|TEST)-[A-Za-z0-9_-]{16,}\b/g, '[REDACTED-TOKEN]');
  out = out.replace(/\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/g, '[REDACTED-KEY]');
  out = out.replace(/(\bmongodb(?:\+srv)?:\/\/)[^/\s@]+@/gi, '$1〈redacted〉@');
  out = out.replace(/(\bpostgres(?:ql)?:\/\/)[^/\s@]+@/gi, '$1〈redacted〉@');
  out = out.replace(/(["'])((?:(?!\1)[^\r\n]){12,200})\1/g, (m, quote: string, inner: string) => {
    if (shannonEntropy(inner) >= 3.2) return `${quote}〈${inner.length} caracteres redactados〉${quote}`;
    return m;
  });
  return out;
}
