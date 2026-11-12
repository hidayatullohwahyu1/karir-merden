/* KARIR MERDEN — halaman admin di HP (posting bebas: foto + caption, tanpa AI).
   Masuk dengan kata sandi admin → token disimpan di HP ini (30 hari).
   Semua permintaan: POST ke API_URL dengan badan teks JSON (tanpa preflight CORS). */
(function () {
  'use strict';
  var API = (window.KM_CONFIG && window.KM_CONFIG.API_URL) || '';
  var TOKEN_KEY = 'km_admin_token', KAB_KEY = 'km_admin_kab';
  var KABUPATEN = ['Banjarnegara', 'Purbalingga', 'Banyumas', 'Wonosobo', 'Kebumen', 'Lainnya'];
  var MAX_SIDE = 1600, QUALITY = 0.85;
  var token = '', drafts = [], busy = false, uid = 0;
  var LOGO = document.querySelector('.logo') ? document.querySelector('.logo').getAttribute('src') : 'icons/icon-192.png';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
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
    try { var o = JSON.parse(store(TOKEN_KEY) || 'null'); if (o && o.token && o.exp > Date.now()) return o.token; } catch (e) { /* abaikan */ }
    return '';
  }
  function showApp(on) {
    $('vLogin').classList.toggle('hidden', on);
    $('vApp').classList.toggle('hidden', !on);
    $('logoutBtn').classList.toggle('hidden', !on);
    $('postbar').classList.toggle('hidden', !on || !drafts.length);
    if (on) loadRecent();
  }
  function logout() { token = ''; store(TOKEN_KEY, null); showApp(false); }
  $('logoutBtn').addEventListener('click', function () {
    if (busy && !confirm('Masih memposting. Tetap keluar?')) return;
    logout();
  });
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('loginErr').classList.add('hidden');
    $('loginBtn').disabled = true; $('loginBtn').textContent = 'Memeriksa…';
    call({ api: 'login', password: $('pw').value })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || 'Gagal masuk.');
        token = d.token; store(TOKEN_KEY, JSON.stringify({ token: d.token, exp: d.exp }));
        $('pw').value = ''; showApp(true);
      })
      .catch(function (err) { $('loginErr').textContent = err.message; $('loginErr').classList.remove('hidden'); })
      .then(function () { $('loginBtn').disabled = false; $('loginBtn').textContent = 'Masuk'; });
  });

  /* ---------- Draf postingan ---------- */
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
  function newDraft(extra) {
    var d = { key: ++uid, caption: '', kab: store(KAB_KEY) || '', state: 'edit', msg: '', data: '', thumb: '' };
    for (var k in extra) d[k] = extra[k];
    drafts.push(d);
    return d;
  }
  function addFiles(list) {
    var files = Array.prototype.filter.call(list || [], function (f) { return /^image\//.test(f.type); });
    files.forEach(function (f) {
      var d = newDraft({ thumb: URL.createObjectURL(f), loading: true });
      shrink(f).then(function (u) { d.data = u; d.loading = false; }, function (err) { d.state = 'err'; d.msg = err.message; d.loading = false; }).then(render);
    });
    render();
    if (files.length) setTimeout(function () { var t = document.querySelector('.draft textarea'); if (t) t.focus({ preventScroll: true }); }, 50);
  }
  $('photoBtn').addEventListener('click', function () { $('files').click(); });
  $('writeBtn').addEventListener('click', function () { $('files').click(); });
  $('files').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
  $('textBtn').addEventListener('click', function () {
    newDraft({}); render();
    var all = document.querySelectorAll('.draft textarea'); if (all.length) all[all.length - 1].focus();
  });

  function kabOptions(sel) {
    return '<option value="">Semua daerah</option>' + KABUPATEN.map(function (k) {
      return '<option' + (k === sel ? ' selected' : '') + '>' + esc(k) + '</option>';
    }).join('');
  }
  function render() {
    // pertahankan kursor bila admin sedang mengetik caption saat foto lain selesai diproses
    var ae = document.activeElement, fk = ae && ae.getAttribute && ae.getAttribute('data-cap');
    var s0 = fk ? ae.selectionStart : 0, s1 = fk ? ae.selectionEnd : 0;
    renderInner();
    if (fk) { var t = document.querySelector('[data-cap="' + fk + '"]'); if (t) { t.focus({ preventScroll: true }); try { t.setSelectionRange(s0, s1); } catch (e) { /* abaikan */ } } }
  }
  function renderInner() {
    $('drafts').innerHTML = drafts.map(function (d) {
      var done = d.state === 'ok';
      var st = d.state === 'ok' ? '<div class="st ok">✓ ' + esc(d.msg) + '</div>'
        : d.state === 'err' ? '<div class="st err">' + esc(d.msg) + '</div>'
        : d.state === 'run' ? '<div class="st run">Memposting…</div>' : '';
      return '<article class="card draft' + (done ? ' done' : '') + '" data-k="' + d.key + '">' +
        '<div class="draft-h"><img src="' + LOGO + '" alt="" width="40" height="40"><div><b>Karir Merden</b>' +
          '<select data-kab="' + d.key + '" aria-label="Daerah">' + kabOptions(d.kab) + '</select></div></div>' +
        '<textarea data-cap="' + d.key + '" placeholder="Tulis caption: posisi, syarat, cara melamar… (boleh kosong)" aria-label="Caption">' + esc(d.caption) + '</textarea>' +
        (d.thumb ? '<div class="pic"><img src="' + esc(d.thumb) + '" alt="Foto flyer"></div>' : '') + st +
        (d.state === 'edit' || d.state === 'err' ? '<button type="button" class="rm" data-rm="' + d.key + '" aria-label="Hapus draf">×</button>' : '') +
        '</article>';
    }).join('');
    document.querySelectorAll('.draft textarea').forEach(grow);
    updateBar();
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(64, t.scrollHeight) + 'px'; }
  function find(key) { for (var i = 0; i < drafts.length; i++) if (drafts[i].key === key) return drafts[i]; return null; }
  function pending() { return drafts.filter(function (d) { return d.state === 'edit' || d.state === 'err'; }); }
  function updateBar() {
    var n = pending().length;
    $('postbar').classList.toggle('hidden', !drafts.length || !token);
    $('goBtn').disabled = busy || !n;
    $('goBtn').textContent = busy ? 'Memposting…' : n > 1 ? 'Posting ' + n : 'Posting';
    var done = drafts.filter(function (d) { return d.state === 'ok'; }).length;
    $('postInfo').textContent = busy ? done + ' dari ' + (done + n) + ' selesai' : n ? n + ' postingan siap' : done ? 'Semua sudah tayang' : '';
  }
  $('drafts').addEventListener('input', function (e) {
    var k = Number(e.target.getAttribute('data-cap'));
    if (k) { find(k).caption = e.target.value; grow(e.target); }
  });
  $('drafts').addEventListener('change', function (e) {
    var k = Number(e.target.getAttribute('data-kab'));
    if (k) { find(k).kab = e.target.value; store(KAB_KEY, e.target.value); }
  });
  $('drafts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (!b || busy) return;
    var k = Number(b.getAttribute('data-rm'));
    drafts = drafts.filter(function (d) { if (d.key === k && d.thumb) URL.revokeObjectURL(d.thumb); return d.key !== k; });
    render();
  });

  /* ---------- Posting satu per satu ---------- */
  window.addEventListener('beforeunload', function (e) {
    if (busy || pending().some(function (d) { return d.caption || d.thumb; })) { e.preventDefault(); e.returnValue = ''; }
  });
  $('goBtn').addEventListener('click', function () {
    var todo = pending().filter(function (d) { return d.thumb || d.caption.trim(); });
    if (!todo.length) { toast('Pilih foto atau tulis caption dulu.'); return; }
    if (busy) return;
    busy = true; $('bar').classList.remove('hidden'); updateBar();
    var i = 0;
    var waitImg = function (d) { return new Promise(function (res) { (function chk() { if (!d.loading) res(); else setTimeout(chk, 120); })(); }); };
    var next = function () {
      if (i >= todo.length || !token) return finish();
      var d = todo[i++];
      return waitImg(d).then(function () {
        if (d.thumb && !d.data) throw new Error(d.msg || 'Foto tidak bisa dibaca');
        d.state = 'run'; render();
        return call({ api: 'post', token: token, imageData: d.data ? d.data.split(',')[1] : '', mimeType: 'image/jpeg', caption: d.caption, kabupaten: d.kab });
      }).then(function (r) {
        if (!r.ok) throw new Error(r.error || 'Gagal memposting');
        d.state = 'ok'; d.id = r.id; d.msg = 'Tayang di web (' + r.id + ')' + (r.warn ? ' – ' + r.warn : '');
      }).catch(function (err) { d.state = 'err'; d.msg = err.message + ' — tekan Posting untuk mencoba lagi'; })
        .then(function () { $('bar').firstElementChild.style.width = Math.round(i / todo.length * 100) + '%'; render(); return next(); });
    };
    var finish = function () {
      busy = false;
      setTimeout(function () { $('bar').classList.add('hidden'); $('bar').firstElementChild.style.width = '0'; }, 600);
      var ok = todo.filter(function (d) { return d.state === 'ok'; }).length;
      toast(ok === todo.length ? ok + ' postingan tayang di web.' : ok + ' tayang, ' + (todo.length - ok) + ' gagal.');
      // draf yang sudah tayang dibersihkan setelah sebentar, yang gagal tetap untuk dicoba lagi
      setTimeout(function () {
        drafts = drafts.filter(function (d) { if (d.state === 'ok' && d.thumb) URL.revokeObjectURL(d.thumb); return d.state !== 'ok'; });
        render();
      }, 2500);
      render(); loadRecent();
    };
    next();
  });

  /* ---------- Postingan terbaru ---------- */
  function loadRecent() {
    $('recent').innerHTML = '<p class="muted">Memuat…</p>';
    call({ api: 'recent', token: token })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || 'Gagal memuat');
        if (!d.items.length) { $('recent').innerHTML = '<p class="muted">Belum ada postingan.</p>'; return; }
        $('recent').innerHTML = d.items.map(function (x) {
          var acts = [];
          if (x.status === 'Aktif' && x.id) {
            acts.push('<a class="btn-sm ghost" href="./?id=' + encodeURIComponent(x.id) + '">Lihat</a>');
            acts.push('<button type="button" class="btn-sm ghost" data-arc="' + esc(x.id) + '">Turunkan</button>');
          }
          if (x.status === 'Draf' && x.id) acts.push('<button type="button" class="btn-sm" data-pub="' + esc(x.id) + '">Terbitkan</button>');
          return '<div class="row">' + (x.foto ? '<img class="th" src="' + esc(x.foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<span class="th"></span>') +
            '<div class="tx"><b>' + esc(x.judul || '(tanpa judul)') + '</b><small>' + esc([x.perusahaan, x.kabupaten, x.id].filter(Boolean).join(' · ')) + '</small>' +
            '<span class="tag ' + esc(x.status) + '">' + esc(x.status === 'Aktif' ? 'Tayang' : x.status || '–') + '</span>' +
            (x.catatan && x.status === 'Draf' ? '<small>' + esc(x.catatan) + '</small>' : '') +
            '<div class="acts">' + acts.join('') + '</div></div></div>';
        }).join('');
      })
      .catch(function (err) { $('recent').innerHTML = '<p class="err">' + esc(err.message) + '</p>'; });
  }
  $('refreshBtn').addEventListener('click', loadRecent);
  $('recent').addEventListener('click', function (e) {
    var a = e.target.closest('[data-arc]');
    if (a) {
      var id = a.getAttribute('data-arc');
      if (!confirm('Turunkan ' + id + ' dari web? Baris tetap tersimpan di sheet sebagai Arsip.')) return;
      a.disabled = true; a.textContent = 'Menurunkan…';
      call({ api: 'archive', token: token, id: id })
        .then(function (d) { if (!d.ok) throw new Error(d.error); toast(id + ' diturunkan dari web.'); loadRecent(); })
        .catch(function (err) { alert(err.message); a.disabled = false; a.textContent = 'Turunkan'; });
      return;
    }
    var b = e.target.closest('[data-pub]'); if (b) publish(b.getAttribute('data-pub'), false, b);
  });
  function publish(id, confirmed, btn) {
    btn.disabled = true; btn.textContent = 'Menerbitkan…';
    call({ api: 'publish', token: token, id: id, confirm: confirmed })
      .then(function (d) {
        if (d.ok) { toast(id + ' tayang di web.'); loadRecent(); return; }
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
