import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot } from '../../engine/paths';
import {
  createNodeLab,
  stopNodeLab,
  listNodeLabs,
  validateNodeLabId,
  validateNodeLabPort,
} from '../../engine/lab/node-manager';
import { assertNodeLabIsolation } from '../../engine/lab/verify';

const PORT = 32123;

describe('laboratorio node (sin Docker)', () => {
  it('valida identificadores y puertos', () => {
    expect(() => validateNodeLabId('lab-01')).toThrow(/node-/);
    expect(() => validateNodeLabId('node-OK!')).toThrow();
    expect(validateNodeLabId('node-01')).toBe('node-01');
    expect(() => validateNodeLabPort(80)).toThrow(/rango/);
    expect(validateNodeLabPort(3101)).toBe(3101);
  });

  it('el target rechaza puerto privilegiado', async () => {
    const { runTool } = await import('../../engine/process/runner');
    const script = path.join(findRepoRoot(), 'engine', 'lab', 'targets', 'node-vuln-app.cjs');
    const r = await runTool(process.execPath, {
      args: [script, '80'],
      timeoutMs: 10000,
      maxOutputBytes: 1024,
    });
    expect(r.exitCode).toBe(2);
  });

  it('ciclo de vida + vulnerabilidades demo sintéticas', async () => {
    const lab = await createNodeLab('node-test-01', PORT);
    expect(lab.target).toBe(`http://127.0.0.1:${PORT}/`);
    try {
      expect(listNodeLabs().some((l) => l.id === 'node-test-01')).toBe(true);
      // IDOR sintético sin auth.
      const u = await fetch(`http://127.0.0.1:${PORT}/api/users/2`).then((r) => r.json());
      expect(u).toEqual({ id: '2', name: 'Bob', email: 'bob@example.test', role: 'user' });
      // XSS reflejado.
      const g = await fetch(`http://127.0.0.1:${PORT}/greet?name=%3Cscript%3E`).then((r) => r.text());
      expect(g).toContain('<script>');
      // Login débil demo.
      const login = await fetch(`http://127.0.0.1:${PORT}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user: 'admin', pass: 'admin' }),
      });
      expect(login.status).toBe(200);
      // Puerta: objetivo correcto pasa, ajeno bloquea.
      const ok = await assertNodeLabIsolation('node-test-01', lab.target);
      expect(ok.ok).toBe(true);
      const bad = await assertNodeLabIsolation('node-test-01', 'http://127.0.0.1:9999/');
      expect(bad.ok).toBe(false);
      const ext = await assertNodeLabIsolation('node-test-01', 'http://example.com/');
      expect(ext.ok).toBe(false);
      const ghost = await assertNodeLabIsolation('node-fantasma', lab.target);
      expect(ghost.ok).toBe(false);
    } finally {
      expect(await stopNodeLab('node-test-01')).toBe(true);
    }
    await expect(fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.text())).rejects.toThrow();
  }, 60000);
});
