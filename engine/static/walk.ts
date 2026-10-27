// Recorrido seguro del objetivo: sin ejecutar su código, sin binarios,
// sin dependencias instaladas, con límites de tamaño y exclusiones.

import fs from 'node:fs';
import path from 'node:path';

export interface WalkOptions {
  maxFiles: number;
  maxFileBytes: number;
  extraExcludes?: string[];
}

export interface WalkFile {
  absPath: string;
  relPath: string;
  size: number;
}

const DIR_EXCLUDES = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'out',
  'vendor', '__pycache__', '.venv', 'venv', 'target', 'bin', 'obj', '.idea', '.vscode',
]);

const FILE_EXCLUDES = [/\.min\.js$/, /\.map$/, /\.lock$/i];

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.mjs', '.cjs', '.json', '.jsonc',
  '.yml', '.yaml', '.toml', '.ini', '.env', '.example', '.md', '.txt',
  '.html', '.htm', '.css', '.scss', '.py', '.rb', '.go', '.java', '.php',
  '.dockerfile', '.sh', '.sql', '.xml', '.gradle', '.properties', '.conf', '.config',
]);

function hasTextName(name: string): boolean {
  const low = name.toLowerCase();
  if (low === 'dockerfile' || low.startsWith('dockerfile.')) return true;
  if (low === '.env' || low.startsWith('.env.')) return true;
  if (low === 'docker-compose.yml' || low === 'docker-compose.yaml') return true;
  const ext = path.extname(low);
  return TEXT_EXTENSIONS.has(ext);
}

export function walkTarget(root: string, options: WalkOptions): { files: WalkFile[]; truncated: boolean; skippedDirs: string[] } {
  const files: WalkFile[] = [];
  const skippedDirs: string[] = [];
  let truncated = false;
  const excludes = new Set([...DIR_EXCLUDES, ...(options.extraExcludes ?? [])]);

  const stack: string[] = [root];
  while (stack.length > 0) {
    if (files.length >= options.maxFiles) {
      truncated = true;
      break;
    }
    const dir = stack.pop() as string;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (files.length >= options.maxFiles) {
        truncated = true;
        break;
      }
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (excludes.has(e.name)) continue;
        if (e.name === '.git') continue;
        stack.push(abs);
      } else if (e.isFile()) {
        const rel = path.relative(root, abs).replace(/\\/g, '/');
        if (rel.split('/').some((part) => excludes.has(part))) {
          skippedDirs.push(rel);
          continue;
        }
        if (!hasTextName(e.name) && !FILE_EXCLUDES.some((rx) => rx.test(e.name))) {
          continue;
        }
        if (FILE_EXCLUDES.some((rx) => rx.test(e.name))) continue;
        let size = 0;
        try {
          size = fs.statSync(abs).size;
        } catch {
          continue;
        }
        if (size > options.maxFileBytes || size === 0) continue;
        files.push({ absPath: abs, relPath: rel, size });
      }
    }
  }
  return { files, truncated, skippedDirs };
}

export function readTextFile(absPath: string, maxBytes: number): string | null {
  try {
    const buf = fs.readFileSync(absPath);
    if (buf.length === 0 || buf.length > maxBytes) return null;
    if (buf.includes(0)) return null; // binario
    return buf.toString('utf8');
  } catch {
    return null;
  }
}
