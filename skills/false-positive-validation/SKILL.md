# Skill: validación de falsos positivos

1. **Objetivo:** decidir si una sospecha es vulnerabilidad, FP o no-verificable, con evidencia.
2. **Alcance:** Hallazgos `possible`/`evidence-found` de cualquier motor.
3. **Tecnologías:** Todas.
4. **Metodología:** 1) Leer regla y su lista de FP. 2) Trazar flujo (origen→sumidero). 3) Buscar mitigación en otra capa. 4) Probar en laboratorio con datos sintéticos (mínimo impacto). 5) Clasificar: confirmed / false-positive (justificado) / unverified.
5. **Patrones vulnerables:** Flujo completo con entrada externa real; mitigación ausente; explotación mínima demostrada en lab.
6. **Patrones seguros:** Sanitización/validación efectiva intermedia; constantes internas; código muerto/inaccesible; mitigación documentada y vigente.
7. **Casos límite:** Mitigación parcial (baja severidad, no FP); explotación que requiere precondiciones raras (documentarlas, no ignorar).
8. **Falsos positivos:** Marcar solo con justificación ≥10 caracteres + qué se revisó. Un FP mal marcado es deuda de riesgo.
9. **Evidencia:** Qué se leyó, qué se ejecutó (comando exacto, entorno lab), resultado observado.
10. **Severidad:** Re-evaluar tras validar (un confirmed puede bajar si el impacto real es menor).
11. **Referencias:** Regla que originó el hallazgo + docs del framework.
12. **Pruebas automatizables:** Re-ejecutar el motor tras el fix; tests de regresión.
13. **Privacidad:** Pruebas solo con datos sintéticos; evidencias redactadas.
14. **Aceptación:** 0 hallazgos `possible` sin pasos de validación escritos; FPs justificados uno por uno.
