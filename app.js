/* KARIR MERDEN — frontend statis (GitHub Pages), tampilan feed.
   Data dari Google Apps Script: API_URL?api=jobs
   Klik dicatat lewat:          API_URL?api=klik&id=...&aksi=Lihat|Lamar */
(function () {
  'use strict';

  var API = (window.KM_CONFIG && window.KM_CONFIG.API_URL) || '';
  var CACHE_KEY = 'km_jobs_v2', NOTICE_KEY = 'km_notice_off', SAVED_KEY = 'km_saved';
  var PAGE = 8;
  var S = { jobs: [], loaded: false, error: '', currentId: '', kab: '', shown: PAGE, view: 'list' };
  var INFO = {
    nama: 'KARIR MERDEN', waAdmin: '', minDilihat: 5,
    kabupaten: ['Banjarnegara', 'Purbalingga', 'Banyumas', 'Wonosobo', 'Kebumen', 'Lainnya'],
    pendidikan: ['Tidak disyaratkan', 'SD', 'SMP', 'SMA/SMK', 'D3', 'S1']
  };
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var COLORS = ['#1b74e4', '#0f766e', '#7c3aed', '#c2410c', '#be123c', '#15803d', '#a16207', '#0e7490', '#4338ca', '#9d174d'];

  var I = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 2 3.1-.2.9 3 2.6 1.8-1 2.9 1 2.9-2.6 1.8-.9 3-3.1-.2L12 22l-2.4-2-3.1.2-.9-3L3 15.4l1-2.9-1-2.9L5.6 7.8l.9-3 3.1.2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    edu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/></svg>',
    money: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0114 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5l7 7-7 7"/><path d="M21 12H10a7 7 0 00-7 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.5"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    globe: '<svg class="globe" viewBox="0 0 24 24" aria-label="Publik"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 010 18a14 14 0 010-18"/></svg>'
  };

  /* ---------- Lowongan tersimpan (di perangkat ini saja) ---------- */
  var saved = (function () { try { var a = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } })();
  function isSaved(id) { return saved.indexOf(id) >= 0; }
  function toggleSave(id) {
    var i = saved.indexOf(id);
    if (i >= 0) saved.splice(i, 1); else saved.unshift(id);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved.slice(0, 100))); } catch (e) { /* abaikan */ }
    updateSavedBadge();
    return i < 0;
  }
  function updateSavedBadge() {
    var n = saved.filter(function (id) { var j = findJob(id); return j && !expired(j); }).length;
    var b = document.getElementById('savedBadge');
    if (b) { b.textContent = n > 9 ? '9+' : String(n); b.classList.toggle('hidden', !n); }
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tgl(iso) {
    if (!iso) return '';
    var p = iso.slice(0, 10).split('-');
    return Number(p[2]) + ' ' + BLN[Number(p[1]) - 1] + ' ' + p[0];
  }
  function tglPendek(iso) { var p = iso.slice(0, 10).split('-'); return Number(p[2]) + ' ' + BLN[Number(p[1]) - 1]; }
  function todayIso() {
    var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function daysFromToday(iso) { return Math.round((Date.parse(iso) - Date.parse(todayIso())) / 864e5); }
  function waktuLalu(iso) {
    if (!iso) return '';
    var d = -daysFromToday(iso);
    if (d <= 0) return 'Hari ini';
    if (d === 1) return 'Kemarin';
    if (d < 7) return d + ' hari lalu';
    return tglPendek(iso);
  }
  /** Waktu gaya Facebook dari tanggal-jam lengkap: "Baru saja", "5 mnt", "3 jam", "Kemarin", "3 hari", "12 Nov". */
  function waktuPost(j) {
    if (!j.waktu) return waktuLalu(j.dicek);
    var ms = Date.now() - Date.parse(j.waktu);
    if (isNaN(ms)) return waktuLalu(j.dicek);
    var m = Math.floor(ms / 6e4);
    if (m < 1) return 'Baru saja';
    if (m < 60) return m + ' mnt';
    if (m < 24 * 60) return Math.floor(m / 60) + ' jam';
    return waktuLalu(j.dicek);
  }
  /** Teks caption → HTML aman: tautan, email, dan nomor WA bisa diketuk. */
  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])|([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})|((?:\+62|62|0)8[\d\-. ]{7,15}\d)/g,
      function (all, url, mail, tel) {
        if (url) return '<a href="' + url + '" target="_blank" rel="noopener nofollow">' + url + '</a>';
        if (mail) return '<a href="mailto:' + mail + '">' + mail + '</a>';
        var n = tel.replace(/[^\d]/g, '').replace(/^0/, '62');
        return '<a href="https://wa.me/' + n + '" target="_blank" rel="noopener">' + tel + '</a>';
      });
  }
  function eduText(p) { return (!p || p === 'Tidak disyaratkan') ? 'Semua lulusan' : 'Min. ' + p; }
  function isSafeUrl(u) { return /^https?:\/\//i.test(String(u || '').trim()); }
  function initials(s) {
    var w = String(s || '?').replace(/\b(PT|CV|UD|Tbk|PD|KSP)\b\.?/gi, '').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase();
  }
  function colorFor(s) {
    var h = 0; s = String(s || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return COLORS[h % COLORS.length];
  }
  function points(text) {
    return String(text || '').split(/\s*(?:\n|•)\s*/).map(function (x) { return x.replace(/^[-–*]\s*/, '').trim(); }).filter(Boolean);
  }

  function lamarLink(j) {
    var v = String(j.caraLamar || '').trim();
    if (/^wa\.me\//i.test(v)) v = 'https://' + v;
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(v)) {
      var num = (v.match(/wa\.me\/(\d+)/) || [])[1];
      if (num) return waLink(num, j);
      return { href: v, label: 'Lamar via WhatsApp' };
    }
    if (isSafeUrl(v)) return { href: v, label: 'Lamar di situs perekrut' };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return { href: 'mailto:' + v + '?subject=' + encodeURIComponent('Lamaran ' + j.judul), label: 'Lamar lewat email' };
    }
    var digits = v.replace(/[^\d+]/g, '');
    if (/^(\+?62|0)8\d{7,12}$/.test(digits)) return waLink(digits.replace(/^\+/, '').replace(/^0/, '62'), j);
    return null;
  }
  function waLink(num, j) {
    var msg = 'Halo, saya ingin bertanya tentang lowongan ' + j.judul + ' di ' + j.perusahaan + ' (info dari KARIR MERDEN).';
    return { href: 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg), label: 'Lamar via WhatsApp' };
  }
  function baseUrl() { return location.origin + location.pathname; }
  function jobUrl(id) { return baseUrl() + '?id=' + encodeURIComponent(id); }
  function findJob(id) { for (var i = 0; i < S.jobs.length; i++) if (S.jobs[i].id === id) return S.jobs[i]; return null; }

  /* ---------- Penyimpanan lokal (tampil cepat saat sinyal lemah) ---------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function cacheRead() { try { var o = JSON.parse(store(CACHE_KEY) || 'null'); return o && Array.isArray(o.jobs) ? o : null; } catch (e) { return null; } }

  /* ---------- Pencatat klik (sekali per aksi per lowongan selama halaman terbuka) ---------- */
  var sudahDicatat = {};
  function catat(id, aksi) {
    var k = id + '|' + aksi;
    if (!API || !id || sudahDicatat[k]) return false;
    sudahDicatat[k] = true;
    try {
      fetch(API + '?api=klik&id=' + encodeURIComponent(id) + '&aksi=' + encodeURIComponent(aksi),
        { method: 'GET', mode: 'no-cors', keepalive: true, credentials: 'omit' })
        .catch(function () { delete sudahDicatat[k]; });
    } catch (e) { delete sudahDicatat[k]; }
    return true;
  }

  var toastT;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 2500);
  }

  /* ---------- Filter ---------- */
  function setupFilters() {
    var edu = $('fEdu'), ev = edu.value;
    edu.innerHTML = '<option value="">Semua lulusan</option>' +
      INFO.pendidikan.filter(function (e) { return e !== 'Tidak disyaratkan'; })
        .map(function (e) { return '<option value="' + esc(e) + '">Lulusan ' + esc(e) + '</option>'; }).join('');
    edu.value = ev;
    var hitung = {};
    S.jobs.forEach(function (j) { if (!expired(j)) hitung[j.kabupaten] = (hitung[j.kabupaten] || 0) + 1; });
    var kabs = INFO.kabupaten.filter(function (k) { return hitung[k] || k === S.kab; });
    $('chips').innerHTML = ['<button type="button" class="chip' + (S.kab ? '' : ' on') + '" data-kab="">Semua</button>']
      .concat(kabs.map(function (k) {
        return '<button type="button" class="chip' + (S.kab === k ? ' on' : '') + '" data-kab="' + esc(k) + '">' + esc(k) +
          (hitung[k] ? ' · ' + hitung[k] : '') + '</button>';
      })).join('');
  }
  $('chips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    S.kab = c.getAttribute('data-kab');
    Array.prototype.forEach.call($('chips').children, function (x) { x.classList.toggle('on', x === c); });
    S.shown = PAGE;
    if (S.view !== 'list' && S.view !== 'saved') openList(true); else renderList();
    window.scrollTo(0, 0);
  });
  $('q').addEventListener('input', function () { S.shown = PAGE; renderList(); });
  ['fEdu', 'fTanpa'].forEach(function (id) { $(id).addEventListener('change', function () { S.shown = PAGE; renderList(); }); });
  function toggleSearch(forceOpen) {
    var panel = $('filterPanel');
    var open = forceOpen === true ? true : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !open);
    $('searchBtn').setAttribute('aria-expanded', String(open));
    if (open) { if (S.view !== 'list') openList(true); window.scrollTo(0, 0); $('q').focus(); }
    markNav();
  }
  $('searchBtn').addEventListener('click', function () { toggleSearch(); });

  function expired(j) { return j.batas && j.batas < todayIso(); }
  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var edu = $('fEdu').value, tanpa = $('fTanpa').checked, EDU = INFO.pendidikan;
    var onlySaved = S.view === 'saved';
    return S.jobs.filter(function (j) {
      if (expired(j)) return false;
      if (onlySaved && !isSaved(j.id)) return false;
      if (q && (j.judul + ' ' + j.perusahaan + ' ' + j.kategori + ' ' + j.alamat + ' ' + j.kabupaten + ' ' + j.ringkasan).toLowerCase().indexOf(q) < 0) return false;
      if (S.kab && j.kabupaten !== S.kab) return false;
      if (edu && Math.max(0, EDU.indexOf(j.pendidikan)) > EDU.indexOf(edu)) return false;
      if (tanpa && !j.tanpaPengalaman) return false;
      return true;
    });
  }

  /* ---------- Satu posting ---------- */
  function facts(j) {
    var f = [];
    if (j.dicek && daysFromToday(j.dicek) >= -2) f.push('<span class="fact new">BARU</span>');
    f.push('<span class="fact">' + I.edu + esc(eduText(j.pendidikan)) + '</span>');
    if (j.gaji) f.push('<span class="fact money">' + I.money + esc(j.gaji) + '</span>');
    if (j.tanpaPengalaman) f.push('<span class="fact">' + I.star + 'Tanpa pengalaman</span>');
    if (j.batas) {
      var d = daysFromToday(j.batas);
      f.push('<span class="fact' + (d <= 5 ? ' hot' : '') + '">' + I.clock +
        (d === 0 ? 'Tutup hari ini' : d === 1 ? 'Tutup besok' : 'Tutup ' + tglPendek(j.batas)) + '</span>');
    }
    return '<div class="facts">' + f.join('') + '</div>';
  }
  function viewsHtml(j) {
    var n = Number(j.dilihat) || 0;
    return n >= Math.max(1, INFO.minDilihat) ? '<span>' + I.eye + 'Dilihat ' + n.toLocaleString('id-ID') + ' kali</span>' : '<span></span>';
  }
  function mediaHtml(j) {
    if (!j.foto) return '';
    return '<button type="button" class="media" data-zoom="' + esc(j.id) + '" aria-label="Perbesar flyer ' + esc(j.judul) + '">' +
      '<img src="' + esc(j.foto) + '" data-fid="' + esc(j.fotoId || '') + '" alt="Flyer lowongan ' + esc(j.judul) + ' di ' + esc(j.perusahaan) +
      '" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>';
  }
  var LOGO = (document.querySelector('.logo') || {}).getAttribute ? document.querySelector('.logo').getAttribute('src') : 'icons/icon-192.png';
  function isPost(j) { return j.jenis === 'post'; }
  function headerHtml(j) {
    if (isPost(j)) {
      return '<div class="post-h"><img class="ava" src="' + LOGO + '" alt="" width="40" height="40">' +
        '<div class="who"><div class="co"><span>' + esc(INFO.nama === 'KARIR MERDEN' ? 'Karir Merden' : INFO.nama) + '</span>' + I.check + '</div>' +
        '<div class="sub">' + esc(waktuPost(j)) + (j.kabupaten ? ' · ' + esc(j.kabupaten) : '') + ' · ' + I.globe + '</div></div></div>';
    }
    return '<div class="post-h"><span class="ava" style="background:' + colorFor(j.perusahaan) + '" aria-hidden="true">' + esc(initials(j.perusahaan)) + '</span>' +
      '<div class="who"><div class="co"><span>' + esc(j.perusahaan || 'Perusahaan') + '</span>' + (j.label ? I.check : '') + '</div>' +
      '<div class="sub">' + esc(j.kabupaten) + (j.dicek ? ' · ' + esc(waktuPost(j)) : '') + (j.label ? ' · Dicek admin' : '') + '</div></div></div>';
  }
  function postHtml(j, full) {
    var lamar = lamarLink(j);
    var body;
    if (isPost(j)) {
      var cap = String(j.ringkasan || '');
      var long = !full && (cap.length > 260 || cap.split('\n').length > 5);
      body = cap ? '<div class="post-b"><div class="caption' + (long ? ' clamp' : '') + '">' + linkify(cap) + '</div>' +
        (long ? '<button type="button" class="more-btn" data-more="1">Lihat selengkapnya</button>' : '') + '</div>' : '<div class="post-b slim"></div>';
    } else {
      var pts = points(j.ringkasan);
      var ring = pts.length
        ? '<ul class="ring' + (full || pts.length <= 3 ? '' : ' clamp') + '">' + pts.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
          (!full && pts.length > 3 ? '<button type="button" class="more-btn" data-open="' + esc(j.id) + '">Lihat selengkapnya</button>' : '')
        : '';
      body = '<div class="post-b"' + (full ? '' : ' data-open="' + esc(j.id) + '" role="link" tabindex="0" aria-label="Buka detail ' + esc(j.judul) + '"') + '>' +
        '<h2>' + esc(j.judul) + '</h2>' + facts(j) + ring + '</div>';
    }
    return '<article class="post" data-id="' + esc(j.id) + '">' + headerHtml(j) + body +
      mediaHtml(j) +
      '<div class="stats">' + viewsHtml(j) + (j.alamat ? '<span>' + I.pin + esc(j.alamat.length > 40 ? j.alamat.slice(0, 38) + '…' : j.alamat) + '</span>' : '') + '</div>' +
      (full ? '' : '<div class="actions">' +
        (lamar ? '<a class="act primary" data-lamar="' + esc(j.id) + '" href="' + esc(lamar.href) + '" target="_blank" rel="noopener">' + I.send + 'Lamar</a>'
               : '<button type="button" class="act primary" data-open="' + esc(j.id) + '">' + (isPost(j) ? I.info + 'Detail' : I.send + 'Lamar') + '</button>') +
        '<button type="button" class="act" data-share="' + esc(j.id) + '">' + I.share + 'Bagikan</button>' +
        saveBtn(j, 'act') +
      '</div>') + '</article>';
  }
  function saveBtn(j, cls) {
    var on = isSaved(j.id);
    return '<button type="button" class="' + cls + (on ? ' saved' : '') + '" data-save="' + esc(j.id) + '" aria-pressed="' + on + '">' +
      I.save + '<span>' + (on ? 'Tersimpan' : 'Simpan') + '</span></button>';
  }

  /* ---------- Baris "Terbaru" ala Stories ---------- */
  function renderStories() {
    var box = $('stories');
    var items = S.view === 'list' && !S.kab && !$('q').value.trim()
      ? S.jobs.filter(function (j) { return !expired(j); }).slice(0, 12) : [];
    if (items.length < 3) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = items.map(function (j) {
      var fresh = j.dicek && daysFromToday(j.dicek) >= -3;
      var inner = j.foto
        ? '<img src="' + esc(j.foto) + '" data-fid="' + esc(j.fotoId || '') + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
        : '<span style="background:' + colorFor(j.perusahaan) + '">' + esc(initials(j.perusahaan)) + '</span>';
      return '<button type="button" class="story' + (fresh ? ' fresh' : '') + '" data-open="' + esc(j.id) + '" aria-label="' + esc(j.judul + ' – ' + j.perusahaan) + '">' +
        '<span class="ring-o">' + inner + '</span><small>' + esc(j.judul) + '</small></button>';
    }).join('');
  }

  function skeletons(n) {
    var one = '<div class="post skel"><div class="sk-row"><div class="sk sk-ava"></div><div style="flex:1"><div class="sk sk-line" style="width:45%"></div>' +
      '<div class="sk sk-line" style="width:30%"></div></div></div><div class="sk sk-line" style="width:70%;height:16px;margin-top:16px"></div>' +
      '<div class="sk sk-line" style="width:90%"></div><div class="sk sk-media"></div></div>';
    return new Array(n + 1).join(one);
  }

  /* ---------- Daftar (feed) ---------- */
  function renderList() {
    var box = $('list');
    if (!S.loaded) {
      $('count').textContent = '';
      box.innerHTML = S.error
        ? '<div class="post empty"><b>Gagal memuat lowongan</b>Periksa sinyal internet, lalu coba lagi.<br><button type="button" id="retryBtn">Coba lagi</button></div>'
        : skeletons(2);
      var rb = $('retryBtn'); if (rb) rb.addEventListener('click', load);
      return;
    }
    var items = filtered();
    var isSavedView = S.view === 'saved';
    renderStories();
    updateSavedBadge();
    $('count').textContent = isSavedView ? 'Lowongan tersimpan' + (items.length ? ' · ' + items.length : '')
      : (items.length ? items.length + ' lowongan' + (S.kab ? ' di ' + S.kab : '') : '');
    if (!items.length) {
      box.innerHTML = isSavedView
        ? '<div class="post empty"><b>Belum ada yang disimpan</b>Tekan ' + I.save.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"') +
          ' <b style="display:inline">Simpan</b> pada lowongan yang menarik agar mudah dibuka lagi.</div>'
        : '<div class="post empty"><b>Belum ada loker untuk pilihan ini</b>Coba hapus filter, atau cek lagi beberapa hari ke depan.</div>';
      return;
    }
    box.innerHTML = items.slice(0, S.shown).map(function (j) { return postHtml(j, false); }).join('');
    $('sentinel').setAttribute('data-more', items.length > S.shown ? '1' : '');
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      if (en[0].isIntersecting && $('sentinel').getAttribute('data-more') && (S.view === 'list' || S.view === 'saved')) { S.shown += PAGE; renderList(); }
    }, { rootMargin: '600px' }).observe($('sentinel'));
  } else { S.shown = 1e6; }

  /* ---------- Detail ---------- */
  function renderDetail(id) {
    var j = findJob(id), box = $('detail');
    if (!j) {
      box.innerHTML = S.loaded || S.error
        ? '<div class="post empty"><b>Lowongan tidak ditemukan</b>Lowongan ini sudah ditutup atau tidak tersedia lagi.<br><button type="button" data-home="1">Lihat loker lain</button></div>'
        : skeletons(1);
      return;
    }
    if (expired(j)) {
      box.innerHTML = '<div class="post empty"><b>Lowongan sudah ditutup</b>Batas lamaran ' + esc(tgl(j.batas)) + ' sudah lewat.<br><button type="button" data-home="1">Lihat loker lain</button></div>';
      return;
    }
    document.title = j.judul + (j.perusahaan ? ' – ' + j.perusahaan : '') + ' | ' + INFO.nama;
    if (S.loaded && catat(j.id, 'Lihat')) j.dilihat = (Number(j.dilihat) || 0) + 1;
    var lamar = lamarLink(j);
    var sumber = isSafeUrl(j.urlSumber) ? '<a href="' + esc(j.urlSumber) + '" target="_blank" rel="noopener">Buka iklan asli</a>' : esc(j.urlSumber || '-');
    box.innerHTML = postHtml(j, true).replace('</article>', '') + (isPost(j) ? '' :
      '<div class="post-b" style="padding-top:0">' +
        '<dl class="dl">' +
          '<dt>Lokasi</dt><dd>' + esc(j.kabupaten) + (j.alamat ? ' · ' + esc(j.alamat) : '') + '</dd>' +
          '<dt>Lulusan</dt><dd>' + esc(eduText(j.pendidikan)) + '</dd>' +
          '<dt>Pengalaman</dt><dd>' + (j.tanpaPengalaman ? 'Tanpa pengalaman boleh' : 'Lihat syarat') + '</dd>' +
          '<dt>Gaji</dt><dd>' + (j.gaji ? esc(j.gaji) : 'Tidak dicantumkan') + '</dd>' +
          (j.kategori ? '<dt>Bidang</dt><dd>' + esc(j.kategori) + '</dd>' : '') +
          '<dt>Ditutup</dt><dd>' + (j.batas ? tgl(j.batas) : 'Tidak disebutkan') + '</dd>' +
        '</dl>' +
        '<div class="infobox"><b>' + esc(j.label || 'Sumber') + '</b><br>Dicek admin desa: ' + (j.dicek ? tgl(j.dicek) : '-') + '<br>Sumber: ' + sumber + '</div>' +
        (lamar ? '' : '<div class="infobox"><b>Cara melamar</b><br>' + esc(j.caraLamar || 'Lihat iklan asli') + '</div>') +
      '</div>') +
      '<div class="big-actions">' +
        (lamar ? '<a class="btn lamar" data-lamar="' + esc(j.id) + '" href="' + esc(lamar.href) + '" target="_blank" rel="noopener">' + I.send + esc(lamar.label) + '</a>' : '') +
        '<div class="two">' +
          '<button type="button" class="btn share" data-share="' + esc(j.id) + '">' + I.share + 'Bagikan</button>' +
          saveBtn(j, 'btn share') +
        '</div>' +
        (INFO.waAdmin ? '<button type="button" class="btn lapor" data-report="' + esc(j.id) + '">' + I.flag + 'Laporkan lowongan ini</button>' : '') +
      '</div>' +
      '<p class="legal">Info ini disebarkan Pemerintah Desa Merden sebagai layanan informasi. Proses seleksi sepenuhnya oleh perusahaan. ' +
      '<strong>Jangan pernah membayar untuk melamar kerja.</strong></p></article>';
  }

  /* ---------- Aksi pada posting (satu pendengar untuk semua) ---------- */
  function onPostClick(e) {
    if (e.target.closest('.caption a')) return; // tautan di caption: biarkan terbuka biasa
    var t = e.target.closest('[data-share],[data-report],[data-zoom],[data-lamar],[data-home],[data-save],[data-more],[data-open]');
    if (!t) return;
    if (t.hasAttribute('data-home')) { openList(true); return; }
    if (t.hasAttribute('data-more')) {
      var c = t.parentNode.querySelector('.caption'); if (c) c.classList.remove('clamp');
      t.remove(); return;
    }
    if (t.hasAttribute('data-lamar')) { catat(t.getAttribute('data-lamar'), 'Lamar'); return; }
    if (t.hasAttribute('data-save')) {
      var sid = t.getAttribute('data-save'), on = toggleSave(sid);
      document.querySelectorAll('[data-save="' + sid + '"]').forEach(function (b) {
        b.classList.toggle('saved', on); b.setAttribute('aria-pressed', String(on));
        var sp = b.querySelector('span'); if (sp) sp.textContent = on ? 'Tersimpan' : 'Simpan';
      });
      toast(on ? 'Disimpan. Buka lagi di menu Tersimpan.' : 'Dihapus dari Tersimpan.');
      if (!on && S.view === 'saved') renderList();
      return;
    }
    var id = t.getAttribute('data-open') || t.getAttribute('data-share') || t.getAttribute('data-report') || t.getAttribute('data-zoom');
    var j = findJob(id); if (!j) return;
    if (t.hasAttribute('data-open')) openDetail(id, true);
    else if (t.hasAttribute('data-share')) share(j);
    else if (t.hasAttribute('data-report')) report(j);
    else if (t.hasAttribute('data-zoom')) zoom(j, t.querySelector('img'));
  }
  $('list').addEventListener('click', onPostClick);
  $('detail').addEventListener('click', onPostClick);
  $('stories').addEventListener('click', onPostClick);
  $('list').addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.post-b[data-open]')) { e.preventDefault(); openDetail(e.target.getAttribute('data-open'), true); }
  });

  function share(j) {
    var link = jobUrl(j.id);
    var where = [j.perusahaan, j.kabupaten].filter(Boolean).join(', ');
    var text = 'Loker: ' + j.judul + (where ? ' – ' + where : '') + (j.gaji ? '\nGaji: ' + j.gaji : '') +
      '\nInfo dari KARIR MERDEN, Pemdes Merden.';
    if (navigator.share) {
      navigator.share({ title: j.judul, text: text, url: link }).catch(function () { /* dibatalkan */ });
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + link), '_blank', 'noopener');
    }
  }
  function report(j) {
    if (!INFO.waAdmin) { toast('Silakan laporkan ke kantor Desa Merden.'); return; }
    window.open('https://wa.me/' + INFO.waAdmin + '?text=' +
      encodeURIComponent('Laporan lowongan ' + j.id + ' (' + j.judul + ' – ' + j.perusahaan + '): '), '_blank', 'noopener');
  }

  /* ---------- Foto: cadangan bila tautan utama gagal, dan tampilan diperbesar ---------- */
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.getAttribute('data-fid')) return;
    if (!img.getAttribute('data-alt')) {
      img.setAttribute('data-alt', '1');
      img.src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(img.getAttribute('data-fid')) + '&sz=w1080';
    } else {
      var m = img.closest('.media'); if (m) m.classList.add('hidden');
    }
  }, true);

  var lastFocus = null;
  function zoom(j, img) {
    lastFocus = document.activeElement;
    $('lbImg').src = (img && img.currentSrc) || j.foto;
    $('lbImg').alt = 'Flyer lowongan ' + j.judul + ' di ' + j.perusahaan;
    $('lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    $('lbClose').focus();
    if (S.loaded) catat(j.id, 'Lihat');
  }
  function closeZoom() {
    $('lightbox').classList.add('hidden'); document.body.style.overflow = ''; $('lbImg').src = '';
    if (lastFocus) lastFocus.focus();
  }
  $('lbClose').addEventListener('click', closeZoom);
  $('lightbox').addEventListener('click', function (e) { if (e.target === this) closeZoom(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('lightbox').classList.contains('hidden')) closeZoom(); });

  /* ---------- Pengumuman keamanan ---------- */
  if (store(NOTICE_KEY) === '1') $('notice').classList.add('hidden');
  $('noticeX').addEventListener('click', function () { $('notice').classList.add('hidden'); store(NOTICE_KEY, '1'); });

  /* ---------- Navigasi (?id=LK-0001 dan ?v=tips bisa dibagikan) ---------- */
  function showView(v) {
    S.view = v;
    $('vList').classList.toggle('hidden', v !== 'list' && v !== 'saved');
    $('vDetail').classList.toggle('hidden', v !== 'detail');
    $('vTips').classList.toggle('hidden', v !== 'tips');
    $('backBtn').classList.toggle('hidden', v === 'list');
    $('tipsBtn').classList.toggle('on', v === 'tips');
    $('notice').style.display = v === 'saved' ? 'none' : '';
    if (v !== 'detail') document.title = INFO.nama + ' – Info Loker Pemuda Desa Merden';
    markNav();
    window.scrollTo(0, 0);
  }
  function markNav() {
    var searching = !$('filterPanel').classList.contains('hidden');
    document.querySelectorAll('.bottom-nav [data-nav]').forEach(function (b) {
      var n = b.getAttribute('data-nav');
      var on = n === 'search' ? searching : !searching && (n === S.view || (n === 'list' && S.view === 'detail'));
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  document.querySelector('.bottom-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-nav]'); if (!b) return;
    var n = b.getAttribute('data-nav');
    if (n !== 'search') { $('filterPanel').classList.add('hidden'); $('searchBtn').setAttribute('aria-expanded', 'false'); }
    if (n === 'list') { if (S.view === 'list') window.scrollTo({ top: 0, behavior: 'smooth' }); else openList(true); }
    else if (n === 'search') toggleSearch();
    else if (n === 'saved') openSaved(true);
    else if (n === 'tips') openTips(true);
  });
  var pushed = 0; // jumlah langkah navigasi di dalam halaman ini (untuk tombol kembali)
  function push(query) { try { history.pushState(null, '', baseUrl() + query); pushed++; } catch (e) { /* abaikan */ } }
  function openDetail(id, record) { S.currentId = id; renderDetail(id); showView('detail'); if (record) push('?id=' + encodeURIComponent(id)); }
  function openList(record) { S.currentId = ''; S.view = 'list'; S.shown = PAGE; renderList(); showView('list'); if (record) push(''); }
  function openSaved(record) { S.currentId = ''; S.view = 'saved'; S.shown = 1e6; renderList(); showView('saved'); if (record) push('?v=saved'); }
  function openTips(record) { showView('tips'); if (record) push('?v=tips'); }
  function route() {
    var p = new URLSearchParams(location.search);
    var id = (p.get('id') || '').slice(0, 20);
    if (id) openDetail(id, false);
    else if (p.get('v') === 'tips') openTips(false);
    else if (p.get('v') === 'saved') openSaved(false);
    else openList(false);
  }
  $('backBtn').addEventListener('click', function () {
    if (pushed > 0) { pushed--; history.back(); } else openList(true);
  });
  $('tipsBtn').addEventListener('click', function () { if (S.view === 'tips') openList(true); else openTips(true); });
  $('brandLink').addEventListener('click', function (e) { e.preventDefault(); openList(true); });
  window.addEventListener('popstate', route);

  /* ---------- Memuat data ---------- */
  function apply(data) {
    if (data.info) {
      INFO.nama = data.info.nama || INFO.nama;
      INFO.waAdmin = String(data.info.waAdmin || '');
      if (Array.isArray(data.info.kabupaten)) INFO.kabupaten = data.info.kabupaten;
      if (Array.isArray(data.info.pendidikan)) INFO.pendidikan = data.info.pendidikan;
      if (typeof data.info.minDilihat === 'number') INFO.minDilihat = data.info.minDilihat;
    }
    S.jobs = Array.isArray(data.jobs) ? data.jobs : [];
    $('nama').textContent = INFO.nama;
    setupFilters();
  }
  function refreshView() {
    if (S.view === 'list' || S.view === 'saved') renderList();
    else if (S.view === 'detail' && S.currentId) renderDetail(S.currentId);
  }
  function load() {
    S.error = '';
    if (!S.jobs.length) refreshView();
    if (window.DEMO_JOBS) { apply({ jobs: window.DEMO_JOBS }); S.loaded = true; refreshView(); return; }
    if (!API) { S.error = 'API_URL belum diisi di config.js'; refreshView(); return; }
    fetch(API + '?api=jobs', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error((data && data.error) || 'Data tidak valid');
        apply(data);
        S.loaded = true;
        store(CACHE_KEY, JSON.stringify({ info: data.info, jobs: data.jobs, t: Date.now() }));
        refreshView();
      })
      .catch(function (err) {
        S.error = String(err && err.message || err);
        if (S.jobs.length) S.loaded = true; // tetap tampilkan data tersimpan terakhir
        refreshView();
      });
  }

  /* ---------- Mulai ---------- */
  setupFilters();
  var cached = cacheRead();
  if (cached) { apply(cached); S.loaded = true; }
  route();
  load();
})();
