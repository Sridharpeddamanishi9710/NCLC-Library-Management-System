const { getDb, initSchema, closeDb } = require('../models/db');
const config = require('../config');

function run() {
  console.log(`[InitDB] Initializing database at: ${config.dbPath}`);
  const db = getDb();
  initSchema(db);

  const fkCheck = db.pragma('foreign_keys', { simple: true });
  console.log(`[InitDB] SQLite Foreign Keys Enabled: ${fkCheck === 1}`);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    .all();
  console.log('[InitDB] Created Tables:', tables.map((t) => t.name).join(', '));

  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    .all();
  console.log('[InitDB] Created Indexes:', indexes.map((i) => i.name).join(', '));

  closeDb();
  console.log('[InitDB] Database initialization completed successfully.');
}

if (require.main === module) {
  try {
    run();
  } catch (err) {
    console.error('[InitDB] Error initializing database:', err);
    process.exit(1);
  }
}

module.exports = { run };
