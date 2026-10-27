# Laboratorio

Objetivos deliberadamente vulnerables y aislados para pruebas avanzadas.
Dos variantes:

## A. Laboratorio Node (sin Docker, recomendado en esta PC)

- App vulnerable propia (`engine/lab/targets/node-vuln-app.cjs`, Node puro):
  XSS reflejado, IDOR sintético, login débil demo, cookie sin flags, sin
  CSP/HSTS. Sin `eval` ni RCE a propósito.
- Gestión desde la vista Laboratorio: IDs con forma `node-nombre`, puertos
  1024–65535 en `127.0.0.1` (fijo en código), healthcheck y apagado al cerrar.
- Puerta `assertNodeLabIsolation`: proceso vivo + loopback + puerto del lab.
- Aislamiento más débil que Docker (mismo SO): **solo datos sintéticos**,
  jamás credenciales ni datos reales.

## B. Laboratorio Docker (imágenes educativas)

Requiere Docker (binario + daemon). En este equipo: **ausente** → bloqueado
con motivo. Cuando esté disponible: red dedicada `--internal`, etiqueta
`cuyosec.lab=<id>`, publicación solo en `127.0.0.1`, límites CPU/RAM/pids,
limpieza solo de recursos propios.

## Imágenes sugeridas (verificar licencia y digest antes de usar)

- `bkimminich/juice-shop:v17.4.0` (MIT) — API/web moderna.
- `webgoat/webgoat:v2023.8` (GPL-2.0, solo uso interno/educativo).

Fijar siempre versión y, cuando sea viable, digest (`image@sha256:…`).

## Aislamiento aplicado por `lab:create`

- Red dedicada `--internal` (sin Internet desde el objetivo) + etiqueta
  `cuyosec.lab=<id>`.
- Publicación solo en `127.0.0.1:puerto`.
- Límites: 1 CPU, 1 GB RAM, 256 pids.
- Sin socket Docker, sin credenciales reales, sin bases de producción.

## Puerta de ejecución

`lab:check` verifica daemon + lab en ejecución + objetivo en loopback del lab.
`lab:remove` solo toca contenedores/redes con la etiqueta propia: jamás
recursos preexistentes ajenos.
