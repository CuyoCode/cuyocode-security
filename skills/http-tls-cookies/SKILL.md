# Skill: HTTP / TLS / cookies

1. **Objetivo:** evaluar transporte y sesión web sin explotar.
2. **Alcance:** URLs autorizadas. Pasivo por defecto; activo solo con límites y sin métodos mutantes en prod.
3. **Tecnologías:** HTTPS, HSTS, CSP, cookies, Railway/proxies.
4. **Metodología:** HTTP→HTTPS → certificado (cadena, host, vigencia, protocolo) → cabeceras (contexto!) → cookies por tipo → rutas sensibles → errores.
5. **Patrones vulnerables:** Sin HTTPS; certificado inválido/vencido; TLS <1.2; HSTS ausente en HTTPS; sesión sin `Secure/HttpOnly/SameSite`; stack traces; `.env`/`.git` públicos.
6. **Patrones seguros:** 301 a HTTPS + HSTS con preload evaluado; TLS 1.2+; CSP_nonce/estricta; cookies `Secure+HttpOnly+SameSite`; errores genéricos.
7. **Casos límite:** HSTS en dominios con subdominios legacy (evaluar `includeSubDomains`); framing necesario (allowlist, no `*`); `X-Powered-By` tras proxy.
8. **Falsos positivos:** Cabecera "faltante" no siempre exigible (documentar aplicabilidad); cookie funcional sin flags (info).
9. **Evidencia:** Estado+cabeceras (redactadas) o campos del certificado; nunca cuerpo con datos.
10. **Severidad:** Cert inválido/TLS viejo/`.env` → high; HSTS/sesión → medium; resto → low/info.
11. **Referencias:** OWASP Secure Headers, TLS Cheat Sheet, Session Management.
12. **Pruebas automatizables:** Motores `http-passive`, `tls-check`, `cookies-review`.
13. **Privacidad:** No replay de sesiones; no guardar cookies de terceros.
14. **Aceptación:** Tabla de comprobaciones con aplica/no-aplica justificado.
