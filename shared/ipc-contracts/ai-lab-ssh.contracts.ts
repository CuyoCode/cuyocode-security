// Contratos IA, laboratorio y perfiles SSH.

export const AI_CHANNELS = {
  status: 'ai:status',
  configure: 'ai:configure',
  test: 'ai:test',
  forget: 'ai:forget',
} as const;

export interface AiStatus {
  mode: 'off' | 'local' | 'external';
  ollamaModel: string | null;
  ollamaOk: boolean | null;
  externalEndpoint: string | null;
  externalOk: boolean | null;
  hasKey: boolean;
}

export interface AiConfigureInput {
  mode: 'off' | 'local' | 'external';
  ollamaModel?: string;
  endpoint?: string;
  model?: string;
  maxTokens?: number;
  /** Clave en texto (solo viaja por IPC; en disco vive cifrada si remember). */
  apiKey?: string;
  /** Guardar la clave cifrada con el almacén del SO (por defecto true). */
  remember?: boolean;
}

export const LAB_CHANNELS = {
  docker: 'lab:docker',
  status: 'lab:status',
  create: 'lab:create',
  remove: 'lab:remove',
  check: 'lab:check',
  nodeCreate: 'lab:node-create',
  nodeStop: 'lab:node-stop',
  nodeList: 'lab:node-list',
} as const;

export const SSH_CHANNELS = {
  list: 'ssh:list',
  create: 'ssh:create',
  remove: 'ssh:remove',
  fetchKey: 'ssh:fetch-key',
  pinKey: 'ssh:pin-key',
  exec: 'ssh:exec',
} as const;

export interface SshProfileInput {
  name: string;
  host: string;
  port: number;
  user: string;
  keyPath: string;
}

export interface SshProfileDto extends SshProfileInput {
  id: string;
  knownHostsPath: string;
  opsVersion: number;
  createdAt: string;
}
