const app = require('./app');
const config = require('./config');
const { getDb, initSchema } = require('./models/db');

// Ensure database schema is ready on startup
const db = getDb();
initSchema(db);

if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`[Server] Library Management API running on http://localhost:${config.port}`);
    console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    console.log(`[Server] Books endpoint: http://localhost:${config.port}/api/books`);
    console.log(`[Server] Members endpoint: http://localhost:${config.port}/api/members`);
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

module.exports = app;
