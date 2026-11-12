/* KARIR MERDEN — halaman admin di HP.
   Masuk dengan kata sandi admin → token disimpan di HP ini (30 hari).
   Semua permintaan: POST ke API_URL dengan badan teks JSON (tanpa preflight CORS). */
(function () {
  'use strict';
  var API = (window.KM_CONFIG && window.KM_CONFIG.API_URL) || '';
  var TOKEN_KEY = 'km_admin_token';
  var MAX_SIDE = 1600, QUALITY = 0.85;
  var token = '', queue = [], busy = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var toastT;
  function toast(m) { var t = $('toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 3000); }

  function call(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('Server menjawab ' + r.status); return r.json(); })
      .then(function (d) {
        if (d && d.auth === false) { logout(); throw new Error(d.error || 'Sesi berakhir.'); }
        return d;
      });
  }

  /* ---------- Masuk / keluar ---------- */
  function loadToken() {
    try {
      var o = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (o && o.token && o.exp > Date.now()) return o.token;
    } catch (e) { /* abaikan */ }
    return '';
  }
  function showApp(on) {
    $('vLogin').classList.toggle('hidden', on);
    $('vApp').classList.toggle('hidden', !on);
    $('logoutBtn').classList.toggle('hidden', !on);
    if (on) loadRecent();
  }
  function logout() {
    token = '';
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* abaikan */ }
    showApp(false);
  }
  $('logoutBtn').addEventListener('click', function () {
    if (busy && !confirm('Masih mengunggah. Tetap keluar?')) return;
    logout();
  });

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('pw').value;
    $('loginErr').classList.add('hidden');
    $('loginBtn').disabled = true; $('loginBtn').textContent = 'Memeriksa…';
    call({ api: 'login', password: pw })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || 'Gagal masuk.');
        token = d.token;
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: d.token, exp: d.exp })); } catch (x) { /* abaikan */ }
        $('pw').value = '';
        showApp(true);
      })
      .catch(function (err) { $('loginErr').textContent = err.message; $('loginErr').classList.remove('hidden'); })
      .then(function () { $('loginBtn').disabled = false; $('loginBtn').textContent = 'Masuk'; });
  });

  /* ---------- Pilih & perkecil foto ---------- */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', QUALITY));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibaca')); };
      img.src = url;
    });
  }
  function addFiles(list) {
    Array.prototype.forEach.call(list || [], function (f) {
      if (!/^image\//.test(f.type)) return;
      var it = { name: f.name, state: 'antre', label: 'Siap', url: '', thumb: URL.createObjectURL(f) };
      queue.push(it);
      shrink(f).then(function (u) { it.url = u; }, function (err) { it.state = 'err'; it.label = err.message; }).then(render);
    });
    render();
  }
  $('files').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) { $('pick').addEventListener(t, function (e) { e.preventDefault(); $('pick').classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { $('pick').addEventListener(t, function (e) { e.preventDefault(); $('pick').classList.remove('over'); }); });
  $('pick').addEventListener('drop', function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });

  function render() {
    $('grid').innerHTML = queue.map(function (it, i) {
      var cls = it.state === 'Aktif' ? 'ok' : it.state === 'Draf' ? 'draf' : it.state === 'err' ? 'err' : '';
      return '<div class="tile' + (it.state === 'proses' ? ' busy' : '') + '"><img src="' + esc(it.thumb) + '" alt="">' +
        '<span class="st ' + cls + '">' + esc(it.label) + '</span>' +
        (it.state === 'antre' && !busy ? '<button type="button" class="rm" data-i="' + i + '" aria-label="Hapus foto">×</button>' : '') + '</div>';
    }).join('');
    var n = queue.filter(function (x) { return x.state === 'antre'; }).length;
    $('goBtn').disabled = busy || !n;
    $('goBtn').textContent = busy ? 'Memproses…' : n ? 'Unggah ' + n + ' flyer' : 'Unggah flyer';
  }
  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('.rm'); if (!b || busy) return;
    var it = queue.splice(Number(b.getAttribute('data-i')), 1)[0];
    if (it) URL.revokeObjectURL(it.thumb);
    render();
  });

  /* ---------- Proses satu per satu ---------- */
  window.addEventListener('beforeunload', function (e) { if (busy) { e.preventDefault(); e.returnValue = ''; } });
  $('goBtn').addEventListener('click', function () {
    var todo = queue.filter(function (x) { return x.state === 'antre'; });
    if (!todo.length || busy) return;
    busy = true; $('sum').textContent = ''; $('bar').classList.remove('hidden'); render();
    var done = 0, auto = $('auto').checked;
    var wait = function (it) { // tunggu foto selesai diperkecil
      return new Promise(function (res) { (function chk() { if (it.url || it.state === 'err') res(); else setTimeout(chk, 150); })(); });
    };
    var step = function (i) {
      if (i >= todo.length) return finish();
      var it = todo[i];
      return wait(it).then(function () {
        if (it.state === 'err') return;
        it.state = 'proses'; it.label = 'AI membaca…'; render();
        return call({ api: 'flyer', token: token, imageData: it.url.split(',')[1], mimeType: 'image/jpeg', autoTerbit: auto })
          .then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Gagal');
            it.state = d.status; it.label = d.status === 'Aktif' ? 'Terbit ' + d.id : 'Draf ' + d.id;
          })
          .catch(function (err) { it.state = 'err'; it.label = err.message; });
      }).then(function () {
        done++; $('bar').firstElementChild.style.width = Math.round(done / todo.length * 100) + '%'; render();
        if (token) return step(i + 1);
        finish();
      });
    };
    var finish = function () {
      busy = false; render();
      var a = todo.filter(function (x) { return x.state === 'Aktif'; }).length;
      var d = todo.filter(function (x) { return x.state === 'Draf'; }).length;
      var g = todo.filter(function (x) { return x.state === 'err'; }).length;
      $('sum').textContent = 'Selesai: ' + a + ' terbit, ' + d + ' Draf' + (g ? ', ' + g + ' gagal' : '') + '.';
      loadRecent();
    };
    step(0);
  });

  /* ---------- Terbaru di sheet ---------- */
  function loadRecent() {
    $('recent').innerHTML = '<p class="muted">Memuat…</p>';
    call({ api: 'recent', token: token })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || 'Gagal memuat');
        if (!d.items.length) { $('recent').innerHTML = '<p class="muted">Belum ada lowongan.</p>'; return; }
        $('recent').innerHTML = d.items.map(function (x) {
          var web = x.status === 'Aktif' && x.id ? '<a class="btn-sm ghost" style="display:inline-flex;align-items:center;text-decoration:none" href="./?id=' + encodeURIComponent(x.id) + '">Lihat di web</a>' : '';
          var pub = x.status === 'Draf' && x.id ? '<button type="button" class="btn-sm" data-pub="' + esc(x.id) + '">Terbitkan</button>' : '';
          return '<div class="row">' + (x.foto ? '<img class="th" src="' + esc(x.foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="th"></span>') +
            '<div class="tx"><b>' + esc(x.judul || '(tanpa judul)') + '</b><small>' + esc([x.perusahaan, x.kabupaten, x.id].filter(Boolean).join(' · ')) + '</small>' +
            '<span class="tag ' + esc(x.status) + '">' + esc(x.status || '–') + '</span>' +
            (x.catatan && x.status !== 'Aktif' ? '<small>' + esc(x.catatan) + '</small>' : '') +
            '<div>' + pub + ' ' + web + '</div></div></div>';
        }).join('');
      })
      .catch(function (err) { $('recent').innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }
  $('refreshBtn').addEventListener('click', loadRecent);
  $('recent').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pub]'); if (!b) return;
    publish(b.getAttribute('data-pub'), false, b);
  });
  function publish(id, confirmed, btn) {
    btn.disabled = true; btn.textContent = 'Menerbitkan…';
    call({ api: 'publish', token: token, id: id, confirm: confirmed })
      .then(function (d) {
        if (d.ok) { toast(id + ' terbit di web.'); loadRecent(); return; }
        if (d.needConfirm && confirm('Periksa ' + id + ':\n\n' + d.error + '\n\nTetap terbitkan?')) return publish(id, true, btn);
        if (!d.needConfirm) alert(d.error || 'Gagal menerbitkan.');
        btn.disabled = false; btn.textContent = 'Terbitkan';
      })
      .catch(function (err) { alert(err.message); btn.disabled = false; btn.textContent = 'Terbitkan'; });
  }

  /* ---------- Mulai ---------- */
  token = loadToken();
  showApp(!!token);
})();
