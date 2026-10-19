const { getDb } = require('./db');

class BookModel {
  static get db() {
    return getDb();
  }

  /**
   * Retrieves all books with optional search and filters.
   * @param {Object} [filters]
   * @param {string} [filters.search]
   * @param {string} [filters.genre]
   * @param {boolean} [filters.availableOnly]
   */
  static findAll({ search, genre, availableOnly } = {}) {
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

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Retrieves a single book by ID, including its active loans count.
   * @param {number} id
   */
  static findById(id) {
    const sql = `
      SELECT b.*,
        (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.status = 'ISSUED') as active_loans_count
      FROM books b
      WHERE b.id = ?
    `;
    return this.db.prepare(sql).get(id) || null;
  }

  /**
   * Retrieves a book by ISBN, optionally excluding a specific book ID.
   * @param {string} isbn
   * @param {number} [excludeId]
   */
  static findByIsbn(isbn, excludeId = null) {
    if (excludeId) {
      return this.db
        .prepare('SELECT * FROM books WHERE isbn = ? AND id != ?')
        .get(isbn, excludeId) || null;
    }
    return this.db.prepare('SELECT * FROM books WHERE isbn = ?').get(isbn) || null;
  }

  /**
   * Counts active loans for a book.
   * @param {number} id
   */
  static getActiveLoansCount(id) {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM loans WHERE book_id = ? AND status = 'ISSUED'")
      .get(id);
    return row ? row.count : 0;
  }

  /**
   * Counts total loans (active or returned) for a book.
   * @param {number} id
   */
  static getTotalLoansCount(id) {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM loans WHERE book_id = ?')
      .get(id);
    return row ? row.count : 0;
  }

  /**
   * Creates a new book record.
   */
  static create({ isbn, title, author, genre, total_copies, available_copies, shelf_location }) {
    const finalAvailable = available_copies !== undefined ? available_copies : total_copies;

    const stmt = this.db.prepare(`
      INSERT INTO books (
        isbn, title, author, genre, total_copies, available_copies, shelf_location
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      isbn.trim(),
      title.trim(),
      author.trim(),
      genre ? genre.trim() : null,
      total_copies,
      finalAvailable,
      shelf_location ? shelf_location.trim() : null
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Updates an existing book.
   */
  static update(id, updates) {
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

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const sql = `UPDATE books SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);

    return this.findById(id);
  }

  /**
   * Safely deletes a book and its historical non-active loans within a transaction.
   * Assumes active loans have already been checked to be 0.
   */
  static delete(id) {
    const tx = this.db.transaction(() => {
      // Remove historical returned loans to satisfy foreign key integrity
      this.db.prepare("DELETE FROM loans WHERE book_id = ? AND status != 'ISSUED'").run(id);
      return this.db.prepare('DELETE FROM books WHERE id = ?').run(id);
    });

    return tx();
  }
}

module.exports = BookModel;
