# Proveedores de IA

La IA es opcional: los controles deterministas funcionan sin ella. Modos:

## off (por defecto)

Sin llamadas. El informe lo indica.

## local — Ollama

- Endpoint: `OLLAMA_HOST` o `http://127.0.0.1:11434`.
- `ai:test` verifica daemon + modelo instalado (`ollama pull llama3.1`).
- Todo queda en el equipo. Límite 180 s por análisis.

## external — API compatible OpenAI

- Solo `https`, `maxTokens` 100–16000, timeout 120 s.
- Clave solo en memoria de sesión (`ai:forget` la borra).
- Consentimiento por auditoría (ver `PRIVACY.md`).

## Contrato con el modelo

Recibe: objetivo, tecnologías, alcance, reglas, resumen de hallazgos y
fragmentos mínimos. Devuelve JSON validado (`summary`, `annotations`,
`suggestedNextSteps`). Sin esquema válido → hallazgos pendientes, sin
opinión inventada. El modelo no cambia alcance ni ejecuta nada; el repo
auditado se trata como datos no confiables (anti prompt-injection).

## Estado en este entorno

Ollama no instalado → `ai:test` informa no disponible. Sin claves
configuradas. Revisiones IA: 0 realizadas (verificable en `ai_analyses`).
