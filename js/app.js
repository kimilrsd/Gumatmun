/**
 * Silsilah Keluarga - Main Application Logic
 * Handles routing, API calls, members display, stats, and search
 */

// ==================== GLOBAL STATE ====================
const API_URL = 'api.php';
let allMembers = [];
let allFamilies = [];
let currentFamilyId = ''; // '' means all families
let isAuthenticated = false;
let searchTimeout = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('footerYear').textContent = new Date().getFullYear();
    checkAuth();
    loadFamilies().then(() => {
        loadHomeStats();
    });
    initNavScroll();
    
    // Handle initial hash
    const hash = window.location.hash.replace('#', '') || 'home';
    navigate(hash, false);
});

// ==================== NAVIGATION / SPA ROUTER ====================
function navigate(page, pushState = true) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.classList.remove('active'));
    
    const target = document.getElementById('section-' + page);
    if (target) {
        target.classList.add('active');
    } else {
        document.getElementById('section-home').classList.add('active');
        page = 'home';
    }
    
    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === page);
    });
    
    if (pushState) {
        window.location.hash = page;
    }
    
    // Load data for the section
    switch (page) {
        case 'home': loadHomeStats(); break;
        case 'tree': loadTree(); break;
        case 'members': loadMembers(); break;
        case 'stats': loadStats(); break;
        case 'gallery': loadGallery(); break;
        case 'admin': 
            if (isAuthenticated) {
                showAdminView();
                loadAdminTable();
            } else {
                showLoginView();
            }
            break;
    }
    
    // Close mobile menu
    document.getElementById('navLinks').classList.remove('open');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#', '') || 'home';
    navigate(page, false);
});

// ==================== NAVBAR ====================
function initNavScroll() {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        const scrollY = window.scrollY;
        navbar.classList.toggle('scrolled', scrollY > 50);
        lastScroll = scrollY;
    });
}

function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    navLinks.classList.toggle('open');
}

// ==================== API HELPER ====================
async function apiCall(action, method = 'GET', data = null) {
    const opts = { method, headers: {} };
    
    let url = `${API_URL}?action=${action}`;
    
    if (method === 'GET' && data) {
        const params = new URLSearchParams(data);
        url += '&' + params.toString();
    } else if (method === 'POST' && data) {
        if (data instanceof FormData) {
            opts.body = data;
        } else {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data);
        }
    }
    
    const response = await fetch(url, opts);
    const result = await response.json();
    
    if (!response.ok) {
        throw new Error(result.error || 'Terjadi kesalahan');
    }
    
    return result;
}

// ==================== AUTH ====================
async function checkAuth() {
    try {
        const result = await apiCall('check_auth');
        isAuthenticated = result.authenticated;
        updateAdminButton();
    } catch (e) {
        isAuthenticated = false;
    }
}

function updateAdminButton() {
    const btn = document.getElementById('adminBtn');
    const text = btn.querySelector('.admin-btn-text');
    if (isAuthenticated) {
        btn.innerHTML = '<i class="fas fa-cogs"></i> <span class="admin-btn-text">Dashboard</span>';
    } else {
        btn.innerHTML = '<i class="fas fa-lock"></i> <span class="admin-btn-text">Admin</span>';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginSubmitBtn');
    const errorEl = document.getElementById('loginError');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    errorEl.classList.remove('visible');
    
    try {
        const result = await apiCall('login', 'POST', {
            username: document.getElementById('loginUsername').value,
            password: document.getElementById('loginPassword').value
        });
        
        isAuthenticated = true;
        updateAdminButton();
        showAdminView();
        loadAdminTable();
        showToast('Login berhasil! Selamat datang.', 'success');
    } catch (e) {
        errorEl.textContent = e.message;
        errorEl.classList.add('visible');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Masuk';
    }
}

async function handleLogout() {
    try {
        await apiCall('logout', 'POST');
    } catch (e) {}
    isAuthenticated = false;
    updateAdminButton();
    showLoginView();
    showToast('Anda telah logout.', 'info');
}

function showLoginView() {
    document.getElementById('loginView').style.display = 'block';
    document.getElementById('adminView').style.display = 'none';
}

function showAdminView() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('adminView').style.display = 'block';
}

