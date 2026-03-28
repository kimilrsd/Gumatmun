# Silsilah Keluarga - Walkthrough

## Apa yang Dibuat

Website silsilah keluarga interaktif dengan PHP + SQLite backend dan vanilla HTML/CSS/JS frontend. Tema gelap modern dengan glassomorphism, animasi halus, dan fully responsive.

## Demo

![Demo Recording](C:/Users/Kimil/.gemini/antigravity/brain/aaed4cba-8335-4570-85de-43a3f4e644a9/demo_recording.webp)

## File yang Dibuat

| File | Deskripsi |
|------|-----------|
| [db.php](file:///d:/source%20%20code/silsilah/db.php) | Database SQLite, auto-create tables, seed 13 sample members |
| [api.php](file:///d:/source%20%20code/silsilah/api.php) | REST API: auth, CRUD, tree, stats, search, photo upload |
| [index.html](file:///d:/source%20%20code/silsilah/index.html) | SPA shell dengan semua halaman, modal, dan form |
| [css/style.css](file:///d:/source%20%20code/silsilah/css/style.css) | Design system: dark theme, glassmorphism, responsive |
| [js/app.js](file:///d:/source%20%20code/silsilah/js/app.js) | Router, API calls, members, stats, search, toasts |
| [js/tree.js](file:///d:/source%20%20code/silsilah/js/tree.js) | SVG tree visualization: zoom, pan, pinch, export |
| [js/admin.js](file:///d:/source%20%20code/silsilah/js/admin.js) | Admin CRUD, photo upload, relationship management |

## Fitur Lengkap

1. **🏠 Beranda** - Hero section + statistik keluarga (total anggota, generasi, dll)
2. **🌳 Pohon Keluarga Interaktif** - SVG tree dengan zoom/pan/pinch, warna gender, export PNG
3. **👥 Daftar Anggota** - Grid cards dengan foto, filter generasi/gender, search real-time
4. **👤 Detail Anggota** - Modal dengan info lengkap, hubungan keluarga (ayah/ibu/pasangan/anak/saudara)
5. **📊 Statistik** - Chart distribusi generasi & profesi, ringkasan data
6. **🔐 Admin Dashboard** - Login (admin/admin123), tabel manajemen, CRUD lengkap
7. **📸 Upload Foto** - Upload foto anggota (JPG/PNG/GIF/WebP, max 5MB)
8. **🔍 Pencarian** - Cari berdasarkan nama, panggilan, profesi, tempat lahir
9. **📱 Responsive** - Mobile, tablet, desktop optimized
10. **🖨️ Export/Cetak** - Download pohon keluarga sebagai gambar PNG

## Hasil Testing

| Test | Status |
|------|--------|
| Home Page + Stats | ✅ Passed |
| Members List + Filter | ✅ Passed |
| Family Tree SVG | ✅ Passed |
| Member Detail Modal | ✅ Passed |
| Statistics + Charts | ✅ Passed |
| Admin Login + CRUD | ✅ Passed |

## Cara Menjalankan

```powershell
C:\xampp\php\php.exe -S localhost:8080
```

Buka `http://localhost:8080` di browser. Login admin: **admin** / **admin123**

> [!NOTE]
> SQLite3 extension sudah di-enable di [C:\xampp\php\php.ini](file:///C:/xampp/php/php.ini). Database otomatis dibuat di folder [database/silsilah.db](file:///d:/source%20%20code/silsilah/database/silsilah.db) saat pertama kali diakses.
