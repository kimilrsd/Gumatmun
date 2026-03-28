<?php
/**
 * API endpoint for Silsilah Keluarga
 * Handles all CRUD operations and authentication
 */

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');

require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    $db = getDB();
    
    switch ($action) {
        // ============ AUTH ============
        case 'login':
            handleLogin($db);
            break;
        case 'logout':
            handleLogout();
            break;
        case 'check_auth':
            checkAuth();
            break;
            
        // ============ FAMILIES ============
        case 'get_families':
            getFamilies($db);
            break;
        case 'add_family':
            requireAuth();
            addFamily($db);
            break;
        case 'update_family':
            requireAuth();
            updateFamily($db);
            break;
        case 'delete_family':
            requireAuth();
            deleteFamily($db);
            break;
            
        // ============ MEMBERS ============
        case 'get_members':
            getMembers($db);
            break;
        case 'get_member':
            getMember($db);
            break;
        case 'add_member':
            requireAuth();
            addMember($db);
            break;
        case 'update_member':
            requireAuth();
            updateMember($db);
            break;
        case 'delete_member':
            requireAuth();
            deleteMember($db);
            break;
            
        // ============ TREE ============
        case 'get_tree':
            getTree($db);
            break;
            
        // ============ STATS ============
        case 'get_stats':
            getStats($db);
            break;
            
        // ============ SEARCH ============
        case 'search':
            searchMembers($db);
            break;
            
        // ============ PHOTO ============
        case 'upload_photo':
            requireAuth();
            uploadPhoto();
            break;
            
        // ============ GALLERY ============
        case 'get_gallery':
            getGallery($db);
            break;
        case 'add_gallery_photo':
            requireAuth();
            addGalleryPhoto($db);
            break;
        case 'delete_gallery_photo':
            requireAuth();
            deleteGalleryPhoto($db);
            break;
            
        default:
            jsonResponse(['error' => 'Invalid action'], 400);
    }
} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}

// ==================== HELPER FUNCTIONS ====================

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function requireAuth() {
    if (empty($_SESSION['user_id'])) {
        jsonResponse(['error' => 'Unauthorized'], 401);
    }
}

function getPostData() {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    // Try JSON explicitly
    if (strpos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        return json_decode($raw, true) ?? [];
    }
    // Fallback: If $_POST is empty, try to parse raw input as JSON anyway
    if (empty($_POST)) {
        $raw = file_get_contents('php://input');
        if (!empty($raw)) {
            $json = json_decode($raw, true);
            if (is_array($json)) return $json;
        }
    }
    return $_POST;
}

// ==================== FAMILY HANDLERS ====================

function getFamilies($db) {
    $result = $db->query("SELECT f.*, 
        (SELECT COUNT(*) FROM members WHERE family_id = f.id) as member_count
        FROM families f ORDER BY f.name");
    $families = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $families[] = $row;
    }
    jsonResponse(['families' => $families]);
}

function addFamily($db) {
    $data = getPostData();
    $name = trim($data['name'] ?? '');
    if (empty($name)) jsonResponse(['error' => 'Nama keluarga harus diisi'], 400);
    
    $stmt = $db->prepare("INSERT INTO families (name, description, color) VALUES (:name, :desc, :color)");
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':desc', $data['description'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':color', $data['color'] ?? '#3b82f6', SQLITE3_TEXT);
    $stmt->execute();
    
    jsonResponse(['success' => true, 'id' => $db->lastInsertRowID(), 'message' => 'Keluarga berhasil ditambahkan']);
}

function updateFamily($db) {
    $data = getPostData();
    $id = (int)($data['id'] ?? 0);
    $name = trim($data['name'] ?? '');
    if ($id <= 0) jsonResponse(['error' => 'Invalid family ID'], 400);
    if (empty($name)) jsonResponse(['error' => 'Nama keluarga harus diisi'], 400);
    
    $stmt = $db->prepare("UPDATE families SET name = :name, description = :desc, color = :color WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':desc', $data['description'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':color', $data['color'] ?? '#3b82f6', SQLITE3_TEXT);
    $stmt->execute();
    
    jsonResponse(['success' => true, 'message' => 'Keluarga berhasil diperbarui']);
}

function deleteFamily($db) {
    $data = getPostData();
    $id = (int)($data['id'] ?? 0);
    if ($id <= 0) jsonResponse(['error' => 'Invalid family ID'], 400);
    
    // Clear family_id from members
    $db->exec("UPDATE members SET family_id = NULL WHERE family_id = $id");
    
    $stmt = $db->prepare("DELETE FROM families WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    
    jsonResponse(['success' => true, 'message' => 'Keluarga berhasil dihapus']);
}

// ==================== AUTH HANDLERS ======================================

function handleLogin($db) {
    $data = getPostData();
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        jsonResponse(['error' => 'Username dan password harus diisi'], 400);
    }
    
    $stmt = $db->prepare("SELECT * FROM users WHERE username = :u");
    $stmt->bindValue(':u', $username, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonResponse(['error' => 'Username atau password salah'], 401);
    }
    
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'];
    
    jsonResponse([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'role' => $user['role']
        ]
    ]);
}

