# Roadmap

## Completado

- Base desktop endurecida, orquestador cancelable y motores deterministas.
- 9 motores propios + adaptadores opcionales (omitidos con motivo si faltan).
- SSH solo-lectura, laboratorio con puerta de aislamiento, IA opt-in.
- Informes JSON/HTML/PDF con resumen ejecutivo y cobertura.
- Rediseño de UI, onboarding, demo reproducible y CLI headless.
- 77 pruebas verdes y CI en GitHub Actions.
- Repositorio público con licencia MIT, capturas y documentación.

## Próximo

- Firma de código del instalador (certificado).
- Auto-update con GitHub Releases firmado.
- Reglas Semgrep locales versionadas (`rules/semgrep/`).
- Plantillas Nuclei curadas y variable `NUCLEI_TEMPLATES` documentada en UI.
- Pruebas E2E de UI con Playwright Electron.
- Cobertura con umbral mínimo por módulo.
- i18n (es/en) y tema claro.

## Futuro (sin compromiso)

- Importación OpenAPI para alcance guiado de APIs.
- Aplicación de parches revisada (opt-in, diff previo, deshabilitada por defecto).
- Retención y purga configurable de historial.
- Exportación/restauración de base desde la UI.

Lo no listado no está prometido.
