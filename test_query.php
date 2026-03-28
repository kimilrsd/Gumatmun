<?php
$db = new SQLite3('database/silsilah.db');
$res = $db->query("SELECT id, name, father_id, mother_id, spouse_id, is_root FROM members WHERE family_id = 8");
while($row = $res->fetchArray(SQLITE3_ASSOC)) print_r($row);
