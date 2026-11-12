# Proveedores de IA

La IA es opcional: los controles deterministas funcionan sin ella. Modos:

## off (por defecto)

Sin llamadas. El informe lo indica.

## local — Ollama

- Endpoint: `OLLAMA_HOST` o `http://127.0.0.1:11434`.
- `ai:test` verifica daemon + modelo instalado (`ollama pull llama3.1`).
- Todo queda en el equipo. Límite 180 s por análisis.

## external — API compatible OpenAI

- Solo `https` público; se rechazan loopback, `.local` e IPs privadas.
- `maxTokens` 100–16000, timeout 120 s.
- La clave se guarda cifrada con DPAPI si *Recordar* está activo; si no, vive
  solo en memoria de la sesión (`ai:forget` la borra).
- Si se cambia el endpoint, la clave debe ingresarse de nuevo.
- Consentimiento por auditoría (ver `PRIVACY.md`). El modo de la auditoría
  manda: si elegiste local, no se usa el proveedor externo global.

## Contrato con el modelo

Recibe: objetivo, tecnologías, alcance, reglas, resumen de hallazgos y
fragmentos mínimos redactados. Devuelve JSON validado (`summary`,
`annotations`, `suggestedNextSteps`). Sin esquema válido → hallazgos pendientes,
sin opinión inventada. El modelo no cambia alcance ni ejecuta nada; el repo
auditado se trata como datos no confiables (anti prompt-injection).

## Estado en este entorno

Ollama no instalado → `ai:test` informa no disponible. Sin claves
configuradas. Las revisiones IA son opcionales y no bloquean la auditoría.
