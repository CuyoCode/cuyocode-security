# Instalación y ejecución en Windows

## Requisitos

- Windows 10 u 11 (64 bits).
- Node.js 24 (`node --version` → v24.x) y npm 11.
- Git recomendado. Docker, Nmap, ZAP, Nuclei, Gitleaks, Semgrep, Trivy y Ollama
  son opcionales: si faltan, la app lo informa y omite esos motores.

## Desarrollo

```powershell
npm install
npm run dev
```

Esto levanta Vite en `http://localhost:5199`, compila main/preload y abre Electron.
Cerrar la ventana termina la app (`window-all-closed` → `quit`).

Para una demo sin datos propios, la bienvenida ofrece **Probar demo segura**.
También podés aislar los datos con:

```powershell
$env:CUYOCODE_USER_DATA = "$PWD\.tmp\perfil-demo"
npm run dev
```

## Pruebas y compilación

```powershell
npm test              # 80 pruebas (unitarias + integración + seguridad)
npm run test:coverage
npm run type-check
npm run build         # dist/ + dist-electron/
npm run electron:build # verificador + instalador NSIS en release/
npm run screenshots   # capturas reales en docs/images/
```

## Instalador

- `release\CuyoCode-Security-Setup-0.3.0.exe` (NSIS, x64, sin firma).
- Instalación asistida con elección de carpeta; desinstalación sin borrar datos
  (`deleteAppDataOnUninstall: false`).
- Firma de código pendiente: ver [SIGNING.md](SIGNING.md). Windows SmartScreen
  puede advertir en instaladores sin firmar.
- Fuses de Electron activados y validación de integridad ASAR; el laboratorio
  Node usa `utilityProcess` y no depende de `RunAsNode`.

## Datos locales

`%APPDATA%\CuyoCode Security\cuyocode-security\`:

- `cuyocode-security.sqlite` — proyectos, auditorías, hallazgos.
- `cuyocode-security.bak-*.sqlite` — backups previos a migrar (se conservan 3).
- `logs\app.log` — registro con secretos redactados.
- `ssh\` — known_hosts por perfil (nunca claves privadas).
- `vault.json` / `ai-config.json` — solo si se configura IA externa.

No hay telemetría. Las salidas de red dependen del perfil: `npm audit` consulta
el registro npm y los adaptadores externos consultan sus propios servicios.

## Limitaciones conocidas

- Instalador sin firma de código.
- Algunos adaptadores externos requieren binarios y plantillas que no se
  empaquetan (Semgrep necesita `rules/semgrep/`; Nuclei requiere
  `NUCLEI_TEMPLATES`).
- El laboratorio Docker requiere Docker Desktop; el laboratorio Node funciona
  sin Docker.
