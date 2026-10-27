# Pruebas autorizadas

## Regla de oro

Solo objetivos con autorización expresa del responsable. Ante la duda, no
escanear. Esta herramienta no elude esa responsabilidad: el asistente muestra
el alcance exacto antes de ejecutar y registra dominios/IPs/puertos aprobados.

## Perfiles y límites

| Perfil | Qué hace | Qué NUNCA hace |
|---|---|---|
| `local-code` | Lee código local (no lo ejecuta) | Ejecutar el objetivo |
| `web-passive` | GET no mutantes (máx. 60) | Fuzzing, login, POST |
| `web-active` | ZAP baseline + Nuclei (máx. 2000 req) | POST/PUT/DELETE en prod |
| `server-readonly` | TCP + SSH solo-lectura | Modificar el servidor |
| `lab-advanced` | Pruebas profundas en lab aislado | Salir del laboratorio |

## Prohibiciones

- Escaneos masivos de Internet o rangos no autorizados.
- Credenciales reales o de terceros; solo cuentas sintéticas de prueba.
- Datos reales de usuarios/tenants en pruebas de autorización.
- Persistencia, pivoteo, exfiltración: fuera del alcance del laboratorio.
- UDP discovery: opcional, lento y ambiguo (no implementado en MVP).

## Evidencia de autorización

Cada informe incluye objetivo, perfil, fecha y límites aplicados.
