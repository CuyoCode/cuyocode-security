# Fixtures de prueba

Valores 100% sintéticos para pruebas del motor (incluida la clave AWS de
ejemplo documentada por Amazon). Si un escáner real los marca, es el
comportamiento esperado.

- `vuln-app/`: app NestJS/Vue mínima con patrones vulnerables, secretos de
  ejemplo y configuración insegura. Se usa en tests y en la demo de la app.
- `clean-app/`: app mínima sin hallazgos conocidos.

No agregar secretos reales, datos de clientes ni binarios.
