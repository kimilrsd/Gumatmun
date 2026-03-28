/**
 * Silsilah Keluarga - Interactive Family Tree Visualization
 * SVG-based tree rendering with zoom, pan, and click interactions
 */

// ==================== TREE STATE ====================
let treeData = null;
let treeTransform = { x: 0, y: 0, scale: 1 };
let treeDragging = false;
let dragStart = { x: 0, y: 0 };
let treeLoaded = false;

// Layout constants
const NODE_W = 200;
const NODE_H = 72;
const NODE_GAP_X = 40;
const NODE_GAP_Y = 100;
const COUPLE_GAP = 10;
const PHOTO_SIZE = 44;

// ==================== LOAD TREE ====================
async function loadTree() {
    const canvas = document.getElementById('treeCanvas');
    canvas.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#94a3b8" font-size="14">Memuat pohon keluarga...</text>';
    
    try {
        const params = currentFamilyId ? { family_id: currentFamilyId } : {};
        const result = await apiCall('get_tree', 'GET', params);
        treeData = result;
        renderTree();
        initTreeInteractions();
    } catch (e) {
        canvas.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#f43f5e" font-size="14">Gagal memuat: ${e.message}</text>`;
    }
}

// ==================== RENDER TREE ====================
function renderTree() {
    if (!treeData || !treeData.tree) return;

    const { roots, nodes } = treeData.tree;
    if (!roots || roots.length === 0) return;

    const canvas = document.getElementById('treeCanvas');
    const container = document.getElementById('treeContainer');
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    // Calculate layout positions
    const positions = calculateLayout(roots, nodes);

    // Find bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    Object.values(positions).forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x + NODE_W);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y + NODE_H);
    });

    const treeW = maxX - minX + 100;
    const treeH = maxY - minY + 100;

    // Auto-fit
    const scaleX = containerW / treeW;
    const scaleY = containerH / treeH;
    const autoScale = Math.min(scaleX, scaleY, 1) * 0.85;

    treeTransform.scale = autoScale;
    treeTransform.x = (containerW - treeW * autoScale) / 2 - minX * autoScale + 50 * autoScale;
    treeTransform.y = (containerH - treeH * autoScale) / 2 - minY * autoScale + 50 * autoScale;

    // Build SVG
    let svg = `<g id="treeGroup" transform="translate(${treeTransform.x},${treeTransform.y}) scale(${treeTransform.scale})">`;

    // Draw connectors first (behind nodes)
    svg += drawConnectors(roots, nodes, positions);

    // Draw nodes
    Object.entries(positions).forEach(([id, pos]) => {
        const member = nodes[parseInt(id)];
        if (member) {
            svg += drawNode(member, pos.x, pos.y);

            // Draw spouse next to member
            if (member.spouse_id && nodes[member.spouse_id] && positions[member.spouse_id + '_spouse']) {
                const sp = positions[member.spouse_id + '_spouse'];
                svg += drawNode(nodes[member.spouse_id], sp.x, sp.y);
                // Couple connector
                svg += `<line x1="${pos.x + NODE_W}" y1="${pos.y + NODE_H/2}" x2="${sp.x}" y2="${sp.y + NODE_H/2}" 
                    stroke="#f472b6" stroke-width="2" stroke-dasharray="6,3" opacity="0.6"/>`;
                // Heart icon
                const heartX = (pos.x + NODE_W + sp.x) / 2;
                const heartY = pos.y + NODE_H / 2;
                svg += `<text x="${heartX}" y="${heartY + 4}" text-anchor="middle" fill="#f472b6" font-size="14">♥</text>`;
            }
        }
    });

    svg += '</g>';
    canvas.innerHTML = svg;
    treeLoaded = true;
}

// ==================== LAYOUT ALGORITHM ====================
function calculateLayout(roots, nodes) {
    const positions = {};
    let currentX = 0;

    roots.forEach((rootId, idx) => {
        const subtreeWidth = calcSubtreeWidth(rootId, nodes);
        const startX = currentX;
        layoutSubtree(rootId, nodes, positions, startX, 0, subtreeWidth);
        currentX += subtreeWidth + NODE_GAP_X * 2;
    });

    return positions;
}

