# Skill: Docker

1. **Objetivo:** revisar imágenes y Compose (secretos, privilegios, red, base).
2. **Alcance:** Dockerfiles/Compose locales. No inspeccionar hosts ajenos.
3. **Tecnologías:** Docker, Compose, imágenes Node oficiales.
4. **Metodología:** Base (tag fijo/digest) → secretos (ENV/ARG/copias) → usuario → red/puertos → montajes → `privileged`/`socket` → Compose (restart, límites, redes).
5. **Patrones vulnerables:** `ENV SECRET=...`; `.env` copiado; `latest` mutable; root por defecto; `--privileged`; `-v /var/run/docker.sock`; puertos de DB publicados; `restart: always` sin límites.
6. **Patrones seguros:** Tags fijos + digest en prod; secretos por entorno/orquestador; `USER node`; redes dedicadas; solo puertos necesarios; `read_only` + `tmpfs` donde aplique.
7. **Casos límite:** Build args necesarios (no persistir en imagen final: multistage); socket Docker solo en runners CI controlados.
8. **Falsos positivos:** `EXPOSE` no publica solo; `latest` en laboratorio.
9. **Evidencia:** Dockerfile:línea + Compose:servicio.
10. **Severidad:** Secreto en imagen → high; privileged/socket → high; latest en prod → medium.
11. **Referencias:** Docker security docs, OWASP Docker Top 10.
12. **Pruebas automatizables:** Trivy image (cuando esté instalado), `docker scout` opcional.
13. **Privacidad:** No subir imágenes privadas a registros públicos para escanear.
14. **Aceptación:** Sin secretos en capas, usuario no-root, superficie mínima.
