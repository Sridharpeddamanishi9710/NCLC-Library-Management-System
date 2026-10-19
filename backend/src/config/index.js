const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.NODE_ENV === 'test'
      ? (process.env.DB_NAME_TEST || 'library_management_test')
      : (process.env.DB_NAME || 'library_management'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true, // Return DATE and DATETIME fields as strings (YYYY-MM-DD) avoiding timezone distortion
    decimalNumbers: true, // Return DECIMAL types as JavaScript numbers for clean JSON serialization
  },
  // Legacy SQLite database path for safe read-only data migration
  sqliteDbPath: process.env.DATABASE_PATH
    ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
    : path.resolve(__dirname, '../../data/library.db'),
  rules: {
    loanDurationDays: parseInt(process.env.LOAN_DURATION_DAYS || '14', 10),
    fineRatePerDay: parseFloat(process.env.FINE_RATE_PER_DAY || '10.0'),
    currencySymbol: process.env.CURRENCY_SYMBOL || '₹',
    maxActiveLoansPerMember: parseInt(process.env.MAX_ACTIVE_LOANS_PER_MEMBER || '3', 10),
  },
};

module.exports = config;
