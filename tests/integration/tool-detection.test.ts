import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectTools } from '../../electron/main/ipc/tool-detection';

// Integración real: ejecuta los binarios del PATH con timeout.
// Requiere git instalado (verificado en Fase 0).

describe('detección de herramientas externas', () => {
  it('detecta git y reporta esquema completo', async () => {
    const tools = await detectTools();
    expect(tools.length).toBeGreaterThan(0);
    const git = tools.find((t) => t.id === 'git');
    expect(git).toBeDefined();
    expect(git?.detected).toBe(true);
    expect(git?.version).toMatch(/\d+\.\d+/);
    for (const t of tools) {
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.hint.length).toBeGreaterThan(0);
      if (!t.detected) expect(t.version).toBeNull();
    }
  }, 60000);

  it('nunca usa shell:true con datos variables', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'electron', 'main', 'ipc', 'tool-detection.ts'),
      'utf8',
    );
    expect(src).toContain('shell: false');
    expect(src).not.toMatch(/shell:\s*true/);
  });
});
