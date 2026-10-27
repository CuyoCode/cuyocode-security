// Ejecución de procesos externos con límites: sin shell, argv separado y
// validado, timeout, tope de salida y terminación garantizada.

import { spawn } from 'node:child_process';

export interface RunOptions {
  args: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Nombre del binario tal como se invocó (para trazabilidad, no PATH resuelto). */
  command: string;
}

const FORBIDDEN_ARG = /[\0\n\r;|&$`]/;

export function assertSafeArgs(args: string[]): void {
  for (const a of args) {
    if (a.length > 4096 || FORBIDDEN_ARG.test(a)) {
      throw new Error('Argumento de proceso rechazado por seguridad');
    }
  }
}

export function runTool(command: string, options: RunOptions): Promise<RunResult> {
  assertSafeArgs(options.args);
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const cap = options.maxOutputBytes;
    const finish = (exitCode: number | null): void => {
      resolve({ exitCode, stdout, stderr, timedOut, command });
    };
    let child;
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
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ya terminado */
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* sin proceso */
        }
        finish(null);
      }, 2000).unref?.();
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
