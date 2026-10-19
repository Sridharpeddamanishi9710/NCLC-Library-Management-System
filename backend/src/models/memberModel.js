const { getPool } = require('./db');

class MemberModel {
  static get pool() {
    return getPool();
  }

  /**
   * Retrieves all members with optional search and status filter.
   * @param {Object} [filters]
   * @param {string} [filters.search]
   * @param {string} [filters.status]
   */
  static async findAll({ search, status } = {}) {
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

    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  /**
   * Retrieves a single member by ID, including their active loans count.
   * @param {number} id
   */
  static async findById(id) {
    const sql = `
      SELECT m.*,
        (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.status = 'ISSUED') as active_loans_count
      FROM members m
      WHERE m.id = ?
    `;
    const [rows] = await this.pool.query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Finds a member by member code.
   * @param {string} code
   * @param {number} [excludeId]
   */
  static async findByCode(code, excludeId = null) {
    if (excludeId) {
      const [rows] = await this.pool.query('SELECT * FROM members WHERE member_code = ? AND id != ?', [code, excludeId]);
      return rows[0] || null;
    }
    const [rows] = await this.pool.query('SELECT * FROM members WHERE member_code = ?', [code]);
    return rows[0] || null;
  }

  /**
   * Finds a member by email address.
   * @param {string} email
   * @param {number} [excludeId]
   */
  static async findByEmail(email, excludeId = null) {
    const normalized = email.trim().toLowerCase();
    if (excludeId) {
      const [rows] = await this.pool.query('SELECT * FROM members WHERE LOWER(email) = ? AND id != ?', [normalized, excludeId]);
      return rows[0] || null;
    }
    const [rows] = await this.pool.query('SELECT * FROM members WHERE LOWER(email) = ?', [normalized]);
    return rows[0] || null;
  }

  /**
   * Counts active loans for a member.
   * @param {number} id
   */
  static async getActiveLoansCount(id) {
    const [rows] = await this.pool.query(
      "SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND status = 'ISSUED'",
      [id]
    );
    return rows[0] ? Number(rows[0].count) : 0;
  }

  /**
   * Counts total loans for a member.
   * @param {number} id
   */
  static async getTotalLoansCount(id) {
    const [rows] = await this.pool.query('SELECT COUNT(*) as count FROM loans WHERE member_id = ?', [id]);
    return rows[0] ? Number(rows[0].count) : 0;
  }

  /**
   * Creates a new member.
   */
  static async create({ member_code, name, email, phone, status, max_borrow_limit }) {
    const sql = `
      INSERT INTO members (
        member_code, name, email, phone, status, max_borrow_limit
      ) VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `;

    const [result] = await this.pool.query(sql, [
      member_code.trim(),
      name.trim(),
      email.trim().toLowerCase(),
      phone ? phone.trim() : null,
      status ? status.trim().toUpperCase() : 'ACTIVE',
      max_borrow_limit !== undefined ? max_borrow_limit : 3,
    ]);

    return this.findById(result.insertId);
  }

  /**
   * Updates an existing member.
   */
  static async update(id, updates) {
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

    values.push(id);
    const sql = `UPDATE members SET ${fields.join(', ')} WHERE id = ?`;
    await this.pool.query(sql, values);

    return this.findById(id);
  }

  /**
   * Deactivates a member by changing status to 'INACTIVE'.
   * @param {number} id
   */
  static async deactivate(id) {
    await this.pool.query("UPDATE members SET status = 'INACTIVE' WHERE id = ?", [id]);
    return this.findById(id);
  }

  /**
   * Deletes a member and their historical non-active loans within an explicit MySQL transaction.
   * Assumes active loans have already been checked to be 0.
   * @param {number} id
   */
  static async delete(id) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM loans WHERE member_id = ? AND status != 'ISSUED'", [id]);
      const [result] = await conn.query('DELETE FROM members WHERE id = ?', [id]);
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

module.exports = MemberModel;