function handleLogout() {
    session_destroy();
    jsonResponse(['success' => true]);
}

function checkAuth() {
    if (!empty($_SESSION['user_id'])) {
        jsonResponse([
            'authenticated' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'role' => $_SESSION['role']
            ]
        ]);
    } else {
        jsonResponse(['authenticated' => false]);
    }
}

// ==================== MEMBER HANDLERS ====================

function getMembers($db) {
    $sort = $_GET['sort'] ?? 'name';
    $order = strtoupper($_GET['order'] ?? 'ASC');
    $order = in_array($order, ['ASC', 'DESC']) ? $order : 'ASC';
    
    $validSorts = ['name', 'generation', 'birth_date', 'created_at', 'gender'];
    $sort = in_array($sort, $validSorts) ? $sort : 'name';
    
    $gen = $_GET['generation'] ?? '';
    $gender = $_GET['gender'] ?? '';
    $familyId = $_GET['family_id'] ?? '';
    
    $where = [];
    $params = [];
    
    if ($gen !== '' && is_numeric($gen)) {
        $where[] = "m.generation = :gen";
        $params[':gen'] = (int)$gen;
    }
    if ($gender !== '' && in_array($gender, ['L', 'P'])) {
        $where[] = "m.gender = :gender";
        $params[':gender'] = $gender;
    }
    if ($familyId !== '' && is_numeric($familyId)) {
        $where[] = "m.family_id = :family_id";
        $params[':family_id'] = (int)$familyId;
    }
    
    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';
    
    $sql = "SELECT m.*, 
            f.name as father_name, 
            mo.name as mother_name, 
            s.name as spouse_name
            FROM members m
            LEFT JOIN members f ON m.father_id = f.id
            LEFT JOIN members mo ON m.mother_id = mo.id
            LEFT JOIN members s ON m.spouse_id = s.id
            $whereClause
            ORDER BY m.$sort $order";
    
    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    
    $result = $stmt->execute();
    $members = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $members[] = $row;
    }
    
    jsonResponse(['members' => $members, 'total' => count($members)]);
}

function getMember($db) {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['error' => 'Invalid member ID'], 400);
    }
    
    $stmt = $db->prepare("SELECT m.*, 
        f.name as father_name, 
        mo.name as mother_name, 
        s.name as spouse_name
        FROM members m
        LEFT JOIN members f ON m.father_id = f.id
        LEFT JOIN members mo ON m.mother_id = mo.id
        LEFT JOIN members s ON m.spouse_id = s.id
        WHERE m.id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $member = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$member) {
        jsonResponse(['error' => 'Member not found'], 404);
    }
    
    // Get children
    $stmt = $db->prepare("SELECT id, name, nickname, gender, birth_date, photo 
        FROM members WHERE father_id = :id OR mother_id = :id ORDER BY birth_date");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $children = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $children[] = $row;
    }
    $member['children'] = $children;
    
    // Get siblings
    if ($member['father_id'] || $member['mother_id']) {
        $sibWhere = [];
        $sibParams = [':self_id' => $id];
        if ($member['father_id']) {
            $sibWhere[] = "father_id = :fid";
            $sibParams[':fid'] = $member['father_id'];
        }
        if ($member['mother_id']) {
            $sibWhere[] = "mother_id = :mid";
            $sibParams[':mid'] = $member['mother_id'];
        }
        $sibSql = "SELECT id, name, nickname, gender, birth_date, photo FROM members WHERE (" . implode(' OR ', $sibWhere) . ") AND id != :self_id ORDER BY birth_date";
        $stmt = $db->prepare($sibSql);
        foreach ($sibParams as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $result = $stmt->execute();
        $siblings = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $siblings[] = $row;
        }
        $member['siblings'] = $siblings;
    } else {
        $member['siblings'] = [];
    }
    
    jsonResponse(['member' => $member]);
}

