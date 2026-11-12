/* KARIR MERDEN — frontend statis (GitHub Pages).
   Data diambil dari Google Apps Script: API_URL?api=jobs
   Klik dicatat lewat: API_URL?api=klik&id=...&aksi=Lihat|Lamar */
(function () {
  'use strict';

  var API = (window.KM_CONFIG && window.KM_CONFIG.API_URL) || '';
  var CACHE_KEY = 'km_jobs_v1';
  var S = { jobs: [], loaded: false, error: '', currentId: '' };
  var INFO = {
    nama: 'KARIR MERDEN', waAdmin: '', minDilihat: 5,
    kabupaten: ['Banjarnegara', 'Purbalingga', 'Banyumas', 'Wonosobo', 'Kebumen', 'Lainnya'],
    pendidikan: ['Tidak disyaratkan', 'SD', 'SMP', 'SMA/SMK', 'D3', 'S1']
  };
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

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
  function todayIso() {
    var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function daysFromToday(iso) { return Math.round((Date.parse(iso) - Date.parse(todayIso())) / 864e5); }
  function eduText(p) { return (!p || p === 'Tidak disyaratkan') ? 'Semua lulusan boleh' : 'Lulusan ' + p + ' boleh'; }
  function isSafeUrl(u) { return /^https?:\/\//i.test(String(u || '').trim()); }

  function lamarLink(j) {
    var v = String(j.caraLamar || '').trim();
    if (/^wa\.me\//i.test(v)) v = 'https://' + v;
    if (isSafeUrl(v)) return { href: v, label: 'Lamar di situs perekrut' };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return { href: 'mailto:' + v + '?subject=' + encodeURIComponent('Lamaran ' + j.judul), label: 'Lamar lewat email' };
    }
    var digits = v.replace(/[^\d+]/g, '');
    if (/^(\+?62|0)8\d{7,12}$/.test(digits)) {
      var n = digits.replace(/^\+/, '').replace(/^0/, '62');
      var msg = 'Halo, saya ingin bertanya tentang lowongan ' + j.judul + ' di ' + j.perusahaan + ' (info dari KARIR MERDEN).';
      return { href: 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg), label: 'Lamar lewat WhatsApp' };
    }
    return null;
  }
  function baseUrl() { return location.origin + location.pathname; }
  function jobUrl(id) { return baseUrl() + '?id=' + encodeURIComponent(id); }

  /* ---------- Penyimpanan lokal (opsional: tampil cepat saat sinyal lemah) ---------- */
  function cacheRead() {
    try { var o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return o && Array.isArray(o.jobs) ? o : null; }
    catch (e) { return null; }
  }
  function cacheWrite(o) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(o)); } catch (e) { /* abaikan */ } }

  /* ---------- Pencatat klik ----------
     Satu pengunjung dihitung sekali per aksi per lowongan selama halaman terbuka. */
  var sudahDicatat = {};
  function catat(id, aksi) {
    var k = id + '|' + aksi;
    if (!API || !id || sudahDicatat[k]) return false;
    sudahDicatat[k] = true;
    var url = API + '?api=klik&id=' + encodeURIComponent(id) + '&aksi=' + encodeURIComponent(aksi);
    try {
      fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true, credentials: 'omit' })
        .catch(function () { delete sudahDicatat[k]; });
    } catch (e) { delete sudahDicatat[k]; }
    return true;
  }

  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function viewsHtml(j) {
    var n = Number(j.dilihat) || 0;
    if (n < Math.max(1, INFO.minDilihat)) return '';
    return '<span class="views">' + EYE + 'Dilihat ' + n.toLocaleString('id-ID') + ' kali</span>';
  }

  /* ---------- Filter ---------- */
  function setupFilters() {
    var kab = $('fKab'), edu = $('fEdu'), kv = kab.value, ev = edu.value;
    kab.innerHTML = '<option value="">Semua daerah</option>' +
      INFO.kabupaten.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
    edu.innerHTML = '<option value="">Semua lulusan</option>' +
      INFO.pendidikan.filter(function (e) { return e !== 'Tidak disyaratkan'; })
        .map(function (e) { return '<option value="' + esc(e) + '">' + esc(e) + '</option>'; }).join('');
    kab.value = kv; edu.value = ev;
  }
  ['q', 'fKab', 'fEdu', 'fTanpa'].forEach(function (id) {
    $(id).addEventListener(id === 'q' ? 'input' : 'change', renderList);
  });

  function filtered() {
    var q = $('q').value.trim().toLowerCase();
    var kab = $('fKab').value, edu = $('fEdu').value, tanpa = $('fTanpa').checked;
    var EDU = INFO.pendidikan, today = todayIso();
    return S.jobs.filter(function (j) {
      if (j.batas && j.batas < today) return false;
      if (q && (j.judul + ' ' + j.perusahaan + ' ' + j.kategori + ' ' + j.alamat).toLowerCase().indexOf(q) < 0) return false;
      if (kab && j.kabupaten !== kab) return false;
      if (edu && Math.max(0, EDU.indexOf(j.pendidikan)) > EDU.indexOf(edu)) return false;
      if (tanpa && !j.tanpaPengalaman) return false;
      return true;
    });
  }

  /* ---------- Daftar ---------- */
  function badges(j) {
    var b = [];
    if (j.dicek && daysFromToday(j.dicek) >= -3) b.push('<span class="badge baru">Baru</span>');
    if (j.tanpaPengalaman) b.push('<span class="badge">Tanpa pengalaman</span>');
    if (j.batas) {
      var d = daysFromToday(j.batas);
      if (d >= 0 && d <= 5) b.push('<span class="badge tutup">Segera ditutup</span>');
    }
    return b.length ? '<div class="badges">' + b.join('') + '</div>' : '';
  }

  function renderList() {
    var box = $('list');
    if (!S.loaded) {
      box.innerHTML = S.error
        ? '<div class="error">Gagal memuat lowongan. Periksa sinyal, lalu coba lagi.<br><button type="button" id="retryBtn">Coba lagi</button></div>'
        : '<div class="loading">Memuat lowongan…</div>';
      $('count').textContent = '';
      var rb = $('retryBtn');
      if (rb) rb.addEventListener('click', load);
      return;
    }
    var items = filtered();
    $('count').textContent = items.length ? (items.length + ' lowongan ditemukan') : '';
    if (!items.length) {
      box.innerHTML = '<div class="empty">Belum ada loker untuk pilihan ini.<br>Coba hapus filter, atau cek lagi Senin depan.</div>';
      return;
    }
    box.innerHTML = items.map(function (j) {
      return '<button type="button" class="card" data-id="' + esc(j.id) + '">' +
        '<h2>' + esc(j.judul) + '</h2>' +
        '<div class="co">' + esc(j.perusahaan) + '</div>' +
        '<div class="meta">' + esc(j.kabupaten) + ' · ' + esc(eduText(j.pendidikan)) + '</div>' +
        (j.gaji ? '<div class="gaji">' + esc(j.gaji) + '</div>' : '<div class="gaji none">Gaji tidak dicantumkan</div>') +
        badges(j) + '<div class="more"><span>Lihat detail ›</span>' + viewsHtml(j) + '</div></button>';
    }).join('');
  }

  $('list').addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (card) openDetail(card.getAttribute('data-id'), true);
  });

  /* ---------- Detail ---------- */
  function renderDetail(id) {
    var j = null;
    for (var i = 0; i < S.jobs.length; i++) if (S.jobs[i].id === id) { j = S.jobs[i]; break; }
    var box = $('detail');
    if (!S.loaded && !j) {
      box.innerHTML = S.error
        ? '<div class="error">Gagal memuat lowongan. Periksa sinyal, lalu muat ulang halaman.</div>'
        : '<div class="loading">Memuat lowongan…</div>';
      return;
    }
    if (!j || (j.batas && j.batas < todayIso())) {
      box.innerHTML = '<div class="empty">Lowongan ini sudah ditutup atau tidak tersedia lagi.<br>Lihat loker lain di daftar.</div>';
      document.title = INFO.nama + ' – Info Loker Pemuda Desa Merden';
      return;
    }
    document.title = j.judul + ' – ' + j.perusahaan + ' | ' + INFO.nama;
    if (S.loaded && catat(j.id, 'Lihat')) j.dilihat = (Number(j.dilihat) || 0) + 1;
    var lamar = lamarLink(j);
    var link = jobUrl(j.id);
    var shareText = 'Loker: ' + j.judul + ' – ' + j.perusahaan + ' (' + j.kabupaten + ')' +
      (j.gaji ? '\nGaji: ' + j.gaji : '') + '\nDetail: ' + link + '\n\nInfo dari KARIR MERDEN, Pemdes Merden.';
    var reportHref = INFO.waAdmin
      ? 'https://wa.me/' + INFO.waAdmin + '?text=' + encodeURIComponent('Laporan lowongan ' + j.id + ' (' + j.judul + ' – ' + j.perusahaan + '): ')
      : '';
    var sumber = isSafeUrl(j.urlSumber)
      ? '<a href="' + esc(j.urlSumber) + '" target="_blank" rel="noopener">Buka iklan asli</a>'
      : esc(j.urlSumber);

    box.innerHTML =
      '<div class="detail">' +
        '<h2>' + esc(j.judul) + '</h2>' +
        '<div class="co">' + esc(j.perusahaan) + '</div>' +
        badges(j) +
        (viewsHtml(j) ? '<div>' + viewsHtml(j) + '</div>' : '') +
        '<dl>' +
          '<dt>Lokasi</dt><dd>' + esc(j.kabupaten) + (j.alamat ? ' · ' + esc(j.alamat) : '') + '</dd>' +
          '<dt>Lulusan</dt><dd>' + esc(eduText(j.pendidikan)) + '</dd>' +
          '<dt>Pengalaman</dt><dd>' + (j.tanpaPengalaman ? 'Tanpa pengalaman boleh' : 'Lihat syarat') + '</dd>' +
          '<dt>Gaji</dt><dd>' + (j.gaji ? esc(j.gaji) : 'Tidak dicantumkan') + '</dd>' +
          (j.kategori ? '<dt>Bidang</dt><dd>' + esc(j.kategori) + '</dd>' : '') +
          '<dt>Ditutup</dt><dd>' + (j.batas ? tgl(j.batas) : 'Tidak disebutkan') + '</dd>' +
        '</dl>' +
        (j.ringkasan ? '<div class="sec"><h3>Tugas dan syarat</h3><div class="ringkas">' + esc(j.ringkasan) + '</div></div>' : '') +
        '<div class="sumber"><b>' + esc(j.label || 'Sumber') + '</b><br>' +
          'Dicek admin desa: ' + (j.dicek ? tgl(j.dicek) : '-') + '<br>Sumber: ' + sumber + '</div>' +
        '<div class="actions">' +
          (lamar
            ? '<a class="btn lamar" id="lamarBtn" href="' + esc(lamar.href) + '" target="_blank" rel="noopener">' + esc(lamar.label) + '</a>'
            : '<div class="sumber"><b>Cara melamar</b><br>' + esc(j.caraLamar || 'Lihat iklan asli') + '</div>') +
          '<a class="btn share" href="https://wa.me/?text=' + encodeURIComponent(shareText) + '" target="_blank" rel="noopener">Bagikan ke WhatsApp</a>' +
          (reportHref ? '<a class="btn lapor" href="' + esc(reportHref) + '" target="_blank" rel="noopener">Laporkan lowongan ini</a>' : '') +
        '</div>' +
        '<p class="note">Info ini disebarkan Pemerintah Desa Merden sebagai layanan informasi. Proses seleksi sepenuhnya oleh perusahaan. ' +
        '<strong>Jangan pernah membayar untuk melamar kerja.</strong></p>' +
      '</div>';

    var lb = $('lamarBtn');
    if (lb) lb.addEventListener('click', function () { catat(j.id, 'Lamar'); });
  }

  /* ---------- Navigasi (alamat ?id=LK-0001 dan ?v=tips bisa dibagikan) ---------- */
  function showView(v) {
    $('vList').classList.toggle('hidden', v !== 'list');
    $('vDetail').classList.toggle('hidden', v !== 'detail');
    $('vTips').classList.toggle('hidden', v !== 'tips');
    $('navLoker').classList.toggle('on', v !== 'tips');
    $('navTips').classList.toggle('on', v === 'tips');
    if (v !== 'detail') document.title = INFO.nama + ' – Info Loker Pemuda Desa Merden';
    window.scrollTo(0, 0);
  }
  function push(query) {
    try { history.pushState(null, '', baseUrl() + query); } catch (e) { /* abaikan */ }
  }
  function openDetail(id, record) {
    S.currentId = id;
    renderDetail(id);
    showView('detail');
    if (record) push('?id=' + encodeURIComponent(id));
  }
  function openList(record) {
    S.currentId = '';
    if (S.loaded) renderList();
    showView('list');
    if (record) push('');
  }
  function openTips(record) { showView('tips'); if (record) push('?v=tips'); }

  function route() {
    var p = new URLSearchParams(location.search);
    var id = (p.get('id') || '').slice(0, 20);
    if (id) openDetail(id, false);
    else if (p.get('v') === 'tips') openTips(false);
    else openList(false);
  }

  $('navLoker').addEventListener('click', function () { openList(true); });
  $('navTips').addEventListener('click', function () { openTips(true); });
  $('backBtn').addEventListener('click', function () { openList(true); });
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
    if (!$('vList').classList.contains('hidden')) renderList();
    if (S.currentId && !$('vDetail').classList.contains('hidden')) renderDetail(S.currentId);
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
        cacheWrite({ info: data.info, jobs: data.jobs, t: Date.now() });
        refreshView();
      })
      .catch(function (err) {
        S.error = String(err && err.message || err);
        if (S.jobs.length) { S.loaded = true; } // tetap tampilkan data tersimpan terakhir
        refreshView();
      });
  }

  /* ---------- Mulai ---------- */
  setupFilters();
  var saved = cacheRead();
  if (saved) { apply(saved); S.loaded = true; }
  route();
  load();
})();
