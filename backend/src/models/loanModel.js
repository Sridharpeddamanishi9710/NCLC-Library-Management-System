const { getPool } = require('./db');

class LoanModel {
  static get pool() {
    return getPool();
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
        CAST(l.fine_amount AS DECIMAL(10,2)) AS fine_amount,
        CAST(l.paid_amount AS DECIMAL(10,2)) AS paid_amount,
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
  static async findById(id) {
    const sql = `${this.baseQuery} WHERE l.id = ?`;
    const [rows] = await this.pool.query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Retrieves raw loan row by ID without joins (for internal status checks).
   * @param {number} id
   */
  static async findRawById(id) {
    const [rows] = await this.pool.query('SELECT * FROM loans WHERE id = ?', [id]);
    return rows[0] || null;
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
  static async findAll({ status, member_id, book_id, search, overdueOnly, currentDate } = {}) {
    let sql = `${this.baseQuery} WHERE 1=1`;
    const params = [];
    const today = currentDate || new Date().toISOString().split('T')[0];

    if (overdueOnly) {
      sql += ` AND l.return_date IS NULL AND DATE(l.due_date) < DATE(?)`;
      params.push(today);
    } else if (status) {
      const upperStatus = status.trim().toUpperCase();
      if (upperStatus === 'OVERDUE') {
        sql += ` AND (l.status = 'OVERDUE' OR (l.return_date IS NULL AND DATE(l.due_date) < DATE(?)))`;
        params.push(today);
      } else if (upperStatus === 'ISSUED') {
        sql += ` AND l.status = 'ISSUED' AND l.return_date IS NULL AND DATE(l.due_date) >= DATE(?)`;
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

    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  /**
   * Counts active (unreturned) loans for a given member.
   * @param {number} memberId
   */
  static async countActiveLoansByMember(memberId) {
    const [rows] = await this.pool.query(
      'SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND return_date IS NULL',
      [memberId]
    );
    return rows[0] ? Number(rows[0].count) : 0;
  }

  /**
   * Inserts a new loan and decrements available_copies in one atomic MySQL transaction.
   * Uses SELECT ... FOR UPDATE to prevent race conditions on copy availability.
   * @param {Object} loanData
   */
  static async issueLoanAtomic({ book_id, member_id, issue_date, due_date }) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Lock the book row to prevent race conditions
      const [bookRows] = await conn.query(
        'SELECT available_copies, total_copies FROM books WHERE id = ? FOR UPDATE',
        [book_id]
      );

      if (!bookRows[0] || bookRows[0].available_copies <= 0) {
        const err = new Error('No available copies for this book.');
        err.status = 400;
        throw err;
      }

      // 2. Decrement available copies
      await conn.query(
        'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
        [book_id]
      );

      // 3. Insert loan record
      const [insertResult] = await conn.query(
        `INSERT INTO loans (
          book_id, member_id, issue_date, due_date, status, fine_amount, paid_amount, fine_paid
        ) VALUES (
          ?, ?, ?, ?, 'ISSUED', 0.00, 0.00, 0
        )`,
        [book_id, member_id, issue_date, due_date]
      );

      await conn.commit();
      return this.findById(insertResult.insertId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Returns a book, updates loan record, and increments available_copies in one atomic MySQL transaction.
   * Uses SELECT ... FOR UPDATE to avoid duplicate returns and ensure copy count integrity.
   * @param {Object} returnData
   */
  static async returnLoanAtomic({ loan_id, book_id, return_date, fine_amount, fine_paid }) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Lock the loan row
      const [loanRows] = await conn.query(
        'SELECT return_date FROM loans WHERE id = ? FOR UPDATE',
        [loan_id]
      );

      if (!loanRows[0] || loanRows[0].return_date !== null) {
        throw new Error('LOAN_ALREADY_RETURNED');
      }

      // 2. Lock the book row
      const [bookRows] = await conn.query(
        'SELECT available_copies, total_copies FROM books WHERE id = ? FOR UPDATE',
        [book_id]
      );

      if (bookRows[0] && bookRows[0].available_copies >= bookRows[0].total_copies) {
        throw new Error('COPIES_EXCEED_TOTAL');
      }

      // 3. Update loan record
      await conn.query(
        `UPDATE loans
         SET return_date = ?,
             status = 'RETURNED',
             fine_amount = ?,
             fine_paid = ?
         WHERE id = ?`,
        [return_date, fine_amount, fine_paid, loan_id]
      );

      // 4. Increment book available_copies
      await conn.query(
        'UPDATE books SET available_copies = available_copies + 1 WHERE id = ?',
        [book_id]
      );

      await conn.commit();
      return this.findById(loan_id);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Records a fine payment for a loan within a MySQL transaction.
   * @param {number} loanId
   * @param {number} newPaidAmount
   * @param {number} finePaid (1 or 0)
   */
  static async recordPayment(loanId, newPaidAmount, finePaid) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE loans SET paid_amount = ?, fine_paid = ? WHERE id = ?',
        [newPaidAmount, finePaid, loanId]
      );

      await conn.commit();
      return this.findById(loanId);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = LoanModel;
