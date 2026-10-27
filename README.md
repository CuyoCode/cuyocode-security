# CuyoCode Security

Herramienta desktop de auditoría de seguridad asistida (uso interno de CuyoCode,
solo sobre objetivos expresamente autorizados).

> La ausencia de hallazgos **no** significa que un proyecto sea seguro.

## Capacidades

- **Estática:** reconocimiento, secretos (10 patrones + entropía), `npm audit`
  real, 19 reglas propias (JS/NestJS/Vue) + adaptadores Gitleaks/Semgrep/Trivy.
- **Dinámica:** HTTP/TLS/cookies con guardia de alcance (anti-SSRF/rebinding) +
  adaptadores ZAP/Nuclei.
- **Servidores:** escáner TCP propio + Nmap opcional + SSH solo-lectura
  (13 operaciones versionadas).
- **IA opcional:** Ollama local o API externa con consentimiento; clave solo
  en memoria.
- **Informes** JSON/HTML redactados, historial, comparación, laboratorio Docker
  con puerta de aislamiento.

## Uso

```powershell
npm install
npm run dev      # desarrollo (renderer :5173 + Electron)
npm test         # 57 pruebas
npm run build    # compila renderer + main + preload
npm run electron:build  # instalador Windows (NSIS)
```

Docs: `docs/USER-GUIDE.md`, `docs/INSTALLATION-WINDOWS.md`,
`docs/AUTHORIZED-TESTING.md`. Seguridad: `SECURITY.md`.
