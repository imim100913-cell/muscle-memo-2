const CACHE_VERSION = 'muscle-memo-p0-02-b4acaa9f90f26f39';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('muscle-memo-') && key !== CACHE_VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
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

// The active worker owns an immutable, fully installed executable shell. Only a
// successfully installed and explicitly activated worker may select a new shell.
// Network-first HTML caching would mix a new index with unavailable new bundles.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Other origins, APIs and dev tools are outside the executable shell cache.
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('node_modules')
  ) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const target = request.mode === 'navigate'
      ? new URL('./index.html', self.registration.scope)
      : request;
    const cached = await cache.match(target, { ignoreVary: true });
    if (cached) return cached;
    // Never overwrite this version with an unverified network response, and
    // never borrow an executable from another version's (possibly partial) cache.
    try { return await fetch(request); }
    catch { return new Response('Offline', { status: 503, statusText: 'Offline' }); }
  })());
});
