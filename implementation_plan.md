# Family Tree Website (Silsilah Keluarga)

Membangun website silsilah keluarga yang interaktif, responsif, dan user-friendly dengan fitur lengkap. Menggunakan PHP backend dengan SQLite database (tanpa perlu konfigurasi MySQL) dan vanilla HTML/CSS/JavaScript di frontend.

## Tech Stack

- **Backend**: PHP 8+ with SQLite (file-based DB, no setup needed)
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Tree Visualization**: Custom D3.js-style SVG rendering for interactive family tree
- **Icons**: Font Awesome CDN
- **Fonts**: Google Fonts (Inter, Outfit)

## Fitur Lengkap

1. **Interactive Family Tree Visualization** - Pohon keluarga interaktif dengan zoom, pan, dan klik untuk detail
2. **Member Management (CRUD)** - Tambah, edit, hapus anggota keluarga
3. **Relationship Management** - Hubungkan anggota (Ayah, Ibu, Pasangan)
4. **Member Profile** - Detail profil lengkap: foto, bio, tanggal lahir/wafat, alamat, dll
5. **Photo Upload** - Upload dan kelola foto anggota keluarga
6. **Search & Filter** - Cari anggota berdasarkan nama, generasi, status
7. **Statistics Dashboard** - Statistik keluarga (jumlah anggota, generasi, dll)
8. **Export/Print** - Cetak/export pohon keluarga ke PDF/gambar
9. **Admin Authentication** - Login admin untuk kelola data
10. **Responsive Design** - Mobile-friendly, tablet-friendly, desktop

---

## Proposed Changes

### Database Layer

#### [NEW] [db.php](file:///d:/source%20%20code/silsilah/db.php)
- SQLite database initialization & connection
- Auto-create tables on first run:
  - `users` (id, username, password_hash, role, created_at)
  - `members` (id, name, nickname, gender, birth_date, birth_place, death_date, death_place, photo, bio, phone, address, occupation, generation, created_at, updated_at)
  - `relationships` (id, member_id, related_member_id, relationship_type)
- Seed default admin account (admin/admin123)

---

### Backend API

#### [NEW] [api.php](file:///d:/source%20%20code/silsilah/api.php)
- RESTful API router handling all CRUD operations
- Endpoints:
  - `GET /api.php?action=get_members` - List all members
  - `GET /api.php?action=get_member&id=X` - Get single member
  - `POST /api.php?action=add_member` - Add member
  - `POST /api.php?action=update_member` - Update member
  - `POST /api.php?action=delete_member` - Delete member
  - `GET /api.php?action=get_tree` - Get tree structure for visualization
  - `GET /api.php?action=get_stats` - Get family statistics
  - `POST /api.php?action=login` - Admin login
  - `POST /api.php?action=logout` - Logout
  - `GET /api.php?action=search&q=X` - Search members
  - `POST /api.php?action=upload_photo` - Upload member photo

---

### Frontend - Core Assets

#### [NEW] [index.html](file:///d:/source%20%20code/silsilah/index.html)
- Main single-page application shell
- Navigation bar with logo and menu
- Multiple sections/views managed by JS router:
  - Home (hero + tree overview)
  - Family Tree (interactive visualization)
  - Members list (grid/list view)
  - Member detail modal
  - Admin dashboard
  - Statistics page

#### [NEW] [css/style.css](file:///d:/source%20%20code/silsilah/css/style.css)
- Complete design system with CSS custom properties
- Dark/light theme support
- Glassmorphism effects, gradients, animations
- Responsive breakpoints (mobile, tablet, desktop)
- Tree visualization styles
- Card components, modals, forms
- Print stylesheet

#### [NEW] [js/app.js](file:///d:/source%20%20code/silsilah/js/app.js)
- Main application logic & SPA router
- API communication layer
- State management
- Event handling

#### [NEW] [js/tree.js](file:///d:/source%20%20code/silsilah/js/tree.js)
- Interactive family tree rendering using SVG
- Zoom, pan, and click interactions
- Node rendering with photos and names
- Connector lines between family members
- Auto-layout algorithm for tree positioning
- Export tree as PNG/SVG

#### [NEW] [js/admin.js](file:///d:/source%20%20code/silsilah/js/admin.js)
- Admin dashboard functionality
- Member CRUD forms
- Photo upload handling
- Relationship management UI

---

### Supporting Files

#### [NEW] [uploads/](file:///d:/source%20%20code/silsilah/uploads/)
- Directory for uploaded member photos

#### [NEW] [.htaccess](file:///d:/source%20%20code/silsilah/.htaccess)
- URL rewriting rules (optional, for clean URLs)

---

## Verification Plan

### Browser Testing
1. Start PHP built-in server: `php -S localhost:8080` from project directory
2. Open `http://localhost:8080` in browser
3. Verify:
   - Landing page loads with hero section and family tree overview
   - Family tree visualization renders correctly with sample data
   - Zoom/pan works on tree
   - Click on member node shows member detail
   - Admin login works (admin/admin123)
   - Admin dashboard shows member management
   - Add/edit/delete member works
   - Photo upload works
   - Search works
   - Statistics display correctly
   - Responsive layout works when resizing browser
   - Export/print functionality works

### Manual Verification
- User should test on mobile device or browser dev tools mobile view
- User should verify photo upload with actual images
- User should test with real family data
