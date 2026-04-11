import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const db = new Database(path.join(os.tmpdir(), 'tauri_trimo_dev.db'));

const rows = db.prepare(`
  SELECT app_name, duration,
    CASE WHEN logo_base64 IS NULL THEN 'NULL' ELSE substr(logo_base64,1,30) END as logo_preview
  FROM app_usage
  WHERE date(timestamp) = date('now')
  ORDER BY duration DESC
`).all();

console.log(JSON.stringify(rows, null, 2));
db.close();
