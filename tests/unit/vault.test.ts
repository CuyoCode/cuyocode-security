import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Vault, type CipherStorage } from '../../electron/main/security/vault';

// Cifrado falso reversible solo para probar la lógica (DPAPI real vive en
// Electron y se verifica en smoke, no aquí).
const fakeStorage: CipherStorage = {
  isAvailable: true,
  encryptString: (plain: string) => Buffer.from(`enc:${plain}`, 'utf8'),
  decryptString: (buf: Buffer) => {
    const s = buf.toString('utf8');
    if (!s.startsWith('enc:')) throw new Error('corrupto');
    return s.slice(4);
  },
};

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cuyosec-vault-'));
}

describe('bóveda cifrada', () => {
  it('roundtrip sin texto plano en disco', () => {
    const dir = tempDir();
    const vault = new Vault(dir, fakeStorage);
    vault.set('ai-external-key', 'sk-secreta-123');
    const raw = fs.readFileSync(path.join(dir, 'vault.json'), 'utf8');
    expect(raw).not.toContain('sk-secreta-123');
    expect(vault.get('ai-external-key')).toBe('sk-secreta-123');
    expect(vault.has('ai-external-key')).toBe(true);
    vault.delete('ai-external-key');
    expect(vault.get('ai-external-key')).toBeNull();
  });

  it('rechaza claves y valores inválidos', () => {
    const vault = new Vault(tempDir(), fakeStorage);
    expect(() => vault.set('../evil', 'x')).toThrow();
    expect(() => vault.set('k', '')).toThrow();
    expect(() => vault.set('k', 'x'.repeat(5000))).toThrow();
  });

  it('archivo corrupto equivale a bóveda vacía', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'vault.json'), 'no-json{{{', 'utf8');
    const vault = new Vault(dir, fakeStorage);
    expect(vault.get('cualquiera')).toBeNull();
  });

  it('sin cifrado disponible no guarda', () => {
    const vault = new Vault(tempDir(), {
      isAvailable: false,
      encryptString: () => Buffer.alloc(0),
      decryptString: () => '',
    });
    expect(vault.available).toBe(false);
    expect(() => vault.set('k', 'v')).toThrow(/cifrado/i);
  });
});
