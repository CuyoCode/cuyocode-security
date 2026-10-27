import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('endurecimiento Electron (guardas de regresión)', () => {
  it('la ventana deshabilita nodeIntegration y aísla el contexto', () => {
    const src = read('electron/main/window.ts');
    expect(src).toContain('nodeIntegration: false');
    expect(src).toContain('contextIsolation: true');
    expect(src).toContain('sandbox: true');
  });

  it('el preload no expone ipcRenderer crudo ni APIs de sistema', () => {
    const src = read('electron/preload/preload.ts');
    expect(src).toContain('contextBridge.exposeInMainWorld');
    expect(src).toContain(`exposeInMainWorld('api'`);
    expect(src).not.toContain('exposeInMainWorld("electron"');
    expect(src).not.toContain("exposeInMainWorld('electron'");
    expect(src).not.toContain('require(');
    expect(src).not.toContain('child_process');
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/shell\s*:/);
  });

  it('el main no usa shell:true', () => {
    for (const rel of ['electron/main/ipc/register-handlers.ts', 'electron/main/main.ts']) {
      expect(read(rel)).not.toMatch(/shell:\s*true/);
    }
  });

  it('el renderer declara una CSP restrictiva', () => {
    const html = read('index.html');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("script-src 'self'");
  });
});
