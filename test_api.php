<?php
require_once __DIR__ . '/db.php';

// Mock session and post data
$_SESSION['user_id'] = 1;
$_SERVER['CONTENT_TYPE'] = 'application/json';
$_SERVER['REQUEST_METHOD'] = 'POST';
$GLOBALS['test_json_input'] = json_encode(['id' => 1]);

// Override getPostData
function getPostData() {
    return json_decode($GLOBALS['test_json_input'], true);
}

// Function to mock jsonResponse
function jsonResponse($data, $code = 200) {
    echo "HTTP $code\n";
    echo json_encode($data);
    exit;
}

try {
    $db = getDB();
    
    // Clear family_id from members
    $id = 1;
    $db->exec("UPDATE members SET family_id = NULL WHERE family_id = $id");
    
    $stmt = $db->prepare("DELETE FROM families WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    
    jsonResponse(['success' => true, 'message' => 'Keluarga berhasil dihapus']);
} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
