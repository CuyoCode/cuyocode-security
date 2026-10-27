# Privacidad

## Lo que NUNCA sale del equipo sin consentimiento explícito

- Código fuente, `.env`, claves privadas, historial git, datos de clientes.
- La política por defecto es local: los 4 motores base funcionan offline
  (salvo `npm audit`/`trivy`, que requieren red y lo informan).

## IA externa (opt-in por auditoría)

1. Se informa qué se envía: resumen de hallazgos + hasta 12 fragmentos
   redactados (máx. 1500 caracteres cada uno).
2. Exclusiones fijas: `.env*`, `*.pem/key`, `id_rsa`, `.git/`, `*credential*`,
   `*secret*`.
3. Consentimiento con checkbox (no pre-marcado) + registro de proveedor,
   modelo y archivos (sin guardar el contenido transmitido).
4. La API key se guarda **cifrada con el almacén del SO** (DPAPI en Windows,
   `vault.json` + `ai-config.json` en la carpeta de datos) solo si el usuario
   tilda *Recordar*; `Ajustes → Olvidar` la borra. Jamás viaja en logs.

## Datos locales

`%APPDATA%\cuyocode-security\cuyocode-security\`: SQLite (proyectos,
auditorías, hallazgos con evidencias redactadas), backups pre-migración (3),
`ssh/` (known_hosts por perfil, rutas de claves — nunca contenidos),
`logs/app.log` (redactado, rotación 1 MB).

## Exportación

Informes JSON/HTML con redacción aplicada también a vistas previas.
Sin telemetría, sin analítica, sin envíos automáticos.
