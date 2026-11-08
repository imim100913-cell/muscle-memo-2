const CACHE_VERSION = 'muscle-memo-p0-02-24f607c3e5624643';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './coach_all_might.png',
  './coach_demon.png',
  './coach_gentle.png',
  './coach_professional.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const indexURL = new URL('./index.html', self.registration.scope);
    const response = await fetch(indexURL, { cache: 'reload' });
    if (!response.ok) throw new Error('App shell could not be cached');
    const html = await response.clone().text();
    const bundles = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
      .map(match => new URL(match[1], indexURL))
      .filter(url => url.origin === self.location.origin && url.pathname.includes('/assets/'));
    const cache = await caches.open(CACHE_VERSION);
    // A new worker must not activate until its executable app shell is available offline.
    await cache.addAll([...STATIC_ASSETS, ...bundles.map(url => url.href)]);
    await cache.put(indexURL, response);
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('muscle-memo-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Listen for messages from client (e.g. SKIP_WAITING or SHOW_NOTIFICATION)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data.payload || {};
    if (self.registration && self.registration.showNotification) {
      self.registration.showNotification(title || 'マッスルメモ 2.0', {
        body: body || 'インターバルが終了しました！次のセットに入りましょう。',
        icon: './icon.svg',
        badge: './icon.svg',
        tag: tag || 'muscle-memo-timer',
        renotify: true,
        vibrate: [200, 100, 200, 100, 400]
      });
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});

// Network-first strategy with cache fallback for always-fresh updates + offline resilience
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Skip Vite HMR, internal API endpoints, and external Gemini API calls
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('node_modules') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, cloned);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request, { ignoreVary: url.origin === self.location.origin && url.pathname.includes('/assets/') }).then(async (cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (request.mode === 'navigate') {
            return (await caches.match(new URL('./index.html', self.registration.scope))) ||
              new Response('Offline', { status: 503, statusText: 'Offline' });
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
