const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDatabase, resetTestDatabase, teardownTestDatabase, TEST_DB_NAME } = require('./testHelper');
const { seed, sampleBooks, sampleMembers } = require('../src/scripts/seed');

describe('Milestone 1 - MySQL Database Schema & Constraints', () => {
  let pool;

  before(async () => {
    pool = await setupTestDatabase();
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  after(async () => {
    await teardownTestDatabase();
  });

  it('should create all required tables and indexes in MySQL', async () => {
    const [tables] = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
      [TEST_DB_NAME]
    );
    const tableNames = tables.map((t) => t.TABLE_NAME || t.table_name).sort();

    assert.deepEqual(tableNames, ['books', 'loans', 'members']);

    const [indexes] = await pool.query(
      `SELECT DISTINCT index_name FROM information_schema.statistics WHERE table_schema = ?`,
      [TEST_DB_NAME]
    );
    const indexNames = indexes.map((i) => i.INDEX_NAME || i.index_name);

    assert.ok(indexNames.includes('idx_books_isbn'));
    assert.ok(indexNames.includes('idx_members_code'));
    assert.ok(indexNames.includes('idx_loans_book_id'));
    assert.ok(indexNames.includes('idx_loans_member_id'));
    assert.ok(indexNames.includes('idx_loans_status'));
  });

  it('should enforce MySQL foreign key constraints on loans', async () => {
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO loans (book_id, member_id, issue_date, due_date) VALUES (9999, 9999, '2026-10-19', '2026-11-02')`
        );
      },
      (err) => {
        assert.ok(
          err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW',
          `Expected foreign key error code, got: ${err.code}`
        );
        return true;
      }
    );
  });

  it('should enforce CHECK constraints on book copies', async () => {
    // available_copies > total_copies should fail
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO books (isbn, title, author, total_copies, available_copies) VALUES ('111-TEST', 'Test Title', 'Test Author', 2, 5)`
        );
      },
      (err) => {
        assert.ok(
          err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.message.includes('CHECK'),
          `Expected CHECK constraint error, got: ${err.code} / ${err.message}`
        );
        return true;
      }
    );

    // Negative copies should fail
    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO books (isbn, title, author, total_copies, available_copies) VALUES ('222-TEST', 'Test Title 2', 'Test Author', -1, -1)`
        );
      },
      (err) => {
        assert.ok(
          err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.message.includes('CHECK'),
          `Expected CHECK constraint error, got: ${err.code} / ${err.message}`
        );
        return true;
      }
    );
  });

  it('should enforce UNIQUE constraints on ISBN and member code', async () => {
    await pool.query(
      `INSERT INTO books (isbn, title, author, total_copies, available_copies) VALUES ('ISBN-UNIQUE-1', 'Book One', 'Author', 1, 1)`
    );

    await assert.rejects(
      async () => {
        await pool.query(
          `INSERT INTO books (isbn, title, author, total_copies, available_copies) VALUES ('ISBN-UNIQUE-1', 'Duplicate Book', 'Author', 1, 1)`
        );
      },
      (err) => {
        assert.equal(err.code, 'ER_DUP_ENTRY');
        return true;
      }
    );
  });

  it('should seed data safely and be idempotent in MySQL', async () => {
    const firstRun = await seed(pool);
    assert.equal(firstRun.booksAdded, sampleBooks.length);
    assert.equal(firstRun.membersAdded, sampleMembers.length);

    const [[countAfterFirst]] = await pool.query('SELECT COUNT(*) as c FROM books');
    assert.equal(countAfterFirst.c, sampleBooks.length);

    // Second seed run should add 0 new items without throwing
    const secondRun = await seed(pool);
    assert.equal(secondRun.booksAdded, 0);
    assert.equal(secondRun.membersAdded, 0);

    const [[countAfterSecond]] = await pool.query('SELECT COUNT(*) as c FROM books');
    assert.equal(countAfterSecond.c, sampleBooks.length);
  });

  it('should allow valid loan insertion when book and member exist', async () => {
    await seed(pool);

    const [[book]] = await pool.query('SELECT id FROM books LIMIT 1');
    const [[member]] = await pool.query('SELECT id FROM members LIMIT 1');

    const [result] = await pool.query(
      `INSERT INTO loans (book_id, member_id, issue_date, due_date) VALUES (?, ?, '2026-10-19', '2026-11-02')`,
      [book.id, member.id]
    );

    assert.ok(result.insertId > 0);

    const [[loanRecord]] = await pool.query('SELECT * FROM loans WHERE id = ?', [result.insertId]);
    assert.equal(loanRecord.book_id, book.id);
    assert.equal(loanRecord.member_id, member.id);
    assert.equal(loanRecord.status, 'ISSUED');
    assert.equal(Number(loanRecord.fine_amount), 0);
    assert.equal(Number(loanRecord.fine_paid), 0);
  });
});
