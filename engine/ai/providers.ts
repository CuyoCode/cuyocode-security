// Interfaz común de proveedores de IA. La IA interpreta y propone; nunca
// ejecuta, nunca cambia el alcance, su salida se valida contra esquema.

export interface AiSnippet {
  file: string;
  excerpt: string;
}

export interface AiReviewRequest {
  auditGoal: string;
  technologies: string[];
  scope: string;
  rules: string[];
  findingsSummary: Array<{ id: string; title: string; severity: string; verificationStatus: string }>;
  snippets: AiSnippet[];
}

export interface AiAnnotation {
  findingId: string;
  opinion: 'supports' | 'disputes' | 'uncertain';
  rationale: string;
}

export interface AiAnalysis {
  provider: string;
  model: string;
  summary: string;
  annotations: AiAnnotation[];
  suggestedNextSteps: string[];
}

export interface AiProvider {
  id: string;
  label: string;
  test(): Promise<{ ok: boolean; detail: string }>;
  analyze(request: AiReviewRequest, opts: { timeoutMs: number }): Promise<AiAnalysis>;
}

export function validateAnalysis(input: unknown, provider: string, model: string): AiAnalysis {
  if (typeof input !== 'object' || input === null) throw new Error('IA: respuesta no objeto');
  const r = input as Record<string, unknown>;
  if (typeof r['summary'] !== 'string' || r['summary'].trim().length === 0) {
    throw new Error('IA: sin resumen');
  }
  const annotations: AiAnnotation[] = [];
  if (Array.isArray(r['annotations'])) {
    for (const a of r['annotations']) {
      if (typeof a !== 'object' || a === null) continue;
      const an = a as Record<string, unknown>;
      if (typeof an['findingId'] !== 'string') continue;
      if (!['supports', 'disputes', 'uncertain'].includes(String(an['opinion']))) continue;
      if (typeof an['rationale'] !== 'string' || an['rationale'].length < 10) continue;
      annotations.push({ findingId: an['findingId'], opinion: an['opinion'] as AiAnnotation['opinion'], rationale: an['rationale'].slice(0, 2000) });
    }
  }
  const steps = Array.isArray(r['suggestedNextSteps'])
    ? (r['suggestedNextSteps'] as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 20)
    : [];
  return { provider, model, summary: (r['summary'] as string).slice(0, 4000), annotations, suggestedNextSteps: steps };
}

export function analysisPrompt(request: AiReviewRequest): string {
  return [
    'Sos un revisor de seguridad. Respondé SOLO JSON válido con esta forma:',
    '{"summary": string, "annotations": [{"findingId": string, "opinion": "supports|disputes|uncertain", "rationale": string}], "suggestedNextSteps": [string]}',
    'No inventes vulnerabilidades ni afirmes explotación sin evidencia. Si falta evidencia, opinion=uncertain.',
    `Objetivo de la auditoría: ${request.auditGoal}`,
    `Tecnologías: ${request.technologies.join(', ') || 'desconocidas'}`,
    `Alcance permitido: ${request.scope}`,
    `Reglas aplicadas: ${request.rules.join(', ') || 'ninguna'}`,
    `Hallazgos: ${JSON.stringify(request.findingsSummary).slice(0, 6000)}`,
    `Fragmentos: ${JSON.stringify(request.snippets).slice(0, 6000)}`,
  ].join('\n');
}
