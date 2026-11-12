# Escáneres y motores

Motores propios (siempre disponibles; red solo cuando se indica):

| Motor | Qué hace |
|---|---|
| `recon` | Stack por evidencia (package.json, imports, CI, Docker) |
| `secrets-builtin` | 10 patrones + entropía, sin emitir valores |
| `deps-npm-audit` | `npm audit` real (requiere red); sin lockfile avisa |
| `patterns-builtin` | `rules/*.json` (8 JS + 6 NestJS + 5 Vue) |
| `http-passive` | Cabeceras, CSP, framing, stack traces, rutas sensibles |
| `tls-check` | Certificado, cadena, hostname, protocolo |
| `cookies-review` | Flags por tipo de cookie |
| `ports-tcp` | 24 puertos TCP + banner pasivo |
| `ssh-readonly` | 13 inspecciones Linux solo-lectura |

Adaptadores opcionales (binario real o `omitido` con motivo):

| Adaptador | Requisito |
|---|---|
| Gitleaks | Binario `gitleaks` (perfil `local-code-deep`) |
| Semgrep | Binario `semgrep` + `rules/semgrep/*.yaml` |
| Trivy | Binario `trivy`; puede requerir red para la base de CVEs |
| OWASP ZAP | Java + ZAP (perfiles `web-active`/`lab-advanced`) |
| Nuclei | Binario + `NUCLEI_TEMPLATES` con plantillas locales |
| Nmap | Binario `nmap`; licencia NPSL, nunca empaquetado |

## Herramientas detectadas (equipo de desarrollo)

Git, Node, npm, OpenSSH, Docker y Python disponibles según la máquina. La app
muestra el estado real en **Herramientas** y permite copiar el comando de
instalación; nunca instala nada por su cuenta.

## Licencias

Gitleaks MIT, Trivy Apache-2.0, ZAP Apache-2.0, Nuclei MIT, Semgrep LGPL-2.1
(motor; reglas mixtas), Nmap NPSL (no redistribuir), Ollama MIT,
Electron/Vue/Vite MIT, Node MIT.
