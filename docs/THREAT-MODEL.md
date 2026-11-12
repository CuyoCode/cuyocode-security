# Modelo de amenazas (propio de la herramienta)

La herramienta maneja objetivos sensibles y credenciales: es un objetivo
atractivo. Activos: código auditado, secretos detectados, perfiles SSH, clave
API cifrada o en memoria, historial local.

## Amenazas y mitigaciones

1. **Renderer comprometido → RCE.** `nodeIntegration:false`, `sandbox:true`,
   `contextIsolation:true`, CSP de producción, preload con 44 métodos fijos,
   navegación y ventanas bloqueadas, permisos denegados por defecto y
   validación total en main. Tests: `electron-hardening.test.ts`.
2. **Inyección de comandos vía IPC.** Sin `shell:true`; allowlists (perfiles,
   ops SSH, imágenes); argumentos con NUL/saltos de línea rechazados; comandos
   remotos SSH validados contra el catálogo y no contra caracteres de shell.
3. **SSRF / escape de alcance.** `guardedFetch`: resolución y validación de IPs,
   detección de rebinding, redirecciones solo al mismo host, IPs sensibles
   bloqueadas salvo `allowPrivate` explícito. Tests: `web-local`, `scope-network`.
4. **Fuga de secretos.** `redact`/`redactCode` en logs, evidencias, SSH, IA,
   títulos/impacto y exportaciones; huellas en lugar de valores; clave API
   cifrada con DPAPI o solo en memoria. Tests: `redaction`, `report`.
5. **SSH como vector.** Solo operaciones del catálogo versionado, claves por
   ruta (no contenido), `StrictHostKeyChecking=yes` + pin manual, `BatchMode`.
6. **Laboratorio que toca producción.** Puerta `assertLabIsolation` valida lab
   vivo y puerto publicado; sin verificación, `lab-advanced` se bloquea.
   Limpieza por etiqueta. Contenedores con `cap-drop ALL` y `no-new-privileges`.
7. **IA que filtra código.** Exclusiones (.env, claves, git), tope de
   fragmentos, consentimiento por corrida persistido, modo por auditoría
   (nunca el global), endpoint atado a la clave y salida validada por esquema.
8. **Falsa confianza.** Taxonomía de estados, sin score global, cobertura y
   limitaciones visibles en cada informe.
9. **Ejecutable manipulado.** Single instance, fuses (`RunAsNode` off,
   integridad ASAR, `onlyLoadAppFromAsar`), CSP de producción y sin
   `node_modules` empaquetados. Firma de código pendiente.

## Riesgos aceptados (documentados)

- Usuario SSH con más permisos de los mínimos: la herramienta advierte, no lo
  puede impedir del lado cliente.
- `npm audit` envía el árbol de dependencias al registro: se informa.
- Sin sandbox de SO para motores: los escáneres corren con permisos del usuario.
- Instalador Windows sin firma: SmartScreen puede advertir.
- El guardia DNS resuelve antes y después de la petición; la ventana TOCTOU
  residual se documenta y se reduce con validación previa y posterior.
