# Instalación y ejecución en Windows

## Requisitos

- Windows 10 u 11 (64 bits).
- Node.js 24 (`node --version` → v24.x) y npm 11.
- Git (para historial; el resto de herramientas son opcionales en Fase 1).

## Desarrollo

```powershell
cd C:\Users\ignac\Documents\programacion\cuyocode-security
npm install
npm run dev
```

Esto levanta Vite en `http://localhost:5173`, compila main/preload y abre Electron.
Cerrar la ventana termina la app (`window-all-closed` → `quit`).

## Pruebas y compilación

```powershell
npm test          # Vitest: 57 pruebas (unitarias + integración + seguridad)
npm run type-check
npm run build     # dist/ + dist-electron/
npm run electron:build  # instalador NSIS en release/
```

## Instalador verificado (27/10/2026, Fase 8)

- `release\CuyoCode Security Setup 0.2.0.exe` (123 MB, NSIS, sin firma).
- Instalación silenciosa `/S` OK en `%LOCALAPPDATA%\Programs\CuyoCode Security`.
- App instalada inicia, migra la base existente (v1→v5 con backup) y se cierra
  limpiamente. Desinstalación silenciosa OK (sin restos).
- Pendiente: icono propio (usa el de Electron), firma con certificado y prueba
  en Windows limpio.

## Datos locales

`%APPDATA%\CuyoCode Security\cuyocode-security\`:

- `cuyocode-security.sqlite` — proyectos, auditorías, hallazgos.
- `cuyocode-security.bak-*.sqlite` — backups previos a migrar (se conservan 3).
- `logs\app.log` — registro con secretos redactados.

No hay telemetría ni conexiones salientes en Fase 1 (salvo las comprobaciones
`--version` locales de herramientas).

## Limitaciones conocidas (Fase 1)

- Sin motor de auditoría: Hallazgos e Informes muestran estados vacíos honestos.
- Sin proveedor de IA (desactivada por defecto).
- `npm install` muestra avisos de dependencias deprecadas heredadas de
  `electron-builder` (inflight, rimraf, glob); no afectan el funcionamiento.