function addMember($db) {
    $data = getPostData();
    $name = trim($data['name'] ?? '');
    
    if (empty($name)) {
        jsonResponse(['error' => 'Nama harus diisi'], 400);
    }
    
    $stmt = $db->prepare("INSERT INTO members (family_id, name, nickname, gender, birth_date, birth_place, death_date, death_place, photo, bio, phone, email, address, occupation, father_id, mother_id, spouse_id, generation, is_root) 
        VALUES (:family_id, :name, :nickname, :gender, :birth_date, :birth_place, :death_date, :death_place, :photo, :bio, :phone, :email, :address, :occupation, :father_id, :mother_id, :spouse_id, :generation, :is_root)");
    
    $stmt->bindValue(':family_id', !empty($data['family_id']) ? (int)$data['family_id'] : null);
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':nickname', $data['nickname'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':gender', $data['gender'] ?? 'L', SQLITE3_TEXT);
    $stmt->bindValue(':birth_date', $data['birth_date'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':birth_place', $data['birth_place'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':death_date', $data['death_date'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':death_place', $data['death_place'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':photo', $data['photo'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':bio', $data['bio'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':phone', $data['phone'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':email', $data['email'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':address', $data['address'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':occupation', $data['occupation'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':father_id', !empty($data['father_id']) ? (int)$data['father_id'] : null);
    $stmt->bindValue(':mother_id', !empty($data['mother_id']) ? (int)$data['mother_id'] : null);
    $stmt->bindValue(':spouse_id', !empty($data['spouse_id']) ? (int)$data['spouse_id'] : null);
    $stmt->bindValue(':generation', (int)($data['generation'] ?? 1), SQLITE3_INTEGER);
    $stmt->bindValue(':is_root', (int)($data['is_root'] ?? 0), SQLITE3_INTEGER);
    
    $stmt->execute();
    $newId = $db->lastInsertRowID();
    
    // Update spouse back-reference
    if (!empty($data['spouse_id'])) {
        $stmt2 = $db->prepare("UPDATE members SET spouse_id = :new_id WHERE id = :spouse_id AND (spouse_id IS NULL OR spouse_id = 0)");
        $stmt2->bindValue(':new_id', $newId, SQLITE3_INTEGER);
        $stmt2->bindValue(':spouse_id', (int)$data['spouse_id'], SQLITE3_INTEGER);
        $stmt2->execute();
    }
    
    jsonResponse(['success' => true, 'id' => $newId, 'message' => 'Anggota berhasil ditambahkan']);
}

function updateMember($db) {
    $data = getPostData();
    $id = (int)($data['id'] ?? 0);
    $name = trim($data['name'] ?? '');
    
    if ($id <= 0) jsonResponse(['error' => 'Invalid member ID'], 400);
    if (empty($name)) jsonResponse(['error' => 'Nama harus diisi'], 400);
    
    // Get old spouse to clear back-reference
    $old = $db->querySingle("SELECT spouse_id FROM members WHERE id = $id");
    
    $stmt = $db->prepare("UPDATE members SET 
        family_id = :family_id,
        name = :name, nickname = :nickname, gender = :gender, 
        birth_date = :birth_date, birth_place = :birth_place, 
        death_date = :death_date, death_place = :death_place, 
        photo = :photo, bio = :bio, phone = :phone, email = :email, 
        address = :address, occupation = :occupation,
        father_id = :father_id, mother_id = :mother_id, spouse_id = :spouse_id,
        generation = :generation, is_root = :is_root,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = :id");
    
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->bindValue(':family_id', !empty($data['family_id']) ? (int)$data['family_id'] : null);
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':nickname', $data['nickname'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':gender', $data['gender'] ?? 'L', SQLITE3_TEXT);
    $stmt->bindValue(':birth_date', $data['birth_date'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':birth_place', $data['birth_place'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':death_date', $data['death_date'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':death_place', $data['death_place'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':photo', $data['photo'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':bio', $data['bio'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':phone', $data['phone'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':email', $data['email'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':address', $data['address'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':occupation', $data['occupation'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':father_id', !empty($data['father_id']) ? (int)$data['father_id'] : null);
    $stmt->bindValue(':mother_id', !empty($data['mother_id']) ? (int)$data['mother_id'] : null);
    $stmt->bindValue(':spouse_id', !empty($data['spouse_id']) ? (int)$data['spouse_id'] : null);
    $stmt->bindValue(':generation', (int)($data['generation'] ?? 1), SQLITE3_INTEGER);
    $stmt->bindValue(':is_root', (int)($data['is_root'] ?? 0), SQLITE3_INTEGER);
    
    $stmt->execute();
    
    // Clear old spouse back-reference
    if ($old && $old != ($data['spouse_id'] ?? null)) {
        $db->exec("UPDATE members SET spouse_id = NULL WHERE id = $old AND spouse_id = $id");
    }
    
    // Set new spouse back-reference
    if (!empty($data['spouse_id'])) {
        $newSpouse = (int)$data['spouse_id'];
        $stmt2 = $db->prepare("UPDATE members SET spouse_id = :id WHERE id = :spouse_id");
        $stmt2->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmt2->bindValue(':spouse_id', $newSpouse, SQLITE3_INTEGER);
        $stmt2->execute();
    }
    
    jsonResponse(['success' => true, 'message' => 'Anggota berhasil diperbarui']);
}

function deleteMember($db) {
    $data = getPostData();
    $id = (int)($data['id'] ?? $_GET['id'] ?? 0);
    
    if ($id <= 0) jsonResponse(['error' => 'Invalid member ID'], 400);
    
    // Clear references to this member
    $db->exec("UPDATE members SET father_id = NULL WHERE father_id = $id");
    $db->exec("UPDATE members SET mother_id = NULL WHERE mother_id = $id");
    $db->exec("UPDATE members SET spouse_id = NULL WHERE spouse_id = $id");
    
    // Delete photo file
    $photo = $db->querySingle("SELECT photo FROM members WHERE id = $id");
    if ($photo && file_exists(__DIR__ . '/' . $photo)) {
        unlink(__DIR__ . '/' . $photo);
    }
    
    $stmt = $db->prepare("DELETE FROM members WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    
    jsonResponse(['success' => true, 'message' => 'Anggota berhasil dihapus']);
}

// ==================== TREE HANDLER ====================

function getTree($db) {
    $familyId = $_GET['family_id'] ?? '';
    
    $sql = "SELECT id, name, nickname, gender, birth_date, death_date, photo, occupation, 
        father_id, mother_id, spouse_id, generation, is_root, family_id 
        FROM members";
    
    if ($familyId !== '' && is_numeric($familyId)) {
        $sql .= " WHERE family_id = :family_id 
                  OR id IN (SELECT father_id FROM members WHERE family_id = :family_id)
                  OR id IN (SELECT mother_id FROM members WHERE family_id = :family_id)
                  OR id IN (SELECT spouse_id FROM members WHERE family_id = :family_id)
                  OR spouse_id IN (SELECT id FROM members WHERE family_id = :family_id)";
    }
    
    $sql .= " ORDER BY generation, birth_date";
    
    $stmt = $db->prepare($sql);
    if ($familyId !== '' && is_numeric($familyId)) {
        $stmt->bindValue(':family_id', (int)$familyId, SQLITE3_INTEGER);
    }
    $result = $stmt->execute();
    
    $members = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $members[] = $row;
    }
    
    // Build tree structure starting from root members
    $tree = buildTreeNodes($members);
    
    jsonResponse(['tree' => $tree, 'members' => $members]);
}

function buildTreeNodes($members) {
    $byId = [];
    foreach ($members as $m) {
        $byId[$m['id']] = $m;
        $byId[$m['id']]['children'] = [];
    }
    
    $roots = [];
    foreach ($members as $m) {
        $id = $m['id'];
        $fid = $m['father_id'];
        $mid = $m['mother_id'];
        
        // Determine if member should be rendered as a spouse (attached to another node)
        // rather than a root or a child.
        if ($m['spouse_id'] && !$m['father_id'] && !$m['mother_id'] && !$m['is_root']) {
            $sId = $m['spouse_id'];
            if (isset($byId[$sId])) {
                $spouse = $byId[$sId];
                $spouseIsFloating = !$spouse['father_id'] && !$spouse['mother_id'] && !$spouse['is_root'];
                // If the spouse is also floating, use ID to decide deterministically who is the root
                if (!$spouseIsFloating || $id > $sId) {
                    continue; // Skip rendering as root/child, it will be rendered next to spouse
                }
            }
        }
        
        $addedAsChild = false;
        if ($fid && isset($byId[$fid])) {
            $byId[$fid]['children'][] = $id;
            $addedAsChild = true;
        } 
        if ($mid && isset($byId[$mid])) {
            $byId[$mid]['children'][] = $id;
            $addedAsChild = true;
        }
        
        // If not added as a child to anyone, and not skipped as a spouse -> must be root
        if (!$addedAsChild) {
            $roots[] = $id;
        }
    }
    
    return ['roots' => $roots, 'nodes' => $byId];
}

// ==================== STATS HANDLER ====================

function getStats($db) {
    $familyId = $_GET['family_id'] ?? '';
    $familyFilter = '';
    $params = [];
    
    if ($familyId !== '' && is_numeric($familyId)) {
        $familyFilter = ' WHERE family_id = :family_id';
        $params[':family_id'] = (int)$familyId;
    }
    
    $bindAndQuery = function($sql) use ($db, $params) {
        $stmt = $db->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v, SQLITE3_INTEGER);
        }
        return $stmt->execute();
    };
    
    $total = $db->querySingle("SELECT COUNT(*) FROM members" . $familyFilter . ($params ? '' : ''));
    if ($familyId !== '' && is_numeric($familyId)) {
        $stmt = $db->prepare("SELECT COUNT(*) FROM members WHERE family_id = :fid");
        $stmt->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $total = $stmt->execute()->fetchArray()[0];
        
        $stmt = $db->prepare("SELECT COUNT(*) FROM members WHERE gender = 'L' AND family_id = :fid");
        $stmt->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $male = $stmt->execute()->fetchArray()[0];
        
        $stmt = $db->prepare("SELECT COUNT(*) FROM members WHERE gender = 'P' AND family_id = :fid");
        $stmt->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $female = $stmt->execute()->fetchArray()[0];
        
        $stmt = $db->prepare("SELECT COUNT(*) FROM members WHERE (death_date = '' OR death_date IS NULL) AND family_id = :fid");
        $stmt->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $living = $stmt->execute()->fetchArray()[0];
        
        $stmt = $db->prepare("SELECT COUNT(*) FROM members WHERE death_date != '' AND death_date IS NOT NULL AND family_id = :fid");
        $stmt->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $deceased = $stmt->execute()->fetchArray()[0];
        
        $stmt = $db->prepare("SELECT MAX(generation) FROM members WHERE family_id = :fid");
        $stmt->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $maxGen = $stmt->execute()->fetchArray()[0];
        
        $stmt = $db->prepare("SELECT generation, COUNT(*) as count FROM members WHERE family_id = :fid GROUP BY generation ORDER BY generation");
        $stmt->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $result = $stmt->execute();
        
        $stmt2 = $db->prepare("SELECT occupation, COUNT(*) as count FROM members WHERE occupation != '' AND family_id = :fid GROUP BY occupation ORDER BY count DESC LIMIT 10");
        $stmt2->bindValue(':fid', (int)$familyId, SQLITE3_INTEGER);
        $result2 = $stmt2->execute();
    } else {
        $total = $db->querySingle("SELECT COUNT(*) FROM members");
        $male = $db->querySingle("SELECT COUNT(*) FROM members WHERE gender = 'L'");
        $female = $db->querySingle("SELECT COUNT(*) FROM members WHERE gender = 'P'");
        $living = $db->querySingle("SELECT COUNT(*) FROM members WHERE death_date = '' OR death_date IS NULL");
        $deceased = $db->querySingle("SELECT COUNT(*) FROM members WHERE death_date != '' AND death_date IS NOT NULL");
        $maxGen = $db->querySingle("SELECT MAX(generation) FROM members");
        
        $result = $db->query("SELECT generation, COUNT(*) as count FROM members GROUP BY generation ORDER BY generation");
        $result2 = $db->query("SELECT occupation, COUNT(*) as count FROM members WHERE occupation != '' GROUP BY occupation ORDER BY count DESC LIMIT 10");
    }
    
    // Members per generation
    $generations = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $generations[] = $row;
    }
    
    // Occupation distribution
    $occupations = [];
    while ($row = $result2->fetchArray(SQLITE3_ASSOC)) {
        $occupations[] = $row;
    }
    
    jsonResponse([
        'total_members' => $total,
        'male' => $male,
        'female' => $female,
        'living' => $living,
        'deceased' => $deceased,
        'max_generation' => $maxGen,
        'generations' => $generations,
        'occupations' => $occupations
    ]);
}

// ==================== SEARCH HANDLER ====================

function searchMembers($db) {
    $q = trim($_GET['q'] ?? '');
    if (empty($q)) {
        jsonResponse(['members' => [], 'total' => 0]);
    }
    
    $stmt = $db->prepare("SELECT m.*, 
        f.name as father_name, 
        mo.name as mother_name, 
        s.name as spouse_name
        FROM members m
        LEFT JOIN members f ON m.father_id = f.id
        LEFT JOIN members mo ON m.mother_id = mo.id
        LEFT JOIN members s ON m.spouse_id = s.id
        WHERE m.name LIKE :q OR m.nickname LIKE :q OR m.occupation LIKE :q OR m.birth_place LIKE :q OR m.address LIKE :q
        ORDER BY m.name ASC
        LIMIT 50");
    $stmt->bindValue(':q', "%$q%", SQLITE3_TEXT);
    $result = $stmt->execute();
    
    $members = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $members[] = $row;
    }
    
    jsonResponse(['members' => $members, 'total' => count($members)]);
}

// ==================== PHOTO HANDLER ====================

function uploadPhoto() {
    if (empty($_FILES['photo'])) {
        jsonResponse(['error' => 'No file uploaded'], 400);
    }
    
    $file = $_FILES['photo'];
    $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!in_array($file['type'], $allowed)) {
        jsonResponse(['error' => 'Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.'], 400);
    }
    
    if ($file['size'] > 5 * 1024 * 1024) {
        jsonResponse(['error' => 'Ukuran file terlalu besar. Maksimal 5MB.'], 400);
    }
    
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'member_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $uploadDir = __DIR__ . '/uploads/';
    
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $target = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $target)) {
        jsonResponse(['success' => true, 'path' => 'uploads/' . $filename]);
    } else {
        jsonResponse(['error' => 'Gagal mengupload file'], 500);
    }
}

// ==================== GALLERY HANDLERS ====================

function getGallery($db) {
    $familyId = $_GET['family_id'] ?? '';
    
    $where = [];
    $params = [];
    if ($familyId !== '' && is_numeric($familyId)) {
        $where[] = "family_id = :family_id";
        $params[':family_id'] = (int)$familyId;
    }
    
    $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';
    $sql = "SELECT p.*, f.name as family_name FROM family_photos p LEFT JOIN families f ON p.family_id = f.id $whereClause ORDER BY p.created_at DESC";
    
    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    
    $result = $stmt->execute();
    $photos = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $photos[] = $row;
    }
    
    jsonResponse(['photos' => $photos]);
}

function addGalleryPhoto($db) {
    if (empty($_FILES['photo'])) {
        jsonResponse(['error' => 'No file uploaded'], 400);
    }
    
    $title = $_POST['title'] ?? '';
    $desc = $_POST['description'] ?? '';
    $familyId = !empty($_POST['family_id']) ? (int)$_POST['family_id'] : null;
    
    if (empty($title)) {
        jsonResponse(['error' => 'Judul foto harus diisi'], 400);
    }
    
    $file = $_FILES['photo'];
    $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!in_array($file['type'], $allowed)) {
        jsonResponse(['error' => 'Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.'], 400);
    }
    
    // Size limit up to 15MB for gallery
    if ($file['size'] > 15 * 1024 * 1024) {
        jsonResponse(['error' => 'Ukuran file terlalu besar. Maksimal 15MB.'], 400);
    }
    
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'gallery_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $uploadDir = __DIR__ . '/uploads/';
    
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $target = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $target)) {
        $path = 'uploads/' . $filename;
        $stmt = $db->prepare("INSERT INTO family_photos (family_id, title, description, file_path) VALUES (:family_id, :title, :description, :file_path)");
        $stmt->bindValue(':family_id', $familyId);
        $stmt->bindValue(':title', $title, SQLITE3_TEXT);
        $stmt->bindValue(':description', $desc, SQLITE3_TEXT);
        $stmt->bindValue(':file_path', $path, SQLITE3_TEXT);
        $stmt->execute();
        
        jsonResponse(['success' => true, 'message' => 'Foto berhasil ditambahkan ke Arsip Kalbu']);
    } else {
        jsonResponse(['error' => 'Gagal mengupload file'], 500);
    }
}

function deleteGalleryPhoto($db) {
    $data = getPostData();
    $id = (int)($data['id'] ?? 0);
    
    if ($id <= 0) jsonResponse(['error' => 'Invalid photo ID'], 400);
    
    $photo = $db->querySingle("SELECT file_path FROM family_photos WHERE id = $id");
    if ($photo && file_exists(__DIR__ . '/' . $photo)) {
        unlink(__DIR__ . '/' . $photo);
    }
    
    $stmt = $db->prepare("DELETE FROM family_photos WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    
    jsonResponse(['success' => true, 'message' => 'Foto berhasil dihapus dari Arsip Kalbu']);
}

