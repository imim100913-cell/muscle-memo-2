import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Each executable app shell gets its own cache; an installing update must not
// overwrite the cache still used by an older, active worker.
function versionedServiceWorker() {
  return {
    name: 'versioned-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const worker = readFileSync(new URL('./public/sw.js', import.meta.url), 'utf8');
      const files = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).sort().join('|');
      const revision = createHash('sha256').update(worker).update(files).digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker.replace('muscle-memo-p0-02-v1', `muscle-memo-p0-02-${revision}`) });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true
  },
  plugins: [react(), versionedServiceWorker()],
  server: {
    host: true
  },
  preview: {
    host: true
  }
});
