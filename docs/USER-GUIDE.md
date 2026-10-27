# Guía de uso

1. **Ajustes → IA** (opcional): configurar Ollama o API externa y probar.
2. **Proyectos** (opcional): registrar carpeta/URL/servidor.
3. **Nueva auditoría**: objetivo → perfil → alcance/permisos → IA → confirmar.
   - URL remota: se muestra qué host se consultará; red privada bloqueada
     salvo autorización explícita.
   - Servidor: elegir perfil SSH previamente registrado con clave fijada.
   - Laboratorio: crear lab, verificar aislamiento, luego `lab-advanced`.
4. **Ejecución**: progreso por motor, cancelación en cualquier momento.
5. **Hallazgos**: filtrar, revisar, marcar FP con justificación, copiar corrección.
6. **Informes**: vista previa (redactada) → exportar JSON/HTML.
7. **Auditorías**: historial, comparación, revisión IA (si se configuró).

## Perfiles SSH

Servidores SSH → registrar (clave o agent) → *Obtener clave* → comparar huella
→ *Fijar* → ejecutar inspecciones o auditar con `server-readonly`.
