const mysql = require('mysql2/promise');
const config = require('../src/config');
const { setPool, initSchema } = require('../src/models/db');

let testPoolInstance = null;

const TEST_DB_NAME = process.env.DB_NAME_TEST || 'library_management_test';

/**
 * Ensures tests strictly run on the isolated test database.
 * Prevents any accidental execution against development database.
 */
async function setupTestDatabase() {
  if (config.db.database === 'library_management' && !process.env.DB_NAME_TEST) {
    throw new Error(
      "SAFETY VIOLATION: Tests attempted to execute against the development database 'library_management'! Configure DB_NAME_TEST."
    );
  }

  // 1. Connect without selecting database to ensure test database exists
  const adminConn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });

  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB_NAME}\``);
  await adminConn.end();

  // 2. Create isolated test connection pool
  if (!testPoolInstance) {
    testPoolInstance = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: TEST_DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      decimalNumbers: true,
    });
  }

  // 3. Inject test pool into models
  setPool(testPoolInstance);

  // 4. Ensure schema is initialized in test database
  await initSchema(testPoolInstance);

  return testPoolInstance;
}

/**
 * Clears all tables in the isolated test database between test runs.
 */
async function resetTestDatabase() {
  if (!testPoolInstance) return;

  const conn = await testPoolInstance.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE loans');
    await conn.query('TRUNCATE TABLE books');
    await conn.query('TRUNCATE TABLE members');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
}

/**
 * Closes the isolated test connection pool.
 */
async function teardownTestDatabase() {
  if (testPoolInstance) {
    await testPoolInstance.end();
    testPoolInstance = null;
    setPool(null);
  }
}

module.exports = {
  TEST_DB_NAME,
  setupTestDatabase,
  resetTestDatabase,
  teardownTestDatabase,
};
