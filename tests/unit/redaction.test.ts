import { describe, expect, it } from 'vitest';
import { redact } from '../../electron/main/logging/logger';

describe('redacción de secretos en logs', () => {
  it('oculta valores en formato clave=valor y JSON', () => {
    expect(redact('password=supersecreto')).toBe('password=[REDACTED]');
    expect(redact('{"api_key": "AKIA-12345"}')).toBe('{"api_key": "[REDACTED]"}');
    expect(redact('token: abcdef123')).toBe('token: [REDACTED]');
  });

  it('oculta cabeceras Authorization', () => {
    const out = redact('authorization: Bearer eyJhbGciOiJIUzI1NiJ9');
    expect(out).toContain('Bearer [REDACTED]');
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('no altera texto sin secretos', () => {
    const msg = 'Auditoría iniciada para proyecto demo con perfil local-code';
    expect(redact(msg)).toBe(msg);
  });

  it('trunca mensajes gigantes', () => {
    const out = redact('x'.repeat(9000));
    expect(out.length).toBeLessThan(9000);
    expect(out).toContain('[truncado]');
  });
});
