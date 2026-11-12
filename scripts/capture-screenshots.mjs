// Captura screenshots reales de la app para el README.
// Uso: npm run screenshots
// Requiere haber compilado (npm run build) y sirve dist en el puerto 5199.

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'docs', 'images');
const profileDir = path.join(root, '.tmp', `screenshot-profile-${Date.now()}`);
const PORT = 9223;
const BASE_URL = 'http://localhost:5199';

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(profileDir, { recursive: true, force: true });

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const preview = spawn(process.execPath, [viteBin, 'preview', '--port', '5199', '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const env = { ...process.env, CUYOCODE_USER_DATA: profileDir };
delete env.ELECTRON_RUN_AS_NODE;
const electron = spawn(electronPath, ['.', `--remote-debugging-port=${PORT}`], {
  cwd: root,
  env,
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function waitForTarget(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
      const page = list.find((t) => t.type === 'page' && t.url.startsWith('http'));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {
      /* todavía arrancando */
    }
    await sleep(500);
  }
  throw new Error('No se encontró la ventana de Electron para capturar');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close: () => ws.close(),
      });
    });
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id) return;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.error) entry.rej(new Error(msg.error.message));
      else entry.res(msg.result);
    });
    ws.addEventListener('error', reject);
  });
}

async function waitForApp(http) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      /* vite aún arranca */
    }
    await sleep(500);
  }
  throw new Error('Vite preview no respondió');
}

async function main() {
  try {
    await waitForApp();
    const target = await waitForTarget();
    const cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    const evaluate = async (expression) => {
      const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? 'evaluate falló');
      return r.result?.value;
    };

    await evaluate("localStorage.setItem('cuyocode:onboarded','1'); location.hash='#/dashboard'; location.reload();");
    await sleep(2500);
    console.log('Preparando datos de demo…');
    await evaluate('window.api.system.demo()');
    await sleep(800);
    await evaluate("location.hash='#/audits'; location.reload();");
    await sleep(2500);

    const capture = async (name) => {
      await sleep(1300);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = path.join(outDir, `${name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log(`  ✓ docs/images/${name}.png`);
    };

    const audits = await evaluate('window.api.audits.list()');
    const auditId = audits?.[0]?.id ?? '';

    await evaluate("location.hash='#/dashboard'");
    await capture('dashboard');

    await evaluate("location.hash='#/audits'");
    await capture('audits');

    await evaluate(`location.hash='#/findings?audit=${auditId}'`);
    await sleep(1000);
    await evaluate("document.querySelector('.item')?.click()");
    await capture('findings');

    await evaluate(`location.hash='#/reports?audit=${auditId}'`);
    await capture('reports');

    await evaluate("location.hash='#/wizard'");
    await capture('wizard');

    await evaluate("location.hash='#/tools'");
    await capture('tools');

    await evaluate("location.hash='#/settings'");
    await capture('settings');

    cdp.close();
    console.log('Screenshots listos en docs/images');
  } finally {
    for (const child of [electron, preview]) {
      if (child.pid && process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        child.kill();
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
