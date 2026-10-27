// Validación y normalización de objetivos (carpeta / URL / servidor).
// Usado por el IPC y por todos los motores. Nada aquí ejecuta código del objetivo.

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { CreateProjectInput, ProjectKind } from '../../shared/ipc-contracts/project.contracts';

export const LIMITS = {
  nameMax: 80,
  targetMax: 2048,
  idMax: 64,
} as const;

export class ValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

/** Rechaza objetos con prototipo alterado o claves peligrosas. */
export function assertSafeObject(value: unknown, what: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new ValidationError('INVALID_SHAPE', `${what}: se esperaba un objeto`);
  for (const key of Object.keys(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new ValidationError('UNSAFE_KEY', `${what}: clave no permitida`);
    }
  }
}

/** Los canales sin argumentos documentados rechazan cualquier argumento. */
export function assertNoArgs(args: unknown[]): void {
  if (args.length > 0) throw new ValidationError('UNEXPECTED_ARGS', 'Este canal no acepta argumentos');
}

export function assertSingleArg(args: unknown[]): unknown {
  if (args.length !== 1) throw new ValidationError('ARG_COUNT', 'Se esperaba exactamente un argumento');
  return args[0];
}

export function cleanText(value: unknown, max: number, what: string): string {
  if (typeof value !== 'string') throw new ValidationError('INVALID_TYPE', `${what}: se esperaba texto`);
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) throw new ValidationError('EMPTY', `${what}: valor vacío`);
  if (trimmed.length > max) throw new ValidationError('TOO_LONG', `${what}: máximo ${max} caracteres`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new ValidationError('CONTROL_CHARS', `${what}: contiene caracteres de control`);
  }
  return trimmed;
}

const KIND_SET: ReadonlySet<string> = new Set(['folder', 'url', 'server']);

export function validateFolderTarget(target: string): string {
  if (!path.win32.isAbsolute(target) && !path.posix.isAbsolute(target)) {
    throw new ValidationError('NOT_ABSOLUTE', 'La carpeta debe indicarse con ruta absoluta');
  }
  const normalized = path.normalize(target);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(normalized);
  } catch {
    throw new ValidationError('NOT_FOUND', 'La carpeta no existe o no es accesible');
  }
  if (!stat.isDirectory()) throw new ValidationError('NOT_A_DIRECTORY', 'La ruta no es una carpeta');
  return normalized;
}

export function validateUrlTarget(target: string): string {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new ValidationError('BAD_URL', 'URL inválida');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('BAD_SCHEME', 'Solo se admiten URLs http(s)');
  }
  if (!parsed.hostname) throw new ValidationError('BAD_URL', 'URL sin host');
  if (parsed.username || parsed.password) {
    throw new ValidationError('URL_CREDENTIALS', 'La URL no debe incluir credenciales');
  }
  return parsed.toString();
}

export function validateServerTarget(target: string): string {
  // Formas admitidas: host | host:puerto. Sin esquema, sin ruta, sin credenciales.
  const m = /^([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(target);
  if (!m) throw new ValidationError('BAD_SERVER', 'Servidor: se espera "host" o "host:puerto"');
  const port = m[2] === undefined ? 22 : Number(m[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError('BAD_PORT', 'Puerto fuera de rango 1-65535');
  }
  return m[2] === undefined ? `${m[1]}:22` : `${m[1]}:${port}`;
}

export function validateCreateProject(input: unknown): CreateProjectInput {
  assertSafeObject(input, 'Proyecto');
  const name = cleanText(input['name'], LIMITS.nameMax, 'Nombre');
  const kindRaw = input['kind'];
  if (typeof kindRaw !== 'string' || !KIND_SET.has(kindRaw)) {
    throw new ValidationError('BAD_KIND', 'Tipo: folder, url o server');
  }
  const kind = kindRaw as ProjectKind;
  const rawTarget = cleanText(input['target'], LIMITS.targetMax, 'Objetivo');
  const target =
    kind === 'folder'
      ? validateFolderTarget(rawTarget)
      : kind === 'url'
        ? validateUrlTarget(rawTarget)
        : validateServerTarget(rawTarget);
  return { name, kind, target };
}

export function validateId(input: unknown): string {
  const id = cleanText(input, LIMITS.idMax, 'Identificador');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    throw new ValidationError('BAD_ID', 'Identificador inválido');
  }
  return id;
}

export function newId(): string {
  return randomUUID();
}

/** Host normalizado de una URL ya validada (minúsculas, sin puerto por defecto). */
export function urlHost(normalizedUrl: string): string {
  return new URL(normalizedUrl).hostname.toLowerCase();
}
