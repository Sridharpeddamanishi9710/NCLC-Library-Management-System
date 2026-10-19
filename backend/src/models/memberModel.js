const { getDb } = require('./db');

class MemberModel {
  static get db() {
    return getDb();
  }

  /**
   * Retrieves all members with optional search and status filter.
   * @param {Object} [filters]
   * @param {string} [filters.search]
   * @param {string} [filters.status]
   */
  static findAll({ search, status } = {}) {
    let sql = `
      SELECT m.*,
        (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.status = 'ISSUED') as active_loans_count
      FROM members m
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(m.name) LIKE ? OR LOWER(m.email) LIKE ? OR LOWER(m.member_code) LIKE ? OR m.phone LIKE ?)`;
      params.push(term, term, term, term);
    }

    if (status && status.trim()) {
      sql += ` AND m.status = ?`;
      params.push(status.trim().toUpperCase());
    }

    sql += ` ORDER BY m.name ASC`;

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Retrieves a single member by ID, including their active loans count.
   * @param {number} id
   */
  static findById(id) {
    const sql = `
      SELECT m.*,
        (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.status = 'ISSUED') as active_loans_count
      FROM members m
      WHERE m.id = ?
    `;
    return this.db.prepare(sql).get(id) || null;
  }

  /**
   * Finds a member by member code.
   * @param {string} code
   * @param {number} [excludeId]
   */
  static findByCode(code, excludeId = null) {
    if (excludeId) {
      return this.db
        .prepare('SELECT * FROM members WHERE member_code = ? AND id != ?')
        .get(code, excludeId) || null;
    }
    return this.db.prepare('SELECT * FROM members WHERE member_code = ?').get(code) || null;
  }

  /**
   * Finds a member by email address.
   * @param {string} email
   * @param {number} [excludeId]
   */
  static findByEmail(email, excludeId = null) {
    const normalized = email.trim().toLowerCase();
    if (excludeId) {
      return this.db
        .prepare('SELECT * FROM members WHERE LOWER(email) = ? AND id != ?')
        .get(normalized, excludeId) || null;
    }
    return this.db.prepare('SELECT * FROM members WHERE LOWER(email) = ?').get(normalized) || null;
  }

  /**
   * Counts active loans for a member.
   * @param {number} id
   */
  static getActiveLoansCount(id) {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND status = 'ISSUED'")
      .get(id);
    return row ? row.count : 0;
  }

  /**
   * Counts total loans for a member.
   * @param {number} id
   */
  static getTotalLoansCount(id) {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM loans WHERE member_id = ?')
      .get(id);
    return row ? row.count : 0;
  }

  /**
   * Creates a new member.
   */
  static create({ member_code, name, email, phone, status, max_borrow_limit }) {
    const stmt = this.db.prepare(`
      INSERT INTO members (
        member_code, name, email, phone, status, max_borrow_limit
      ) VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      member_code.trim(),
      name.trim(),
      email.trim().toLowerCase(),
      phone ? phone.trim() : null,
      status ? status.trim().toUpperCase() : 'ACTIVE',
      max_borrow_limit !== undefined ? max_borrow_limit : 3
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Updates an existing member.
   */
  static update(id, updates) {
    const fields = [];
    const values = [];

    const allowed = ['member_code', 'name', 'email', 'phone', 'status', 'max_borrow_limit'];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        let val = updates[key];
        if (key === 'email' && typeof val === 'string') val = val.trim().toLowerCase();
        else if (key === 'status' && typeof val === 'string') val = val.trim().toUpperCase();
        else if (typeof val === 'string') val = val.trim();
        values.push(val);
      }
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const sql = `UPDATE members SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);

    return this.findById(id);
  }

  /**
   * Deactivates a member by changing status to 'INACTIVE'.
   * @param {number} id
   */
  static deactivate(id) {
    this.db
      .prepare("UPDATE members SET status = 'INACTIVE', updated_at = datetime('now') WHERE id = ?")
      .run(id);
    return this.findById(id);
  }

  /**
   * Deletes a member and their historical non-active loans within a transaction.
   * Assumes active loans have already been checked to be 0.
   * @param {number} id
   */
  static delete(id) {
    const tx = this.db.transaction(() => {
      this.db.prepare("DELETE FROM loans WHERE member_id = ? AND status != 'ISSUED'").run(id);
      return this.db.prepare('DELETE FROM members WHERE id = ?').run(id);
    });

    return tx();
  }
}

module.exports = MemberModel;
