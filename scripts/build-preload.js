// Empaqueta electron/preload/preload.ts en un único archivo CommonJS.
//
// El preload corre con `sandbox: true` (ver electron/main/window.ts): el loader
// sandboxeado solo resuelve `require('electron')` y módulos empaquetados, no
// archivos locales como shared/ipc-contracts/*. Por eso se bundlean los imports
// locales con esbuild en vez de compilar archivo por archivo.
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['electron/preload/preload.ts'],
  outfile: 'dist-electron/electron/preload/preload.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
};

async function run() {
  if (watch) {
    const context = await esbuild.context(options);
    await context.watch();
    console.log('[preload] watching for changes...');
  } else {
    await esbuild.build(options);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
