const CirculationService = require('../services/circulationService');
const LoanModel = require('../models/loanModel');

/**
 * Controller for Loan circulation, returns, overdue tracking, and fine management with async MySQL support.
 */
class LoanController {
  /**
   * POST /api/loans/issue
   * Issues a book to an active member with availability and limit checks.
   */
  static async issueLoan(req, res, next) {
    try {
      const loan = await CirculationService.issueLoan(req.validatedIssueData);
      res.status(201).json({
        success: true,
        message: 'Book issued successfully.',
        data: loan,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/loans/:id/return
   * Processes book return, calculates overdue days and fines, increments copies.
   */
  static async returnLoan(req, res, next) {
    try {
      const loanId = req.validatedId;
      const { return_date } = req.body || {};

      const returnedLoan = await CirculationService.returnLoan(loanId, return_date);
      res.json({
        success: true,
        message: 'Book returned successfully.',
        data: returnedLoan,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/loans
   * Lists loans with book and member information, supporting status/member/book/search filters.
   */
  static async getAllLoans(req, res, next) {
    try {
      const { status, member_id, book_id, search } = req.query;

      const memberId = member_id ? Number(member_id) : undefined;
      const bookId = book_id ? Number(book_id) : undefined;

      const rawLoans = await LoanModel.findAll({
        status,
        member_id: memberId,
        book_id: bookId,
        search,
      });

      const enrichedLoans = rawLoans.map((l) => CirculationService.enrichLoan(l));

      res.json({
        success: true,
        count: enrichedLoans.length,
        data: enrichedLoans,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/loans/overdue
   * Lists all unreturned loans whose due date has passed.
   */
  static async getOverdueLoans(req, res, next) {
    try {
      const rawLoans = await LoanModel.findAll({ overdueOnly: true });
      const enrichedLoans = rawLoans.map((l) => CirculationService.enrichLoan(l));

      res.json({
        success: true,
        count: enrichedLoans.length,
        data: enrichedLoans,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/loans/:id
   * Retrieves single loan record by ID with joined book and member data.
   */
  static async getLoanById(req, res, next) {
    try {
      const loanId = req.validatedId;
      const rawLoan = await LoanModel.findById(loanId);

      if (!rawLoan) {
        return res.status(404).json({
          success: false,
          error: 'Loan record not found.',
        });
      }

      const enriched = CirculationService.enrichLoan(rawLoan);

      res.json({
        success: true,
        data: enriched,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/loans/:id/pay-fine
   * Processes fine payments, updating paid amount and fine status.
   */
  static async payFine(req, res, next) {
    try {
      const loanId = req.validatedId;
      const amount = req.validatedPaymentAmount;

      const updatedLoan = await CirculationService.payFine(loanId, amount);

      res.json({
        success: true,
        message: 'Fine payment recorded successfully.',
        data: updatedLoan,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = LoanController;