// ==================== HOME STATS ====================
async function loadHomeStats() {
    try {
        const params = currentFamilyId ? { family_id: currentFamilyId } : {};
        const stats = await apiCall('get_stats', 'GET', params);
        document.getElementById('stat-total').textContent = stats.total_members;
        document.getElementById('stat-generations').textContent = stats.max_generation || 0;
        document.getElementById('stat-living').textContent = stats.living;
        document.getElementById('stat-occupations').textContent = stats.occupations ? stats.occupations.length : 0;
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

// ==================== FAMILIES ====================
async function loadFamilies() {
    try {
        const result = await apiCall('get_families');
        allFamilies = result.families;
        renderFamilyTabs();
        populateFamilyDropdowns();
    } catch (e) {
        console.error('Failed to load families:', e);
    }
}

function renderFamilyTabs() {
    const containers = ['homeFamilyTabs', 'treeFamilyTabs'];
    
    containers.forEach(containerId => {
        const el = document.getElementById(containerId);
        if (!el) return;
        
        if (allFamilies.length <= 1) {
            el.innerHTML = '';
            return;
        }
        
        let html = `<button class="btn ${currentFamilyId === '' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="selectFamily('')">
            <i class="fas fa-globe"></i> Semua Keluarga
        </button>`;
        
        allFamilies.forEach(f => {
            const isActive = currentFamilyId == f.id;
            html += `<button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="selectFamily(${f.id})" style="${isActive ? `background:${f.color}; border-color:${f.color};` : `border-left:3px solid ${f.color};`}">
                <i class="fas fa-code-branch"></i> ${escapeHtml(f.name)} <small>(${f.member_count})</small>
            </button>`;
        });
        
        el.innerHTML = html;
    });
}

function selectFamily(familyId) {
    currentFamilyId = familyId;
    renderFamilyTabs();
    
    // Reload current active page data
    const activePage = document.querySelector('.section.active');
    if (activePage) {
        const id = activePage.id.replace('section-', '');
        switch (id) {
            case 'home': loadHomeStats(); break;
            case 'tree': loadTree(); break;
            case 'members': loadMembers(); break;
            case 'stats': loadStats(); break;
            case 'gallery': loadGallery(); break;
        }
    }
}

function populateFamilyDropdowns() {
    // Filter dropdown on members page
    const filterFamily = document.getElementById('filterFamily');
    if (filterFamily) {
        const currentVal = filterFamily.value;
        filterFamily.innerHTML = '<option value="">Semua Keluarga</option>';
        allFamilies.forEach(f => {
            filterFamily.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        });
        filterFamily.value = currentVal;
    }
    
    // Form dropdown on member form
    const formFamily = document.getElementById('formFamily');
    if (formFamily) {
        const currentVal = formFamily.value;
        formFamily.innerHTML = '<option value="">-- Pilih Keluarga --</option>';
        allFamilies.forEach(f => {
            formFamily.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        });
        formFamily.value = currentVal;
    }

    // Admin filter dropdown
    const adminFilterFamily = document.getElementById('adminFilterFamily');
    if (adminFilterFamily) {
        const currentVal = adminFilterFamily.value || '';
        adminFilterFamily.innerHTML = '<option value="">-- Filter: Semua Keluarga --</option>';
        allFamilies.forEach(f => {
            adminFilterFamily.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        });
        adminFilterFamily.value = currentVal;
    }
    
    // Gallery filter dropdown
    const filterGalleryFamily = document.getElementById('filterGalleryFamily');
    if (filterGalleryFamily) {
        const currentVal = filterGalleryFamily.value || '';
        filterGalleryFamily.innerHTML = '<option value="">Semua Cabang Keluarga</option>';
        allFamilies.forEach(f => {
            filterGalleryFamily.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        });
        filterGalleryFamily.value = currentVal;
    }

    // Gallery upload form dropdown
    const formGalleryFamily = document.getElementById('formGalleryFamily');
    if (formGalleryFamily) {
        const currentVal = formGalleryFamily.value || '';
        formGalleryFamily.innerHTML = '<option value="">-- Semua Cabang Keluarga --</option>';
        allFamilies.forEach(f => {
            formGalleryFamily.innerHTML += `<option value="${f.id}">${escapeHtml(f.name)}</option>`;
        });
        formGalleryFamily.value = currentVal;
    }
}

// Family Management Modal
async function openFamilyModal() {
    openModal('familyModal');
    await loadFamilyList();
}

async function loadFamilyList() {
    const listEl = document.getElementById('familyList');
    listEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
        const result = await apiCall('get_families');
        allFamilies = result.families;
        
        if (result.families.length === 0) {
            listEl.innerHTML = '<div class="empty-state" style="padding:var(--space-lg)"><p>Belum ada keluarga. Tambahkan yang pertama!</p></div>';
            return;
        }
        
        listEl.innerHTML = result.families.map(f => `
            <div style="display:flex; align-items:center; gap:var(--space-md); padding:var(--space-md); border:1px solid var(--border-color); border-radius:var(--radius-md); margin-bottom:var(--space-sm);">
                <div style="width:12px;height:12px;border-radius:50%;background:${f.color};flex-shrink:0;"></div>
                <div style="flex:1;">
                    <strong>${escapeHtml(f.name)}</strong>
                    ${f.description ? `<br><small style="color:var(--text-muted)">${escapeHtml(f.description)}</small>` : ''}
                </div>
                <span class="member-badge gen">${f.member_count} anggota</span>
                <button class="btn btn-ghost btn-sm" onclick="handleDeleteFamily(${f.id})" style="color:var(--danger-500)" title="Hapus">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = `<div class="empty-state"><p>Gagal memuat: ${e.message}</p></div>`;
    }
}

async function handleAddFamily() {
    const name = document.getElementById('newFamilyName').value.trim();
    const desc = document.getElementById('newFamilyDesc').value.trim();
    const color = document.getElementById('newFamilyColor').value;
    
    if (!name) {
        showToast('Nama keluarga harus diisi', 'error');
        return;
    }
    
    try {
        await apiCall('add_family', 'POST', { name, description: desc, color });
        showToast('Keluarga berhasil ditambahkan!', 'success');
        document.getElementById('newFamilyName').value = '';
        document.getElementById('newFamilyDesc').value = '';
        await loadFamilies();
        await loadFamilyList();
    } catch (e) {
        showToast('Gagal menambah keluarga: ' + e.message, 'error');
    }
}

async function handleDeleteFamily(id) {
    const family = allFamilies.find(f => f.id == id);
    const name = family ? family.name : 'keluarga ini';
    if (!confirm(`Hapus keluarga "${name}"? Anggota keluarga ini tidak akan dihapus, hanya cabang keluarganya.`)) return;
    
    try {
        await apiCall('delete_family', 'POST', { id });
        showToast('Keluarga berhasil dihapus!', 'success');
        if (currentFamilyId == id) currentFamilyId = '';
        await loadFamilies();
        await loadFamilyList();
    } catch (e) {
        showToast('Gagal menghapus: ' + e.message, 'error');
    }
}

// ==================== MEMBERS LIST ====================
async function loadMembers() {
    const grid = document.getElementById('memberGrid');
    grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
        const gen = document.getElementById('filterGen').value;
        const gender = document.getElementById('filterGender').value;
        const sort = document.getElementById('sortSelect').value;
        const familyFilter = document.getElementById('filterFamily').value || currentFamilyId;
        
        const params = { sort };
        if (gen) params.generation = gen;
        if (gender) params.gender = gender;
        if (familyFilter) params.family_id = familyFilter;
        
        const result = await apiCall('get_members', 'GET', params);
        allMembers = result.members;
        
        // Populate generation filter if not done
        populateGenFilter(result.members);
        
        renderMemberGrid(result.members);
    } catch (e) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Gagal memuat data</h4><p>${e.message}</p></div>`;
    }
}

function populateGenFilter(members) {
    const select = document.getElementById('filterGen');
    if (select.options.length > 1) return; // Already populated
    
    const gens = [...new Set(members.map(m => m.generation))].sort((a, b) => a - b);
    gens.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = `Generasi ${g}`;
        select.appendChild(opt);
    });
}

