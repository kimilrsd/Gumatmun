<?php
$db = new SQLite3('database/silsilah.db');
$res = $db->query("SELECT id, name, photo FROM members WHERE photo != '' AND photo IS NOT NULL");
while($row = $res->fetchArray(SQLITE3_ASSOC)) {
    echo "{$row['id']} | {$row['name']} | Photo: {$row['photo']}\n";
}
