# KARIR MERDEN

Info lowongan kerja untuk pemuda Desa Merden (Kec. Purwanegara, Kab. Banjarnegara) dan sekitarnya.
Layanan gratis Pemerintah Desa Merden.

Situs: https://hidayatullohwahyu1.github.io/karir-merden/

## Cara kerja

- **Frontend (repo ini)**: halaman statis di GitHub Pages: `index.html`, `style.css`, `app.js`.
- **Backend**: Google Apps Script yang menempel di Google Sheets KARIR MERDEN. Admin desa mengelola lowongan di Sheets.
  Halaman ini hanya membaca lowongan berstatus *Aktif* lewat API:
  - `API_URL?api=jobs` mengembalikan daftar lowongan aktif + info (nama, WA admin, daftar kabupaten/pendidikan)
  - `API_URL?api=klik&id=LK-0001&aksi=Lihat|Lamar` mencatat klik ke sheet LogKlik
- `API_URL` diatur di `config.js` (URL web app Apps Script, berakhiran `/exec`).

## Tautan yang bisa dibagikan

- Daftar: `/karir-merden/`
- Detail lowongan: `/karir-merden/?id=LK-0001`
- Tips aman melamar: `/karir-merden/?v=tips`

Lowongan resmi tidak pernah memungut biaya.
