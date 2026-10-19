const app = require('./app');
const config = require('./config');
const { initSchema, testConnection } = require('./models/db');

async function start() {
  try {
    await testConnection();
    console.log(`[Database] Connected to MySQL (${config.db.host}:${config.db.port}/${config.db.database})`);
    await initSchema();
    console.log('[Database] Schema verified and ready.');
  } catch (err) {
    console.error('[Database] Connection check failed:', err.message);
  }

  const server = app.listen(config.port, () => {
    console.log(`[Server] Library Management API running on http://localhost:${config.port}`);
    console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    console.log(`[Server] Books endpoint: http://localhost:${config.port}/api/books`);
    console.log(`[Server] Members endpoint: http://localhost:${config.port}/api/members`);
    console.log(`[Server] Loans endpoint: http://localhost:${config.port}/api/loans`);
  });

  const shutdown = () => {
    console.log('\n[Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start();
}

module.exports = app;
