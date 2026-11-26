const CACHE = 'zavrill-shell-v5';
const SHELL = ['/brand/wordmark.svg', '/brand/wordmark-inverse.svg', '/favicon.ico', '/favicon-32.png', '/apple-touch-icon.png', '/design-tokens.css', '/brand/mark.svg', '/', '/style.css', '/app.js', '/admin', '/admin.css', '/admin.js', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('courier-shell-') || key.startsWith('zavrill-shell-')) && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.pathname, copy))); }
    return response;
  }).catch(async () => (await caches.match(url.pathname)) || new Response('Open Zavrill once while online to make this screen available offline.', { status: 503 })));
});
