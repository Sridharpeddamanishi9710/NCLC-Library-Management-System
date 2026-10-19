const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getPool } = require('./models/db');
const bookRoutes = require('./routes/bookRoutes');
const memberRoutes = require('./routes/memberRoutes');
const loanRoutes = require('./routes/loanRoutes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());

// API Health Check
app.get('/api/health', async (req, res) => {
  try {
    const pool = getPool();
    const [[bookRow]] = await pool.query('SELECT COUNT(*) as count FROM books');
    const [[memberRow]] = await pool.query('SELECT COUNT(*) as count FROM members');
    const [[loanRow]] = await pool.query('SELECT COUNT(*) as count FROM loans');

    res.json({
      status: 'UP',
      service: 'NCLC Library Management System Backend',
      environment: config.env,
      database: {
        engine: 'MySQL',
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
        counts: {
          books: Number(bookRow.count),
          members: Number(memberRow.count),
          loans: Number(loanRow.count),
        },
      },
      rules: config.rules,
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// Root Information Route
app.get('/', (req, res) => {
  res.json({
    message: 'NCLC Library Management System API (MySQL)',
    databaseEngine: 'MySQL',
    endpoints: {
      health: '/api/health',
      books: '/api/books',
      members: '/api/members',
      loans: '/api/loans',
    },
  });
});

// Resource Routes
app.use('/api/books', bookRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/loans', loanRoutes);

// Catch-all 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
