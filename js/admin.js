/**
 * Silsilah Keluarga - Admin Dashboard Logic
 * Handles member CRUD operations, photo upload, and admin table
 */

// ==================== ADMIN TABLE ====================
async function loadAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '<tr><td colspan="11"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
    
    try {
        const familyFilter = document.getElementById('adminFilterFamily')?.value;
        const params = { sort: 'id' };
        if (familyFilter) params.family_id = familyFilter;
        
        const result = await apiCall('get_members', 'GET', params);
        allMembers = result.members;
        
        if (result.members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><i class="fas fa-users"></i><h4>Belum ada anggota</h4></div></td></tr>';
            return;
        }
        
        tbody.innerHTML = result.members.map(m => {
            const genderIcon = m.gender === 'L' ? '<i class="fas fa-mars" style="color:#60a5fa"></i>' : '<i class="fas fa-venus" style="color:#f472b6"></i>';
            const avatar = m.photo 
                ? `<img src="${m.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` 
                : `<div style="width:32px;height:32px;border-radius:50%;background:${m.gender === 'L' ? '#1d4ed8' : '#be185d'};display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;">${m.name.charAt(0)}</div>`;
            
            return `<tr>
                <td>${m.id}</td>
                <td>${avatar}</td>
                <td>
                    <strong>${escapeHtml(m.name)}</strong>
                    ${m.nickname ? `<br><small style="color:var(--text-muted)">${escapeHtml(m.nickname)}</small>` : ''}
                    ${m.death_date ? '<br><small style="color:var(--gray-500)">✝ Almarhum/ah</small>' : ''}
                </td>
                <td>${genderIcon}</td>
                <td><span class="member-badge gen">Gen ${m.generation}</span></td>
                <td>${m.birth_date ? formatDate(m.birth_date) : '-'}</td>
                <td>${m.occupation || '-'}</td>
                <td>${m.father_name || '-'}</td>
                <td>${m.mother_name || '-'}</td>
                <td>${m.spouse_name || '-'}</td>
                <td>
                    <div class="actions">
                        <button class="btn btn-ghost btn-sm" onclick="showMemberDetail(${m.id})" title="Detail"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-ghost btn-sm" onclick="openEditMemberModal(${m.id})" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-ghost btn-sm" onclick="showDeleteConfirm(${m.id}, '${escapeHtml(m.name).replace(/'/g, "\\'")}')" title="Hapus" style="color:var(--danger-500)"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><i class="fas fa-exclamation-circle"></i><h4>Gagal memuat data</h4><p>${e.message}</p></div></td></tr>`;
    }
}

// ==================== ADD MEMBER MODAL ====================
function openAddMemberModal() {
    document.getElementById('memberFormTitle').innerHTML = '<i class="fas fa-user-plus"></i> Tambah Anggota Baru';
    document.getElementById('memberForm').reset();
    document.getElementById('formMemberId').value = '';
    document.getElementById('formPhoto').value = '';
    document.getElementById('photoPreview').innerHTML = '<i class="fas fa-camera"></i>';
    document.getElementById('formGeneration').value = '1';
    
    // Pre-select current family if one is active
    populateFamilyDropdowns();
    if (currentFamilyId) {
        document.getElementById('formFamily').value = currentFamilyId;
    }
    
    populateRelationDropdowns().then(() => {
        if (window.tsFather) window.tsFather.setValue('');
        if (window.tsMother) window.tsMother.setValue('');
        if (window.tsSpouse) window.tsSpouse.setValue('');
    });
    
    openModal('memberFormModal');
}

// ==================== EDIT MEMBER MODAL ====================
async function openEditMemberModal(id) {
    document.getElementById('memberFormTitle').innerHTML = '<i class="fas fa-user-edit"></i> Edit Anggota';
    
    try {
        const result = await apiCall('get_member', 'GET', { id });
        const m = result.member;
        
        document.getElementById('formMemberId').value = m.id;
        document.getElementById('formName').value = m.name || '';
        document.getElementById('formNickname').value = m.nickname || '';
        document.getElementById('formGender').value = m.gender || 'L';
        document.getElementById('formGeneration').value = m.generation || 1;
        document.getElementById('formBirthDate').value = m.birth_date || '';
        document.getElementById('formBirthPlace').value = m.birth_place || '';
        document.getElementById('formDeathDate').value = m.death_date || '';
        document.getElementById('formDeathPlace').value = m.death_place || '';
        document.getElementById('formPhone').value = m.phone || '';
        document.getElementById('formEmail').value = m.email || '';
        document.getElementById('formOccupation').value = m.occupation || '';
        document.getElementById('formAddress').value = m.address || '';
        document.getElementById('formBio').value = m.bio || '';
        document.getElementById('formIsRoot').checked = m.is_root == 1;
        document.getElementById('formPhoto').value = m.photo || '';
        
        // Family dropdown
        populateFamilyDropdowns();
        document.getElementById('formFamily').value = m.family_id || '';
        
        // Photo preview
        const preview = document.getElementById('photoPreview');
        if (m.photo) {
            preview.innerHTML = `<img src="${m.photo}" alt="Photo">`;
        } else {
            preview.innerHTML = '<i class="fas fa-camera"></i>';
        }
        
        await populateRelationDropdowns(m.id);
        
        if (window.tsFather) window.tsFather.setValue(m.father_id || '');
        if (window.tsMother) window.tsMother.setValue(m.mother_id || '');
        if (window.tsSpouse) window.tsSpouse.setValue(m.spouse_id || '');
        
        openModal('memberFormModal');
    } catch (e) {
        showToast('Gagal memuat data anggota: ' + e.message, 'error');
    }
}

// ==================== POPULATE RELATION DROPDOWNS ====================
async function populateRelationDropdowns(excludeId = null) {
    try {
        if (allMembers.length === 0) {
            const result = await apiCall('get_members');
            allMembers = result.members;
        }
        
        const fatherSelect = document.getElementById('formFather');
        const motherSelect = document.getElementById('formMother');
        const spouseSelect = document.getElementById('formSpouse');
        
        // Reset
        fatherSelect.innerHTML = '<option value="">-- Pilih Ayah --</option>';
        motherSelect.innerHTML = '<option value="">-- Pilih Ibu --</option>';
        spouseSelect.innerHTML = '<option value="">-- Pilih Pasangan --</option>';
        
        allMembers.forEach(m => {
            if (excludeId && m.id == excludeId) return;
            
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.name} (Gen ${m.generation})`;
            
            if (m.gender === 'L') {
                fatherSelect.appendChild(opt.cloneNode(true));
            } else {
                motherSelect.appendChild(opt.cloneNode(true));
            }
            
            spouseSelect.appendChild(opt.cloneNode(true));
        });
        
        // Initialize or sync TomSelect for search functionality
        if (window.tsFather) window.tsFather.sync();
        else window.tsFather = new TomSelect('#formFather', {create: false, sortField: {field: "text", direction: "asc"}, plugins: ['clear_button']});
        
        if (window.tsMother) window.tsMother.sync();
        else window.tsMother = new TomSelect('#formMother', {create: false, sortField: {field: "text", direction: "asc"}, plugins: ['clear_button']});
        
        if (window.tsSpouse) window.tsSpouse.sync();
        else window.tsSpouse = new TomSelect('#formSpouse', {create: false, sortField: {field: "text", direction: "asc"}, plugins: ['clear_button']});
        
    } catch (e) {
        console.error('Failed to populate dropdowns:', e);
    }
}

// ==================== SAVE MEMBER ====================
async function handleSaveMember(e) {
    e.preventDefault();
    
    const id = document.getElementById('formMemberId').value;
    const isEdit = !!id;
    
    const data = {
        family_id: document.getElementById('formFamily').value || null,
        name: document.getElementById('formName').value.trim(),
        nickname: document.getElementById('formNickname').value.trim(),
        gender: document.getElementById('formGender').value,
        generation: parseInt(document.getElementById('formGeneration').value) || 1,
        birth_date: document.getElementById('formBirthDate').value,
        birth_place: document.getElementById('formBirthPlace').value.trim(),
        death_date: document.getElementById('formDeathDate').value,
        death_place: document.getElementById('formDeathPlace').value.trim(),
        phone: document.getElementById('formPhone').value.trim(),
        email: document.getElementById('formEmail').value.trim(),
        occupation: document.getElementById('formOccupation').value.trim(),
        address: document.getElementById('formAddress').value.trim(),
        bio: document.getElementById('formBio').value.trim(),
        photo: document.getElementById('formPhoto').value,
        father_id: document.getElementById('formFather').value || null,
        mother_id: document.getElementById('formMother').value || null,
        spouse_id: document.getElementById('formSpouse').value || null,
        is_root: document.getElementById('formIsRoot').checked ? 1 : 0
    };
    
    if (isEdit) data.id = parseInt(id);
    
    try {
        const action = isEdit ? 'update_member' : 'add_member';
        await apiCall(action, 'POST', data);
        
        closeModal('memberFormModal');
        showToast(isEdit ? 'Anggota berhasil diperbarui!' : 'Anggota berhasil ditambahkan!', 'success');
        
        // Refresh data
        allMembers = [];
        loadAdminTable();
        
        // Also refresh if on members page
        const membersSection = document.getElementById('section-members');
        if (membersSection.classList.contains('active')) {
            loadMembers();
        }
    } catch (e) {
        showToast('Gagal menyimpan: ' + e.message, 'error');
    }
}

// ==================== PHOTO UPLOAD ====================
async function previewPhoto(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    
    // Validate size
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file terlalu besar. Maksimal 5MB.', 'error');
        input.value = '';
        return;
    }
    
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('photoPreview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
    
    // Upload
    try {
        const formData = new FormData();
        formData.append('photo', file);
        
        const result = await apiCall('upload_photo', 'POST', formData);
        
        if (result.path) {
            document.getElementById('formPhoto').value = result.path;
            showToast('Foto berhasil diupload!', 'success');
        }
    } catch (e) {
        showToast('Gagal upload foto: ' + e.message, 'error');
    }
}

// ==================== DELETE MEMBER ====================
let deleteTargetId = null;

function showDeleteConfirm(id, name) {
    deleteTargetId = id;
    document.getElementById('confirmMessage').innerHTML = `Apakah Anda yakin ingin menghapus <strong>${name}</strong>?`;
    openModal('confirmModal');
}

async function confirmDelete() {
    if (!deleteTargetId) return;
    
    try {
        await apiCall('delete_member', 'POST', { id: deleteTargetId });
        closeModal('confirmModal');
        showToast('Anggota berhasil dihapus!', 'success');
        
        // Refresh
        allMembers = [];
        loadAdminTable();
        
        const membersSection = document.getElementById('section-members');
        if (membersSection.classList.contains('active')) {
            loadMembers();
        }
    } catch (e) {
        showToast('Gagal menghapus: ' + e.message, 'error');
    }
    
    deleteTargetId = null;
}

// ==================== GALLERY ADMIN ====================
async function openGalleryAdminModal() {
    openModal('galleryAdminModal');
    document.getElementById('galleryUploadForm').reset();
    populateFamilyDropdowns();
    await loadAdminGalleryList();
}

async function handleUploadGallery(e) {
    e.preventDefault();
    
    const photo = document.getElementById('newGalleryPhoto').files[0];
    const title = document.getElementById('newGalleryTitle').value.trim();
    const desc = document.getElementById('newGalleryDesc').value.trim();
    const familyId = document.getElementById('formGalleryFamily').value;
    
    if (!photo || !title) {
        showToast('Foto dan judul harus diisi', 'error');
        return;
    }
    
    if (photo.size > 15 * 1024 * 1024) {
        showToast('Ukuran file terlalu besar. Maksimal 15MB.', 'error');
        return;
    }
    
    const btn = document.getElementById('btnGalleryUpload');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah...';
    
    try {
        const formData = new FormData();
        formData.append('photo', photo);
        formData.append('title', title);
        formData.append('description', desc);
        if (familyId) formData.append('family_id', familyId);
        
        await apiCall('add_gallery_photo', 'POST', formData);
        showToast('Foto berhasil ditambahkan ke Arsip Kalbu!', 'success');
        
        document.getElementById('galleryUploadForm').reset();
        await loadAdminGalleryList();
        
        // Refresh gallery if currently open
        const sectionGallery = document.getElementById('section-gallery');
        if (sectionGallery && sectionGallery.classList.contains('active')) {
            loadGallery();
        }
    } catch(err) {
        showToast('Gagal mengunggah foto: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> Unggah';
    }
}

async function loadAdminGalleryList() {
    const listEl = document.getElementById('galleryAdminList');
    listEl.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    
    try {
        const result = await apiCall('get_gallery', 'GET');
        
        if (result.photos.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><p>Belum ada foto arsip kenangan.</p></div>';
            return;
        }
        
        listEl.innerHTML = result.photos.map(p => `
            <div style="display:flex; align-items:center; gap:var(--space-md); padding:var(--space-sm); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:var(--space-xs);">
                <img src="${p.file_path}" style="width:50px; height:50px; object-fit:cover; border-radius:var(--radius-xs);">
                <div style="flex:1; overflow:hidden;">
                    <strong style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.title)}</strong>
                    <small style="color:var(--text-muted)">${formatDate(p.created_at.split(' ')[0])} ${p.family_name ? ' &bull; ' + escapeHtml(p.family_name) : ''}</small>
                </div>
                <button class="btn btn-ghost btn-sm" onclick="handleDeleteGalleryPhoto(${p.id}, '${escapeHtml(p.title).replace(/'/g, "\\'")}')" style="color:var(--danger-500)" title="Hapus Foto">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch(e) {
        listEl.innerHTML = `<div class="empty-state"><p>Gagal memuat: ${e.message}</p></div>`;
    }
}

async function handleDeleteGalleryPhoto(id, title) {
    if (!confirm(`Hapus foto "${title}" dari Arsip Kalbu? Tindakan ini tidak dapat dibatalkan.`)) return;
    
    try {
        await apiCall('delete_gallery_photo', 'POST', { id });
        showToast('Foto berhasil dihapus!', 'success');
        await loadAdminGalleryList();
        
        // Refresh gallery if currently open
        const sectionGallery = document.getElementById('section-gallery');
        if (sectionGallery && sectionGallery.classList.contains('active')) {
            loadGallery();
        }
    } catch(e) {
        showToast('Gagal menghapus foto: ' + e.message, 'error');
    }
}

