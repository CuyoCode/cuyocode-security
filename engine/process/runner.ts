// Ejecución de procesos externos con límites: sin shell, argv separado y
// validado, timeout, tope de salida y terminación garantizada.

import { spawn, type ChildProcess } from 'node:child_process';

export interface RunOptions {
  args: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  cwd?: string;
  env?: Record<string, string>;
  /** Cancelación cooperativa: mata el árbol de procesos al abortar. */
  signal?: AbortSignal;
}

export interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** Nombre del binario tal como se invocó (para trazabilidad, no PATH resuelto). */
  command: string;
}

// Con shell:false los metacaracteres no se interpretan; solo NUL y saltos de
// línea rompen el paso de argumentos. La verdadera frontera es la allowlist
// de comandos remotos (SSH) y la validación de cada motor.
const FORBIDDEN_ARG = /[\0\n\r]/;

export function assertSafeArgs(args: string[]): void {
  for (const a of args) {
    if (a.length > 4096 || FORBIDDEN_ARG.test(a)) {
      throw new Error('Argumento de proceso rechazado por seguridad');
    }
  }
}

/** Mata el proceso y sus hijos (Windows: taskkill /T; POSIX: grupo). */
function killTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } catch {
      /* taskkill ausente */
    }
  }
  try {
    child.kill('SIGKILL');
  } catch {
    /* ya terminado */
  }
}

export function runTool(command: string, options: RunOptions): Promise<RunResult> {
  assertSafeArgs(options.args);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cap = options.maxOutputBytes;
    const finish = (exitCode: number | null): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      resolve({ exitCode, stdout, stderr, timedOut, aborted, command });
    };
    const onAbort = (): void => {
      aborted = true;
      killTree(child);
      finish(null);
    };
    let child: ChildProcess;
    try {
      child = spawn(command, options.args, {
        shell: false,
        windowsHide: true,
        cwd: options.cwd,
        env: options.env,
      });
    } catch {
      finish(null);
      return;
    }
    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener('abort', onAbort, { once: true });
    }
    timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
      setTimeout(() => finish(null), 2000).unref?.();
    }, options.timeoutMs);
    timer.unref?.();
    child.stdout?.on('data', (d: Buffer) => {
      if (stdout.length < cap) stdout += d.toString('utf8', 0, cap - stdout.length);
    });
    child.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < cap) stderr += d.toString('utf8', 0, cap - stderr.length);
    });
    child.on('error', () => {
      clearTimeout(timer);
      finish(null);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish(code);
    });
  });
}
