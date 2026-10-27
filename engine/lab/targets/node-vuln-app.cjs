// Laboratorio Node: aplicación intencionalmente vulnerable para pruebas
// avanzadas SIN Docker. Solo datos sintéticos. Escucha ÚNICAMENTE en
// 127.0.0.1 (fijo en código, no configurable). Sin eval ni RCE a propósito:
// las demos son XSS reflejado, IDOR sintético, login débil y cabeceras.
'use strict';

const http = require('node:http');

const PORT = Number(process.argv[2]);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  console.error('puerto inválido (1024-65535)');
  process.exit(2);
}

const USERS = [
  { id: '1', name: 'Ada', email: 'ada@example.test', role: 'admin' },
  { id: '2', name: 'Bob', email: 'bob@example.test', role: 'user' },
];

function json(res, code, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...(extraHeaders || {}) });
  res.end(body);
}

function html(res, code, body) {
  // Sin CSP ni HSTS a propósito: el motor http-passive debe detectarlo.
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', Server: 'nodelab/1.0' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/' && req.method === 'GET') {
    // Cookie de sesión sin flags a propósito (la detecta cookies-review).
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      Server: 'nodelab/1.0',
      'Set-Cookie': 'nodelab_session=visitante; Path=/',
    });
    return res.end('<html><body><h1>nodelab</h1><ul>' +
      '<li><a href="/greet?name=invitado">/greet?name=</a> (XSS reflejado demo)</li>' +
      '<li>/api/users/2 (IDOR demo, sin auth)</li>' +
      '<li>POST /api/login {"user":"admin","pass":"admin"} (login débil demo)</li>' +
      '</ul></body></html>');
  }

  if (url.pathname === '/greet' && req.method === 'GET') {
    const name = url.searchParams.get('name') ?? 'mundo';
    return html(res, 200, `<html><body><h1>Hola ${name}</h1></body></html>`);
  }

  if (url.pathname.startsWith('/api/users/') && req.method === 'GET') {
    const id = url.pathname.slice('/api/users/'.length);
    const user = USERS.find((u) => u.id === id);
    if (!user) return json(res, 404, { error: 'no existe' });
    return json(res, 200, user);
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      let data = {};
      try {
        data = JSON.parse(body);
      } catch {
        return json(res, 400, { error: 'json inválido' });
      }
      if (data.user === 'admin' && data.pass === 'admin') {
        // Cookie de sesión sin flags a propósito: la detecta cookies-review.
        return json(res, 200, { ok: true }, { 'Set-Cookie': 'nodelab_session=abc123; Path=/' });
      }
      return json(res, 401, { error: 'credenciales inválidas' });
    });
    return;
  }

  return html(res, 404, '<html><body>not found</body></html>');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`nodelab en http://127.0.0.1:${PORT}/`);
});
