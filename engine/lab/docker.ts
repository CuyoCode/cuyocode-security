// Gestión del laboratorio Docker: crea objetivos vulnerables aislados con
// límites y etiquetas propias. Solo toca recursos con etiqueta cuyocode.
// Sin Docker → laboratorio no disponible (se informa, no se simula).

import { runTool } from '../process/runner';

export const LAB_LABEL = 'cuyosec.lab';
export const LAB_NET_PREFIX = 'cuyosec-net-';

export interface LabInfo {
  id: string;
  image: string;
  container: string;
  network: string;
  status: string;
  ports: string[];
}

export async function dockerAvailable(): Promise<{ binary: boolean; daemon: boolean; version: string | null }> {
  const ver = await runTool('docker', { args: ['--version'], timeoutMs: 15000, maxOutputBytes: 4096 });
  if (ver.exitCode === null) return { binary: false, daemon: false, version: null };
  const version = /Docker version ([^\s,]+)/.exec(ver.stdout)?.[1] ?? null;
  const info = await runTool('docker', { args: ['info', '--format', '{{.ServerVersion}}'], timeoutMs: 20000, maxOutputBytes: 4096 });
  return { binary: true, daemon: info.exitCode === 0, version };
}

export async function createLab(id: string, image: string, publishPort: number): Promise<LabInfo> {
  if (!/^[a-z0-9-]{4,32}$/.test(id)) throw new Error('id de laboratorio inválido');
  if (!/^[A-Za-z0-9][A-Za-z0-9_./:-]{1,200}$/.test(image)) throw new Error('imagen inválida');
  if (!Number.isInteger(publishPort) || publishPort < 1024 || publishPort > 65535) {
    throw new Error('puerto de publicación fuera de rango 1024-65535');
  }
  const avail = await dockerAvailable();
  if (!avail.binary || !avail.daemon) throw new Error('Docker no disponible (binario o daemon)');
  const network = `${LAB_NET_PREFIX}${id}`;
  const container = `cuyosec-${id}`;
  const net = await runTool('docker', {
    args: ['network', 'create', '--internal', '--label', `${LAB_LABEL}=${id}`, network],
    timeoutMs: 30000, maxOutputBytes: 4096,
  });
  if (net.exitCode !== 0) throw new Error(`no se pudo crear la red aislada: ${net.stderr.slice(0, 200)}`);
  const run = await runTool('docker', {
    args: [
      'run', '-d', '--rm', '--name', container,
      '--network', network,
      '--label', `${LAB_LABEL}=${id}`,
      '--memory', '1g', '--cpus', '1.0', '--pids-limit', '256',
      '--read-only=false',
      '-p', `127.0.0.1:${publishPort}:3000`,
      image,
    ],
    timeoutMs: 120000, maxOutputBytes: 8192,
  });
  if (run.exitCode !== 0) {
    await runTool('docker', { args: ['network', 'rm', network], timeoutMs: 30000, maxOutputBytes: 4096 });
    throw new Error(`no se pudo iniciar el contenedor: ${run.stderr.slice(0, 300)}`);
  }
  return { id, image, container, network, status: 'running', ports: [`127.0.0.1:${publishPort}`] };
}

export async function removeLab(id: string): Promise<void> {
  if (!/^[a-z0-9-]{4,32}$/.test(id)) throw new Error('id de laboratorio inválido');
  // Solo contenedores/redes con nuestra etiqueta: jamás toca recursos ajenos.
  await runTool('docker', { args: ['rm', '-f', `cuyosec-${id}`], timeoutMs: 60000, maxOutputBytes: 4096 });
  await runTool('docker', { args: ['network', 'rm', `${LAB_NET_PREFIX}${id}`], timeoutMs: 30000, maxOutputBytes: 4096 });
}

export async function labStatus(id: string): Promise<LabInfo | null> {
  const ps = await runTool('docker', {
    args: ['ps', '--filter', `label=${LAB_LABEL}=${id}`, '--format', '{{.Names}} {{.Image}} {{.Status}} {{.Ports}}'],
    timeoutMs: 20000, maxOutputBytes: 8192,
  });
  if (ps.exitCode !== 0) return null;
  const line = ps.stdout.split('\n').map((l) => l.trim()).find(Boolean);
  if (!line) return null;
  const [container = '', image = '', ...rest] = line.split(/\s+/);
  return { id, image, container, network: `${LAB_NET_PREFIX}${id}`, status: rest.join(' '), ports: [] };
}
