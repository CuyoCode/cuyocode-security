# Troubleshooting

## `npm run dev` no abre Electron

- Verificar Vite en `:5173` y `dist-electron/electron/main/main.js` generado.
- `Error: spawn EINVAL`: usar `scripts/launch-electron.js` actual (ejecutable
  directo, sin `npx.cmd`).
- `ELECTRON_RUN_AS_NODE` seteada por terminales integradas: el launcher la
  limpia; si persiste, abrir PowerShell externa.

## Base de datos

- Ruta dev: `%APPDATA%\cuyocode-security\cuyocode-security\*.sqlite`.
- Migraciones con backup previo (`.bak-*`, se conservan 3). Ante error,
  restaurar el `.bak` más reciente y reportar.
- `user_version` actual: 5.

## Motores omitidos

Todo `omitido: <motivo>` es informativo, no un fallo: indica qué instalar
(Herramientas) o qué límite aplicó. `npm audit` sin red → omitido.

## Tildes en consola PowerShell 5.1

El log es UTF-8 válido; la consola muestra `�` por su codepage. Leer con
`Get-Content -Encoding utf8` o abrir el archivo.

## Puertos en uso

Vite exige `:5173` (`strictPort`). `npm run dev` concurrente duplica
procesos: cerrar ventanas Electron huérfanas si el puerto queda ocupado.
