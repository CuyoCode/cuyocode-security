// Adaptador de API externa compatible OpenAI.
// La clave vive solo en memoria del proceso principal durante la sesión:
// nunca se persiste ni se registra. Sin consentimiento no se envía nada.

import type { AiAnalysis, AiProvider, AiReviewRequest } from './providers';
import { analysisPrompt, validateAnalysis } from './providers';

export interface ExternalConfig {
  endpoint: string;
  model: string;
  maxTokens: number;
}

export function validateExternalConfig(input: unknown): ExternalConfig {
  if (typeof input !== 'object' || input === null) throw new Error('Configuración IA inválida');
  const c = input as Record<string, unknown>;
  if (typeof c['endpoint'] !== 'string') throw new Error('endpoint inválido');
  let url: URL;
  try {
    url = new URL(c['endpoint']);
  } catch {
    throw new Error('endpoint no URL');
  }
  if (url.protocol !== 'https:') throw new Error('el endpoint externo debe ser https');
  if (typeof c['model'] !== 'string' || c['model'].length === 0 || c['model'].length > 100) {
    throw new Error('modelo inválido');
  }
  const maxTokens = typeof c['maxTokens'] === 'number' ? Math.floor(c['maxTokens']) : 2000;
  if (maxTokens < 100 || maxTokens > 16000) throw new Error('maxTokens fuera de rango 100-16000');
  return { endpoint: url.toString(), model: c['model'], maxTokens };
}

export class ExternalProvider implements AiProvider {
  readonly id = 'external';
  readonly label = 'API externa (con consentimiento)';
  private config: ExternalConfig;
  private apiKey: string;

  constructor(config: ExternalConfig, apiKey: string) {
    if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 500) {
      throw new Error('API key inválida');
    }
    this.config = config;
    this.apiKey = apiKey;
  }

  /** Borra la clave de memoria (al cerrar sesión o cambiar de proveedor). */
  forget(): void {
    this.apiKey = '';
  }

  async test(): Promise<{ ok: boolean; detail: string }> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      timer.unref?.();
      const res = await fetch(`${this.config.endpoint.replace(/\/$/, '')}/models`, {
        headers: { authorization: `Bearer ${this.apiKey}` },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (res.status === 401 || res.status === 403) return { ok: false, detail: 'API key rechazada' };
      if (!res.ok) return { ok: false, detail: `Endpoint respondió ${res.status}` };
      return { ok: true, detail: 'Endpoint accesible' };
    } catch {
      return { ok: false, detail: 'Endpoint no accesible' };
    }
  }

  async analyze(request: AiReviewRequest, opts: { timeoutMs: number }): Promise<AiAnalysis> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    timer.unref?.();
    try {
      const res = await fetch(`${this.config.endpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          messages: [{ role: 'user', content: analysisPrompt(request) }],
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`API externa respondió ${res.status}`);
      const data = (await res.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: string } }>;
      } | null;
      const content = data?.choices?.[0]?.message?.content ?? '';
      let parsed: unknown;
      try {
        const start = content.indexOf('{');
        parsed = JSON.parse(start >= 0 ? content.slice(start) : '{}') as unknown;
      } catch {
        throw new Error('API externa: respuesta no JSON');
      }
      return validateAnalysis(parsed, 'external', this.config.model);
    } finally {
      clearTimeout(timer);
    }
  }
}
