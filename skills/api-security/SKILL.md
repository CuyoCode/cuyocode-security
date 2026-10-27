# Skill: seguridad de APIs

1. **Objetivo:** revisar diseño y exposición de APIs REST/HTTP.
2. **Alcance:** Especificación OpenAPI del usuario + código + pruebas pasivas. Sin fuzzing en producción.
3. **Tecnologías:** REST, JSON, CORS, rate-limit, paginación, webhooks.
4. **Metodología:** Inventario (OpenAPI + estático) → auth por endpoint → validación → rate-limit → errores → CORS → documentación expuesta → webhooks.
5. **Patrones vulnerables:** Endpoints sin auth inesperados; exceso de datos (DNI/claves en listados); sin paginación/límites; errores con stack; `/docs` en prod; webhooks sin firma; CORS `*` con credenciales.
6. **Patrones seguros:** OpenAPI como contrato + validación (zod/class-validator); rate-limit por usuario+IP; errores genéricos con ID de correlación; firmas HMAC en webhooks con replay protection.
7. **Casos límite:** Documentación en prod tras auth admin (aceptable documentado); GraphQL necesita análisis propio.
8. **Falsos positivos:** Campos "sensibles" que el propio usuario consulta (evaluar minimización, no marcar critical automático).
9. **Evidencia:** Método+ruta+auth requerida+respuesta (redactada) o cita OpenAPI.
10. **Severidad:** Datos ajenos/sin auth → high; exceso de datos → medium; docs expuestas → medium/low.
11. **Referencias:** OWASP API Security Top 10 2023, REST Assessment Cheat Sheet.
12. **Pruebas automatizables:** Importar OpenAPI y cruzar con guards (estático); rate-limit en laboratorio.
13. **Privacidad:** No enviar OpenAPI con datos reales a IA externa sin consentimiento.
14. **Aceptación:** Inventario endpoint→auth→validación con gaps marcados.
