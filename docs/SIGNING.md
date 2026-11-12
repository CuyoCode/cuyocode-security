# Firma del instalador Windows

Estado: el instalador se compila **sin firmar** hasta configurar un certificado
(SmartScreen mostrará aviso). La configuración ya acepta certificado por
variables de entorno y el workflow de release las propaga desde secretos
(electron-builder las lee automáticamente).

## Firma en GitHub Actions

El workflow [release.yml](../.github/workflows/release.yml) pasa `CSC_LINK` y
`CSC_KEY_PASSWORD` desde los secretos del repositorio. Para habilitar la firma:

1. Exportar el certificado a `.pfx` y codificarlo en base64:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\secrets\cuyocode.pfx"))
   ```
2. En GitHub, **Settings > Secrets and variables > Actions**, crear:
   - `CSC_LINK`: el contenido base64 del `.pfx`.
   - `CSC_KEY_PASSWORD`: la contraseña del `.pfx`.
3. Publicar un tag `v*`; el instalador saldrá firmado. Sin esos secretos el
   release sigue funcionando, pero sin firma.

Nunca versionar el `.pfx`, su contraseña ni el base64 en el repositorio.

## Procedimiento local (cuando tengas certificado de firma de código)

1. Obtener certificado OV/EV de una CA (p. ej. Sectigo, DigiCert, SSL.com).
   Para probar el flujo sin costo, generar uno autofirmado (solo tests locales,
   SmartScreen seguirá avisando):
   ```powershell
   New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=CuyoCode"
   ```
2. Exportar a `.pfx` e informar a electron-builder por entorno (nunca
   versionar el `.pfx` ni su clave):
   ```powershell
   $env:CSC_LINK="C:\secrets\cuyocode.pfx"
   $env:CSC_KEY_PASSWORD="..."
   npm run electron:build
   ```
3. Verificar la firma:
   ```powershell
   Get-AuthenticodeSignature "release\CuyoCode-Security-Setup-*.exe"
   ```

## Icono

`resources/icon.ico` generado con `node scripts/make-icon.cjs` (sin
dependencias) y ya conectado al instalador y desinstalador. Para cambiarlo,
editar el dibujo en el script y regenerar.
