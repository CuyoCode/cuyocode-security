# Pruebas autorizadas

## Regla de oro

Solo objetivos con autorización expresa del responsable. Ante la duda, no
escanear. Esta herramienta no elude esa responsabilidad: el asistente muestra
el alcance exacto antes de ejecutar y el registro local conserva objetivo,
tipo, perfil, modo de IA y autorización de red privada.

## Perfiles y límites

| Perfil | Qué hace | Qué NUNCA hace |
|---|---|---|
| `local-code` | Lee código local (no lo ejecuta) | Ejecutar el objetivo |
| `local-code-deep` | + adaptadores externos opcionales | Ejecutar el objetivo |
| `web-passive` | GET no mutantes (presupuesto acotado) | Fuzzing, login, POST |
| `web-active` | ZAP baseline + Nuclei seleccionado | POST/PUT/DELETE en prod |
| `server-readonly` | TCP + Nmap opcional + SSH solo-lectura | Modificar el servidor |
| `lab-advanced` | Pruebas profundas en lab aislado verificado | Salir del laboratorio |

## Prohibiciones

- Escaneos masivos de Internet o rangos no autorizados.
- Credenciales reales o de terceros; solo cuentas sintéticas de prueba.
- Datos reales de usuarios/tenants en pruebas de autorización.
- Persistencia, pivoteo, exfiltración: fuera del alcance del laboratorio.
- UDP discovery: no implementado.

## Evidencia de autorización

Cada informe incluye objetivo, perfil, fecha, duración, cobertura y límites
aplicados. La demo usa exclusivamente datos sintéticos incluidos en el repo.
