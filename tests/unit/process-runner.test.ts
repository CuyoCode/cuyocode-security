import { describe, expect, it } from 'vitest';
import { assertSafeArgs, runTool } from '../../engine/process/runner';
import { ALLOWED_OPS } from '../../engine/server/ssh';

describe('ejecutor de procesos', () => {
  it('rechaza NUL y saltos de línea, pero admite metacaracteres con shell:false', () => {
    expect(() => assertSafeArgs(['a\nb'])).toThrow();
    expect(() => assertSafeArgs(['a\0b'])).toThrow();
    expect(() => assertSafeArgs(['a;b'])).not.toThrow();
    expect(() => assertSafeArgs(['https://x/?a=1&b=2'])).not.toThrow();
    expect(() => assertSafeArgs(['ok', '--flag=1'])).not.toThrow();
  });

  it('todas las operaciones SSH permitidas pasan la validación de argv', () => {
    for (const [id, def] of Object.entries(ALLOWED_OPS)) {
      expect(() => assertSafeArgs([def.command]), id).not.toThrow();
    }
  });

  it('ejecuta y captura salida', async () => {
    const r = await runTool('node', { args: ['-e', 'console.log("hola")'], timeoutMs: 15000, maxOutputBytes: 1024 });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('hola');
    expect(r.timedOut).toBe(false);
  });

  it('aplica timeout y termina', async () => {
    const r = await runTool('node', {
      args: ['-e', 'setTimeout(()=>{}, 30000)'],
      timeoutMs: 800,
      maxOutputBytes: 1024,
    });
    expect(r.timedOut).toBe(true);
  }, 15000);

  it('binario inexistente no rompe', async () => {
    const r = await runTool('noexiste-bin-xyz', { args: [], timeoutMs: 5000, maxOutputBytes: 1024 });
    expect(r.exitCode).toBeNull();
  });
});
