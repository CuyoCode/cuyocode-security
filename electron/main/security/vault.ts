// Bóveda local cifrada con el almacén del SO (DPAPI en Windows vía
// safeStorage de Electron). Los secretos en reposo jamás quedan en texto
// plano. El almacenamiento es inyectable para poder testear la lógica sin
// runtime de Electron.

import fs from 'node:fs';
import path from 'node:path';

export interface CipherStorage {
  isAvailable: boolean;
  encryptString(plain: string): Buffer;
  decryptString(buf: Buffer): string;
}

export function electronStorage(): CipherStorage {
  // require diferido: este módulo también se importa en tests sin Electron.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { safeStorage } = require('electron') as typeof import('electron');
  return {
    isAvailable: safeStorage.isEncryptionAvailable(),
    encryptString: (plain: string) => safeStorage.encryptString(plain),
    decryptString: (buf: Buffer) => safeStorage.decryptString(buf),
  };
}

export class Vault {
  private file: string;
  private storage: CipherStorage;

  constructor(dataDir: string, storage: CipherStorage) {
    this.file = path.join(dataDir, 'vault.json');
    this.storage = storage;
  }

  private quarantineCorrupt(): void {
    const dest = `${this.file}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(this.file, dest);
    } catch {
      try {
        fs.copyFileSync(this.file, dest);
      } catch {
        /* último recurso: no hay backup disponible */
      }
    }
  }

  private readAll(): Record<string, string> {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const data = JSON.parse(raw) as unknown;
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          if (typeof k === 'string' && typeof v === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(k)) {
            out[k] = v;
          }
        }
        return out;
      }
      this.quarantineCorrupt();
      return {};
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') this.quarantineCorrupt();
      return {};
    }
  }

  private writeAll(data: Record<string, string>): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  get available(): boolean {
    return this.storage.isAvailable;
  }

  set(key: string, value: string): void {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(key)) throw new Error('Clave de bóveda inválida');
    if (typeof value !== 'string' || value.length === 0 || value.length > 4096) {
      throw new Error('Valor de bóveda inválido');
    }
    if (!this.storage.isAvailable) throw new Error('Cifrado del SO no disponible');
    const all = this.readAll();
    all[key] = this.storage.encryptString(value).toString('base64');
    this.writeAll(all);
  }

  get(key: string): string | null {
    const raw = this.readAll()[key];
    if (!raw) return null;
    try {
      return this.storage.decryptString(Buffer.from(raw, 'base64'));
    } catch {
      return null;
    }
  }

  delete(key: string): void {
    const all = this.readAll();
    delete all[key];
    this.writeAll(all);
  }

  has(key: string): boolean {
    return this.readAll()[key] !== undefined;
  }
}
