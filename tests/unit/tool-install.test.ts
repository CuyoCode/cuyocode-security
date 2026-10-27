import { describe, expect, it } from 'vitest';
import { detectTools, isAbsentOutput, isAllowedInstallUrl, parseSpecVersion, TOOL_SPECS } from '../../electron/main/ipc/tool-detection';

describe('guía de instalación de herramientas', () => {
  it('toda herramienta tiene URL oficial https', () => {
    expect(TOOL_SPECS.length).toBeGreaterThan(0);
    for (const t of TOOL_SPECS) {
      expect(t.installUrl.startsWith('https://')).toBe(true);
      expect(t.installCommand.length <= 60).toBe(true);
    }
  });

  it('la allowlist solo acepta URLs del catálogo', () => {
    expect(isAllowedInstallUrl('https://ollama.com/download')).toBe(true);
    expect(isAllowedInstallUrl('https://evil.example.com/')).toBe(false);
    expect(isAllowedInstallUrl('https://ollama.com/download/extra')).toBe(false);
    expect(isAllowedInstallUrl('javascript:alert(1)')).toBe(false);
  });

  it('parsea versión de OpenSSH Windows y descarta stub de Python', () => {
    expect(parseSpecVersion('ssh', 'OpenSSH_for_Windows_9.5p2, LibreSSL 3.8.2')).toBe('9.5p2');
    expect(parseSpecVersion('ssh', 'OpenSSH_9.8p1, OpenSSL 3.3.2')).toBe('9.8p1');
    expect(parseSpecVersion('npm', '11.19.0')).toBe('11.19.0');
    expect(isAbsentOutput('python', 'no se encontró Python; ejecutar sin argumentos')).toBe(true);
    expect(isAbsentOutput('python', 'Python 3.12.1')).toBe(false);
  });

  it('npm se detecta en este equipo (regresión del reporte)', async () => {
    const tools = await detectTools();
    const npm = tools.find((t) => t.id === 'npm');
    expect(npm?.detected).toBe(true);
    expect(npm?.version).toMatch(/\d+\.\d+/);
  }, 60000);
});
