# Skill: PostgreSQL

1. **Objetivo:** revisar uso y configuración de PostgreSQL.
2. **Alcance:** Código (pg/TypeORM/Prisma) + configs. No conectarse a producción.
3. **Tecnologías:** PostgreSQL, TypeORM, Prisma, `pg`, Docker.
4. **Metodología:** Consultas (raw vs parametrizado) → migraciones vs `synchronize` → conexión (SSL, credenciales) → roles → backups/PITR.
5. **Patrones vulnerables:** Interpolación en `query()`; `synchronize:true`; `sslmode=disable`; superusuario en app; `trust` en `pg_hba`; backups sin probar.
6. **Patrones seguros:** `$1`/parámetros siempre; migraciones; `sslmode=require/verify-full`; rol app con mínimos; `pg_hba` por host+scram; PITR probado.
7. **Casos límite:** Identificadores dinámicos (tabla/columna): allowlist, no parámetros; `search_path` en funciones SECURITY DEFINER.
8. **Falsos positivos:** Raw SQL con parámetros es seguro; `synchronize` en dev local.
9. **Evidencia:** Consulta + binding + config SSL/rol (sin password).
10. **Severidad:** SQLi → high/critical; `trust`/superuser expuesto → high.
11. **Referencias:** PostgreSQL security docs, OWASP SQL Injection Prevention.
12. **Pruebas automatizables:** `js-sql-concat`, prueba `'`/`--` en laboratorio.
13. **Privacidad:** `DATABASE_URL`: citar host/base/SSL, jamás password.
14. **Aceptación:** 0 interpolaciones con entrada; migraciones versionadas.
