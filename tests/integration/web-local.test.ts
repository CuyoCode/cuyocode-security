import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookiesEngine } from '../../engine/dynamic/cookies';
import { httpEngine } from '../../engine/dynamic/http';
import { guardedFetch } from '../../engine/dynamic/fetch-guard';
import type { EngineJob } from '../../engine/orchestrator/types';
import { loadProfile } from '../../engine/orchestrator/runner';

let base = '';
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/redirect-out') {
      res.writeHead(302, { location: 'http://127.0.0.1:9/' });
      res.end();
      return;
    }
    if (req.url === '/.env') {
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('MONGODB_URI=mongodb://u:p@localhost:27017/db');
      return;
    }
    if (req.url !== '/') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.setHeader('Server', 'fixture/1.0');
    res.setHeader('Set-Cookie', [
      'sessid=abc123; Path=/',
      'theme=dark; Path=/; SameSite=Lax',
    ]);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<html><body>ok</body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function job(target: string): EngineJob {
  return {
    auditId: 'test',
    target,
    kind: 'url',
    profile: loadProfile('web-passive'),
    limits: { timeoutMs: 60000, maxRequests: 60, maxRedirects: 3 },
    signal: new AbortController().signal,
    allowPrivate: true,
    aiMode: 'off',
    report: () => undefined,
  };
}

describe('auditoría web contra servidor local', () => {
  it('http pasivo reporta HTTP sin TLS, divulgación y .env expuesto', async () => {
    const r = await httpEngine(job(base));
    const ids = new Set(r.findings.map((f) => f.ruleId.split('@')[0]));
    expect(ids.has('http-no-tls')).toBe(true);
    expect(ids.has('http-disclose')).toBe(true);
    expect(ids.has('http-csp')).toBe(true);
    expect(ids.has('http-xcto')).toBe(true);
    const env = r.findings.find((f) => f.evidence[0]?.snippet.includes('/.env'));
    expect(env?.severity).toBe('high');
  });

  it('cookies distingue sesión sin flags (sin exigir Secure en HTTP)', async () => {
    const r = await cookiesEngine(job(base));
    const sess = r.findings.find((f) => f.title.includes('sessid'));
    expect(sess).toBeDefined();
    expect(sess?.title).toContain('HttpOnly');
    expect(sess?.title).toContain('SameSite');
    expect(sess?.title).not.toContain('Secure');
    expect(sess?.severity).toBe('low');
  });

  it('la guardia bloquea redirección a puerto sensible sin allowPrivate', async () => {
    const j = job(`${base}/redirect-out`);
    j.allowPrivate = false;
    await expect(
      guardedFetch(`${base}/redirect-out`, { allowPrivate: false, maxRedirects: 3, timeoutMs: 10000, maxBodyBytes: 1024 }, j.signal),
    ).rejects.toThrow();
  });

  it('la guardia bloquea metadata cloud sin red', async () => {
    await expect(
      guardedFetch('http://169.254.169.254/', { allowPrivate: false, maxRedirects: 0, timeoutMs: 5000, maxBodyBytes: 1024 }),
    ).rejects.toThrow(/bloqueado|resuelve/i);
  });
});
