# Formato de informe

Cada auditoría genera JSON estructurado + HTML legible (`reports:generate`,
`reports:save` con diálogo). Contenido:

1. Objetivo, fecha/duración, perfil, alcance, motores+versiones, reglas.
2. Tecnologías (hallazgo `recon-stack`), resumen por severidad.
3. Confirmados vs pendientes (por `verificationStatus`, no solo severidad).
4. Evidencias redactadas, impacto, validación, corrección, referencias.
5. Limitaciones fijas + notas de cobertura (errores/omisiones de motores).
6. Sin secretos, sin score global.

## Esquema de hallazgo

Ver `shared/finding-schema.ts` (fuente normativa): `id` estable
(`motor|regla|objetivo|ubicación|evidencia`), `severity`/`confidence`/
`verificationStatus` separados, `status` de revisión con historial y
justificación obligatoria para falsos positivos.

## Comparación

`audits:compare` por ids estables: nuevos, resueltos, persistentes. La tabla
`audit_findings` conserva la atribución histórica aunque se re-ejecute.
