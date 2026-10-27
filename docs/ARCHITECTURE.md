# Arquitectura

```
Renderer (Vue 3 Options API + Pinia + hash-router, sin Node)
  ↕ window.api (firmas fijas, promesas; eventos audits:progress/finished)
Preload (contextBridge; bundle esbuild de un solo archivo por sandbox:true)
  ↕ ipcRenderer.invoke(canal fijo) / .on limitado a progreso
Main (Node 24)
  ├── ipc/register-handlers.ts — validación + sobre {ok}/{error}
  ├── services/audit-service.ts — corridas en 2.º plano, cancelación, IA
  ├── database/ — node:sqlite + user_version 5 + backup + audit_findings
  ├── logging/logger.ts — redacción de secretos + rotación 1MB
  └── window.ts / main.ts — ventana endurecida, datos en userData
shared/ — contratos IPC + finding-schema (fuente normativa)
engine/ — puro Node, testeable sin Electron:
  ├── scope/ (targets, network: DNS pinning + rebinding + IP sensibles)
  ├── process/runner.ts (spawn sin shell, timeout, tope, kill)
  ├── orchestrator/ (perfiles, gates de lab/consentimiento, validación)
  ├── finding/ (redact, redactCode, dedup por id estable)
  ├── static/ (recon, secrets, deps-npm-audit, patterns) + adapters/
  ├── dynamic/ (fetch-guard, http, tls, cookies) + adapters/ (zap, nuclei)
  ├── server/ (ports-tcp, ssh allowlist, linux) + adapters/ (nmap)
  ├── lab/ (docker etiquetado + verify como puerta)
  ├── ai/ (ollama, external https, consent, schema-guard)
  ├── reporting/ (json + html redactados)
  └── paths.ts (raíz dev/dist/asar por búsqueda de profiles+rules)
rules/ profiles/ skills/ — datos versionados fuera del motor
```

## Decisiones verificadas

- **Electron 45 + Node 24.22** empaquetado ≈ Node 24.21 dev.
- **node:sqlite** (`require OK` en runtime Electron): sin toolchain nativo.
- **TypeScript estricto**, sin `any` (convención `desktop-erp`).
- **Preload bundlado** (sandbox no resuelve requires locales).
- **Nmap externo opcional** (licencia NPSL, no se empaqueta).
- **Atribución histórica** por `audit_findings`: re-ejecutar no vacía informes previos.
- **Evidencias siempre redactadas** (`redactCode`): los snippets no contienen secretos.
