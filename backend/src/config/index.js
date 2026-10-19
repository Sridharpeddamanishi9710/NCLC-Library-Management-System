const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  dbPath: process.env.DATABASE_PATH
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
