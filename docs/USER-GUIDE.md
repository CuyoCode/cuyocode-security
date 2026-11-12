# Guía de uso

1. **Bienvenida / demo:** *Probar demo segura* crea un proyecto sintético,
   audita el fixture vulnerable y el laboratorio Node, y deja hallazgos listos
   para revisar. No requiere Docker ni IA.
2. **Ajustes → IA** (opcional): configurar Ollama o API externa y probar.
3. **Proyectos** (opcional): registrar carpeta/URL/servidor.
4. **Nueva auditoría**: objetivo → perfil → alcance/permisos → IA → confirmar.
   - URL remota: se muestra qué host se consultará; red privada bloqueada
     salvo autorización explícita.
   - Servidor: elegir perfil SSH previamente registrado con clave fijada.
   - Laboratorio: crear lab, verificar aislamiento, luego `lab-advanced`. Podés
     elegir un laboratorio Node en ejecución desde el asistente.
5. **Ejecución**: progreso por motor, cancelación en cualquier momento.
6. **Hallazgos**: filtrar, revisar, marcar FP con justificación, copiar corrección.
   El detalle se mantiene tras guardar la revisión.
7. **Informes**: resumen ejecutivo con cobertura → exportar JSON/HTML/PDF.
8. **Auditorías**: historial, ejecución, hallazgos, informe y comparación
   (nuevos/resueltos/persistentes).

## Perfiles SSH

Servidores SSH → registrar (clave o agent) → *Obtener clave* → comparar huella
→ *Fijar* → ejecutar inspecciones o auditar con `server-readonly`.

## CLI

```powershell
node dist-electron/scripts/audit-cli.js --profile local-code --target . --out artifacts/audit --fail-on high
```
