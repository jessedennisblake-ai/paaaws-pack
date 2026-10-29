// PAAAWS PACK offline support + instant updates.
// Pages always come fresh from the internet (never an old saved copy), so a new
// version shows the first time the app opens. Saved copies are only used offline.
const CACHE = 'paaaws-pack-v23'
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'])))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  const fresh = req.mode === 'navigate' ? fetch(req, { cache: 'no-store' }) : fetch(req, { cache: 'no-cache' })
  e.respondWith(
    fresh
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  )
})
