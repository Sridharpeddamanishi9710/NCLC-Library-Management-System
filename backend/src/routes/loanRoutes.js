const express = require('express');
const router = express.Router();
const LoanController = require('../controllers/loanController');
const {
  validateId,
  validateIssueLoan,
  validateReturnLoan,
  validatePayFine,
} = require('../middlewares/validate');

// Loan Issue & Return
router.post('/issue', validateIssueLoan, LoanController.issueLoan);
router.post('/:id/return', validateId, validateReturnLoan, LoanController.returnLoan);

// Queries
// NOTE: /overdue must come before /:id to prevent route shadowing
router.get('/overdue', LoanController.getOverdueLoans);
router.get('/', LoanController.getAllLoans);
router.get('/:id', validateId, LoanController.getLoanById);

// Fine Settlement
router.post('/:id/pay-fine', validateId, validatePayFine, LoanController.payFine);

module.exports = router;