function calcSubtreeWidth(nodeId, nodes) {
    const node = nodes[nodeId];
    if (!node) return NODE_W;

    const childIds = (node.children || []).filter(cid => {
        const child = nodes[cid];
        return child && !isSpouseOnly(child, nodes);
    });

    if (childIds.length === 0) {
        let width = NODE_W;
        // Add spouse width
        if (node.spouse_id && nodes[node.spouse_id]) {
            width += COUPLE_GAP + NODE_W;
        }
        return width;
    }

    let totalWidth = 0;
    childIds.forEach((cid, i) => {
        totalWidth += calcSubtreeWidth(cid, nodes);
        if (i < childIds.length - 1) totalWidth += NODE_GAP_X;
    });

    let nodeWidth = NODE_W;
    if (node.spouse_id && nodes[node.spouse_id]) {
        nodeWidth += COUPLE_GAP + NODE_W;
    }

    return Math.max(totalWidth, nodeWidth);
}

function layoutSubtree(nodeId, nodes, positions, startX, y, availableWidth) {
    const node = nodes[nodeId];
    if (!node) return;

    let nodeWidth = NODE_W;
    let hasSpouse = node.spouse_id && nodes[node.spouse_id];
    if (hasSpouse) nodeWidth += COUPLE_GAP + NODE_W;

    // Center node in available width
    const nodeX = startX + (availableWidth - nodeWidth) / 2;
    positions[nodeId] = { x: nodeX, y };

    if (hasSpouse) {
        positions[node.spouse_id + '_spouse'] = { x: nodeX + NODE_W + COUPLE_GAP, y };
    }

    // Layout children
    const childIds = (node.children || []).filter(cid => {
        const child = nodes[cid];
        return child && !isSpouseOnly(child, nodes);
    });

    if (childIds.length === 0) return;

    const childY = y + NODE_H + NODE_GAP_Y;
    let childXOffset = startX;

    // Calculate total children width
    let totalChildrenWidth = 0;
    const childWidths = childIds.map(cid => calcSubtreeWidth(cid, nodes));
    childWidths.forEach((w, i) => {
        totalChildrenWidth += w;
        if (i < childWidths.length - 1) totalChildrenWidth += NODE_GAP_X;
    });

    // Center children under parent
    childXOffset = startX + (availableWidth - totalChildrenWidth) / 2;

    childIds.forEach((cid, i) => {
        layoutSubtree(cid, nodes, positions, childXOffset, childY, childWidths[i]);
        childXOffset += childWidths[i] + NODE_GAP_X;
    });
}

function isSpouseOnly(member, nodes) {
    // A member is "spouse-only" if they married into the family
    // i.e. no parents, not root, but has a spouse who IS in the tree
    return !member.father_id && !member.mother_id && !member.is_root && member.spouse_id;
}

// ==================== DRAW CONNECTORS ====================
function drawConnectors(roots, nodes, positions) {
    let svg = '';

    function drawForNode(nodeId) {
        const node = nodes[nodeId];
        if (!node || !positions[nodeId]) return;

        const childIds = (node.children || []).filter(cid => {
            const child = nodes[cid];
            return child && !isSpouseOnly(child, nodes) && positions[cid];
        });

        if (childIds.length === 0) return;

        const parentPos = positions[nodeId];
        let parentCenterX = parentPos.x + NODE_W / 2;

        // If has spouse, center between parent and spouse
        if (node.spouse_id && positions[node.spouse_id + '_spouse']) {
            const spousePos = positions[node.spouse_id + '_spouse'];
            parentCenterX = (parentPos.x + NODE_W / 2 + spousePos.x + NODE_W / 2) / 2;
        }

        const parentBottomY = parentPos.y + NODE_H;
        const midY = parentBottomY + NODE_GAP_Y / 2;

        // Vertical line from parent down to midY
        svg += `<line x1="${parentCenterX}" y1="${parentBottomY}" x2="${parentCenterX}" y2="${midY}" 
            class="connector" stroke="${getConnectorColor()}" stroke-width="2" opacity="0.4"/>`;

        // Horizontal line at midY spanning all children
        if (childIds.length > 1) {
            const leftmostChild = positions[childIds[0]];
            const rightmostChild = positions[childIds[childIds.length - 1]];
            const lineX1 = leftmostChild.x + NODE_W / 2;
            const lineX2 = rightmostChild.x + NODE_W / 2;

            svg += `<line x1="${lineX1}" y1="${midY}" x2="${lineX2}" y2="${midY}" 
                class="connector" stroke="${getConnectorColor()}" stroke-width="2" opacity="0.4"/>`;
        }

        // Vertical lines from midY down to each child
        childIds.forEach(cid => {
            const childPos = positions[cid];
            const childCenterX = childPos.x + NODE_W / 2;
            const childTopY = childPos.y;

            svg += `<line x1="${childCenterX}" y1="${midY}" x2="${childCenterX}" y2="${childTopY}" 
                class="connector" stroke="${getConnectorColor()}" stroke-width="2" opacity="0.4"/>`;

            // Recurse
            drawForNode(cid);
        });
    }

    roots.forEach(rid => drawForNode(rid));
    return svg;
}

