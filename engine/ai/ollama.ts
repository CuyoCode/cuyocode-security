// Adaptador Ollama (IA local): funciona sin nube. Verifica disponibilidad,
// modelo instalado y límites antes de analizar.

import type { AiAnalysis, AiProvider, AiReviewRequest } from './providers';
import { analysisPrompt, validateAnalysis } from './providers';

export function ollamaHost(): string {
  const raw = process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434';
  return raw.replace(/\/$/, '');
}

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  timer.unref?.();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return { status: res.status, text: await res.text().catch(() => '') };
  } finally {
    clearTimeout(timer);
  }
}

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama';
  readonly label = 'Ollama (local)';
  private model: string;

  constructor(model: string) {
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(model)) throw new Error('Modelo Ollama inválido');
    this.model = model;
  }

  async test(): Promise<{ ok: boolean; detail: string }> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      timer.unref?.();
      const res = await fetch(`${ollamaHost()}/api/tags`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) return { ok: false, detail: `Ollama respondió ${res.status}` };
      const data = (await res.json().catch(() => null)) as { models?: Array<{ name?: string }> } | null;
      const names = (data?.models ?? []).map((m) => m.name ?? '');
      if (names.some((n) => n === this.model || n.startsWith(`${this.model}:`))) {
        return { ok: true, detail: `Modelo ${this.model} disponible` };
      }
      return { ok: false, detail: `Modelo ${this.model} no instalado (ollama pull ${this.model})` };
    } catch {
      return { ok: false, detail: 'Ollama no accesible en ' + ollamaHost() };
    }
  }

  async analyze(request: AiReviewRequest, opts: { timeoutMs: number }): Promise<AiAnalysis> {
    const { text, status } = await postJson(
      `${ollamaHost()}/api/generate`,
      { model: this.model, prompt: analysisPrompt(request), stream: false, format: 'json' },
      opts.timeoutMs,
    );
    if (status !== 200) throw new Error(`Ollama respondió ${status}`);
    let parsed: unknown;
    try {
      const outer = JSON.parse(text) as { response?: string };
      parsed = JSON.parse(outer.response ?? '{}') as unknown;
    } catch {
      throw new Error('Ollama: respuesta no JSON');
    }
    return validateAnalysis(parsed, 'ollama', this.model);
  }
}
