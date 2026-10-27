# Seguridad SSH

## Modelo

- Sin consola arbitraria: 13 operaciones versionadas (`SSH_OPS_VERSION=1`,
  ver `engine/server/ssh.ts`). Todo lo demás se rechaza antes de conectarse
  (test `negative.test.ts`).
- Sin contraseñas: claves por ruta o ssh-agent. La base guarda rutas, jamás
  contenidos ni passphrases.
- Host key con pin manual: `ssh:fetch-key` (ssh-keyscan) → el usuario compara
  la huella por canal confiable → `ssh:pin-key`. Cambio de clave = conexión
  rechazada (`StrictHostKeyChecking=yes`, known_hosts dedicado por perfil).
- `BatchMode=yes`: nunca pide password interactivamente.
- Salidas redactadas antes de mostrarse o persistirse.

## Operaciones (solo lectura)

`sys.uname`, `net.sockets`, `fw.ufw`, `fw.iptables`, `ssh.config`,
`svc.enabled`, `pkg.updates`, `docker.ps`, `proxy.nginx`, `certs.live`,
`perms.shadow`, `users.login`, `logs.auth`.

## Advertencia honesta

SSH no ofrece sesiones de solo lectura por sí mismo: la restricción la aplica
esta herramienta del lado cliente. Usar cuenta dedicada de mínimos privilegios
y, si es viable, `ForceCommand`/`authorized_keys restrictions` del lado servidor.
Lo que requiera root (`sshd -T`) queda como **no verificado**, nunca como seguro.

## Railway

Sin acceso a red interna ni contenedores del proveedor: auditar URL pública +
repo local + revisión manual guiada del panel. Sin integraciones no oficiales.
