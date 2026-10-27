# Skill: autenticación

1. **Objetivo:** verificar identidad (quién sos) en APIs y apps.
2. **Alcance:** Código + pruebas en laboratorio con cuentas sintéticas. Nunca credenciales reales ni spraying en producción.
3. **Tecnologías:** JWT, sesiones, OAuth2/OIDC, bcrypt/argon2, TOTP.
4. **Metodología:** Registro → login → emisión → almacenamiento → renovación → cierre. Revisarhash, comparación constant-time, expiración, rotación, bloqueo por intentos, recuperación.
5. **Patrones vulnerables:** Passwords en claro/md5; secreto JWT literal; sin expiración; sesión sin rotación tras login (fijación); sin límite de intentos; reset por token predecible; `alg:none`.
6. **Patrones seguros:** argon2/bcrypt, JWT corto + refresh rotativo atado a dispositivo, `HttpOnly+Secure+SameSite`, rate-limit + captcha progresivo, TOTP opcional.
7. **Casos límite:** APIs máquina-a-máquina (mTLS/API keys con rotación); "recordarme" con token separado de larga vida y revocable.
8. **Falsos positivos:** Falta de `HttpOnly` en cookies no-sesión; 2FA ausente en riesgo bajo documentado.
9. **Evidencia:** Flujo completo + expiraciones + almacenamiento del token.
10. **Severidad:** Bypass/secretos → critical/high; falta de rate-limit → medium.
11. **Referencias:** OWASP Authentication Cheat Sheet, ASVS 2.x.
12. **Pruebas automatizables:** Login con credenciales inválidas (429 esperado), token expirado rechazado, reuse de refresh detectado.
13. **Privacidad:** Cuentas de prueba sintéticas; no tocar sesiones reales.
14. **Aceptación:** Matriz de flujos con resultado esperado y observado.
