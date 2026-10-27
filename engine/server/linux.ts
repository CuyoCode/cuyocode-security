// Inspección Linux por SSH: interpreta salidas de operaciones permitidas y
// produce hallazgos. Lo que requiere privilegios y no se pudo leer queda como
// "no verificado", nunca como seguro.

import type { EngineJob, EngineResult } from '../orchestrator/types';
import type { Finding } from '../../shared/finding-schema';
import { stableFindingId } from '../finding/dedup';
import { ALLOWED_OPS, SSH_OPS_VERSION, execAllowedOp, type SshProfile } from './ssh';

export const LINUX_VERSION = 'cuyocode-ssh/1.0';

export interface SshAuditContext {
  profile: SshProfile;
}

function mkFinding(
  job: EngineJob,
  id: string,
  title: string,
  category: string,
  severity: Finding['severity'],
  verification: Finding['verificationStatus'],
  detail: string,
  impact: string,
  remediation: string[],
  now: string,
): Finding {
  const fid = stableFindingId({
    source: `${LINUX_VERSION}.ops${SSH_OPS_VERSION}`,
    ruleId: `${id}@1`,
    target: job.target,
    file: null,
    lineStart: null,
    evidenceKind: id,
    evidenceSnippet: detail.slice(0, 160),
  });
  return {
    id: fid,
    title,
    category,
    severity,
    confidence: 'medium',
    verificationStatus: verification,
    source: `${LINUX_VERSION}.ops${SSH_OPS_VERSION}`,
    ruleId: `${id}@1`,
    target: job.target,
    location: { file: null, lineStart: null, lineEnd: null },
    evidence: [{ kind: id, snippet: detail.slice(0, 300), detail }],
    impact,
    reproduction: ['Repetir la operación SSH permitida indicada.'],
    remediation,
    references: [],
    firstSeen: now,
    lastSeen: now,
    status: 'open',
  };
}

async function runOp(
  job: EngineJob,
  ctx: SshAuditContext,
  op: string,
  errors: EngineResult['errors'],
): Promise<string | null> {
  if (job.signal.aborted) return null;
  try {
    const r = await execAllowedOp(ctx.profile, op, 30000);
    if (r.timedOut || r.exitCode === null) {
      errors.push({ engine: 'ssh-readonly', message: `${op}: sin respuesta` });
      return null;
    }
    return r.stdout;
  } catch (e) {
    errors.push({ engine: 'ssh-readonly', message: `${op}: ${e instanceof Error ? e.message : '?'}` });
    return null;
  }
}

