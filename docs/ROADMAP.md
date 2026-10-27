# Roadmap

## Completado (Fases 0–7, verificado 27/10/2026)

Base desktop endurecida, orquestador cancelable, 9 motores propios +
6 adaptadores, SSH solo-lectura, laboratorio con puerta de aislamiento, IA
opcional con consentimiento, informes JSON/HTML redactados, 57 tests verdes.

## Fase 8 (en curso)

- Inventario de dependencias y licencias (SBOM).
- Instalador NSIS probado en Windows limpio.
- Revisión de dependencias vulnerables propias (`npm audit` del proyecto).

## Futuro (post-MVP, sin compromiso)

- Importación OpenAPI para APIs (alcance guiado).
- Reglas Semgrep locales versionadas (`rules/semgrep/`).
- Plantillas Nuclei curadas + `NUCLEI_TEMPLATES` documentado.
- PDF vía `printToPDF` del informe HTML.
- Aplicación de parches revisada (opt-in, diff previo, deshabilitada por defecto).
- i18n, firma de instalador (certificado), auto-update.
- Publicación open source: re-auditoría de secretos en historial + `SECURITY.md`.

Lo no listado no está prometido.
