# Modelo de amenazas (propio de la herramienta)

La herramienta maneja objetivos sensibles y credenciales: es un objetivo
atractivo. Activos: código auditado, secretos detectados, perfiles SSH, clave
API en memoria, historial local.

## Amenazas y mitigaciones

1. **Renderer comprometido → RCE.** Mitigación: `nodeIntegration:false`,
   `sandbox:true`, `contextIsolation:true`, CSP, preload con 30 métodos fijos,
   validación total en main. Tests: `electron-hardening.test.ts`.
2. **Inyección de comandos vía IPC.** Sin `shell:true` en ningún spawn;
   allowlists (perfiles, ops SSH, imágenes por charset); `assertSafeArgs`.
3. **SSRF / escape de alcance.** `guardedFetch`: DNS fijado, rebinding
   detectado, redirecciones solo al mismo host, IPs sensibles bloqueadas salvo
   `allowPrivate` explícito. Tests: `web-local`, `scope-network`.
4. **Fuga de secretos.** `redact`/`redactCode` en logs, evidencias, SSH, IA e
   informes; huellas en lugar de valores; clave API solo en memoria.
5. **SSH como vector.** Solo operaciones del catálogo versionado, claves por
   ruta (no contenido), `StrictHostKeyChecking=yes` + pin manual, `BatchMode`.
6. **Laboratorio que toca producción.** Puerta `assertLabIsolation`: sin Docker
   o sin lab verificado, `lab-advanced` se bloquea. Limpieza solo por etiqueta.
7. **IA que filtra código.** Exclusiones (.env, claves, git), tope de
   fragmentos, consentimiento por corrida, salida validada contra esquema.
8. **Falsa confianza.** Taxonomía de 8 estados; sin score global; limitaciones
   en cada informe.

## Riesgos aceptados (documentados)

- Usuario SSH con más permisos de los mínimos: la herramienta advierte, no lo
  puede impedir del lado cliente.
- `npm audit` envía el árbol de dependencias al registro: se informa.
- Sin sandbox de SO para motores: los escáneres corren con permisos del usuario.
