# Skill: revisión manual de código

1. **Objetivo:** encontrar lo que los escáneres no ven: lógica de negocio, autorización, flujos.
2. **Alcance:** Repositorio local. No ejecutar el código salvo tests del propio proyecto en entorno aislado.
3. **Tecnologías:** JS/TS, Vue SFC, configs, Docker, SQL.
4. **Metodología:** Entradas (rutas, DTOs, query params) → sumideros (DB, exec, render, fs). Trazar 3 flujos críticos: autenticación, autorización por objeto, dinero/datos sensibles.
5. **Patrones vulnerables:** `eval`, `exec` con interpolación, SQL concatenado, `innerHTML`/`v-html` con datos, secretos literales, `synchronize:true`, CORS `*` con credenciales.
6. **Patrones seguros:** Validación con allowlist, consultas parametrizadas, salida codificada, secretos en entorno, migraciones.
7. **Casos límite:** Decoradores que parecen proteger (`@UseGuards`) pueden tener excepciones globales o rutas excluidas: leer el módulo, no el símbolo.
8. **Falsos positivos:** Sanitización en otra capa, constantes internas, código muerto.
9. **Evidencia:** Archivo:líneas del origen y del sumidero + cadena de propagación.
10. **Severidad:** según datos alcanzables y autenticación requerida (ver methodology).
11. **Referencias:** OWASP Code Review Guide, CWE-20/78/89/79/798.
12. **Pruebas automatizables:** Reglas en `rules/*.json` (motor `cuyocode-patterns`).
13. **Privacidad:** No copiar secretos a notas; usar huellas.
14. **Aceptación:** Cada hallazgo con flujo trazado o marcado `possible` con pasos de validación.
