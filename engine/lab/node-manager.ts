// Gestor del laboratorio Node: ejecuta la app vulnerable propia como hija del
// proceso principal, solo en loopback, con healthcheck y apagado garantizado.
// En Electron usa utilityProcess (no depende de RunAsNode); en tests usa node.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { findRepoRoot } from '../paths';
import { ValidationError } from '../scope/targets';

export interface NodeLabInfo {
  id: string;
  port: number;
  pid: number | null;
  startedAt: string;
  target: string;
}

interface LabChild {
  pid?: number;
  kill(): boolean;
  on(event: 'exit', cb: () => void): void;
  on(event: 'error', cb: () => void): void;
}

const labs = new Map<string, { proc: LabChild; port: number; startedAt: string; exited: boolean }>();

function targetScript(): string {
  const abs = path.join(findRepoRoot(), 'engine', 'lab', 'targets', 'node-vuln-app.cjs');
  // Empaquetado: los targets van fuera del asar (asarUnpack).
  if (abs.includes('app.asar')) return abs.replace('app.asar', 'app.asar.unpacked');
  return abs;
}

function spawnLab(script: string, port: number): LabChild {
  try {
    // require diferido: en tests (Node puro) no existe utilityProcess.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as typeof import('electron');
    if (typeof electron.utilityProcess?.fork === 'function') {
      return electron.utilityProcess.fork(script, [String(port)], {
        stdio: 'ignore',
        serviceName: 'CuyoCode Node Lab',
      }) as unknown as LabChild;
    }
  } catch {
    /* sin runtime Electron */
  }
  return spawn(process.execPath, [script, String(port)], {
    shell: false,
    windowsHide: true,
    stdio: 'ignore',
  }) as unknown as LabChild;
}

export function validateNodeLabId(id: string): string {
  const v = id.trim();
  if (!/^node-[a-z0-9-]{1,27}$/.test(v)) {
    throw new ValidationError('BAD_LAB_ID', 'ID de laboratorio node inválido (forma: node-nombre)');
  }
  return v;
}

export function validateNodeLabPort(port: unknown): number {
  const p = typeof port === 'number' ? port : Number(port);
  if (!Number.isInteger(p) || p < 1024 || p > 65535) {
    throw new ValidationError('BAD_LAB_PORT', 'Puerto de laboratorio fuera de rango 1024-65535');
  }
  return p;
}

async function waitHealthy(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      timer.unref?.();
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      await res.arrayBuffer().catch(() => new ArrayBuffer(0));
      if (res.status === 200) return true;
    } catch {
      /* aún no levanta */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** Crea y arranca un laboratorio node. Falla si el puerto está ocupado. */
export async function createNodeLab(id: string, port: number): Promise<NodeLabInfo> {
  const labId = validateNodeLabId(id);
  const labPort = validateNodeLabPort(port);
  if (labs.has(labId)) throw new ValidationError('LAB_EXISTS', `El laboratorio "${labId}" ya existe`);
  const startedAt = new Date().toISOString();
  const proc = spawnLab(targetScript(), labPort);
  const entry = { proc, port: labPort, startedAt, exited: false };
  proc.on('exit', () => {
    entry.exited = true;
  });
  proc.on('error', () => {
    entry.exited = true;
  });
  labs.set(labId, entry);
  const healthy = await waitHealthy(labPort, 15000);
  if (!healthy || entry.exited) {
    await stopNodeLab(labId);
    throw new ValidationError('LAB_PORT_BUSY', `El laboratorio "${labId}" no respondió en 127.0.0.1:${labPort} (¿puerto ocupado?)`);
  }
  return { id: labId, port: labPort, pid: proc.pid ?? null, startedAt, target: `http://127.0.0.1:${labPort}/` };
}

export async function stopNodeLab(id: string): Promise<boolean> {
  const labId = validateNodeLabId(id);
  const entry = labs.get(labId);
  if (!entry) return false;
  labs.delete(labId);
  try {
    entry.proc.kill();
  } catch {
    /* ya terminado */
  }
  await new Promise((r) => setTimeout(r, 1500));
  try {
    if (!entry.exited) entry.proc.kill();
  } catch {
    /* terminado */
  }
  return true;
}

export function getNodeLabPort(id: string): number | null {
  const entry = labs.get(id);
  if (!entry || entry.exited) return null;
  return entry.port;
}

export function listNodeLabs(): NodeLabInfo[] {
  const out: NodeLabInfo[] = [];
  for (const [id, entry] of labs) {
    if (entry.exited) continue;
    out.push({ id, port: entry.port, pid: entry.proc.pid ?? null, startedAt: entry.startedAt, target: `http://127.0.0.1:${entry.port}/` });
  }
  return out;
}

/** Apagado de emergencia (before-quit). Sincrónico: envía kill a todos. */
export function stopAllNodeLabs(): void {
  for (const [id, entry] of labs) {
    try {
      entry.proc.kill();
    } catch {
      /* ya terminado */
    }
    labs.delete(id);
  }
}
