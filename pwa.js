/* KARIR MERDEN — PWA: daftar service worker dan tombol "Pasang aplikasi".
   Tombol apa pun dengan atribut data-install akan:
   - Android/Chrome/Edge: memunculkan dialog pasang bawaan browser;
   - iPhone/iPad (Safari): menampilkan petunjuk "Bagikan › Tambah ke Layar Utama".
   Elemen dengan atribut data-install-wrap disembunyikan bila aplikasi sudah terpasang. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* abaikan */ }); });
  }

  var deferred = null;
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var DISMISS = 'km_install_off';

  function els(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function dismissed() { try { return localStorage.getItem(DISMISS) === '1'; } catch (e) { return false; } }
  function update() {
    var can = !standalone && (deferred || isIOS);
    els('[data-install]').forEach(function (b) { b.classList.toggle('hidden', !can); });
    els('[data-install-wrap]').forEach(function (w) { w.classList.toggle('hidden', !can || dismissed()); });
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; update(); });
  window.addEventListener('appinstalled', function () { deferred = null; standalone = true; update(); });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-install-x]')) {
      try { localStorage.setItem(DISMISS, '1'); } catch (x) { /* abaikan */ }
      update(); return;
    }
    var b = e.target.closest('[data-install]');
    if (!b) return;
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; update(); });
    } else if (isIOS) {
      var h = document.getElementById('iosHint');
      if (h) h.classList.remove('hidden');
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-ios-x]')) document.getElementById('iosHint').classList.add('hidden');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update); else update();
})();
