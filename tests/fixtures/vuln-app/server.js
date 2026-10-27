const express = require('express');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = 'fixture-hardcoded-secret';
const AWS_KEY = 'AKIAIOSFODNN7EXAMPLE';

app.get('/calc', (req, res) => {
  const result = eval(req.query.expr);
  res.send(String(result));
});

app.get('/run', (req, res) => {
  exec('ls ' + req.query.dir, (err, out) => {
    res.send(out || '');
  });
});

app.get('/user', async (req, res) => {
  const q = 'SELECT * FROM users WHERE id = ' + req.query.id;
  res.send(q);
});

app.post('/login', (req, res) => {
  const token = jwt.sign({ sub: req.body.user });
  res.json({ token });
});

app.get('/page', (req, res) => {
  res.send('<div id="x"></div><script>document.getElementById("x").innerHTML = location.hash</script>');
});

module.exports = app;
