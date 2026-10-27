import { describe, expect, it } from 'vitest';
import { assertNoRebinding, assertScopeIps, isSensitiveIp, resolveHost } from '../../engine/scope/network';
import { parseTarget } from '../../engine/server/ports';

describe('guardia de red', () => {
  it('marca IPs sensibles', () => {
    expect(isSensitiveIp('127.0.0.1')).toBe(true);
    expect(isSensitiveIp('10.1.2.3')).toBe(true);
    expect(isSensitiveIp('192.168.1.1')).toBe(true);
    expect(isSensitiveIp('172.16.0.5')).toBe(true);
    expect(isSensitiveIp('169.254.169.254')).toBe(true);
    expect(isSensitiveIp('::1')).toBe(true);
    expect(isSensitiveIp('8.8.8.8')).toBe(false);
  });

  it('bloquea alcance privado sin autorización', async () => {
    const r = await resolveHost('localhost');
    expect(r.ips.length).toBeGreaterThan(0);
    expect(() => assertScopeIps(r, { allowPrivate: false })).toThrow(/bloqueado/i);
    expect(assertScopeIps(r, { allowPrivate: true })).toEqual(r.ips);
  });

  it('detecta DNS rebinding', () => {
    expect(() => assertNoRebinding(['1.1.1.1'], ['1.1.1.1'], 'h')).not.toThrow();
    expect(() => assertNoRebinding(['1.1.1.1'], ['1.1.1.1', '2.2.2.2'], 'h')).toThrow(/rebinding/);
  });

  it('falla con host irresoluble', async () => {
    await expect(resolveHost('noexiste.invalid')).rejects.toThrow();
  });

  it('parseTarget acepta host, host:puerto y URL', () => {
    expect(parseTarget('srv-lan:2222')).toEqual({ host: 'srv-lan', port: 2222 });
    expect(parseTarget('srv-lan')).toEqual({ host: 'srv-lan', port: 22 });
    expect(parseTarget('http://127.0.0.1:32231/')).toEqual({ host: '127.0.0.1', port: 32231 });
    expect(() => parseTarget('http://mala_host!/')).toThrow();
  });
});
