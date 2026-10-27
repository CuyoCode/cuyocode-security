// Inventario de dependencias (SBOM ligero, sin dependencias nuevas).
// Lee package.json de cada paquete instalado y resume licencias.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const modules = path.join(root, 'node_modules');

function licenseOf(pkg) {
  const l = pkg.license ?? pkg.licenses;
  if (typeof l === 'string') return l;
  if (Array.isArray(l)) return l.map((x) => (typeof x === 'string' ? x : x.type)).filter(Boolean).join(', ');
  if (l && typeof l === 'object') return l.type ?? 'UNKNOWN';
  return 'UNKNOWN';
}

const entries = [];
for (const name of fs.readdirSync(modules)) {
  if (name.startsWith('.')) continue;
  const dir = path.join(modules, name);
  const load = (pkgPath, pkgName) => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
      entries.push({ name: pkgName, version: pkg.version ?? '?', license: licenseOf(pkg) });
    } catch {
      /* enlace roto: se informa en consola */
      console.error(`sin package.json: ${pkgName}`);
    }
  };
  if (name.startsWith('@')) {
    for (const sub of fs.readdirSync(dir)) load(path.join(dir, sub), `${name}/${sub}`);
  } else {
    load(dir, name);
  }
}

entries.sort((a, b) => (a.name < b.name ? -1 : 1));
fs.writeFileSync(path.join(root, 'sbom.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), packages: entries }, null, 2)}\n`);

const byLicense = new Map();
for (const e of entries) byLicense.set(e.license, (byLicense.get(e.license) ?? 0) + 1);
console.log(`paquetes: ${entries.length}`);
for (const [lic, n] of [...byLicense.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${lic}: ${n}`);
}
const unknown = entries.filter((e) => e.license === 'UNKNOWN');
if (unknown.length > 0) {
  console.log('UNKNOWN:');
  for (const u of unknown.slice(0, 20)) console.log(`  ${u.name}@${u.version}`);
}
