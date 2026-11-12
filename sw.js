/* KARIR MERDEN — service worker.
   - Kerangka aplikasi (HTML/CSS/JS/ikon) disimpan agar aplikasi tetap terbuka saat sinyal hilang.
   - HTML/JS/CSS: ambil dari jaringan dulu (selalu versi terbaru), cadangan dari simpanan.
   - Data lowongan & API admin TIDAK disimpan di sini (data lowongan sudah disimpan app.js di perangkat).
   Naikkan VERSION setiap kali mengubah daftar SHELL. */
var VERSION = 'km-v3';
var SHELL = ['./', './index.html', './admin.html',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API Apps Script & foto Drive: biarkan langsung ke jaringan
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
      });
    })
  );
});
