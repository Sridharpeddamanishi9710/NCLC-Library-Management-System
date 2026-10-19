const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getDb } = require('./models/db');
const bookRoutes = require('./routes/bookRoutes');
const memberRoutes = require('./routes/memberRoutes');
const loanRoutes = require('./routes/loanRoutes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  try {
    const db = getDb();
    const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
    const loanCount = db.prepare('SELECT COUNT(*) as count FROM loans').get().count;
    const fkStatus = db.pragma('foreign_keys', { simple: true });

    res.json({
      status: 'UP',
      service: 'NCLC Library Management System Backend',
      environment: config.env,
      database: {
        path: config.dbPath,
        foreignKeysEnabled: fkStatus === 1,
        counts: {
          books: bookCount,
          members: memberCount,
          loans: loanCount,
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
    message: 'NCLC Library Management System API (Milestone 3)',
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
