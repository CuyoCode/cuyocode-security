# Skill: Node.js

1. **Objetivo:** revisar backends Node (Express/Fastify/NestJS) y dependencias.
2. **Alcance:** Código y lockfiles locales. No `npm install` de orígenes no verificados durante la auditoría.
3. **Tecnologías:** Node 18/20/22/24, npm, Express, JWT, bcrypt/argon2.
4. **Metodología:** Superficie (rutas) → middlewares (auth, rate-limit, validación) → dependencias (`npm audit`, lockfile) → secretos → crypto → errores.
5. **Patrones vulnerables:** `eval`/`Function`; `exec` con interpolación (usar `spawn`+argv); SQL concatenado; `X-Powered-By` + stack traces; JWT sin expiración; `Math.random` para seguridad; `crypto.createHash('md5')` para passwords.
6. **Patrones seguros:** `helmet`, rate-limit, `celebrate`/`zod`, consultas parametrizadas, argon2/bcrypt con costo adecuado, `NODE_ENV=production`.
7. **Casos límite:** `child_process` con comandos fijos (seguro); `vm` no es sandbox; `postMessage`/workers con datos.
8. **Falsos positivos:** DevDependencies vulnerables no desplegadas; audit de `npm` con `fixAvailable:false` sin parche.
9. **Evidencia:** Ruta+línea, versión afectada y corregida (deps), salida de `npm audit` citada.
10. **Severidad:** RCE/inyección → critical/high; cabeceras → low/info con contexto.
11. **Referencias:** OWASP Node.js Cheat Sheet, nodejs.org seguridad.
12. **Pruebas automatizables:** `npm audit --json`, `rules/javascript.json`, tests de rate-limit en laboratorio.
13. **Privacidad:** `npm audit` envía el árbol de dependencias al registro: informar al usuario.
14. **Aceptación:** Lockfile presente, 0 vulnerabilidades high/critical o plan documentado.
