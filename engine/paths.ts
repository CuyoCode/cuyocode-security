// Localiza la raíz del proyecto (dev, dist-electron o app.asar) buscando los
// directorios versionados profiles/ y rules/. Nada hardcodeado por entorno.

import fs from 'node:fs';
import path from 'node:path';

let cached: string | null = null;

export function findRepoRoot(): string {
  if (cached) return cached;
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    try {
      if (fs.statSync(path.join(dir, 'profiles')).isDirectory() && fs.statSync(path.join(dir, 'rules')).isDirectory()) {
        cached = dir;
        return dir;
      }
    } catch {
      /* seguir subiendo */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Raíz del proyecto no encontrada (faltan profiles/ o rules/)');
}

export function profilesDir(): string {
  return path.join(findRepoRoot(), 'profiles');
}

export function rulesDir(): string {
  return path.join(findRepoRoot(), 'rules');
}
