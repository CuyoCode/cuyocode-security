# Skill: Linux / VPS

1. **Objetivo:** inspeccionar VPS propios (Contabo) por SSH solo-lectura.
2. **Alcance:** Host expresamente autorizado, usuario de auditoría de mínimos privilegios.
3. **Tecnologías:** Debian/Ubuntu, OpenSSH, UFW/nftables, Nginx, Docker.
4. **Metodología:** Puertos externos vs internos → SSH (`PermitRootLogin`, passwords) → firewall → usuarios → updates → Docker → proxy/TLS → permisos → logs.
5. **Patrones vulnerables:** Root por SSH con password; UFW inactivo; servicios en 0.0.0.0 innecesarios; `/etc/shadow` legible; contenedores `--privileged`; certificados vencidos; Nginx con TLS viejo.
6. **Patrones seguros:** Claves ed25519 + `PasswordAuthentication no`; UFW default-deny; unattended-upgrades o ventana definida; backups probados.
7. **Casos límite:** `sshd -T` y varias lecturas requieren root: registrar como no-verificado, no como seguro. Contabo: panel del proveedor se revisa manual, no por SSH.
8. **Falsos positivos:** Puerto abierto + app con auth fuerte (documentar, no alarmar); kernel con livepatch.
9. **Evidencia:** Salida de la operación permitida (versión de ops citada).
10. **Severidad:** Shadow legible/root+password → critical/high; updates → medium; inventario → info.
11. **Referencias:** CIS Benchmarks (guía), Debian security, OpenSSH docs.
12. **Pruebas automatizables:** Operaciones `srv-*` del catálogo versionado.
13. **Privacidad:** Salidas redactadas; no copiar `/etc/shadow`, claves ni logs con IPs de clientes al informe.
14. **Aceptación:** Comparación exposición externa vs estado interno + lista de no-verificados.