function renderMemberGrid(members) {
    const grid = document.getElementById('memberGrid');
    
    if (members.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h4>Tidak ada anggota ditemukan</h4><p>Coba ubah filter pencarian Anda</p></div>';
        return;
    }
    
    grid.innerHTML = members.map(m => {
        const initial = m.name.charAt(0).toUpperCase();
        const genderClass = m.gender === 'L' ? 'male' : 'female';
        const deceasedClass = m.death_date ? ' deceased' : '';
        const avatar = m.photo 
            ? `<img src="${m.photo}" alt="${m.name}">` 
            : initial;
        
        return `
        <div class="member-card" onclick="showMemberDetail(${m.id})">
            <div class="member-card-header">
                <div class="member-avatar ${genderClass}${deceasedClass}">${avatar}</div>
                <div class="member-info">
                    <h4>${escapeHtml(m.name)}</h4>
                    ${m.nickname ? `<span class="member-nickname">"${escapeHtml(m.nickname)}"</span>` : ''}
                </div>
            </div>
            <div class="member-card-body">
                ${m.birth_date ? `<div class="member-detail-row"><i class="fas fa-birthday-cake"></i> ${formatDate(m.birth_date)}${m.birth_place ? ', ' + escapeHtml(m.birth_place) : ''}</div>` : ''}
                ${m.occupation ? `<div class="member-detail-row"><i class="fas fa-briefcase"></i> ${escapeHtml(m.occupation)}</div>` : ''}
                ${m.father_name || m.mother_name ? `<div class="member-detail-row"><i class="fas fa-user-friends"></i> ${m.father_name ? escapeHtml(m.father_name) : '?'} & ${m.mother_name ? escapeHtml(m.mother_name) : '?'}</div>` : ''}
            </div>
            <div class="member-card-footer">
                <span class="member-badge gen">Gen ${m.generation}</span>
                <span class="member-badge ${genderClass}-badge">${m.gender === 'L' ? '♂ Laki-laki' : '♀ Perempuan'}</span>
                ${m.death_date ? '<span class="member-badge deceased-badge">Almarhum/ah</span>' : ''}
            </div>
        </div>`;
    }).join('');
}

