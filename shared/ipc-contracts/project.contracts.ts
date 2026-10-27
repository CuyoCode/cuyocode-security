// Contratos del canal projects:* — registro mínimo de objetivos (Fase 1).
// La auditoría como tal llega en Fase 2; aquí solo se persiste el objetivo declarado.

export const PROJECT_CHANNELS = {
  list: 'projects:list',
  create: 'projects:create',
  remove: 'projects:remove',
} as const;

export type ProjectKind = 'folder' | 'url' | 'server';

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  /** Ruta absoluta, URL normalizada u host del servidor según kind. */
  target: string;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  kind: ProjectKind;
  target: string;
}
