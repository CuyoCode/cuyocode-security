# Escáneres y motores

Motores propios (siempre disponibles, offline salvo indicación):

| Motor | Versión | Qué hace |
|---|---|---|
| `cuyocode-recon/1.0` | 1 | Stack por evidencia (package.json, imports, CI, Docker) |
| `cuyocode-secrets/1.0` | 1 | 10 patrones + entropía, sin emitir valores |
| `cuyocode-deps/1.0` | 1 | `npm audit` real (requiere red); sin lockfile avisa |
| `cuyocode-patterns/1.0` | 1 | `rules/*.json` (8 JS + 6 NestJS + 5 Vue) |
| `cuyocode-http/1.0` | 1 | Cabeceras, TLS-básico, stack traces, rutas sensibles |
| `cuyocode-tls/1.0` | 1 | Certificado, cadena, hostname, protocolo |
| `cuyocode-cookies/1.0` | 1 | Flags por tipo de cookie |
| `cuyocode-ports/1.0` | 1 | 24 puertos TCP + banner pasivo |
| `cuyocode-ssh/1.0` | ops v1 | 13 inspecciones Linux solo-lectura |

Adaptadores opcionales (binario real o `omitido` con motivo):

| Adaptador | Estado en este entorno |
|---|---|
| Gitleaks | No instalado → omitido (parser no verificado E2E) |
| Semgrep | No instalado y sin `rules/semgrep/` → omitido |
| Trivy | No instalado → omitido |
| OWASP ZAP | Sin Java/ZAP → omitido (parser JSON verificado con fixture) |
| Nuclei | Sin binario/plantillas → omitido (parser JSONL verificado) |
| Nmap | Licencia NPSL: externo opcional, nunca empaquetado |

## Herramientas detectadas (27/10/2026, este equipo)

Git 2.56, Node 24.21, npm 11.19, OpenSSH 9.5. Docker, Python, Nmap,
Gitleaks, Semgrep, Trivy, ZAP, Ollama: ausentes.

## Licencias (a confirmar contra fuentes oficiales antes de distribuir)

Gitleaks MIT, Trivy Apache-2.0, ZAP Apache-2.0, Nuclei MIT, Semgrep LGPL-2.1
(motor; reglas mixtas), Nmap NPSL (no redistribuir), Ollama MIT,
Electron/Vue/Vite MIT, Node MIT.
