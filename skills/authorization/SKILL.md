# Skill: autorización

1. **Objetivo:** verificar permisos (qué podés hacer) por objeto y tenant.
2. **Alcance:** Lógica de negocio con contexto del cliente. Requiere dos cuentas de prueba.
3. **Tecnologías:** Guards, RBAC/ABAC, multi-tenant (NestJS, Express, Postgres/Mongo).
4. **Metodología:** Por cada recurso con id: A crea → B pide el de A (esperado 403/404) → B lista (no debe verlo) → roles cruzados → tenants cruzados.
5. **Patrones vulnerables:** IDOR/BOLA (`/orders/:id` sin ownership); tenant por header/cliente sin validar; `isAdmin` desde el JWT sin firma verificada; ocultar botones como único control.
6. **Patrones seguros:** Chequeo servidor: recurso.propietario == ctx.usuario (o rol/tenant); 404 genérico para no enumerar; tests por rol.
7. **Casos límite:** Recursos compartidos intencionalmente (links con token); administradores con alcance definido; IDs no secuenciales (no es control).
8. **Falsos positivos:** Endpoint que devuelve 404 a todo no-autorizado puede ser correcto; confirmar con dueño.
9. **Evidencia:** Par de peticiones A/B (redactadas) + código del guard + resultado.
10. **Severidad:** Acceso a datos ajenos → high/critical según sensibilidad; enumeración → medium.
11. **Referencias:** OWASP API Top 10 (API1:2023 BOLA), ASVS 4.x.
12. **Pruebas automatizables:** Suite con usuario A/B y asserts 403/404 (solo laboratorio).
13. **Privacidad:** Datos sintéticos; jamás IDs ni datos reales de clientes.
14. **Aceptación:** Tabla recurso×rol con permitido/denegado observado. Los escáneres no cubren esto.
