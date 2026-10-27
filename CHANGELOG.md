# Changelog

## [0.2.2] — Selector de carpetas + guía de instalación

- Botón **Examinar…** con diálogo nativo en Nueva auditoría y Proyectos
  (canal `system:pick-folder`; el renderer nunca recibe rutas arbitrarias).
- Herramientas: estado integrada/ausente, botón **Web oficial** (allowlist
  exacta en main, `system:open-install-page`) y comando winget copiable.
  La app no instala nada por su cuenta.
- Corrección: npm se detecta en Windows vía `cmd /c` fijo (los `.cmd` no se
  pueden spawnear directo); SSH parsea `OpenSSH_for_Windows_X`; el stub de
  Python Store se informa ausente. 65 pruebas verdes.

- Nuevo laboratorio liviano: app vulnerable propia en Node puro (XSS/IDOR/
  login demo, datos sintéticos), loopback fijo, healthcheck y apagado al salir.
- Puerta `assertNodeLabIsolation` (proceso+puerto+loopback); `lab-advanced`
  admite `node-…` además de Docker. Docker deja de ser requisito.
- Corrección: `ports-tcp` parsea host/puerto también desde URL completa.
- UI Laboratorio con sección Node; asistente acepta `node-…`.
- 61 pruebas verdes.

## [0.2.0] — Fases 2–7: motor completo

- Orquestador con perfiles, cancelación, timeouts y errores de cobertura visibles.
- 9 motores propios + 6 adaptadores opcionales (omitidos con motivo si faltan).
- Esquema de hallazgos validado, ids estables, `audit_findings` histórico.
- Informes JSON/HTML redactados, comparación, revisión con justificación.
- SSH solo-lectura con pin de host key; laboratorio con puerta de aislamiento.
- IA local/externa opt-in con consentimiento y salida validada.
- Asistente de 6 pasos, ejecución con progreso, SSH/Lab/IA en la UI.
- 14 skills Markdown, 19 reglas versionadas, 5 perfiles.
- Esquema SQLite v5 con backups. 57 pruebas (unitarias, integración, seguridad).

## [0.1.0] — Fase 1: base desktop

- Ventana endurecida, IPC validado, registro de proyectos, detección de
  herramientas, SQLite + migraciones, logging redactado.
