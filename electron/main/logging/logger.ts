// Logger con redacción de secretos por defecto.
// Nunca registra valores de credenciales, tokens, cookies ni claves.

import fs from 'node:fs';
import path from 'node:path';
import { redact } from '../../../engine/finding/redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_FILE = 1024 * 1024;

export { redact };

class Logger {
  private level: LogLevel = 'info';
  private file: string | null = null;

  configure(options: { level?: LogLevel; file?: string }): void {
    if (options.level) this.level = options.level;
    if (options.file) {
      this.file = options.file;
      fs.mkdirSync(path.dirname(options.file), { recursive: true });
    }
  }

  private write(level: LogLevel, message: string, detail?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const line = `[${new Date().toISOString()}] [${level}] ${redact(message)}` +
      (detail === undefined ? '' : ` ${redact(safeStringify(detail))}`);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    if (this.file) {
      try {
        rotateIfNeeded(this.file);
        fs.appendFileSync(this.file, line + '\n', 'utf8');
      } catch {
        /* logging nunca debe romper la app */
      }
    }
  }

  debug(msg: string, detail?: unknown): void { this.write('debug', msg, detail); }
  info(msg: string, detail?: unknown): void { this.write('info', msg, detail); }
  warn(msg: string, detail?: unknown): void { this.write('warn', msg, detail); }
  error(msg: string, detail?: unknown): void { this.write('error', msg, detail); }
}

function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (_k, v: unknown) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      if (typeof v === 'function') return '[function]';
      return v;
    }) ?? String(value);
  } catch {
    return '[no-serializable]';
  }
}

function rotateIfNeeded(file: string): void {
  try {
    const stat = fs.statSync(file);
    if (stat.size < MAX_FILE) return;
    for (let i = 2; i >= 1; i--) {
      const older = `${file}.${i}`;
      const newer = `${file}.${i + 1}`;
      if (fs.existsSync(older)) {
        if (i === 2) fs.rmSync(older);
        else fs.renameSync(older, newer);
      }
    }
    fs.renameSync(file, `${file}.1`);
  } catch {
    /* sin rotación si el archivo aún no existe */
  }
}

export const logger = new Logger();
