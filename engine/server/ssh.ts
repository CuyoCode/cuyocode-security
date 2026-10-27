// SSH de solo lectura: transporte por OpenSSH del sistema con allowlist de
// comandos versionada. Sin consola arbitraria, sin comandos de la IA, sin
// contraseñas en texto plano. La seguridad efectiva también depende del
// usuario remoto: se recomienda cuenta dedicada de privilegios mínimos.

import fs from 'node:fs';
import path from 'node:path';
import { runTool } from '../process/runner';

export const SSH_OPS_VERSION = 1;

/** Operaciones permitidas (id → comando remoto exacto). Versionadas. */
export const ALLOWED_OPS: Record<string, { title: string; command: string }> = {
  'sys.uname': { title: 'Sistema y kernel', command: 'uname -a' },
  'net.sockets': { title: 'Puertos y sockets en escucha', command: 'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo NO_SS' },
  'fw.ufw': { title: 'Estado UFW', command: 'ufw status verbose 2>&1 || echo NO_UFW' },
  'fw.iptables': { title: 'Reglas iptables', command: 'iptables -S 2>&1 || echo NO_IPTABLES' },
  'ssh.config': { title: 'Configuración efectiva SSH', command: 'sshd -T 2>&1 || echo NEEDS_ROOT' },
  'svc.enabled': { title: 'Servicios habilitados', command: 'systemctl list-unit-files --state=enabled --no-pager 2>&1 | head -50 || service --status-all 2>&1 || echo NO_SYSTEMD' },
  'pkg.updates': { title: 'Actualizaciones pendientes (Debian)', command: 'apt-get -s upgrade 2>&1 | head -30 || echo NO_APT' },
  'docker.ps': { title: 'Contenedores Docker', command: 'docker ps --format "{{.Names}} {{.Image}} {{.Status}}" 2>&1 || echo NO_DOCKER' },
  'proxy.nginx': { title: 'Sitios Nginx', command: 'nginx -T 2>&1 | head -80 || echo NO_NGINX' },
  'certs.live': { title: 'Certificados emitidos', command: 'ls -la /etc/letsencrypt/live/ 2>&1 || echo NO_LE' },
  'perms.shadow': { title: 'Permisos de /etc/shadow', command: 'ls -la /etc/shadow 2>&1; test -r /etc/shadow && echo READABLE || echo NOT_READABLE' },
  'users.login': { title: 'Usuarios con shell de login', command: 'grep -v "nologin\\|false$" /etc/passwd 2>&1 || echo NO_PASSWD' },
  'logs.auth': { title: 'Últimos accesos SSH (resumen)', command: 'last -20 2>&1 || echo NO_LAST' },
};

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  /** Ruta a la clave privada (nunca su contenido). Vacía = ssh-agent/por defecto. */
  keyPath: string;
  /** Archivo known_hosts dedicado del perfil. */
  knownHostsPath: string;
  opsVersion: number;
}

export interface SshExecResult {
  op: string;
  stdout: string;
  exitCode: number | null;
  timedOut: boolean;
}

function sshBaseArgs(profile: SshProfile): string[] {
  const args = [
    '-p', String(profile.port),
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `UserKnownHostsFile=${profile.knownHostsPath}`,
    '-o', 'ConnectTimeout=10',
  ];
  if (profile.keyPath) args.push('-i', profile.keyPath);
  args.push(`${profile.user}@${profile.host}`);
  return args;
}

/** Ejecuta UNA operación permitida. Rechaza cualquier op fuera del catálogo. */
export async function execAllowedOp(profile: SshProfile, op: string, timeoutMs = 30000): Promise<SshExecResult> {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(op) || !Object.prototype.hasOwnProperty.call(ALLOWED_OPS, op)) {
    throw new Error(`Operación SSH no permitida: ${op}`);
  }
  const def = ALLOWED_OPS[op] as { title: string; command: string };
  if (!/^[A-Za-z0-9._-]+$/.test(profile.user) || !/^[A-Za-z0-9.-]+$/.test(profile.host)) {
    throw new Error('Perfil SSH con usuario/host inválido');
  }
  if (profile.keyPath) {
    try {
      const st = fs.statSync(profile.keyPath);
      if (!st.isFile()) throw new Error('clave inexistente');
    } catch {
      throw new Error('Clave SSH del perfil inaccesible');
    }
  }
  const res = await runTool('ssh', {
    args: [...sshBaseArgs(profile), '--', def.command],
    timeoutMs,
    maxOutputBytes: 256 * 1024,
  });
  return { op, stdout: res.stdout || res.stderr, exitCode: res.exitCode, timedOut: res.timedOut };
}

/** Obtiene la clave pública del servidor para alta inicial (pin manual). */
export async function fetchHostKey(host: string, port: number): Promise<string> {
  if (!/^[A-Za-z0-9.-]+$/.test(host) || port < 1 || port > 65535) {
    throw new Error('Host/puerto inválido para keyscan');
  }
  const res = await runTool('ssh-keyscan', {
    args: ['-p', String(port), '-t', 'rsa,ecdsa,ed25519', host],
    timeoutMs: 20000,
    maxOutputBytes: 16 * 1024,
  });
  if (!res.stdout) throw new Error('ssh-keyscan sin respuesta');
  return res.stdout;
}

export function profileDir(dataDir: string): string {
  const dir = path.join(dataDir, 'ssh');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
