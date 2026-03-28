<?php
/**
 * Database initialization and connection for Silsilah Keluarga
 * Uses SQLite for zero-configuration setup
 */

define('DB_PATH', __DIR__ . '/database/silsilah.db');

function getDB() {
    static $db = null;
    if ($db === null) {
        $dbDir = dirname(DB_PATH);
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0777, true);
        }
        $db = new SQLite3(DB_PATH);
        $db->enableExceptions(true);
        $db->exec('PRAGMA journal_mode=WAL');
        $db->exec('PRAGMA foreign_keys=ON');
        initializeDatabase($db);
    }
    return $db;
}

function initializeDatabase($db) {
    // Users table for admin authentication
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT DEFAULT '',
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Families table for multiple family branches
    $db->exec("CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        color TEXT DEFAULT '#3b82f6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Members table for family tree data
    $db->exec("CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER DEFAULT NULL,
        name TEXT NOT NULL,
        nickname TEXT DEFAULT '',
        gender TEXT CHECK(gender IN ('L','P')) NOT NULL DEFAULT 'L',
        birth_date TEXT DEFAULT '',
        birth_place TEXT DEFAULT '',
        death_date TEXT DEFAULT '',
        death_place TEXT DEFAULT '',
        photo TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        address TEXT DEFAULT '',
        occupation TEXT DEFAULT '',
        father_id INTEGER DEFAULT NULL,
        mother_id INTEGER DEFAULT NULL,
        spouse_id INTEGER DEFAULT NULL,
        generation INTEGER DEFAULT 1,
        is_root INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL,
        FOREIGN KEY (father_id) REFERENCES members(id) ON DELETE SET NULL,
        FOREIGN KEY (mother_id) REFERENCES members(id) ON DELETE SET NULL
    )");

    // Family photos table (Arsip Kalbu)
    $db->exec("CREATE TABLE IF NOT EXISTS family_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER DEFAULT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        file_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL
    )");

    // Migration: add family_id column if it doesn't exist (for existing databases)
    try {
        $db->exec("ALTER TABLE members ADD COLUMN family_id INTEGER DEFAULT NULL REFERENCES families(id) ON DELETE SET NULL");
    } catch (Exception $e) {
        // Column already exists, ignore
    }

    // Seed default admin if no users exist
    $result = $db->querySingle("SELECT COUNT(*) FROM users");
    if ($result == 0) {
        $hash = password_hash('admin123', PASSWORD_DEFAULT);
        $stmt = $db->prepare("INSERT INTO users (username, password_hash, full_name, role) VALUES (:u, :p, :n, :r)");
        $stmt->bindValue(':u', 'admin', SQLITE3_TEXT);
        $stmt->bindValue(':p', $hash, SQLITE3_TEXT);
        $stmt->bindValue(':n', 'Administrator', SQLITE3_TEXT);
        $stmt->bindValue(':r', 'admin', SQLITE3_TEXT);
        $stmt->execute();
    }

    // Seed sample families and members if no families exist
    $result = $db->querySingle("SELECT COUNT(*) FROM families");
    if ($result == 0) {
        seedSampleData($db);
    }
}

function seedSampleData($db) {
    // Create sample family
    $db->exec("INSERT INTO families (name, description, color) VALUES ('Keluarga Suryadi', 'Keluarga besar H. Ahmad Suryadi dari Surabaya', '#3b82f6')");
    $familyId = $db->lastInsertRowID();

    $members = [
        // Generation 1 - Kakek & Nenek
        ['name' => 'H. Ahmad Suryadi', 'nickname' => 'Pak Ahmad', 'gender' => 'L', 'birth_date' => '1940-03-15', 'birth_place' => 'Surabaya', 'death_date' => '2015-08-20', 'occupation' => 'Pensiunan PNS', 'generation' => 1, 'is_root' => 1, 'bio' => 'Pendiri keluarga besar Suryadi. Seorang pegawai negeri sipil yang mengabdi selama 35 tahun.'],
        ['name' => 'Hj. Siti Aminah', 'nickname' => 'Bu Aminah', 'gender' => 'P', 'birth_date' => '1945-07-22', 'birth_place' => 'Malang', 'occupation' => 'Ibu Rumah Tangga', 'generation' => 1, 'bio' => 'Istri setia H. Ahmad Suryadi. Dikenal sebagai sosok yang lemah lembut dan penyayang.'],
        
        // Generation 2 - Anak-anak
        ['name' => 'Ir. Budi Suryadi', 'nickname' => 'Pak Budi', 'gender' => 'L', 'birth_date' => '1965-01-10', 'birth_place' => 'Surabaya', 'occupation' => 'Insinyur Sipil', 'generation' => 2, 'bio' => 'Anak pertama dari H. Ahmad Suryadi. Lulusan teknik sipil ITS.'],
        ['name' => 'Dr. Dewi Suryadi', 'nickname' => 'Bu Dewi', 'gender' => 'P', 'birth_date' => '1968-05-14', 'birth_place' => 'Surabaya', 'occupation' => 'Dokter Umum', 'generation' => 2, 'bio' => 'Anak kedua dari H. Ahmad Suryadi. Praktik di RS Hasan Sadikin.'],
        ['name' => 'Eko Suryadi', 'nickname' => 'Pak Eko', 'gender' => 'L', 'birth_date' => '1972-11-30', 'birth_place' => 'Surabaya', 'occupation' => 'Wiraswasta', 'generation' => 2, 'bio' => 'Anak ketiga sekaligus bungsu dari H. Ahmad Suryadi.'],

        // Pasangan Gen 2
        ['name' => 'Ratna Kusuma', 'nickname' => 'Bu Ratna', 'gender' => 'P', 'birth_date' => '1967-09-05', 'birth_place' => 'Bandung', 'occupation' => 'Guru SMA', 'generation' => 2, 'bio' => 'Istri Ir. Budi Suryadi. Guru bahasa Inggris.'],
        ['name' => 'Dr. Hendra Wijaya', 'nickname' => 'Pak Hendra', 'gender' => 'L', 'birth_date' => '1966-03-18', 'birth_place' => 'Jakarta', 'occupation' => 'Dokter Spesialis', 'generation' => 2, 'bio' => 'Suami Dr. Dewi Suryadi. Dokter spesialis penyakit dalam.'],
        ['name' => 'Maya Sari', 'nickname' => 'Bu Maya', 'gender' => 'P', 'birth_date' => '1975-12-08', 'birth_place' => 'Yogyakarta', 'occupation' => 'Desainer Interior', 'generation' => 2, 'bio' => 'Istri Eko Suryadi.'],

        // Generation 3 - Cucu
        ['name' => 'Andi Suryadi', 'nickname' => 'Andi', 'gender' => 'L', 'birth_date' => '1990-04-25', 'birth_place' => 'Surabaya', 'occupation' => 'Software Engineer', 'generation' => 3, 'bio' => 'Anak pertama Ir. Budi Suryadi. Bekerja di perusahaan teknologi.'],
        ['name' => 'Citra Suryadi', 'nickname' => 'Citra', 'gender' => 'P', 'birth_date' => '1993-08-12', 'birth_place' => 'Surabaya', 'occupation' => 'Arsitek', 'generation' => 3, 'bio' => 'Anak kedua Ir. Budi Suryadi.'],
        ['name' => 'Fajar Wijaya', 'nickname' => 'Fajar', 'gender' => 'L', 'birth_date' => '1992-02-14', 'birth_place' => 'Jakarta', 'occupation' => 'Dokter Gigi', 'generation' => 3, 'bio' => 'Anak pertama Dr. Dewi Suryadi.'],
        ['name' => 'Nadia Wijaya', 'nickname' => 'Nadia', 'gender' => 'P', 'birth_date' => '1995-06-30', 'birth_place' => 'Jakarta', 'occupation' => 'Dosen', 'generation' => 3, 'bio' => 'Anak kedua Dr. Dewi Suryadi.'],
        ['name' => 'Rizki Suryadi', 'nickname' => 'Rizki', 'gender' => 'L', 'birth_date' => '1998-10-05', 'birth_place' => 'Surabaya', 'occupation' => 'Mahasiswa', 'generation' => 3, 'bio' => 'Anak tunggal Eko Suryadi.'],
    ];

    foreach ($members as $m) {
        $stmt = $db->prepare("INSERT INTO members (family_id, name, nickname, gender, birth_date, birth_place, death_date, occupation, generation, is_root, bio) 
            VALUES (:family_id, :name, :nickname, :gender, :birth_date, :birth_place, :death_date, :occupation, :generation, :is_root, :bio)");
        $stmt->bindValue(':family_id', $familyId, SQLITE3_INTEGER);
        $stmt->bindValue(':name', $m['name'], SQLITE3_TEXT);
        $stmt->bindValue(':nickname', $m['nickname'], SQLITE3_TEXT);
        $stmt->bindValue(':gender', $m['gender'], SQLITE3_TEXT);
        $stmt->bindValue(':birth_date', $m['birth_date'], SQLITE3_TEXT);
        $stmt->bindValue(':birth_place', $m['birth_place'], SQLITE3_TEXT);
        $stmt->bindValue(':death_date', $m['death_date'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':occupation', $m['occupation'], SQLITE3_TEXT);
        $stmt->bindValue(':generation', $m['generation'] ?? 1, SQLITE3_INTEGER);
        $stmt->bindValue(':is_root', $m['is_root'] ?? 0, SQLITE3_INTEGER);
        $stmt->bindValue(':bio', $m['bio'] ?? '', SQLITE3_TEXT);
        $stmt->execute();
    }

    // Set relationships
    // H. Ahmad (1) married to Hj. Siti (2)
    $db->exec("UPDATE members SET spouse_id = 2 WHERE id = 1");
    $db->exec("UPDATE members SET spouse_id = 1 WHERE id = 2");
    
    // Budi (3), Dewi (4), Eko (5) are children of Ahmad & Siti
    $db->exec("UPDATE members SET father_id = 1, mother_id = 2 WHERE id IN (3,4,5)");
    
    // Budi (3) married Ratna (6)
    $db->exec("UPDATE members SET spouse_id = 6 WHERE id = 3");
    $db->exec("UPDATE members SET spouse_id = 3 WHERE id = 6");
    
    // Dewi (4) married Hendra (7)
    $db->exec("UPDATE members SET spouse_id = 7 WHERE id = 4");
    $db->exec("UPDATE members SET spouse_id = 4 WHERE id = 7");
    
    // Eko (5) married Maya (8)
    $db->exec("UPDATE members SET spouse_id = 8 WHERE id = 5");
    $db->exec("UPDATE members SET spouse_id = 5 WHERE id = 8");
    
    // Andi (9) & Citra (10) children of Budi & Ratna
    $db->exec("UPDATE members SET father_id = 3, mother_id = 6 WHERE id IN (9,10)");
    
    // Fajar (11) & Nadia (12) children of Dewi & Hendra (father=Hendra, mother=Dewi)
    $db->exec("UPDATE members SET father_id = 7, mother_id = 4 WHERE id IN (11,12)");
    
    // Rizki (13) child of Eko & Maya
    $db->exec("UPDATE members SET father_id = 5, mother_id = 8 WHERE id = 13");
}
