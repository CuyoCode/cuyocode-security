import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

const DEV_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:5199 ws://localhost:5199; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none';";
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';";

function cspPlugin(): Plugin {
  return {
    name: 'cuyocode-csp',
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? DEV_CSP : PROD_CSP;
      return html.replace(
        /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/i,
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [vue(), cspPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  base: './',
  server: {
    port: 5199,
    strictPort: true,
    watch: {
      ignored: ['**/.tmp/**', '**/release/**', '**/dist/**', '**/dist-electron/**', '**/coverage/**'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
