<?php
require_once __DIR__ . '/db.php';

try {
    $db = getDB();
    
    // Attempt delete the family with ID 1 (or any existing family)
    $stmt = $db->prepare("DELETE FROM families WHERE id = 1");
    if (!$stmt->execute()) {
        echo "Error: " . $db->lastErrorMsg();
    } else {
        echo "Success deleting family 1! (Rollback manually if needed)";
    }
} catch (Exception $e) {
    echo "Exception: " . $e->getMessage();
}
