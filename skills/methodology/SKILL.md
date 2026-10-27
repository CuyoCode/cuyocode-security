# Skill: metodología de auditoría

1. **Objetivo:** ordenar cualquier auditoría (código, web, servidor) con evidencia y sin afirmaciones inventadas.
2. **Alcance:** Solo objetivos con autorización expresa y escrita. Nada fuera del alcance aprobado.
3. **Tecnologías:** Todas (este archivo es agnóstico).
4. **Metodología:** 1) Fijar alcance y perfil. 2) Reconocimiento pasivo. 3) Controles deterministas primero (escáneres/reglas). 4) Revisión manual de lo que los escáneres no cubren (lógica de negocio). 5) Clasificar cada hallazgo. 6) Proponer corrección verificable.
5. **Patrones vulnerables:** Dependen de cada skill específica; aquí no se listan para no generalizar.
6. **Patrones seguros:** Evidencia + procedencia (motor, versión, regla) + pasos de validación.
7. **Casos límite:** Código generado, fixtures, tests y ejemplos pueden contener secretos/patrones intencionales: marcar como informativos, no como críticos sin contexto.
8. **Falsos positivos:** Todo patrón estático es sospecha hasta trazar flujo o probar en laboratorio.
9. **Evidencia necesaria:** Archivo+líneas o petición/respuesta (redactada), regla aplicada, cómo reproducir sin dañar.
10. **Criterios de severidad:** critical (RCE/fuga masiva/credenciales reales), high (auth rota/IDOR con datos), medium (cabeceras/validación con impacto), low/info (endurecimiento/informativo).
11. **Referencias:** OWASP Testing Guide, OWASP Cheat Sheet Series, CWE.
12. **Pruebas automatizables:** Las de `tests/` del proyecto + reglas versionadas en `rules/`.
13. **Privacidad:** No exfiltrar código ni secretos; redactar evidencias; IA externa solo con consentimiento.
14. **Aceptación:** Informe con alcance, cobertura, limitaciones y pruebas omitidas. Sin score global inventado.
