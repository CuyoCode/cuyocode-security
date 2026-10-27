// Detección de herramientas externas por allowlist fija.
// Nunca ejecuta input del renderer: comandos y argumentos están hardcodeados abajo.
// Se invoca con argv separado, timeout y tope de salida (sin intérprete de shell).

import { spawn } from 'node:child_process';
import type { ToolStatus } from '../../../shared/ipc-contracts/system.contracts';

interface ToolSpec {
  id: string;
  name: string;
  /** Comando en PATH (ejecutables .exe directos, sin shell). */
  cmd: string;
  args: string[];
  /**
   * Solo Windows: línea fija para `cmd.exe /c` cuando el comando es un
   * .cmd/.bat que Node no puede spawnear directo (p. ej. npm). Constante
   * curada, jamás input del usuario.
   */
  winCmd?: string;
  /** Si la salida coincide, se informa ausente (stubs, redirecciones). */
  absentIf?: RegExp;
  /** Extrae versión legible de stdout/stderr. */
  parse: (out: string) => string | null;
  hint: string;
  /** Web oficial de instalación. */
  installUrl: string;
  /** Comando winget, o '' si la instalación es manual. */
  installCommand: string;
  required: boolean;
}

/** URLs habilitadas para "Abrir web de instalación" (allowlist exacta). */
export function isAllowedInstallUrl(url: string): boolean {
  return TOOL_SPECS.some((s) => s.installUrl === url);
}

/** Versión parseada para un id del catálogo (testeable sin ejecutar nada). */
export function parseSpecVersion(id: string, out: string): string | null {
  const spec = TOOL_SPECS.find((s) => s.id === id);
  return spec ? spec.parse(out) : null;
}

/** Indica si una salida corresponde a stub ausente (p. ej. Python Store). */
export function isAbsentOutput(id: string, out: string): boolean {
  const spec = TOOL_SPECS.find((s) => s.id === id);
  return spec?.absentIf ? spec.absentIf.test(out) : false;
}

const BERB = '[a-zA-Z0-9._-]+';

function firstLine(out: string): string {
  return out.split(/\r?\n/, 1)[0]?.trim() ?? '';
}

