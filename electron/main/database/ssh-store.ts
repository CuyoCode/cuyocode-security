// Perfiles SSH persistidos (sin secretos: solo ruta de clave y known_hosts
// dedicado). La clave privada nunca se guarda en la base.

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './connection';
import { SSH_OPS_VERSION, profileDir, type SshProfile } from '../../../engine/server/ssh';
import { ValidationError, cleanText, validateId } from '../ipc/validation';
import type { SshProfileDto, SshProfileInput } from '../../../shared/ipc-contracts/ai-lab-ssh.contracts';

function validateProfileInput(input: unknown, dataDir: string): SshProfileInput & { knownHostsPath: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ValidationError('INVALID_SHAPE', 'Perfil SSH inválido');
  }
  const o = input as Record<string, unknown>;
  const name = cleanText(o['name'], 80, 'Nombre');
  const hostRaw = cleanText(o['host'], 255, 'Host');
  if (!/^[A-Za-z0-9.-]{1,255}$/.test(hostRaw)) throw new ValidationError('BAD_HOST', 'Host inválido');
  const port = typeof o['port'] === 'number' ? o['port'] : Number(o['port']);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ValidationError('BAD_PORT', 'Puerto inválido');
  const user = cleanText(o['user'], 64, 'Usuario');
  if (!/^[A-Za-z0-9._-]+$/.test(user)) throw new ValidationError('BAD_USER', 'Usuario inválido');
  const keyPath = typeof o['keyPath'] === 'string' ? o['keyPath'].trim().slice(0, 1024) : '';
  if (keyPath) {
    if (!path.isAbsolute(keyPath)) throw new ValidationError('BAD_KEY', 'La clave debe indicarse con ruta absoluta');
    try {
      if (!fs.statSync(keyPath).isFile()) throw new ValidationError('BAD_KEY', 'Clave inexistente');
    } catch {
      throw new ValidationError('BAD_KEY', 'Clave inaccesible');
    }
  }
  const dir = profileDir(dataDir);
  return { name, host: hostRaw, port, user, keyPath, knownHostsPath: path.join(dir, `${randomUUID()}.known_hosts`) };
}

export function createSshProfile(db: Db, dataDir: string, input: unknown): SshProfileDto {
  const v = validateProfileInput(input, dataDir);
  const id = randomUUID();
  fs.writeFileSync(v.knownHostsPath, '', 'utf8');
  db.prepare(
    'INSERT INTO ssh_profiles (id, name, host, port, user, key_path, known_hosts_path, ops_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, v.name, v.host, v.port, v.user, v.keyPath, v.knownHostsPath, SSH_OPS_VERSION, new Date().toISOString());
  return { id, name: v.name, host: v.host, port: v.port, user: v.user, keyPath: v.keyPath, knownHostsPath: v.knownHostsPath, opsVersion: SSH_OPS_VERSION, createdAt: new Date().toISOString() };
}

export function listSshProfiles(db: Db): SshProfileDto[] {
  const rows = db.prepare('SELECT * FROM ssh_profiles ORDER BY created_at DESC').all() as unknown as Array<{
    id: string; name: string; host: string; port: number; user: string; key_path: string;
    known_hosts_path: string; ops_version: number; created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id, name: r.name, host: r.host, port: r.port, user: r.user, keyPath: r.key_path,
    knownHostsPath: r.known_hosts_path, opsVersion: r.ops_version, createdAt: r.created_at,
  }));
}

export function getSshProfile(db: Db, id: string): SshProfile | null {
  const row = db.prepare('SELECT * FROM ssh_profiles WHERE id = ?').get(validateId(id)) as unknown as {
    id: string; name: string; host: string; port: number; user: string; key_path: string;
    known_hosts_path: string; ops_version: number;
  } | undefined;
  if (!row) return null;
  return { id: row.id, name: row.name, host: row.host, port: row.port, user: row.user, keyPath: row.key_path, knownHostsPath: row.known_hosts_path, opsVersion: row.ops_version };
}

export function deleteSshProfile(db: Db, id: string): void {
  const p = getSshProfile(db, id);
  if (!p) throw new ValidationError('NOT_FOUND', 'Perfil SSH inexistente');
  db.prepare('DELETE FROM ssh_profiles WHERE id = ?').run(p.id);
  try {
    fs.rmSync(p.knownHostsPath, { force: true });
  } catch {
    /* limpieza defensiva */
  }
}

/** Registra la clave de host tras aprobación explícita del usuario (pin manual). */
export function pinHostKey(db: Db, id: string, keyLine: string): void {
  const p = getSshProfile(db, id);
  if (!p) throw new ValidationError('NOT_FOUND', 'Perfil SSH inexistente');
  const clean = keyLine.trim().slice(0, 4096);
  if (!/^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp\d+) /.test(clean.split(' ').slice(1).join(' ') || clean)) {
    // Formato ssh-keyscan: "host tipo clave". Validación laxa pero acotada.
    if (!/^[\w.-]+ [\w-]+ [A-Za-z0-9+/=]+$/.test(clean)) {
      throw new ValidationError('BAD_KEYLINE', 'Línea de clave inválida');
    }
  }
  fs.appendFileSync(p.knownHostsPath, clean + '\n', 'utf8');
}
