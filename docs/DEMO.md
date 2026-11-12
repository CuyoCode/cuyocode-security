# Guion de demo (5 minutos)

## Antes de empezar

```powershell
npm install
npm run dev
```

- Perfil limpio (opcional): `$env:CUYOCODE_USER_DATA = "$PWD\.tmp\perfil-demo"`.
- Cerrá otras instancias de la app para evitar el bloqueo de instancia única.
- No hacen falta Docker, IA ni herramientas externas.

## Recorrido

1. **Bienvenida (20 s).** Mostrá los tres caminos y el mensaje de uso autorizado.
2. **Demo segura (60 s).** Clic en *Probar demo segura*. Mientras corre, explicá:
   - audita un fixture vulnerable sintético incluido en el repo;
   - levanta un laboratorio Node aislado en loopback;
   - no envía datos afuera ni requiere Docker.
3. **Panel (30 s).** KPIs, severidades, actividad y últimas auditorías.
4. **Hallazgos (90 s).** Abrí un hallazgo:
   - evidencia redactada, impacto, validación segura y corrección;
   - cambiá el estado, justificá un falso positivo y mostrá el historial;
   - mencioná que el detalle se conserva tras guardar.
5. **Informe (60 s).** Generá la vista previa: accionables, confirmados,
   severidad, cobertura y limitaciones. Exportá HTML/PDF.
6. **Auditorías (40 s).** Compará las dos corridas: nuevos, resueltos y
   persistentes.
7. **Cierre (40 s).** Ajustes: IA desactivada por defecto, clave cifrada/solo
   memoria, sin telemetría, datos locales. Mencioná CLI y CI.

## Mensajes clave

- Determinista y local: la IA es opcional y nunca ejecuta nada.
- Cobertura honesta: motores omitidos y limitaciones visibles.
- Evidencia y trazabilidad: revisión, justificación e historial.
- Listo para CI con `audit:cli --fail-on`.
- La ausencia de hallazgos no implica seguridad.

## Preguntas frecuentes en vivo

- **¿Ejecuta el código auditado?** No en perfiles estáticos.
- **¿Envía mi código a la nube?** No por defecto; solo IA externa opt-in y redactada.
- **¿Reemplaza un pentest?** No; prioriza evidencia y cobertura, no certifica.
- **¿Funciona sin internet?** Los motores base sí; `npm audit`/Trivy pueden requerir red.
