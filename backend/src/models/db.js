const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let dbInstance = null;

/**
 * Gets or creates the SQLite database connection.
 * @param {string} [customPath] Optional path for testing or alternative database.
 * @returns {import('better-sqlite3').Database}
 */
function getDb(customPath) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbFilePath = customPath || config.dbPath;

  if (dbFilePath !== ':memory:') {
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  const db = new Database(dbFilePath);

  // Enable foreign key constraints and WAL mode for optimal performance and concurrency
  db.pragma('foreign_keys = ON');
  if (dbFilePath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

/**
 * Closes the active database connection.
 */
function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Executes the SQL schema to initialize tables and indexes.
 * @param {import('better-sqlite3').Database} [targetDb]
 */
function initSchema(targetDb) {
  const db = targetDb || getDb();
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Safe idempotent migration check for existing databases
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='loans'").get();
  if (tableCheck) {
    const cols = db.prepare("PRAGMA table_info(loans)").all().map((c) => c.name);
    if (!cols.includes('paid_amount')) {
      db.exec("ALTER TABLE loans ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0.0");
    }
  }
}


/**
 * Overrides the active database instance (useful for test isolation).
 * @param {import('better-sqlite3').Database|null} db
 */
function setDb(db) {
  dbInstance = db;
}

module.exports = {
  getDb,
  setDb,
  closeDb,
  initSchema,
};

