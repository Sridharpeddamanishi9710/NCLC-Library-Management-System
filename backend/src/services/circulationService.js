const config = require('../config');
const BookModel = require('../models/bookModel');
const MemberModel = require('../models/memberModel');
const LoanModel = require('../models/loanModel');

class CirculationService {
  /**
   * Formats a Date object to YYYY-MM-DD.
   * @param {Date} [date]
   * @returns {string}
   */
  static formatDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Adds specified calendar days to a YYYY-MM-DD date string.
   * @param {string} dateStr
   * @param {number} days
   * @returns {string}
   */
  static addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }

  /**
   * Calculates calendar overdue days between due date and return/current date.
   * Returns 0 if not overdue.
   * @param {string} dueDateStr
   * @param {string} targetDateStr
   * @returns {number}
   */
  static calculateOverdueDays(dueDateStr, targetDateStr) {
    if (!dueDateStr || !targetDateStr) return 0;
    const [dY, dM, dD] = dueDateStr.split('-').map(Number);
    const [tY, tM, tD] = targetDateStr.split('-').map(Number);

    const dueUTC = Date.UTC(dY, dM - 1, dD);
    const targetUTC = Date.UTC(tY, tM - 1, tD);

    const diffMs = targetUTC - dueUTC;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Enriches a loan object with dynamic status, calculated overdue days, and live fine balances.
   * Ensures an unreturned loan past its due date is recognized as OVERDUE.
   * @param {Object} loan
   * @param {string} [currentDate]
   */
  static enrichLoan(loan, currentDate) {
    if (!loan) return null;
    const today = currentDate || this.formatDate();
    const isReturned = loan.return_date !== null && loan.return_date !== undefined;

    let effectiveStatus = loan.status;
    let overdueDays = 0;
    let effectiveFine = loan.fine_amount;

    if (isReturned) {
      effectiveStatus = 'RETURNED';
      overdueDays = this.calculateOverdueDays(loan.due_date, loan.return_date);
    } else {
      overdueDays = this.calculateOverdueDays(loan.due_date, today);
      if (overdueDays > 0) {
        effectiveStatus = 'OVERDUE';
        const pendingFine = overdueDays * config.rules.fineRatePerDay;
        effectiveFine = Math.max(loan.fine_amount, pendingFine);
      } else {
        effectiveStatus = 'ISSUED';
      }
    }

    const paidAmount = Number(loan.paid_amount || 0);
    const outstandingBalance = Math.max(0, effectiveFine - paidAmount);
    const isFinePaid = effectiveFine === 0 ? true : paidAmount >= effectiveFine || loan.fine_paid === 1;

    return {
      ...loan,
      status: effectiveStatus,
      overdue_days: overdueDays,
      fine_amount: effectiveFine,
      paid_amount: paidAmount,
      outstanding_fine: outstandingBalance,
      fine_paid: isFinePaid,
      currency: config.rules.currencySymbol,
    };
  }

  /**
   * Issues a book loan with full business validation and atomic transaction.
   * @param {Object} params
   * @param {number} params.book_id
   * @param {number} params.member_id
   * @param {string} [params.issue_date]
   * @param {string} [params.due_date]
   */
  static issueLoan({ book_id, member_id, issue_date, due_date }) {
    // 1. Verify Book
    const book = BookModel.findById(book_id);
    if (!book) {
      const err = new Error('Book not found.');
      err.status = 404;
      throw err;
    }

    if (book.available_copies <= 0) {
      const err = new Error('No available copies for this book.');
      err.status = 400;
      throw err;
    }

    // 2. Verify Member
    const member = MemberModel.findById(member_id);
    if (!member) {
      const err = new Error('Member not found.');
      err.status = 404;
      throw err;
    }

    if (member.status !== 'ACTIVE') {
      const err = new Error(
        `Borrowing is not permitted. Member account is currently ${member.status}. Only ACTIVE members can borrow books.`
      );
      err.status = 400;
      throw err;
    }

    // 3. Enforce Borrow Limits (Member limit and Config limit)
    const activeLoansCount = LoanModel.countActiveLoansByMember(member_id);
    const maxAllowed = Math.min(
      Number(member.max_borrow_limit || 3),
      Number(config.rules.maxActiveLoansPerMember || 3)
    );

    if (activeLoansCount >= maxAllowed) {
      const err = new Error(
        `Borrowing limit reached. Member currently has ${activeLoansCount} active loan(s) (Maximum allowed: ${maxAllowed}).`
      );
      err.status = 400;
      throw err;
    }

    // 4. Compute issue and due dates
    const finalIssueDate = issue_date || this.formatDate();
    const finalDueDate = due_date || this.addDays(finalIssueDate, config.rules.loanDurationDays);

    // 5. Execute atomic issue
    const newLoan = LoanModel.issueLoanAtomic({
      book_id,
      member_id,
      issue_date: finalIssueDate,
      due_date: finalDueDate,
    });

    return this.enrichLoan(newLoan, finalIssueDate);
  }

  /**
   * Returns a borrowed book, calculates fines, and updates copies atomically.
   * @param {number} loanId
   * @param {string} [returnDateInput]
   */
  static returnLoan(loanId, returnDateInput) {
    const rawLoan = LoanModel.findRawById(loanId);
    if (!rawLoan) {
      const err = new Error('Loan record not found.');
      err.status = 404;
      throw err;
    }

    if (rawLoan.return_date !== null) {
      const err = new Error(`This loan has already been returned on ${rawLoan.return_date}.`);
      err.status = 400;
      throw err;
    }

    const finalReturnDate = returnDateInput || this.formatDate();
    const overdueDays = this.calculateOverdueDays(rawLoan.due_date, finalReturnDate);
    const fineAmount = overdueDays * config.rules.fineRatePerDay;
    const isFinePaid = fineAmount === 0 ? 1 : rawLoan.paid_amount >= fineAmount ? 1 : 0;

    const updatedLoan = LoanModel.returnLoanAtomic({
      loan_id: loanId,
      book_id: rawLoan.book_id,
      return_date: finalReturnDate,
      fine_amount: fineAmount,
      fine_paid: isFinePaid,
    });

    return this.enrichLoan(updatedLoan, finalReturnDate);
  }

  /**
   * Settles a fine payment for a loan.
   * @param {number} loanId
   * @param {number} paymentAmount
   */
  static payFine(loanId, paymentAmount) {
    const rawLoan = LoanModel.findById(loanId);
    if (!rawLoan) {
      const err = new Error('Loan record not found.');
      err.status = 404;
      throw err;
    }

    const enriched = this.enrichLoan(rawLoan);

    if (enriched.fine_amount === 0) {
      const err = new Error('No fine is associated with this loan.');
      err.status = 400;
      throw err;
    }

    const outstanding = enriched.outstanding_fine;
    if (outstanding <= 0) {
      const err = new Error('Fine has already been fully paid.');
      err.status = 400;
      throw err;
    }

    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      const err = new Error('Payment amount must be a positive number.');
      err.status = 400;
      throw err;
    }

    if (amount > outstanding) {
      const err = new Error(
        `Payment amount (${config.rules.currencySymbol}${amount}) exceeds outstanding fine balance of ${config.rules.currencySymbol}${outstanding}.`
      );
      err.status = 400;
      throw err;
    }

    const newPaidAmount = enriched.paid_amount + amount;
    const finePaid = newPaidAmount >= enriched.fine_amount ? 1 : 0;

    const updated = LoanModel.recordPayment(loanId, newPaidAmount, finePaid);
    return this.enrichLoan(updated);
  }
}

module.exports = CirculationService;
