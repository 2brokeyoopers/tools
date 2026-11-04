// Yooper Trivia service worker: keeps the quiz working without internet once it has loaded
const CACHE = 'yooper-trivia-v1';
const ASSETS = ['.', 'index.html', 'questions.js', 'manifest.webmanifest', '../yooper-dictionary/icon-192.png', '../yooper-dictionary/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('yooper-trivia-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
// Network first, so a fixed question reaches people right away. The saved copy is used when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
