import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';

function getLocalLanIps() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    const lowerName = name.toLowerCase();
    const isVirtual =
      lowerName.includes('vethernet') ||
      lowerName.includes('wsl') ||
      lowerName.includes('docker') ||
      lowerName.includes('vmware') ||
      lowerName.includes('virtualbox') ||
      lowerName.includes('loopback');

    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        candidates.push({
          address: net.address,
          name,
          isVirtual,
          isPrivate192: net.address.startsWith('192.168.')
        });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
    if (a.isPrivate192 !== b.isPrivate192) return a.isPrivate192 ? -1 : 1;
    return 0;
  });

  return candidates.map((c) => c.address);
}

function muscleMemoMobileBridge() {
  let sharedSyncSnapshot = null;

  const attachMiddlewares = (middlewares, httpServer) => {
    middlewares.use('/api/network-info', (req, res) => {
      const ips = getLocalLanIps();
      const addressInfo = httpServer?.address?.();
      const port = (typeof addressInfo === 'object' && addressInfo?.port) || 5173;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(
        JSON.stringify({
          lanIp: ips[0] || null,
          ips,
          port,
          hasSnapshot: !!sharedSyncSnapshot,
          lastSyncedAt: sharedSyncSnapshot?.updatedAt || null,
          sourceDevice: sharedSyncSnapshot?.sourceDevice || null
        })
      );
    });

    middlewares.use('/api/sync-state', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (req.method === 'GET') {
        res.end(
          JSON.stringify({
            ok: true,
            snapshot: sharedSyncSnapshot
          })
        );
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 5 * 1024 * 1024) {
            req.destroy();
          }
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            sharedSyncSnapshot = {
              updatedAt: new Date().toISOString(),
              sourceDevice: parsed.sourceDevice || 'PC',
              data: parsed.data || {}
            };
            res.end(
              JSON.stringify({
                ok: true,
                updatedAt: sharedSyncSnapshot.updatedAt
              })
            );
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
        return;
      }

      res.statusCode = 405;
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    });
  };

  return {
    name: 'muscle-memo-mobile-bridge',
    configureServer(server) {
      attachMiddlewares(server.middlewares, server.httpServer);
    },
    configurePreviewServer(server) {
      attachMiddlewares(server.middlewares, server.httpServer);
    },
    transformIndexHtml(html) {
      // Prevent Vite HMR client from endlessly polling /__vite_ping or force-reloading
      // when a smartphone leaves home Wi-Fi and is used at the gym on 4G/5G.
      const gymGuardScript = `<script>
(function(){
  if (!window.fetch) return;
  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('__vite_ping') !== -1) {
      return origFetch(input, init).catch(function() {
        return new Promise(function() {});
      });
    }
    return origFetch(input, init);
  };
})();
</script>`;
      return html.replace('<head>', '<head>\n    ' + gymGuardScript);
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
  plugins: [react(), muscleMemoMobileBridge()],
  server: {
    host: true
  },
  preview: {
    host: true
  }
});
