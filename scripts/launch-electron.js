// Lanza Electron limpiando ELECTRON_RUN_AS_NODE del entorno.
// VS Code (y otras apps basadas en Electron) heredan esa variable a sus
// terminales integradas; si queda seteada, `electron .` corre el entry
// point como Node puro y `require('electron').app` es `undefined`.
// Se invoca el ejecutable directo (sin npx/cmd ni shell) para evitar EINVAL.
const { spawn } = require('node:child_process');
const electronPath = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