export async function sshAuditEngine(
  job: EngineJob,
  ctx: SshAuditContext,
): Promise<EngineResult> {
  const started = Date.now();
  const findings: Finding[] = [];
  const skipped: EngineResult['skipped'] = [];
  const errors: EngineResult['errors'] = [];
  const now = new Date().toISOString();
  void ALLOWED_OPS;

  const uname = await runOp(job, ctx, 'sys.uname', errors);
  if (uname && !uname.includes('NO_')) {
    findings.push(mkFinding(job, 'srv-uname', `Servidor: ${uname.trim().slice(0, 100)}`, 'inventory', 'info',
      'evidence-found', `uname: ${uname.trim().slice(0, 200)}`,
      'Inventario para contrastar versiones con avisos de seguridad.',
      ['Mantener kernel y distribución con soporte y actualizaciones.'], now));
  }

  const sockets = await runOp(job, ctx, 'net.sockets', errors);
  if (sockets && !sockets.includes('NO_SS')) {
    const lines = sockets.split('\n').filter((l) => /LISTEN/.test(l)).slice(0, 40);
    findings.push(mkFinding(job, 'srv-listening', `${lines.length} sockets en escucha (vista interna)`, 'network-exposure', 'info',
      'evidence-found', `Sockets: ${lines.join(' | ').slice(0, 400) || '(vacío)'}`,
      'Comparar con el escaneo externo: lo que escucha en 0.0.0.0 debe coincidir con lo esperado.',
      ['Restringir binds a loopback/red interna cuando el servicio no sea público.'], now));
  }

  const ufw = await runOp(job, ctx, 'fw.ufw', errors);
  if (ufw) {
    if (/Status: active/.test(ufw)) {
      findings.push(mkFinding(job, 'srv-ufw', 'Firewall UFW activo', 'configuration', 'info',
        'evidence-found', ufw.slice(0, 400), 'Control de perímetro a nivel host.', ['Mantener reglas mínimas y auditadas.'], now));
    } else if (!/NO_UFW/.test(ufw)) {
      findings.push(mkFinding(job, 'srv-ufw-off', 'Firewall UFW inactivo o sin reglas', 'misconfiguration', 'medium',
        'evidence-found', ufw.slice(0, 400),
        'Sin firewall local, un servicio ligado por error queda expuesto.',
        ['Activar UFW/nftables con política por defecto de denegación.'], now));
    }
  }

  const sshd = await runOp(job, ctx, 'ssh.config', errors);
  if (sshd) {
    if (/NEEDS_ROOT/.test(sshd)) {
      skipped.push({ engine: 'ssh-readonly', reason: 'sshd -T requiere privilegios: configuración SSH no verificada' });
    } else {
      const root = /^permitrootlogin\s+(\S+)/mi.exec(sshd)?.[1]?.toLowerCase();
      if (root === 'yes') {
        findings.push(mkFinding(job, 'srv-root-login', 'SSH permite login directo de root', 'misconfiguration', 'high',
          'evidence-found', `PermitRootLogin ${root}.`,
          'Root expuesto a fuerza bruta; sus claves suelen ser objetivo.',
          ['PermitRootLogin no/prohibit-password + acceso por usuario con sudo.'], now));
      }
      const pass = /^passwordauthentication\s+(\S+)/mi.exec(sshd)?.[1]?.toLowerCase();
      if (pass === 'yes') {
        findings.push(mkFinding(job, 'srv-pass-auth', 'SSH admite autenticación por contraseña', 'misconfiguration', 'medium',
          'evidence-found', `PasswordAuthentication ${pass}.`,
          'Contraseñas débiles/reusadas habilitan fuerza bruta y spraying.',
          ['PubkeyAuthentication yes + PasswordAuthentication no (con acceso por claves verificado).'], now));
      }
    }
  }

  const shadow = await runOp(job, ctx, 'perms.shadow', errors);
  if (shadow && /READABLE/.test(shadow) && !/NOT_READABLE/.test(shadow)) {
    findings.push(mkFinding(job, 'srv-shadow-readable', '/etc/shadow legible por el usuario de auditoría', 'misconfiguration', 'critical',
      'evidence-found', shadow.slice(0, 200),
      'Hashes de contraseñas accesibles permiten cracking offline.',
      ['Corregir permisos (root:shadow 640) y revisar cómo ocurrió.'], now));
  }

  const docker = await runOp(job, ctx, 'docker.ps', errors);
  if (docker && !/NO_DOCKER/.test(docker)) {
    const names = docker.split('\n').filter((l) => l.trim()).slice(0, 20);
    findings.push(mkFinding(job, 'srv-docker', `${names.length} contenedores en ejecución`, 'inventory', 'info',
      'evidence-found', names.join(' | ').slice(0, 400),
      'Inventario para revisar imágenes, montajes y privilegios en auditorías profundas.',
      ['Fijar imágenes por digest y revisar --privileged y montajes sensibles.'], now));
  }

  const updates = await runOp(job, ctx, 'pkg.updates', errors);
  if (updates && !/NO_APT/.test(updates)) {
    const count = (updates.match(/^Inst /gm) ?? []).length;
    if (count > 0) {
      findings.push(mkFinding(job, 'srv-updates', `${count} paquetes con actualización pendiente (simulación)`, 'patching', 'medium',
        'evidence-found', updates.split('\n').slice(0, 10).join('\n').slice(0, 400),
        'Ventana de exposición a vulnerabilidades ya corregidas upstream.',
        ['Aplicar actualizaciones en ventana de mantenimiento con rollback previsto.'], now));
    }
  }

  const users = await runOp(job, ctx, 'users.login', errors);
  if (users && !/NO_PASSWD/.test(users)) {
    findings.push(mkFinding(job, 'srv-users', 'Usuarios con shell de login (resumen)', 'inventory', 'info',
      'evidence-found', users.split('\n').slice(0, 15).join(' | ').slice(0, 400),
      'Cuentas inesperadas pueden indicar persistencia no autorizada.',
      ['Auditar altas/bajas de usuarios periódicamente.'], now));
  }

  return { engine: 'ssh-readonly', version: `${LINUX_VERSION}.ops${SSH_OPS_VERSION}`, findings, errors, skipped, durationMs: Date.now() - started };
}