function getConnectorColor() {
    return '#60a5fa';
}

// ==================== DRAW NODE ====================
function drawNode(member, x, y) {
    const isMale = member.gender === 'L';
    const isDeceased = member.death_date && member.death_date !== '';
    
    let bgColor, borderColor, textColor;
    if (isDeceased) {
        bgColor = 'rgba(226,232,240,0.95)';
        borderColor = '#94a3b8';
        textColor = '#475569';
    } else if (isMale) {
        bgColor = 'rgba(219,234,254,0.95)';
        borderColor = '#3b82f6';
        textColor = '#1e293b';
    } else {
        bgColor = 'rgba(252,231,243,0.95)';
        borderColor = '#ec4899';
        textColor = '#1e293b';
    }

    const radius = 12;
    const initial = member.name.charAt(0).toUpperCase();
    const displayName = member.name.length > 20 ? member.name.substring(0, 18) + '...' : member.name;
    const subtitle = member.birth_date ? member.birth_date.split('-')[0] : '';
    const subtitleText = subtitle ? (isDeceased ? `${subtitle} - ${member.death_date.split('-')[0]}` : subtitle) : '';

    let avatarCircleColor = isMale ? '#3b82f6' : '#ec4899';
    if (isDeceased) avatarCircleColor = '#475569';

    let svg = `<g class="node" onclick="showMemberDetail(${member.id})" style="cursor:pointer">`;
    
    // Shadow
    svg += `<rect x="${x + 2}" y="${y + 3}" width="${NODE_W}" height="${NODE_H}" rx="${radius}" fill="rgba(0,0,0,0.3)"/>`;
    
    // Background
    svg += `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="${radius}" 
        fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>`;

    // Avatar circle
    const avatarX = x + 16;
    const avatarY = y + NODE_H / 2;
    const avatarR = PHOTO_SIZE / 2;

    if (member.photo) {
        svg += `<foreignObject x="${avatarX}" y="${avatarY - avatarR}" width="${PHOTO_SIZE}" height="${PHOTO_SIZE}">
                    <div style="width:100%; height:100%; border-radius:50%; box-sizing:border-box; border:2px solid ${avatarCircleColor}; padding:2px; background:white;">
                        <img src="${member.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" alt="Foto">
                    </div>
                </foreignObject>`;
    } else {
        svg += `<circle cx="${avatarX + avatarR}" cy="${avatarY}" r="${avatarR}" fill="${avatarCircleColor}" opacity="0.8"/>`;
        svg += `<text x="${avatarX + avatarR}" y="${avatarY + 5}" text-anchor="middle" fill="white" font-size="16" font-weight="700" font-family="Inter, sans-serif">${initial}</text>`;
    }

    // Name
    const textX = avatarX + PHOTO_SIZE + 12;
    svg += `<text x="${textX}" y="${y + 28}" fill="${textColor}" font-size="12" font-weight="600" font-family="Inter, sans-serif">${escapeXml(displayName)}</text>`;

    // Subtitle (years)
    if (subtitleText) {
        svg += `<text x="${textX}" y="${y + 44}" fill="#475569" font-size="10" font-family="Inter, sans-serif">${subtitleText}</text>`;
    }

    // Occupation
    if (member.occupation) {
        const occText = member.occupation.length > 18 ? member.occupation.substring(0, 16) + '...' : member.occupation;
        svg += `<text x="${textX}" y="${y + 58}" fill="#94a3b8" font-size="9" font-family="Inter, sans-serif">${escapeXml(occText)}</text>`;
    }

    // Deceased indicator
    if (isDeceased) {
        svg += `<text x="${x + NODE_W - 12}" y="${y + 16}" fill="#94a3b8" font-size="10" text-anchor="middle">✝</text>`;
    }

    svg += '</g>';
    return svg;
}

