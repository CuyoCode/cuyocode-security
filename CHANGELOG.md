# Changelog

## [0.3.0] — Presentación profesional, demo y CLI

- **Rediseño visual completo:** sidebar agrupada, topbar con breadcrumb, design
  system propio (botones, cards, tablas, badges de severidad/estado, toasts,
  diálogos de confirmación, skeletons, charts SVG) y estados de carga/vacío/error.
- Identidad de marca: logo de CuyoCode en la navbar, paleta teal/navy y UI plana
  sin gradientes ni glows decorativos. Pantalla de fallback si la interfaz se
  abre en un navegador sin el puente de Electron. Dev server aislado en `:5199`
  para evitar colisiones con otros proyectos.
- **Demo de un clic:** auditoría estática del fixture sintético + laboratorio
  Node local, con hallazgos y revisiones de ejemplo. Sin Docker ni IA.
- **Onboarding:** bienvenida con tres caminos y checklist de primeros pasos.
- **Informe ejecutivo:** portada, resumen, top de riesgos, cobertura por motor,
  duración y limitaciones; exportación JSON/HTML/PDF con marca.
- **CLI headless** (`audit:cli`) para CI con `--fail-on` por severidad.
- **Seguridad:**
  - redacción PEM/Bearer corregida (duplicaba claves privadas);
  - operaciones SSH permitidas ya no se autobloquean;
  - consentimiento IA por auditoría y clave ligada al endpoint;
  - puerta de laboratorio Docker valida el puerto publicado;
  - timeout global con `AbortController` real y cancelación de procesos;
  - `npm audit` funciona en Windows;
  - PDF con márgenes correctos;
  - migración v6 repara fechas y agrega índices; backup WAL-safe;
  - recuperación de auditorías interrumpidas.
- **Electron:** single instance, bloqueo de navegación/ventanas, permisos
  denegados por defecto, CSP de producción, fuses, `utilityProcess` para el
  laboratorio Node y limpieza del ASAR.
- **Repo público:** licencia MIT, README con capturas, CI, plantillas,
  contribución, código de conducta y documentación sincronizada.
- 80 pruebas verdes (unitarias, integración y seguridad), incluyendo demo E2E,
  redacción de informes y reparación de migraciones.
- Perfiles nuevos: `local-code-deep` (adaptadores opcionales) y `server-readonly`
  con Nmap opcional.

## [0.2.3] — Bóveda cifrada, PDF e icono

- Bóveda `vault.json` cifrada con DPAPI (`safeStorage`): la API key externa
  se recuerda entre sesiones solo con consentimiento; `Olvidar` la borra.
- Exportar PDF real (`printToPDF`).
- Icono propio generado sin dependencias + conectado al instalador;
  `docs/SIGNING.md` con procedimiento de firma (instalador aún sin firmar).
- Botón **Examinar…** con diálogo nativo en Nueva auditoría y Proyectos.
- Herramientas: estado integrada/ausente, botón **Web oficial** y comando winget copiable.
- Corrección: npm se detecta en Windows vía `cmd /c` fijo; SSH parsea
  `OpenSSH_for_Windows_X`; el stub de Python Store se informa ausente.

## [0.2.0] — Motor completo

- Orquestador con perfiles, cancelación, timeouts y errores de cobertura visibles.
- 9 motores propios + adaptadores opcionales (omitidos con motivo si faltan).
- Esquema de hallazgos validado, ids estables, `audit_findings` histórico.
- Informes JSON/HTML redactados, comparación, revisión con justificación.
- SSH solo-lectura con pin de host key; laboratorio con puerta de aislamiento.
- IA local/externa opt-in con consentimiento y salida validada.
- Asistente de 6 pasos, ejecución con progreso, SSH/Lab/IA en la UI.
- 14 skills Markdown, 19 reglas versionadas, perfiles por objetivo.
- Esquema SQLite con backups.

## [0.1.0] — Base desktop

- Ventana endurecida, IPC validado, registro de proyectos, detección de
  herramientas, SQLite + migraciones, logging redactado.
