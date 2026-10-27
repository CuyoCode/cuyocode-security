const http = require('node:http');

function text(res, str) {
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(str);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') return text(res, 'ok');
  return text(res, 'hello');
});

server.listen(0, '127.0.0.1');
