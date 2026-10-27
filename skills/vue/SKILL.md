# Skill: Vue 3

1. **Objetivo:** revisar frontends Vue (XSS, sesión, exposición, controles solo-visuales).
2. **Alcance:** Código `src/`, config Vite, sin probar contra producción.
3. **Tecnologías:** Vue 3, Vite, Pinia, vue-router, axios/fetch.
4. **Metodología:** Buscar `v-html`, `innerHTML`, `postMessage`, `localStorage` con tokens, `import.meta.env`, guards de router, manejo de errores que vuelque respuestas.
5. **Patrones vulnerables:** `v-html` con datos; token en `localStorage`; `VITE_*SECRET/KEY/TOKEN`; `postMessage(...,'*')`; `http://` a APIs; rutas "admin" solo ocultas por `v-if`.
6. **Patrones seguros:** Interpolación `{{ }}` (escapa), DOMPurify, cookies `HttpOnly+Secure+SameSite`, autorización real en backend, CSP.
7. **Casos límite:** `v-html` con contenido 100% estático; `VITE_*` públicas documentadas (maps); guards de router como UX, no como seguridad.
8. **Falsos positivos:** Sanitización en el backend antes de servir; `postMessage` a origen exacto.
9. **Evidencia:** Componente:línea + origen del dato (prop/store/respuesta API).
10. **Severidad:** XSS con sesión → high; token en storage → medium; `VITE_*` sensible → medium/high.
11. **Referencias:** OWASP XSS Prevention, Vue docs (seguridad), HTML5 Security Cheat Sheet.
12. **Pruebas automatizables:** `rules/vue.json`, CSP evaluada en laboratorio.
13. **Privacidad:** No subir bundles a analizadores externos sin consentimiento (contienen lógica y endpoints).
14. **Aceptación:** 0 `v-html` con datos no confiables o sanitización demostrada.
