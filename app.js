/* Karir Merden — halaman warga (GitHub Pages).
   Satu feed: postingan terbaru di atas, saring per daerah, cari kata.
   Data: API_URL?api=jobs · Klik dicatat: API_URL?api=klik&id=…&aksi=Lihat|Lamar
   Tautan ?id=LK-0001 menampilkan satu postingan di paling atas (untuk dibagikan). */
(function () {
  'use strict';
  var API = (window.KM_CONFIG && window.KM_CONFIG.API_URL) || '';
  var CACHE_KEY = 'km_jobs_v3', PAGE = 10;
  var S = { jobs: [], loaded: false, error: false, kab: '', q: '', shown: PAGE, focusId: '' };
  var INFO = { nama: 'Karir Merden', waAdmin: '', kabupaten: ['Banjarnegara', 'Purbalingga', 'Banyumas', 'Wonosobo', 'Kebumen', 'Lainnya'] };
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var COLORS = ['#1877f2', '#0f766e', '#7c3aed', '#c2410c', '#be123c', '#15803d', '#a16207', '#0e7490'];
  var LOGO = document.querySelector('.logo').getAttribute('src');
  var IC = {
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5l7 7-7 7"/><path d="M21 12H10a7 7 0 00-7 7"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/><path d="M11 8v6M8 11h6"/></svg>'
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function todayIso() { var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function days(iso) { return Math.round((Date.parse(iso) - Date.parse(todayIso())) / 864e5); }
  function tgl(iso) { var p = String(iso).slice(0, 10).split('-'); return Number(p[2]) + ' ' + BLN[Number(p[1]) - 1]; }
  function waktu(j) {
    var t = j.waktu ? Date.parse(j.waktu) : NaN;
    if (!isNaN(t)) {
      var m = Math.floor((Date.now() - t) / 6e4);
      if (m < 1) return 'Baru saja';
      if (m < 60) return m + ' mnt';
      if (m < 1440) return Math.floor(m / 60) + ' jam';
    }
    if (!j.dicek) return '';
    var d = -days(j.dicek);
    return d <= 0 ? 'Hari ini' : d === 1 ? 'Kemarin' : d < 7 ? d + ' hari' : tgl(j.dicek);
  }
  function expired(j) { return j.batas && j.batas < todayIso(); }
  function isPost(j) { return j.jenis === 'post'; }
  function initials(s) {
    var w = String(s || '?').replace(/\b(PT|CV|UD|Tbk|PD|KSP)\b\.?/gi, '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
  }
  function colorFor(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length]; }

  /** Teks → HTML aman; tautan, email, dan nomor WA bisa diketuk. */
  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])|([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})|((?:\+62|62|0)8[\d\-. ]{7,15}\d)/g,
      function (all, url, mail, tel) {
        if (url) return '<a href="' + url + '" target="_blank" rel="noopener nofollow">' + url + '</a>';
        if (mail) return '<a href="mailto:' + mail + '">' + mail + '</a>';
        return '<a href="https://wa.me/' + tel.replace(/[^\d]/g, '').replace(/^0/, '62') + '" target="_blank" rel="noopener">' + tel + '</a>';
      });
  }
  /** Kontak lamaran → { href, label } atau null. */
  function lamar(j) {
    var v = String(j.caraLamar || '').trim(), msg = 'Halo, saya ingin bertanya tentang lowongan ' + j.judul + ' (info dari Karir Merden).';
    var wa = (v.match(/wa\.me\/(\d{9,15})/) || [])[1];
    if (!wa) { var d = v.replace(/[^\d+]/g, ''); if (!/[a-z@\/]/i.test(v) && /^(\+?62|0)8\d{7,12}$/.test(d)) wa = d.replace(/^\+/, '').replace(/^0/, '62'); }
    if (wa) return { href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg), label: 'Hubungi' };
    if (/^https?:\/\//i.test(v)) return { href: v, label: 'Lamar' };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { href: 'mailto:' + v + '?subject=' + encodeURIComponent('Lamaran ' + j.judul), label: 'Kirim lamaran' };
    return null;
  }

  /* ---------- Catat klik (sekali per aksi per postingan selama halaman terbuka) ---------- */
  var dicatat = {};
  function catat(id, aksi) {
    var k = id + '|' + aksi;
    if (!API || dicatat[k]) return;
    dicatat[k] = true;
    try { fetch(API + '?api=klik&id=' + encodeURIComponent(id) + '&aksi=' + aksi, { mode: 'no-cors', keepalive: true, credentials: 'omit' }).catch(function () {}); } catch (e) { /* abaikan */ }
  }
  var toastT;
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 2500); }

  /* ---------- Satu postingan ---------- */
  function card(j) {
    var head = isPost(j)
      ? '<img class="ava" src="' + esc(LOGO) + '" alt="">' + '<div class="who"><b>' + esc(INFO.nama) + '</b><span>' + esc([waktu(j), j.kabupaten].filter(Boolean).join(' · ')) + '</span></div>'
      : '<span class="ava" style="background:' + colorFor(j.perusahaan) + '" aria-hidden="true">' + esc(initials(j.perusahaan)) + '</span>' +
        '<div class="who"><b>' + esc(j.perusahaan || INFO.nama) + '</b><span>' + esc([waktu(j), j.kabupaten].filter(Boolean).join(' · ')) + '</span></div>';
    var text;
    if (isPost(j)) {
      text = linkify(j.ringkasan || '');
    } else {
      var bits = [];
      if (j.pendidikan && j.pendidikan !== 'Tidak disyaratkan') bits.push('Min. ' + esc(j.pendidikan));
      if (j.tanpaPengalaman) bits.push('Tanpa pengalaman');
      if (j.gaji) bits.push(esc(j.gaji));
      if (j.batas) bits.push(days(j.batas) <= 5 ? '<span class="hot">Tutup ' + tgl(j.batas) + '</span>' : 'Tutup ' + tgl(j.batas));
      var poin = String(j.ringkasan || '').split(/\s*(?:\n|•)\s*/).map(function (x) { return x.replace(/^[-–*]\s*/, ''); }).filter(Boolean);
      text = '<strong>' + esc(j.judul) + '</strong>' + (bits.length ? '<span class="meta">' + bits.join(' · ') + '</span>' : '') +
        (poin.length ? '<span class="poin">' + poin.map(function (p) { return '• ' + linkify(p); }).join('\n') + '</span>' : '');
    }
    var long = String(j.ringkasan || '').length > 240 || String(j.ringkasan || '').split(/\n|•/).length > 6;
    var l = lamar(j);
    var main = l ? '<a class="act main" href="' + esc(l.href) + '" target="_blank" rel="noopener" data-lamar="' + esc(j.id) + '">' + IC.send + esc(l.label) + '</a>'
      : j.foto ? '<button type="button" class="act main" data-zoom="' + esc(j.id) + '">' + IC.zoom + 'Lihat flyer</button>' : '';
    return '<article class="post" id="p-' + esc(j.id) + '">' +
      '<div class="ph">' + head + (INFO.waAdmin ? '<button type="button" class="dots" data-report="' + esc(j.id) + '" aria-label="Laporkan postingan ini" title="Laporkan">···</button>' : '') + '</div>' +
      (text ? '<div class="txt' + (long ? ' clamp' : '') + '">' + text + '</div>' + (long ? '<button type="button" class="more" data-more="' + esc(j.id) + '">Lihat selengkapnya</button>' : '') : '') +
      (j.foto ? '<button type="button" class="media" data-zoom="' + esc(j.id) + '" aria-label="Perbesar flyer"><img src="' + esc(j.foto) + '" data-fid="' + esc(j.fotoId || '') +
        '" alt="Flyer: ' + esc(j.judul) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>' : '') +
      '<div class="acts">' + main + '<button type="button" class="act" data-share="' + esc(j.id) + '">' + IC.share + 'Bagikan</button></div>' +
      '</article>';
  }

  /* ---------- Daftar ---------- */
  function filtered() {
    var q = S.q.toLowerCase();
    return S.jobs.filter(function (j) {
      if (expired(j)) return false;
      if (S.kab && j.kabupaten !== S.kab) return false;
      if (q && [j.judul, j.perusahaan, j.kabupaten, j.alamat, j.ringkasan].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderChips() {
    var n = {};
    S.jobs.forEach(function (j) { if (!expired(j) && j.kabupaten) n[j.kabupaten] = (n[j.kabupaten] || 0) + 1; });
    $('chips').innerHTML = '<button type="button" class="chip' + (S.kab ? '' : ' on') + '" data-kab="">Semua</button>' +
      INFO.kabupaten.filter(function (k) { return n[k] || k === S.kab; }).map(function (k) {
        return '<button type="button" class="chip' + (S.kab === k ? ' on' : '') + '" data-kab="' + esc(k) + '">' + esc(k) + ' · ' + (n[k] || 0) + '</button>';
      }).join('');
  }
  function skeleton() {
    return '<div class="post" style="padding:12px 16px 16px"><div style="display:flex;gap:10px;align-items:center"><div class="sk" style="width:40px;height:40px;border-radius:50%"></div>' +
      '<div style="flex:1"><div class="sk" style="height:12px;width:40%"></div><div class="sk" style="height:10px;width:25%;margin-top:6px"></div></div></div>' +
      '<div class="sk" style="height:12px;width:85%;margin-top:14px"></div><div class="sk" style="height:200px;margin-top:12px"></div></div>';
  }
  function render() {
    renderChips();
    var f = $('focus');
    var fj = S.focusId && S.jobs.filter(function (j) { return j.id === S.focusId; })[0];
    if (S.focusId && S.loaded) {
      f.innerHTML = fj && !expired(fj)
        ? '<div class="focus-h"><span>Postingan yang dibagikan</span><button type="button" class="link" data-all>Lihat semua</button></div>' + card(fj)
        : '<div class="empty"><b>Lowongan ini sudah ditutup</b>Lihat lowongan lain di bawah.</div>';
    } else f.innerHTML = '';

    var box = $('list');
    if (!S.loaded) {
      box.innerHTML = S.error ? '<div class="empty"><b>Gagal memuat lowongan</b>Periksa sinyal internet.<br><button type="button" class="btn" id="retry">Coba lagi</button></div>' : skeleton() + skeleton();
      return;
    }
    var items = filtered().filter(function (j) { return !fj || j.id !== fj.id; });
    if (!items.length) {
      box.innerHTML = '<div class="empty"><b>Belum ada lowongan' + (S.kab ? ' di ' + esc(S.kab) : '') + (S.q ? ' untuk "' + esc(S.q) + '"' : '') + '</b>' +
        (S.kab || S.q ? 'Coba pilih "Semua" atau kata lain.' : 'Cek lagi beberapa hari ke depan.') + '</div>';
      return;
    }
    box.innerHTML = (fj ? '<div class="focus-h"><span>Lowongan lainnya</span></div>' : '') + items.slice(0, S.shown).map(card).join('');
    $('more').setAttribute('data-more', items.length > S.shown ? '1' : '');
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { if (e[0].isIntersecting && $('more').getAttribute('data-more')) { S.shown += PAGE; render(); } }, { rootMargin: '800px' }).observe($('more'));
  } else S.shown = 1e6;

  /* ---------- Interaksi ---------- */
  $('chips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    S.kab = c.getAttribute('data-kab'); S.shown = PAGE; render(); window.scrollTo(0, 0);
  });
  $('searchBtn').addEventListener('click', function () {
    var open = $('searchRow').classList.toggle('hidden') === false;
    this.setAttribute('aria-expanded', String(open));
    if (open) $('q').focus(); else if (S.q) { $('q').value = ''; S.q = ''; render(); }
  });
  var qt;
  $('q').addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { S.q = $('q').value.trim(); S.shown = PAGE; render(); }, 150); });
  $('home').addEventListener('click', function (e) {
    e.preventDefault(); S.focusId = ''; S.kab = ''; S.q = ''; $('q').value = ''; S.shown = PAGE;
    try { history.replaceState(null, '', location.pathname); } catch (x) { /* abaikan */ }
    render(); window.scrollTo(0, 0);
  });

  function find(id) { for (var i = 0; i < S.jobs.length; i++) if (S.jobs[i].id === id) return S.jobs[i]; return null; }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('#retry')) { load(); return; }
    if (t.closest('[data-all]')) { $('home').click(); return; }
    if (t.closest('[data-tips]')) { $('tips').classList.remove('hidden'); return; }
    if (t.closest('[data-close]') || t.classList.contains('sheet')) { (t.closest('.sheet') || t).classList.add('hidden'); return; }
    var a = t.closest('[data-lamar]'); if (a) { catat(a.getAttribute('data-lamar'), 'Lamar'); return; }
    var m = t.closest('[data-more]');
    if (m) { var tx = m.previousElementSibling; if (tx) tx.classList.remove('clamp'); catat(m.getAttribute('data-more'), 'Lihat'); m.remove(); return; }
    var z = t.closest('[data-zoom]'); if (z) { var jz = find(z.getAttribute('data-zoom')); if (jz) openZoom(jz); return; }
    var s = t.closest('[data-share]'); if (s) { var js = find(s.getAttribute('data-share')); if (js) share(js); return; }
    var r = t.closest('[data-report]'); if (r) { var jr = find(r.getAttribute('data-report')); if (jr) report(jr); }
  });

  function share(j) {
    var url = location.origin + location.pathname + '?id=' + encodeURIComponent(j.id);
    var text = 'Info loker: ' + j.judul + (j.kabupaten ? ' (' + j.kabupaten + ')' : '') + ' – dari Karir Merden, Pemdes Merden.';
    if (navigator.share) navigator.share({ title: j.judul, text: text, url: url }).catch(function () {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + url), '_blank', 'noopener');
  }
  function report(j) {
    window.open('https://wa.me/' + INFO.waAdmin + '?text=' + encodeURIComponent('Laporan postingan ' + j.id + ' (' + j.judul + '): '), '_blank', 'noopener');
  }

  /* ---------- Foto diperbesar + cadangan alamat foto ---------- */
  var lastFocus;
  function openZoom(j) {
    lastFocus = document.activeElement;
    var img = document.querySelector('#p-' + j.id + ' .media img');
    $('lbImg').src = (img && img.currentSrc) || j.foto; $('lbImg').alt = 'Flyer: ' + j.judul;
    $('lightbox').classList.remove('hidden'); document.body.style.overflow = 'hidden'; $('lbClose').focus();
    catat(j.id, 'Lihat');
  }
  function closeZoom() { $('lightbox').classList.add('hidden'); document.body.style.overflow = ''; $('lbImg').src = ''; if (lastFocus) lastFocus.focus(); }
  $('lbClose').addEventListener('click', closeZoom);
  $('lightbox').addEventListener('click', function (e) { if (e.target === this) closeZoom(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('lightbox').classList.contains('hidden')) closeZoom();
    document.querySelectorAll('.sheet').forEach(function (s) { s.classList.add('hidden'); });
  });
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.getAttribute('data-fid')) return;
    if (!img.getAttribute('data-alt')) { img.setAttribute('data-alt', '1'); img.src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(img.getAttribute('data-fid')) + '&sz=w1080'; }
    else { var b = img.closest('.media'); if (b) b.classList.add('hidden'); }
  }, true);

  /* ---------- Data ---------- */
  function apply(d) {
    if (d.info) {
      if (d.info.nama) INFO.nama = /^KARIR MERDEN$/i.test(d.info.nama) ? 'Karir Merden' : d.info.nama;
      INFO.waAdmin = String(d.info.waAdmin || '');
      if (Array.isArray(d.info.kabupaten)) INFO.kabupaten = d.info.kabupaten;
    }
    S.jobs = Array.isArray(d.jobs) ? d.jobs : [];
  }
  function load() {
    S.error = false; render();
    if (window.DEMO_JOBS) { apply({ jobs: window.DEMO_JOBS, info: window.DEMO_INFO }); S.loaded = true; render(); return; }
    fetch(API + '?api=jobs', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        if (!d || d.ok !== true) throw new Error('data');
        apply(d); S.loaded = true; render();
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ info: d.info, jobs: d.jobs })); } catch (e) { /* abaikan */ }
      })
      .catch(function () { S.error = true; if (S.jobs.length) S.loaded = true; render(); if (S.loaded) toast('Sinyal lemah: menampilkan data terakhir.'); });
  }

  S.focusId = (new URLSearchParams(location.search).get('id') || '').slice(0, 20);
  if (new URLSearchParams(location.search).get('v') === 'tips') $('tips').classList.remove('hidden');
  try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && Array.isArray(c.jobs)) { apply(c); S.loaded = true; } } catch (e) { /* abaikan */ }
  load();
})();
