/* Karir Merden — admin di ponsel. Alur: Masuk → Unggah foto lowongan → pilih foto → keterangan → Unggah.
   Semua permintaan: POST ke API_URL (badan teks JSON). Token masuk disimpan di ponsel ini selama 30 hari. */
(function () {
  'use strict';
  var API = (window.KM_CONFIG && window.KM_CONFIG.API_URL) || '';
  var TOKEN_KEY = 'km_admin_token', KAB_KEY = 'km_admin_kab';
  var KAB = ['Banjarnegara', 'Purbalingga', 'Banyumas', 'Wonosobo', 'Kebumen', 'Lainnya'];
  var token = '', drafts = [], busy = false, uid = 0;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  var tt; function toast(m) { var t = $('toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(tt); tt = setTimeout(function () { t.classList.add('hidden'); }, 3000); }
  function call(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('Server tidak merespons dengan benar (kode ' + r.status + ').'); return r.json(); })
      .then(function (d) { if (d && d.auth === false) { logout(); throw new Error(d.error || 'Sesi berakhir.'); } return d; });
  }

  /* ---------- Masuk ---------- */
  function show(on) {
    $('vLogin').classList.toggle('hidden', on); $('vApp').classList.toggle('hidden', !on); $('logout').classList.toggle('hidden', !on);
    bar(); if (on) loadRecent();
  }
  function logout() { token = ''; store(TOKEN_KEY, null); show(false); }
  $('logout').addEventListener('click', function () { if (!busy || confirm('Unggahan masih berjalan. Tetap keluar?')) logout(); });
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); $('loginErr').classList.add('hidden'); $('loginBtn').disabled = true; $('loginBtn').textContent = 'Memeriksa…';
    call({ api: 'login', password: $('pw').value })
      .then(function (d) { if (!d.ok) throw new Error(d.error || 'Gagal masuk.'); token = d.token; store(TOKEN_KEY, JSON.stringify({ token: d.token, exp: d.exp })); $('pw').value = ''; show(true); })
      .catch(function (err) { $('loginErr').textContent = err.message; $('loginErr').classList.remove('hidden'); })
      .then(function () { $('loginBtn').disabled = false; $('loginBtn').textContent = 'Masuk'; });
  });

  /* ---------- Draf ---------- */
  $('kab').innerHTML += KAB.map(function (k) { return '<option>' + k + '</option>'; }).join('');
  $('kab').value = store(KAB_KEY) || '';
  $('kab').addEventListener('change', function () { store(KAB_KEY, this.value); });

  function shrink(file) {
    return new Promise(function (ok, fail) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(u); fail(new Error('Foto tidak dapat dibaca.')); };
      img.src = u;
    });
  }
  function add(extra) { var d = { key: ++uid, caption: '', state: 'edit', msg: '', data: '', thumb: '' }; for (var k in extra) d[k] = extra[k]; drafts.push(d); return d; }
  $('newBtn').addEventListener('click', function () { $('files').click(); });
  $('files').addEventListener('change', function (e) {
    Array.prototype.forEach.call(e.target.files || [], function (f) {
      if (!/^image\//.test(f.type)) return;
      var d = add({ thumb: URL.createObjectURL(f), loading: true });
      shrink(f).then(function (u) { d.data = u; }, function (er) { d.state = 'err'; d.msg = er.message; }).then(function () { d.loading = false; render(); });
    });
    e.target.value = ''; render();
    var t = document.querySelector('.d textarea'); if (t) setTimeout(function () { t.focus({ preventScroll: true }); }, 50);
  });
  $('textBtn').addEventListener('click', function () { add({}); render(); var a = document.querySelectorAll('.d textarea'); a[a.length - 1].focus(); });

  function render() {
    var ae = document.activeElement, fk = ae && ae.getAttribute && ae.getAttribute('data-cap'), s0 = fk ? ae.selectionStart : 0;
    $('drafts').innerHTML = drafts.map(function (d) {
      var edit = d.state === 'edit' || d.state === 'err';
      var st = d.state === 'ok' ? '<div class="st ok">✓ ' + esc(d.msg) + '</div>' : d.state === 'err' ? '<div class="st err">' + esc(d.msg) + '</div>' : d.state === 'run' ? '<div class="st run">Mengunggah…</div>' : '';
      return '<div class="box d">' +
        '<textarea data-cap="' + d.key + '" placeholder="Tulis keterangan… (boleh dikosongkan)"' + (edit ? '' : ' disabled') + '>' + esc(d.caption) + '</textarea>' +
        (d.thumb ? '<img src="' + esc(d.thumb) + '" alt="Foto lowongan">' : '') + st +
        (edit ? '<button type="button" class="x" data-x="' + d.key + '" aria-label="Hapus">×</button>' : '') + '</div>';
    }).join('');
    document.querySelectorAll('.d textarea').forEach(grow);
    if (fk) { var t = document.querySelector('[data-cap="' + fk + '"]'); if (t) { t.focus({ preventScroll: true }); try { t.setSelectionRange(s0, s0); } catch (e) { /* abaikan */ } } }
    bar();
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(60, t.scrollHeight) + 'px'; }
  function find(k) { for (var i = 0; i < drafts.length; i++) if (drafts[i].key === k) return drafts[i]; return null; }
  function waiting() { return drafts.filter(function (d) { return (d.state === 'edit' || d.state === 'err') && (d.thumb || d.caption.trim()); }); }
  function bar() {
    var n = waiting().length;
    $('postbar').classList.toggle('hidden', !token || !drafts.length);
    $('goBtn').disabled = busy || !n;
    $('goBtn').textContent = busy ? 'Mengunggah…' : n > 1 ? 'Unggah ' + n : 'Unggah';
    $('postInfo').textContent = n ? n + ' siap diunggah' : '';
  }
  $('drafts').addEventListener('input', function (e) { var k = Number(e.target.getAttribute('data-cap')); if (k) { find(k).caption = e.target.value; grow(e.target); bar(); } });
  $('drafts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-x]'); if (!b || busy) return;
    var k = Number(b.getAttribute('data-x'));
    drafts = drafts.filter(function (d) { if (d.key === k && d.thumb) URL.revokeObjectURL(d.thumb); return d.key !== k; });
    render();
  });

  /* ---------- Unggah ---------- */
  window.addEventListener('beforeunload', function (e) { if (busy || waiting().length) { e.preventDefault(); e.returnValue = ''; } });
  $('goBtn').addEventListener('click', function () {
    var todo = waiting(); if (!todo.length || busy) return;
    busy = true; bar();
    var kab = $('kab').value, i = 0;
    (function next() {
      if (i >= todo.length || !token) {
        busy = false;
        var ok = todo.filter(function (d) { return d.state === 'ok'; }).length;
        toast(ok === todo.length ? ok + ' unggahan tayang.' : ok + ' tayang, ' + (todo.length - ok) + ' gagal. Silakan coba lagi.');
        render(); loadRecent();
        setTimeout(function () { drafts = drafts.filter(function (d) { if (d.state === 'ok' && d.thumb) URL.revokeObjectURL(d.thumb); return d.state !== 'ok'; }); render(); }, 2000);
        return;
      }
      var d = todo[i++];
      (function wait() { if (d.loading) return setTimeout(wait, 120);
        if (d.thumb && !d.data) { d.state = 'err'; render(); return next(); }
        d.state = 'run'; render();
        call({ api: 'post', token: token, imageData: d.data ? d.data.split(',')[1] : '', mimeType: 'image/jpeg', caption: d.caption, kabupaten: kab })
          .then(function (r) { if (!r.ok) throw new Error(r.error || 'Gagal'); d.state = 'ok'; d.msg = 'Tayang (' + r.id + ')' + (r.warn ? ' – ' + r.warn : ''); })
          .catch(function (er) { d.state = 'err'; d.msg = er.message; })
          .then(function () { render(); next(); });
      })();
    })();
  });

  /* ---------- Sedang tayang ---------- */
  function loadRecent() {
    call({ api: 'recent', token: token }).then(function (d) {
      if (!d.ok) throw new Error(d.error || 'Gagal memuat');
      var aktif = d.items.filter(function (x) { return x.status === 'Aktif' && x.id; });
      $('recent').innerHTML = aktif.length ? aktif.map(function (x) {
        return '<div class="row">' + (x.foto ? '<img class="th" src="' + esc(x.foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="th"></span>') +
          '<a class="tx" href="./?id=' + encodeURIComponent(x.id) + '" style="text-decoration:none;color:inherit"><b>' + esc(x.judul || '(tanpa keterangan)') + '</b>' +
          '<small>' + esc([x.kabupaten, x.id].filter(Boolean).join(' · ')) + '</small></a>' +
          '<button type="button" class="ghost" data-arc="' + esc(x.id) + '">Turunkan</button></div>';
      }).join('') : '<p class="muted">Belum ada unggahan yang tayang.</p>';
    }).catch(function (er) { $('recent').innerHTML = '<p class="err">' + esc(er.message) + '</p>'; });
  }
  $('recent').addEventListener('click', function (e) {
    var b = e.target.closest('[data-arc]'); if (!b) return;
    var id = b.getAttribute('data-arc');
    if (!confirm('Turunkan ' + id + ' dari situs?')) return;
    b.disabled = true; b.textContent = '…';
    call({ api: 'archive', token: token, id: id })
      .then(function (d) { if (!d.ok) throw new Error(d.error); toast(id + ' diturunkan.'); loadRecent(); })
      .catch(function (er) { alert(er.message); b.disabled = false; b.textContent = 'Turunkan'; });
  });

  /* ---------- Mulai ---------- */
  try { var o = JSON.parse(store(TOKEN_KEY) || 'null'); if (o && o.token && o.exp > Date.now()) token = o.token; } catch (e) { /* abaikan */ }
  show(!!token);
})();