// ==================== SEARCH ====================
function handleSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        if (query.trim().length === 0) {
            loadMembers();
            return;
        }
        
        const grid = document.getElementById('memberGrid');
        grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        
        try {
            const result = await apiCall('search', 'GET', { q: query });
            renderMemberGrid(result.members);
        } catch (e) {
            grid.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><h4>Pencarian gagal</h4><p>${e.message}</p></div>`;
        }
    }, 300);
}

// ==================== MEMBER DETAIL ====================
async function showMemberDetail(id) {
    openModal('memberDetailModal');
    const body = document.getElementById('memberDetailBody');
    const footer = document.getElementById('memberDetailFooter');
    body.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    footer.innerHTML = '';
    
    try {
        const result = await apiCall('get_member', 'GET', { id });
        const m = result.member;
        
        const genderClass = m.gender === 'L' ? 'male' : 'female';
        const initial = m.name.charAt(0).toUpperCase();
        const avatar = m.photo 
            ? `<img src="${m.photo}" alt="${m.name}">` 
            : initial;
        
        let html = `
            <div class="member-detail-header">
                <div class="member-detail-avatar ${genderClass}" style="${m.gender === 'P' ? 'background:linear-gradient(135deg,#ec4899,#be185d);border-color:rgba(236,72,153,0.3);' : ''}">
                    ${avatar}
                </div>
                <div class="member-detail-name">
                    <h3>${escapeHtml(m.name)}</h3>
                    ${m.nickname ? `<div class="nickname">"${escapeHtml(m.nickname)}"</div>` : ''}
                    <div style="display:flex; gap:var(--space-sm); margin-top:var(--space-sm);">
                        <span class="member-badge gen">Generasi ${m.generation}</span>
                        <span class="member-badge ${genderClass}-badge">${m.gender === 'L' ? '♂ Laki-laki' : '♀ Perempuan'}</span>
                        ${m.death_date ? '<span class="member-badge deceased-badge">Almarhum/ah</span>' : ''}
                    </div>
                </div>
            </div>`;
        
        // Personal Info
        html += `
            <div class="detail-section">
                <h4><i class="fas fa-info-circle"></i> Informasi Pribadi</h4>
                <div class="detail-grid">
                    <div class="detail-item"><div class="label">Tanggal Lahir</div><div class="value">${m.birth_date ? formatDate(m.birth_date) : '-'}</div></div>
                    <div class="detail-item"><div class="label">Tempat Lahir</div><div class="value">${m.birth_place || '-'}</div></div>
                    ${m.death_date ? `<div class="detail-item"><div class="label">Tanggal Wafat</div><div class="value">${formatDate(m.death_date)}</div></div>` : ''}
                    ${m.death_place ? `<div class="detail-item"><div class="label">Tempat Wafat</div><div class="value">${escapeHtml(m.death_place)}</div></div>` : ''}
                    <div class="detail-item"><div class="label">Pekerjaan</div><div class="value">${m.occupation || '-'}</div></div>
                    <div class="detail-item"><div class="label">Usia</div><div class="value">${calculateAge(m.birth_date, m.death_date)}</div></div>
                </div>
            </div>`;
        
        // Contact
        if (m.phone || m.email || m.address) {
            html += `
            <div class="detail-section">
                <h4><i class="fas fa-address-book"></i> Kontak</h4>
                <div class="detail-grid">
                    ${m.phone ? `<div class="detail-item"><div class="label">Telepon</div><div class="value">${escapeHtml(m.phone)}</div></div>` : ''}
                    ${m.email ? `<div class="detail-item"><div class="label">Email</div><div class="value">${escapeHtml(m.email)}</div></div>` : ''}
                    ${m.address ? `<div class="detail-item"><div class="label">Alamat</div><div class="value">${escapeHtml(m.address)}</div></div>` : ''}
                </div>
            </div>`;
        }
        
        // Family Relations
        html += `<div class="detail-section"><h4><i class="fas fa-heart"></i> Hubungan Keluarga</h4><div class="family-links">`;
        if (m.father_name) html += `<div class="family-link" onclick="showMemberDetail(${m.father_id})"><i class="fas fa-male"></i> Ayah: ${escapeHtml(m.father_name)}</div>`;
        if (m.mother_name) html += `<div class="family-link" onclick="showMemberDetail(${m.mother_id})"><i class="fas fa-female"></i> Ibu: ${escapeHtml(m.mother_name)}</div>`;
        if (m.spouse_name) html += `<div class="family-link" onclick="showMemberDetail(${m.spouse_id})"><i class="fas fa-ring"></i> Pasangan: ${escapeHtml(m.spouse_name)}</div>`;
        if (!m.father_name && !m.mother_name && !m.spouse_name) html += `<span style="color:var(--text-muted); font-size:0.85rem;">Belum ada data hubungan keluarga</span>`;
        html += `</div></div>`;
        
        // Children
        if (m.children && m.children.length > 0) {
            html += `<div class="detail-section"><h4><i class="fas fa-child"></i> Anak (${m.children.length})</h4><div class="family-links">`;
            m.children.forEach(c => {
                html += `<div class="family-link" onclick="showMemberDetail(${c.id})"><i class="fas fa-${c.gender === 'L' ? 'male' : 'female'}"></i> ${escapeHtml(c.name)}</div>`;
            });
            html += `</div></div>`;
        }
        
        // Siblings
        if (m.siblings && m.siblings.length > 0) {
            html += `<div class="detail-section"><h4><i class="fas fa-users"></i> Saudara (${m.siblings.length})</h4><div class="family-links">`;
            m.siblings.forEach(s => {
                html += `<div class="family-link" onclick="showMemberDetail(${s.id})"><i class="fas fa-${s.gender === 'L' ? 'male' : 'female'}"></i> ${escapeHtml(s.name)}</div>`;
            });
            html += `</div></div>`;
        }
        
        // Bio
        if (m.bio) {
            html += `<div class="detail-section"><h4><i class="fas fa-book"></i> Biografi</h4><p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.7;">${escapeHtml(m.bio)}</p></div>`;
        }
        
        body.innerHTML = html;
        
        // Footer buttons
        if (isAuthenticated) {
            footer.innerHTML = `
                <button class="btn btn-secondary" onclick="closeModal('memberDetailModal'); openEditMemberModal(${m.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="closeModal('memberDetailModal'); showDeleteConfirm(${m.id}, '${escapeHtml(m.name)}')">
                    <i class="fas fa-trash"></i> Hapus
                </button>`;
        }
    } catch (e) {
        body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Gagal memuat data</h4><p>${e.message}</p></div>`;
    }
}

// ==================== STATS ====================
async function loadStats() {
    const cardsEl = document.getElementById('statsCards');
    const chartsEl = document.getElementById('chartsRow');
    cardsEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    chartsEl.innerHTML = '';
    
    try {
        const stats = await apiCall('get_stats', 'GET', currentFamilyId ? { family_id: currentFamilyId } : {});
        
        // Stat cards
        cardsEl.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon blue"><i class="fas fa-users"></i></div>
                <div class="stat-number">${stats.total_members}</div>
                <div class="stat-label">Total Anggota</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(59,130,246,0.15);color:#60a5fa"><i class="fas fa-mars"></i></div>
                <div class="stat-number">${stats.male}</div>
                <div class="stat-label">Laki-laki</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(236,72,153,0.15);color:#f472b6"><i class="fas fa-venus"></i></div>
                <div class="stat-number">${stats.female}</div>
                <div class="stat-label">Perempuan</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon purple"><i class="fas fa-layer-group"></i></div>
                <div class="stat-number">${stats.max_generation || 0}</div>
                <div class="stat-label">Generasi</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon emerald"><i class="fas fa-heartbeat"></i></div>
                <div class="stat-number">${stats.living}</div>
                <div class="stat-label">Masih Hidup</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(100,116,139,0.15);color:var(--gray-400)"><i class="fas fa-dove"></i></div>
                <div class="stat-number">${stats.deceased}</div>
                <div class="stat-label">Almarhum/ah</div>
            </div>`;
        
        // Charts
        let chartsHtml = '';
        
        // Generation chart
        if (stats.generations && stats.generations.length > 0) {
            const maxGenCount = Math.max(...stats.generations.map(g => g.count));
            chartsHtml += `<div class="chart-container"><h4><i class="fas fa-layer-group" style="color:var(--primary-400)"></i> Anggota per Generasi</h4><div class="bar-chart">`;
            stats.generations.forEach(g => {
                const pct = (g.count / maxGenCount * 100).toFixed(0);
                chartsHtml += `<div class="bar-row">
                    <span class="bar-label">Generasi ${g.generation}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${pct}%">${g.count} orang</div></div>
                </div>`;
            });
            chartsHtml += `</div></div>`;
        }
        
        // Occupation chart
        if (stats.occupations && stats.occupations.length > 0) {
            const maxOccCount = Math.max(...stats.occupations.map(o => o.count));
            chartsHtml += `<div class="chart-container"><h4><i class="fas fa-briefcase" style="color:var(--accent-400)"></i> Distribusi Profesi</h4><div class="bar-chart">`;
            stats.occupations.forEach(o => {
                const pct = (o.count / maxOccCount * 100).toFixed(0);
                chartsHtml += `<div class="bar-row">
                    <span class="bar-label">${escapeHtml(o.occupation)}</span>
                    <div class="bar-track"><div class="bar-fill accent-bar" style="width:${pct}%">${o.count}</div></div>
                </div>`;
            });
            chartsHtml += `</div></div>`;
        }
        
        chartsEl.innerHTML = chartsHtml;
        
    } catch (e) {
        cardsEl.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Gagal memuat statistik</h4><p>${e.message}</p></div>`;
    }
}

// ==================== MODALS ====================
function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal when clicking overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal with Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            m.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// ==================== TOASTS ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

function calculateAge(birthDate, deathDate) {
    if (!birthDate) return '-';
    const birth = new Date(birthDate);
    const end = deathDate ? new Date(deathDate) : new Date();
    let age = end.getFullYear() - birth.getFullYear();
    const m = end.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--;
    if (deathDate) {
        return `${age} tahun (wafat)`;
    }
    return `${age} tahun`;
}

// ==================== GALLERY (PUBLIC) ====================
let allPhotos = [];

async function loadGallery() {
    const grid = document.getElementById('galleryGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
        const familyFilter = document.getElementById('filterGalleryFamily').value || currentFamilyId;
        const params = {};
        if (familyFilter) params.family_id = familyFilter;
        
        const result = await apiCall('get_gallery', 'GET', params);
        allPhotos = result.photos;
        
        if (allPhotos.length === 0) {
            grid.innerHTML = '<div class="empty-state"><i class="fas fa-images"></i><h4>Belum ada foto</td><p>Galeri ini masih kosong.</p></div>';
            return;
        }
        
        grid.innerHTML = allPhotos.map((p, index) => `
            <div class="gallery-item" onclick="openLightbox(${index})">
                <div class="gallery-img-wrap">
                    <img src="${p.file_path}" alt="${escapeHtml(p.title)}" loading="lazy">
                </div>
                <div class="gallery-info">
                    <h4>${escapeHtml(p.title)}</h4>
                    ${p.description ? `<p>${escapeHtml(p.description).substring(0, 80)}${p.description.length > 80 ? '...' : ''}</p>` : ''}
                    <div class="gallery-meta">
                        <span>${p.family_name ? '<i class="fas fa-tag"></i> ' + escapeHtml(p.family_name) : ''}</span>
                        <span>${formatDate(p.created_at.split(' ')[0])}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Gagal memuat galeri</h4><p>${e.message}</p></div>`;
    }
}

function openLightbox(index) {
    if (index < 0 || index >= allPhotos.length) return;
    const p = allPhotos[index];
    document.getElementById('lightboxImg').src = p.file_path;
    document.getElementById('lightboxTitle').textContent = p.title;
    document.getElementById('lightboxDesc').textContent = p.description || '';
    document.getElementById('lightboxMeta').innerHTML = 
        (p.family_name ? `<span style="margin-right:15px"><i class="fas fa-tag"></i> ${escapeHtml(p.family_name)}</span>` : '') + 
        `<span><i class="fas fa-calendar"></i> ${formatDate(p.created_at.split(' ')[0])}</span>`;
    
    document.getElementById('lightboxModal').classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightboxModal').classList.remove('active');
}

