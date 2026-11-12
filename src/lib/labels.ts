// Etiquetas y formatos de presentación. Única fuente para que la UI no
// muestre enums crudos ni fechas ISO sin contexto.

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
  info: 'Informativo',
};

export function severityLabel(value: string): string {
  return SEVERITY_LABEL[value] ?? value;
}

const AUDIT_STATUS_LABEL: Record<string, string> = {
  queued: 'En cola',
  running: 'En ejecución',
  done: 'Completada',
  cancelled: 'Cancelada',
  failed: 'Fallida',
};

export function auditStatusLabel(value: string): string {
  return AUDIT_STATUS_LABEL[value] ?? value;
}

const FINDING_STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  reviewed: 'Revisado',
  'false-positive': 'Falso positivo',
  resolved: 'Resuelto',
  'accepted-risk': 'Riesgo aceptado',
};

export function findingStatusLabel(value: string): string {
  return FINDING_STATUS_LABEL[value] ?? value;
}

const VERIFICATION_LABEL: Record<string, string> = {
  confirmed: 'Confirmado',
  'evidence-found': 'Evidencia encontrada',
  possible: 'Posible',
  unverified: 'Sin verificar',
};

export function verificationLabel(value: string): string {
  return VERIFICATION_LABEL[value] ?? value;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export function confidenceLabel(value: string): string {
  return CONFIDENCE_LABEL[value] ?? value;
}

const AI_MODE_LABEL: Record<string, string> = {
  off: 'Desactivada',
  local: 'Local (Ollama)',
  external: 'API externa',
};

export function aiModeLabel(value: string): string {
  return AI_MODE_LABEL[value] ?? value;
}

const PROFILE_LABEL: Record<string, string> = {
  'local-code': 'Código local',
  'local-code-deep': 'Código local profundo',
  'demo-code': 'Código local (demo)',
  'web-passive': 'Web pasiva',
  'web-active': 'Web activa controlada',
  'server-readonly': 'Servidor solo-lectura',
  'lab-advanced': 'Laboratorio avanzado',
};

export function profileLabel(value: string): string {
  return PROFILE_LABEL[value] ?? value;
}

const ENGINE_LABEL: Record<string, string> = {
  'recon': 'Reconocimiento',
  'secrets-builtin': 'Secretos',
  'deps-npm-audit': 'Dependencias npm',
  'patterns-builtin': 'Patrones de código',
  'gitleaks': 'Gitleaks',
  'semgrep': 'Semgrep',
  'trivy': 'Trivy',
  'http-passive': 'HTTP pasivo',
  'tls-check': 'TLS',
  'cookies-review': 'Cookies',
  'zap-baseline': 'ZAP baseline',
  'zap-full': 'ZAP completo',
  'nuclei-selected': 'Nuclei',
  'ports-tcp': 'Puertos TCP',
  'nmap': 'Nmap',
  'ssh-readonly': 'SSH solo-lectura',
};

export function engineLabel(value: string): string {
  return ENGINE_LABEL[value] ?? value;
}

const KIND_LABEL: Record<string, string> = {
  folder: 'Carpeta local',
  url: 'URL',
  server: 'Servidor',
};

export function kindLabel(value: string): string {
  return KIND_LABEL[value] ?? value;
}

const OP_LABEL: Record<string, string> = {
  'sys.uname': 'Sistema y kernel',
  'net.sockets': 'Puertos y sockets',
  'fw.ufw': 'Estado UFW',
  'fw.iptables': 'Reglas iptables',
  'ssh.config': 'Configuración SSH',
  'svc.enabled': 'Servicios habilitados',
  'pkg.updates': 'Actualizaciones pendientes',
  'docker.ps': 'Contenedores Docker',
  'proxy.nginx': 'Sitios Nginx',
  'certs.live': 'Certificados emitidos',
  'perms.shadow': 'Permisos /etc/shadow',
  'users.login': 'Usuarios con login',
  'logs.auth': 'Últimos accesos SSH',
};

export function sshOpLabel(value: string): string {
  return OP_LABEL[value] ?? value;
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function relativeDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'hace instantes';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDateShort(iso);
}

export function durationLabel(startedAt: string | null | undefined, finishedAt: string | null | undefined): string {
  const start = parseDate(startedAt);
  const end = parseDate(finishedAt);
  if (!start || !end) return '—';
  const seconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  if (seconds < 1) return '<1 s';
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} min ${rest} s`;
}

/** Etiqueta amigable para objetivos de demo sin exponer rutas internas. */
export function displayTarget(target: string): string {
  if (/[\\/]tests[\\/]fixtures[\\/]vuln-app/i.test(target)) return 'Fixture sintético (demo)';
  if (/^https?:\/\/127\.0\.0\.1:\d+\/?$/i.test(target)) return 'Laboratorio Node (demo)';
  return target;
}

export function shortTarget(target: string, max = 52): string {
  const label = displayTarget(target);
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