function escapeXml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ==================== TREE INTERACTIONS ====================
function initTreeInteractions() {
    const canvas = document.getElementById('treeCanvas');

    // Mouse interactions
    canvas.addEventListener('mousedown', (e) => {
        if (e.target.closest('.node')) return;
        treeDragging = true;
        dragStart = { x: e.clientX - treeTransform.x, y: e.clientY - treeTransform.y };
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!treeDragging) return;
        treeTransform.x = e.clientX - dragStart.x;
        treeTransform.y = e.clientY - dragStart.y;
        updateTreeTransform();
    });

    canvas.addEventListener('mouseup', () => {
        treeDragging = false;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
        treeDragging = false;
        canvas.style.cursor = 'grab';
    });

    // Wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        const newScale = Math.max(0.1, Math.min(3, treeTransform.scale + delta));
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const scaleRatio = newScale / treeTransform.scale;
        treeTransform.x = mouseX - scaleRatio * (mouseX - treeTransform.x);
        treeTransform.y = mouseY - scaleRatio * (mouseY - treeTransform.y);
        treeTransform.scale = newScale;
        
        updateTreeTransform();
    }, { passive: false });

    // Touch interactions
    let lastTouchDist = 0;
    let lastTouchCenter = { x: 0, y: 0 };

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            treeDragging = true;
            dragStart = { x: e.touches[0].clientX - treeTransform.x, y: e.touches[0].clientY - treeTransform.y };
        } else if (e.touches.length === 2) {
            treeDragging = false;
            lastTouchDist = getTouchDist(e.touches);
            lastTouchCenter = getTouchCenter(e.touches);
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && treeDragging) {
            treeTransform.x = e.touches[0].clientX - dragStart.x;
            treeTransform.y = e.touches[0].clientY - dragStart.y;
            updateTreeTransform();
        } else if (e.touches.length === 2) {
            const dist = getTouchDist(e.touches);
            const center = getTouchCenter(e.touches);
            const scaleChange = dist / lastTouchDist;
            const newScale = Math.max(0.1, Math.min(3, treeTransform.scale * scaleChange));
            
            treeTransform.x += center.x - lastTouchCenter.x;
            treeTransform.y += center.y - lastTouchCenter.y;
            treeTransform.scale = newScale;
            
            lastTouchDist = dist;
            lastTouchCenter = center;
            updateTreeTransform();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', () => { treeDragging = false; });
}

function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

function updateTreeTransform() {
    const group = document.getElementById('treeGroup');
    if (group) {
        group.setAttribute('transform', `translate(${treeTransform.x},${treeTransform.y}) scale(${treeTransform.scale})`);
    }
}

// ==================== TREE CONTROLS ====================
function treeZoomIn() {
    treeTransform.scale = Math.min(3, treeTransform.scale + 0.2);
    updateTreeTransform();
}

function treeZoomOut() {
    treeTransform.scale = Math.max(0.1, treeTransform.scale - 0.2);
    updateTreeTransform();
}

function treeReset() {
    if (treeData) renderTree();
}

// ==================== EXPORT ====================
function exportTreeImage() {
    const canvas = document.getElementById('treeCanvas');
    const svgData = new XMLSerializer().serializeToString(canvas);
    
    const container = document.getElementById('treeContainer');
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svgBlob = new Blob([
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgData}</svg>`
    ], { type: 'image/svg+xml;charset=utf-8' });

    // Create canvas to convert SVG to PNG
    const img = new Image();
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        const cvs = document.createElement('canvas');
        cvs.width = width * 2;
        cvs.height = height * 2;
        const ctx = cvs.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const link = document.createElement('a');
        link.download = 'silsilah-keluarga.png';
        link.href = cvs.toDataURL('image/png');
        link.click();
        
        URL.revokeObjectURL(url);
        showToast('Pohon keluarga berhasil diunduh!', 'success');
    };

    img.onerror = () => {
        // Fallback: download SVG
        const link = document.createElement('a');
        link.download = 'silsilah-keluarga.svg';
        link.href = url;
        link.click();
        showToast('Pohon keluarga berhasil diunduh sebagai SVG!', 'success');
    };

    img.src = url;
}
