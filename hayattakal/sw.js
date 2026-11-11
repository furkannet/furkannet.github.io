// Çevrimdışı çalışma: önce ağ, ağ yoksa önbellek. Sürüm adı yayinla.sh ile değişir.
var CACHE = 'hayattakal-0.3.7';
var DOSYALAR = ['./', './index.html', './oyun.js', './manifest.json', './ikon.svg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(DOSYALAR); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('hayattakal-') === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || r.url.indexOf(self.registration.scope) !== 0) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res.ok && r.url.indexOf('version.json') < 0) {
      var kopya = res.clone();
      caches.open(CACHE).then(function (c) { c.put(r, kopya); });
    }
    return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: true }); }));
});
