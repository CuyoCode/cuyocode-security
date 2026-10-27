# Skill: MongoDB

1. **Objetivo:** revisar uso y configuración de MongoDB (inyección, exposición, backups).
2. **Alcance:** Código (Mongoose/driver) + configs accesibles. No conectarse a producción.
3. **Tecnologías:** MongoDB, Mongoose, docker-compose, Railway.
4. **Metodología:** Filtros construidos → operadores desde entrada → conexión/auth/TLS → red (bind) → usuarios/roles → backups.
5. **Patrones vulnerables:** `find(req.body)` / `findOne(req.query)` crudos; `$where`/`$gt` desde cliente; URI con credenciales versionada; `bindIp: 0.0.0.0` sin auth; usuario admin en app; backups sin cifrar.
6. **Patrones seguros:** DTO validado + allowlist de campos; operadores fijos en servidor; URI por entorno; `authorization: enabled`, TLS, roles mínimos; backups cifrados y probados.
7. **Casos límite:** `$regex` con entrada (ReDoS + enumeración): escapar y limitar; agregaciones con `$where` interno fijo.
8. **Falsos positivos:** Operadores fijos en código; `find()` sin filtro intencional (listado propio paginado).
9. **Evidencia:** Filtro construido + origen de sus campos + config de conexión (sin password).
10. **Severidad:** Inyección con lectura/escritura → high; URI versionada → high; bind abierto sin auth → critical.
11. **Referencias:** MongoDB Security Checklist, OWASP NoSQL Injection.
12. **Pruebas automatizables:** `rules/javascript.json` (`js-nosql-operator`), test con `{"$gt":""}` en laboratorio.
13. **Privacidad:** Cadenas de conexión: citar host/base, jamás password.
14. **Aceptación:** 0 filtros con entrada cruda; auth+red verificadas o marcadas no-verificadas.
