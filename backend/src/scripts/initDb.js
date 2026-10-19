const { getPool, initSchema, testConnection, closePool } = require('../models/db');
const config = require('../config');

async function run() {
  console.log(`[InitDB] Connecting to MySQL at: ${config.db.host}:${config.db.port}/${config.db.database}`);
  const pool = getPool();

  try {
    await testConnection(pool);
    console.log('[InitDB] Connected successfully to MySQL.');

    await initSchema(pool);
    console.log('[InitDB] Schema created/verified successfully.');

    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log('[InitDB] Verified Tables in Database:', tableNames.join(', '));
  } finally {
    await closePool();
  }

  console.log('[InitDB] Database initialization completed.');
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[InitDB] Initialization failed:', err.message);
      process.exit(1);
    });
}

module.exports = { run };
