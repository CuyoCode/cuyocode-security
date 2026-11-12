# Formato de informe

Cada auditoría genera JSON estructurado + HTML legible + PDF opcional
(`reports:generate`, `reports:save` con diálogo). Contenido:

1. Portada con objetivo, perfil, estado, fechas, duración y versión de la app.
2. Resumen ejecutivo: accionables, confirmados, pendientes y conteo por severidad.
3. Top de riesgos priorizados.
4. Tabla de hallazgos y detalle con evidencias redactadas, impacto, validación
   segura, corrección y referencias.
5. Cobertura: motores planificados, motores con hallazgos y notas de
   errores/omisiones.
6. Limitaciones fijas. Sin secretos y sin puntuación global.

## Esquema JSON

- `generator`, `version`, `generatedAt`
- `audit`: id, perfil, título, objetivo, estado, fechas, duración, error
- `scope`, `engines`, `coverage`, `summary` (`total`, `actionable`,
  `bySeverity`, `byStatus`, `confirmed`, `pending`)
- `findings[]`, `notes[]`, `limitations[]`

## Esquema de hallazgo

Ver `shared/finding-schema.ts` (fuente normativa): `id` estable
(`motor|regla|objetivo|ubicación|evidencia`), `severity`/`confidence`/
`verificationStatus` separados, `status` de revisión con historial y
justificación obligatoria para falsos positivos.

## Comparación

`audits:compare` por ids estables: nuevos, resueltos, persistentes. La tabla
`audit_findings` conserva la atribución histórica aunque se re-ejecute.

## CLI

La CLI genera los mismos JSON/HTML sin abrir Electron. Con `--fail-on` devuelve
código 2 si hay hallazgos accionables en el umbral, para integrarlo en CI.
