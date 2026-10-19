const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let poolInstance = null;

/**
 * Returns or creates the singleton MySQL connection pool.
 * @param {Object} [customConfig]
 * @returns {import('mysql2/promise').Pool}
 */
function getPool(customConfig) {
  if (poolInstance && !customConfig) {
    return poolInstance;
  }

  const poolOptions = customConfig || config.db;
  const pool = mysql.createPool(poolOptions);

  if (!customConfig) {
    poolInstance = pool;
  }

  return pool;
}

/**
 * Overrides the active connection pool (for isolated tests).
 * @param {import('mysql2/promise').Pool|null} pool
 */
function setPool(pool) {
  poolInstance = pool;
}

/**
 * Closes the active connection pool.
 */
async function closePool() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

/**
 * Tests database connectivity.
 * @param {import('mysql2/promise').Pool} [targetPool]
 */
async function testConnection(targetPool) {
  const pool = targetPool || getPool();
  const [rows] = await pool.query('SELECT 1 + 1 AS result');
  return rows[0].result === 2;
}

/**
 * Initializes the MySQL schema tables and indexes.
 * @param {import('mysql2/promise').Pool} [targetPool]
 */
async function initSchema(targetPool) {
  const pool = targetPool || getPool();
  const schemaPath = path.resolve(__dirname, 'schema.mysql.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Strip line and block comments, then split by semicolons
  const cleanSql = schemaSql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }
}

module.exports = {
  getPool,
  setPool,
  closePool,
  testConnection,
  initSchema,
};
