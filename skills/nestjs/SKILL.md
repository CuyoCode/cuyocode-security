# Skill: NestJS

1. **Objetivo:** revisar APIs NestJS (guards, DTOs, CORS, JWT, subidas, TypeORM/Mongoose).
2. **Alcance:** Código local + configuración. No probar producción.
3. **Tecnologías:** NestJS 9/10/11, class-validator, Passport/JWT, TypeORM, Mongoose.
4. **Metodología:** Mapear módulos → controladores → guards globales y locales → DTOs → servicios → consultas. Verificar `main.ts` (pipes, CORS, prefijos) y excepciones (`@Public()`, `skipAuth`).
5. **Patrones vulnerables:** Rutas sin guard real; `@Res()` sin passthrough; `synchronize:true`; CORS `origin:true/*` con credenciales; `jwt.sign` sin expiración; secreto JWT literal; `FileInterceptor` sin filtro; `req.body` crudo a filtros Mongo.
6. **Patrones seguros:** `APP_GUARD` global + `@Public()` explícito; `ValidationPipe({whitelist, forbidNonWhitelisted, transform})`; guards por recurso (ownership); expiraciones cortas + refresh rotativo.
7. **Casos límite:** Guard global con `reflector` que excluye por metadata; microservicios con validación distinta; GraphQL con resolvers sin guard.
8. **Falsos positivos:** Pipe registrado en otro módulo; expiración en config global; filtro de subida externalizado.
9. **Evidencia:** Controlador:método + guard aplicado/ausente + DTO + consulta resultante.
10. **Severidad:** BOLA/IDOR con datos → high; CORS abierto con credenciales → high; validación → medium.
11. **Referencias:** docs.nestjs.com (security, validation), OWASP API Top 10.
12. **Pruebas automatizables:** `rules/nestjs.json` + tests e2e con dos usuarios de prueba en laboratorio.
13. **Privacidad:** No versionar `.env`; revisar `ConfigService` sin volcar valores.
14. **Aceptación:** Matriz ruta→guard→DTO para los endpoints sensibles.
