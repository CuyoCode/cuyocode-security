# Firma del instalador Windows

Estado: el instalador se compila **sin firmar** (SmartScreen mostrará aviso).
La configuración ya acepta certificado por variables de entorno
(electron-builder las lee automáticamente).

## Procedimiento (cuando tengas certificado de firma de código)

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
   Get-AuthenticodeSignature "release\CuyoCode Security Setup *.exe"
   ```

## Icono

`resources/icon.ico` generado con `node scripts/make-icon.cjs` (sin
dependencias) y ya conectado al instalador y desinstalador. Para cambiarlo,
editar el dibujo en el script y regenerar.
