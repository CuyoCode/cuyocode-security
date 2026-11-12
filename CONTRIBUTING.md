# Contribuir

Gracias por querer mejorar CuyoCode Security. El proyecto prioriza
determinismo, evidencia y seguridad del propio usuario.

## Entorno

- Node.js 24 y npm 11.
- Windows 10/11 para probar el instalador; el motor y los tests corren en Node.

```powershell
npm ci
npm run type-check
npm test
npm run dev
```

## Reglas del proyecto

1. **Nada de secretos reales** en código, tests, fixtures, capturas o issues.
2. Los motores no ejecutan código del objetivo ni usan `shell:true`.
3. Todo proceso externo debe tener timeout, tope de salida y allowlist.
4. Todo texto que salga del sistema debe pasar por redacción.
5. Un hallazgo sin evidencia no es un hallazgo: completá `evidence`, `impact` y `remediation`.
6. Los cambios de UI deben funcionar con teclado y no mostrar enums crudos.

## Flujo de cambios

- Abrí un issue describiendo el problema o la propuesta.
- Creá una rama corta: `feat/...`, `fix/...`, `docs/...`.
- Agregá o actualizá tests. `npm run verify` debe pasar.
- Actualizá `CHANGELOG.md` si el cambio es visible.
- PR pequeño, con contexto, riesgo y cómo se verificó.

## Nuevos motores o reglas

- Motor: implementá `EngineFn` en `engine/`, registralo en
  `engine/orchestrator/registry.ts` y agregalo a un perfil.
- Regla: agregá el JSON en `rules/` con `id` versionado, severidad,
  categoría, evidencia esperada y referencia.
- Adaptador externo: debe omitirse con motivo si falta el binario, nunca fallar
  el resto de la auditoría.

## Reportes de seguridad

No abras issues públicos con vulnerabilidades explotables. Seguí
[SECURITY.md](SECURITY.md).

## Licencia

Al contribuir aceptás que tu aporte se publice bajo la licencia MIT.
