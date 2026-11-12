# Seguridad

## Alcance autorizado

CuyoCode Security solo debe usarse sobre código, URLs y servidores cuya
evaluación esté expresamente autorizada por su responsable. Nunca escanear
terceros, rangos no autorizados ni producción sin permiso explícito.

## Reporte de vulnerabilidades propias

Si encontrás una vulnerabilidad en esta herramienta, reportala por un canal
privado: usá **Security > Report a vulnerability** en
[GitHub](https://github.com/CuyoCode/cuyocode-security/security/advisories/new).
No la publiques hasta consensuar la corrección. No incluyas secretos reales ni
datos de clientes en el reporte.

## Garantías de diseño

- Renderer sin acceso al sistema (`nodeIntegration:false`, `sandbox:true`,
  `contextIsolation:true`), navegación y ventanas bloqueadas, permisos denegados.
- IPC validado en el proceso principal; canales fijos, sin comandos arbitrarios.
- Procesos externos sin `shell:true`, con timeout, tope de salida, cancelación y
  allowlists.
- Logs, evidencias, IA e informes con redacción de secretos.
- SSH solo lectura con operaciones versionadas y host key fijada.
- Laboratorio con puerta de aislamiento; sin verificación se bloquea.
- Electron con fuses, integridad ASAR, single instance y CSP de producción.
- Instalador sin firma de código (pendiente de certificado).

## Auto-auditoría

- `npm audit --omit=dev`: **0 vulnerabilidades** en dependencias de producción.
  El instalador no empaqueta `node_modules`; el renderer va compilado por Vite.
- `npm audit` completo: 6 avisos moderados en herramientas de desarrollo
  (`electron-builder` y cadena `minimatch`), sin corrección disponible sin
  cambio mayor. Riesgo acotado a la máquina de desarrollo.
- 80 pruebas, incluidas seguridad negativa, redacción, migraciones, demo E2E y
  hardening de Electron.

## Verificación rápida

```powershell
npm run verify
npm audit --omit=dev
```
