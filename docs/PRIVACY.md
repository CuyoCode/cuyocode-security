# Privacidad

## Lo que NUNCA sale del equipo sin consentimiento explícito

- Código fuente, `.env`, claves privadas, historial git, datos de clientes.
- La política por defecto es local. `npm audit` y Trivy pueden requerir red y lo
  informan; los demás motores base funcionan offline.

## IA externa (opt-in por auditoría)

1. Se informa qué se envía: resumen de hallazgos + hasta 12 fragmentos
   redactados (máx. 1500 caracteres cada uno).
2. Exclusiones fijas: `.env*`, `*.pem/key`, `id_rsa`, `.git/`, `*credential*`,
   `*secret*`.
3. Consentimiento con checkbox (no pre-marcado). Se persiste el proveedor,
   modelo, alcance, archivos y fecha efectivamente aplicados; no el contenido.
4. La API key se guarda **cifrada con el almacén del SO** (DPAPI en Windows,
   `vault.json` + `ai-config.json` en la carpeta de datos) solo si el usuario
   tilda *Recordar*. Si cambia el endpoint, la clave debe ingresarse de nuevo.
   `Ajustes → Olvidar` la borra. Jamás viaja en logs.

## Datos locales

`%APPDATA%\CuyoCode Security\cuyocode-security\`: SQLite (proyectos,
auditorías, hallazgos con evidencias redactadas), backups pre-migración (3),
`ssh/` (known_hosts por perfil, rutas de claves — nunca contenidos),
`logs/app.log` (redactado, rotación 1 MB), `vault.json`/`ai-config.json` si se
configura IA externa.

## Exportación

Informes JSON/HTML/PDF con redacción aplicada a evidencias, títulos, impacto,
validación, corrección y referencias. Sin telemetría, sin analítica, sin envíos
automáticos.
