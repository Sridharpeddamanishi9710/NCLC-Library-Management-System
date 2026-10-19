const { getDb } = require('./db');

class LoanModel {
  static get db() {
    return getDb();
  }

  /**
   * Base SQL query selecting loan details joined with book and member information.
   */
  static get baseQuery() {
    return `
      SELECT
        l.id,
        l.book_id,
        l.member_id,
        l.issue_date,
        l.due_date,
        l.return_date,
        l.status,
        l.fine_amount,
        l.paid_amount,
        l.fine_paid,
        l.created_at,
        l.updated_at,
        b.title AS book_title,
        b.isbn AS book_isbn,
        b.author AS book_author,
        b.genre AS book_genre,
        b.total_copies AS book_total_copies,
        b.available_copies AS book_available_copies,
        m.name AS member_name,
        m.member_code AS member_code,
        m.email AS member_email,
        m.phone AS member_phone,
        m.status AS member_status,
        m.max_borrow_limit AS member_max_borrow_limit
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
    `;
  }

  /**
   * Retrieves a single loan by ID with joined book and member data.
   * @param {number} id
   */
  static findById(id) {
    const sql = `${this.baseQuery} WHERE l.id = ?`;
    return this.db.prepare(sql).get(id) || null;
  }

  /**
   * Retrieves raw loan row by ID without joins (for fast internal status verification).
   * @param {number} id
   */
  static findRawById(id) {
    return this.db.prepare('SELECT * FROM loans WHERE id = ?').get(id) || null;
  }

  /**
   * Retrieves all loans matching search and filter conditions.
   * @param {Object} [filters]
   * @param {string} [filters.status]
   * @param {number} [filters.member_id]
   * @param {number} [filters.book_id]
   * @param {string} [filters.search]
   * @param {boolean} [filters.overdueOnly]
   * @param {string} [filters.currentDate] Defaults to today in YYYY-MM-DD
   */
  static findAll({ status, member_id, book_id, search, overdueOnly, currentDate } = {}) {
    let sql = `${this.baseQuery} WHERE 1=1`;
    const params = [];
    const today = currentDate || new Date().toISOString().split('T')[0];

    if (overdueOnly) {
      sql += ` AND l.return_date IS NULL AND date(l.due_date) < date(?)`;
      params.push(today);
    } else if (status) {
      const upperStatus = status.trim().toUpperCase();
      if (upperStatus === 'OVERDUE') {
        sql += ` AND (l.status = 'OVERDUE' OR (l.return_date IS NULL AND date(l.due_date) < date(?)))`;
        params.push(today);
      } else if (upperStatus === 'ISSUED') {
        sql += ` AND l.status = 'ISSUED' AND l.return_date IS NULL AND date(l.due_date) >= date(?)`;
        params.push(today);
      } else if (upperStatus === 'RETURNED') {
        sql += ` AND (l.status = 'RETURNED' OR l.return_date IS NOT NULL)`;
      }
    }

    if (member_id) {
      sql += ` AND l.member_id = ?`;
      params.push(member_id);
    }

    if (book_id) {
      sql += ` AND l.book_id = ?`;
      params.push(book_id);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (
        LOWER(b.title) LIKE ? OR
        LOWER(b.isbn) LIKE ? OR
        LOWER(m.name) LIKE ? OR
        LOWER(m.member_code) LIKE ?
      )`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY l.id DESC`;

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Counts active (unreturned) loans for a given member.
   * @param {number} memberId
   */
  static countActiveLoansByMember(memberId) {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND return_date IS NULL')
      .get(memberId);
    return row ? row.count : 0;
  }

  /**
   * Inserts a new loan and decrements available_copies in one atomic transaction.
   * @param {Object} loanData
   * @returns {Object} Newly created loan
   */
  static issueLoanAtomic({ book_id, member_id, issue_date, due_date }) {
    const tx = this.db.transaction(() => {
      // 1. Decrement available copies, strictly ensuring available_copies > 0
      const updateResult = this.db
        .prepare(`
          UPDATE books
          SET available_copies = available_copies - 1,
              updated_at = datetime('now')
          WHERE id = ? AND available_copies > 0
        `)
        .run(book_id);

      if (updateResult.changes === 0) {
        throw new Error('NO_AVAILABLE_COPIES');
      }

      // 2. Insert loan record
      const insertResult = this.db
        .prepare(`
          INSERT INTO loans (
            book_id, member_id, issue_date, due_date, status, fine_amount, paid_amount, fine_paid
          ) VALUES (
            ?, ?, ?, ?, 'ISSUED', 0.0, 0.0, 0
          )
        `)
        .run(book_id, member_id, issue_date, due_date);

      return insertResult.lastInsertRowid;
    });

    const newLoanId = tx();
    return this.findById(newLoanId);
  }

  /**
   * Returns a book, updates loan record, and increments available_copies in one atomic transaction.
   * @param {Object} returnData
   * @returns {Object} Updated loan
   */
  static returnLoanAtomic({ loan_id, book_id, return_date, fine_amount, fine_paid }) {
    const tx = this.db.transaction(() => {
      // 1. Update loan record
      const loanUpdate = this.db
        .prepare(`
          UPDATE loans
          SET return_date = ?,
              status = 'RETURNED',
              fine_amount = ?,
              fine_paid = ?,
              updated_at = datetime('now')
          WHERE id = ? AND return_date IS NULL
        `)
        .run(return_date, fine_amount, fine_paid, loan_id);

      if (loanUpdate.changes === 0) {
        throw new Error('LOAN_ALREADY_RETURNED');
      }

      // 2. Increment book available_copies, ensuring it does not exceed total_copies
      const bookUpdate = this.db
        .prepare(`
          UPDATE books
          SET available_copies = available_copies + 1,
              updated_at = datetime('now')
          WHERE id = ? AND available_copies < total_copies
        `)
        .run(book_id);

      if (bookUpdate.changes === 0) {
        throw new Error('COPIES_EXCEED_TOTAL');
      }
    });

    tx();
    return this.findById(loan_id);
  }

  /**
   * Records a fine payment for a loan.
   * @param {number} loanId
   * @param {number} newPaidAmount
   * @param {number} finePaid (1 or 0)
   */
  static recordPayment(loanId, newPaidAmount, finePaid) {
    this.db
      .prepare(`
        UPDATE loans
        SET paid_amount = ?,
            fine_paid = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `)
      .run(newPaidAmount, finePaid, loanId);

    return this.findById(loanId);
  }
}

module.exports = LoanModel;
