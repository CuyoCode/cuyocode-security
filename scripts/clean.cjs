const fs = require('node:fs');
const path = require('node:path');

for (const dir of ['dist', 'dist-electron', 'coverage']) {
  fs.rmSync(path.join(__dirname, '..', dir), { recursive: true, force: true });
}
console.log('[clean] dist, dist-electron y coverage eliminados');
