// Yooper Trivia service worker: keeps the quiz working without internet once it has loaded
// Change the version below whenever index.html or questions.js changes, so phones drop the old copy.
const CACHE = 'yooper-trivia-v2';
const ASSETS = ['.', 'index.html', 'questions.js', 'manifest.webmanifest', '../yooper-dictionary/icon-192.png', '../yooper-dictionary/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('yooper-trivia-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
// Network first, so a fixed question reaches people right away. A weak camp signal gets 3 seconds,
// then the saved copy is used. A late answer from the network still refreshes the saved copy.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  const net = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
    return res;
  });
  const saved = () => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined));
  const slow = new Promise(resolve => setTimeout(resolve, 3000)).then(saved);
  e.respondWith(
    Promise.race([net.catch(saved), slow.then(hit => hit || net)])
      .then(res => res || net)
      .catch(() => saved().then(hit => hit || Response.error()))
  );
});
