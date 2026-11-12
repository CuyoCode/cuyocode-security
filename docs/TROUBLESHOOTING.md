# Troubleshooting

## `npm run dev` no abre Electron

- Verificar Vite en `:5199` y `dist-electron/electron/main/main.js` generado.
- Si el puerto `5199` está ocupado por otra app, Vite falla (`strictPort`) y la
  app muestra un diálogo en vez de cargar una interfaz ajena.
- `Error: spawn EINVAL`: usar `scripts/launch-electron.js` actual (ejecutable
  directo, sin `npx.cmd`).
- `ELECTRON_RUN_AS_NODE` seteada por terminales integradas: el launcher la
  limpia; si persiste, abrir PowerShell externa.

## Base de datos

- Ruta: `%APPDATA%\CuyoCode Security\cuyocode-security\*.sqlite`.
  Para aislar datos: `$env:CUYOCODE_USER_DATA = "$PWD\.tmp\perfil"`.
- Migraciones con backup previo WAL-safe (`.bak-*`, se conservan 3). Ante error,
  restaurar el `.bak` más reciente y reportar.
- `user_version` actual: 6.

## Motores omitidos

Todo `omitido: <motivo>` es informativo, no un fallo: indica qué instalar
(Herramientas) o qué límite aplicó. `npm audit` sin red → omitido.

## Tildes en consola PowerShell 5.1

El log es UTF-8 válido; la consola muestra `�` por su codepage. Leer con
`Get-Content -Encoding utf8` o abrir el archivo.

## Demo y capturas

- La demo usa el puerto `3117` (y siguientes hasta `3126`) para el laboratorio
  Node. Si están ocupados, la demo continúa con la parte estática.
- `npm run screenshots` requiere `npm run build` y usa un perfil temporal en
  `.tmp/screenshot-profile`; no toca tus datos reales.

## Puertos en uso

Vite exige `:5199` (`strictPort`). `npm run dev` concurrente duplica
procesos: cerrar ventanas Electron huérfanas si el puerto queda ocupado.
Si abrís `http://localhost:5199` en un navegador, verás una pantalla que
explica que la interfaz necesita la app de escritorio (no hay `window.api`).