export const TOOL_SPECS: ToolSpec[] = [
  { id: 'git', name: 'Git', cmd: 'git', args: ['--version'], parse: (o) => /git version (\S+)/.exec(o)?.[1] ?? null, hint: 'winget install Git.Git', installUrl: 'https://git-scm.com/downloads/win', installCommand: 'winget install Git.Git', required: true },
  { id: 'node', name: 'Node.js', cmd: 'node', args: ['--version'], parse: (o) => /v(\S+)/.exec(firstLine(o))?.[1] ?? null, hint: 'Instalar Node.js 24 LTS', installUrl: 'https://nodejs.org/', installCommand: 'winget install OpenJS.NodeJS.LTS', required: true },
  { id: 'npm', name: 'npm', cmd: 'npm', args: ['--version'], winCmd: 'npm --version', parse: (o) => new RegExp(`^(${BERB})$`).exec(firstLine(o))?.[1] ?? null, hint: 'Se instala con Node.js', installUrl: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/', installCommand: '', required: false },
  { id: 'ssh', name: 'OpenSSH', cmd: 'ssh', args: ['-V'], parse: (o) => /(?:OpenSSH_for_Windows_|OpenSSH_)([0-9][^\s,]*)/.exec(o)?.[1] ?? null, hint: 'Incluido en Windows 10/11', installUrl: 'https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_windows', installCommand: '', required: false },
  { id: 'docker', name: 'Docker', cmd: 'docker', args: ['--version'], parse: (o) => /Docker version ([^\s,]+)/.exec(o)?.[1] ?? null, hint: 'Instalar Docker Desktop (opcional: solo lab Docker)', installUrl: 'https://www.docker.com/products/docker-desktop/', installCommand: 'winget install Docker.DockerDesktop', required: false },
  { id: 'python', name: 'Python', cmd: 'python', args: ['--version'], absentIf: /Microsoft Store|no se encontr|ejecutar sin argumentos/i, parse: (o) => /Python ([^\s]+)/.exec(o)?.[1] ?? null, hint: 'winget install Python.Python.3', installUrl: 'https://www.python.org/downloads/windows/', installCommand: 'winget install Python.Python.3', required: false },
  { id: 'nmap', name: 'Nmap', cmd: 'nmap', args: ['--version'], parse: (o) => /Nmap version ([^\s]+)/.exec(o)?.[1] ?? null, hint: 'Opcional externo (Fase 5). No se empaqueta.', installUrl: 'https://nmap.org/download.html', installCommand: '', required: false },
  { id: 'gitleaks', name: 'Gitleaks', cmd: 'gitleaks', args: ['version'], parse: (o) => /v?(\d+\.\d+\.\d+[^\s]*)/.exec(firstLine(o))?.[1] ?? null, hint: 'Descargar release oficial (Fase 3)', installUrl: 'https://github.com/gitleaks/gitleaks/releases', installCommand: '', required: false },
  { id: 'semgrep', name: 'Semgrep', cmd: 'semgrep', args: ['--version'], parse: (o) => new RegExp(`^(\\d+\\.\\d+\\.\\d+${'[\\w.-]*'})$`).exec(firstLine(o))?.[1] ?? null, hint: 'Instalación oficial (Fase 3)', installUrl: 'https://semgrep.dev/docs/getting-started/', installCommand: '', required: false },
  { id: 'trivy', name: 'Trivy', cmd: 'trivy', args: ['--version'], parse: (o) => /Version: ([^\s]+)/.exec(o)?.[1] ?? null, hint: 'Release oficial aquasecurity (Fase 3)', installUrl: 'https://github.com/aquasecurity/trivy/releases', installCommand: '', required: false },
  { id: 'zap', name: 'OWASP ZAP', cmd: 'zap', args: ['-version'], parse: (o) => /(\d+\.\d+\.\d+[^\s]*)/.exec(o)?.[1] ?? null, hint: 'Requiere Java; instalación oficial (Fase 4)', installUrl: 'https://www.zaproxy.org/download/', installCommand: '', required: false },
  { id: 'ollama', name: 'Ollama', cmd: 'ollama', args: ['--version'], parse: (o) => /ollama version is ([^\s]+)/i.exec(o)?.[1] ?? null, hint: 'ollama.com/download (IA local, Fase 3+)', installUrl: 'https://ollama.com/download', installCommand: 'winget install Ollama.Ollama', required: false },
];

const TIMEOUT_MS = 8000;
const MAX_OUT = 64 * 1024;

function runOnce(cmd: string, args: string[]): Promise<{ out: string; exePath: string | null }> {
  return new Promise((resolve) => {
    let out = '';
    let settled = false;
    const finish = (value: { out: string; exePath: string | null }): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let child;
    try {
      child = spawn(cmd, args, { shell: false, windowsHide: true });
    } catch {
      finish({ out: '', exePath: null });
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ya terminado */
      }
      finish({ out, exePath: null });
    }, TIMEOUT_MS);
    child.stdout?.on('data', (d: Buffer) => {
      if (out.length < MAX_OUT) out += d.toString('utf8', 0, MAX_OUT - out.length);
    });
    child.stderr?.on('data', (d: Buffer) => {
      if (out.length < MAX_OUT) out += d.toString('utf8', 0, MAX_OUT - out.length);
    });
    child.on('error', () => {
      clearTimeout(timer);
      finish({ out: '', exePath: null });
    });
    child.on('close', () => {
      clearTimeout(timer);
      finish({ out, exePath: cmd });
    });
  });
}

export async function detectTools(): Promise<ToolStatus[]> {
  const results: ToolStatus[] = [];
  for (const spec of TOOL_SPECS) {
    const useShell = process.platform === 'win32' && typeof spec.winCmd === 'string';
    const { out, exePath } = useShell
      ? await runOnce('C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', spec.winCmd as string])
      : await runOnce(spec.cmd, spec.args);
    const stub = spec.absentIf ? spec.absentIf.test(out) : false;
    const detected = exePath !== null && out.length > 0 && !stub;
    results.push({
      id: spec.id,
      name: spec.name,
      detected,
      version: detected ? spec.parse(out) : null,
      path: detected ? (useShell ? spec.winCmd as string : spec.cmd) : null,
      hint: spec.hint,
      installUrl: spec.installUrl,
      installCommand: spec.installCommand,
      required: spec.required,
    });
  }
  return results;
}
