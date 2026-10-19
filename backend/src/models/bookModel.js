const { getPool } = require('./db');

class BookModel {
  static get pool() {
    return getPool();
  }

  /**
   * Retrieves all books with optional search and filters.
   * @param {Object} [filters]
   * @param {string} [filters.search]
   * @param {string} [filters.genre]
   * @param {boolean} [filters.availableOnly]
   */
  static async findAll({ search, genre, availableOnly } = {}) {
    let sql = `
      SELECT b.*,
        (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.status = 'ISSUED') as active_loans_count
      FROM books b
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(b.title) LIKE ? OR LOWER(b.author) LIKE ? OR LOWER(b.isbn) LIKE ?)`;
      params.push(term, term, term);
    }

    if (genre && genre.trim()) {
      sql += ` AND LOWER(b.genre) = ?`;
      params.push(genre.trim().toLowerCase());
    }

    if (availableOnly) {
      sql += ` AND b.available_copies > 0`;
    }

    sql += ` ORDER BY b.title ASC`;

    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  /**
   * Retrieves a single book by ID, including its active loans count.
   * @param {number} id
   */
  static async findById(id) {
    const sql = `
      SELECT b.*,
        (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.status = 'ISSUED') as active_loans_count
      FROM books b
      WHERE b.id = ?
    `;
    const [rows] = await this.pool.query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Retrieves a book by ISBN, optionally excluding a specific book ID.
   * @param {string} isbn
   * @param {number} [excludeId]
   */
  static async findByIsbn(isbn, excludeId = null) {
    if (excludeId) {
      const [rows] = await this.pool.query('SELECT * FROM books WHERE isbn = ? AND id != ?', [isbn, excludeId]);
      return rows[0] || null;
    }
    const [rows] = await this.pool.query('SELECT * FROM books WHERE isbn = ?', [isbn]);
    return rows[0] || null;
  }

  /**
   * Counts active loans for a book.
   * @param {number} id
   */
  static async getActiveLoansCount(id) {
    const [rows] = await this.pool.query(
      "SELECT COUNT(*) as count FROM loans WHERE book_id = ? AND status = 'ISSUED'",
      [id]
    );
    return rows[0] ? Number(rows[0].count) : 0;
  }

  /**
   * Counts total loans (active or returned) for a book.
   * @param {number} id
   */
  static async getTotalLoansCount(id) {
    const [rows] = await this.pool.query('SELECT COUNT(*) as count FROM loans WHERE book_id = ?', [id]);
    return rows[0] ? Number(rows[0].count) : 0;
  }

  /**
   * Creates a new book record.
   */
  static async create({ isbn, title, author, genre, total_copies, available_copies, shelf_location }) {
    const finalAvailable = available_copies !== undefined ? available_copies : total_copies;

    const sql = `
      INSERT INTO books (
        isbn, title, author, genre, total_copies, available_copies, shelf_location
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const [result] = await this.pool.query(sql, [
      isbn.trim(),
      title.trim(),
      author.trim(),
      genre ? genre.trim() : null,
      total_copies,
      finalAvailable,
      shelf_location ? shelf_location.trim() : null,
    ]);

    return this.findById(result.insertId);
  }

  /**
   * Updates an existing book.
   */
  static async update(id, updates) {
    const fields = [];
    const values = [];

    const allowed = [
      'isbn',
      'title',
      'author',
      'genre',
      'total_copies',
      'available_copies',
      'shelf_location',
    ];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        let val = updates[key];
        if (typeof val === 'string') val = val.trim();
        values.push(val);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `UPDATE books SET ${fields.join(', ')} WHERE id = ?`;
    await this.pool.query(sql, values);

    return this.findById(id);
  }

  /**
   * Safely deletes a book and its historical non-active loans within an explicit MySQL transaction.
   * Assumes active loans have already been checked to be 0.
   */
  static async delete(id) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      // Remove historical returned loans to satisfy foreign key integrity
      await conn.query("DELETE FROM loans WHERE book_id = ? AND status != 'ISSUED'", [id]);
      const [result] = await conn.query('DELETE FROM books WHERE id = ?', [id]);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = BookModel;
