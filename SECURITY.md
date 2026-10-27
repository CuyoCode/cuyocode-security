# Seguridad

## Alcance autorizado

CuyoCode Security solo debe usarse sobre código, URLs y servidores cuya
evaluación esté expresamente autorizada por su responsable. Nunca escanear
terceros, rangos no autorizados ni producción sin permiso explícito.

## Reporte de vulnerabilidades propias

Si encontrás una vulnerabilidad en esta herramienta, reportala al responsable
del proyecto por un canal privado. No la publiques hasta consensuar la
corrección.

## Garantías

- Renderer sin acceso al sistema (`nodeIntegration:false`, `sandbox:true`).
- IPC validado en el proceso principal; canales fijos, sin comandos arbitrarios.
- Procesos externos sin `shell:true`, con timeout y tope de salida.
- Logs e informes con redacción de secretos.
- Credenciales SSH/API en el almacén del SO (desde Fase 5); nunca en texto plano.

## Auto-auditoría (27/10/2026)

- `npm audit --omit=dev`: 0 vulnerabilidades en dependencias de producción
  (el instalador no empaqueta `node_modules`: el renderer va compilado).
- `npm audit` completo: 3 avisos solo-dev (esbuild anidado de Vite,
  cadena tinypool/vitest). Dependencia directa `esbuild` actualizada a ^0.28.
  No se aplica `audit fix --force` (cambio mayor no verificado). Riesgo
  acotado a la máquina de desarrollo; re-evaluar al actualizar Vite/Vitest.
- SBOM: `sbom.json` (345 paquetes, todas licencias permisivas, sin GPL).
