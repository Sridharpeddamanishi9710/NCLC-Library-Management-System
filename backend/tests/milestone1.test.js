const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initSchema } = require('../src/models/db');
const { seed, sampleBooks, sampleMembers } = require('../src/scripts/seed');

describe('Milestone 1 - Database Schema & Constraints', () => {
  let db;

  beforeEach(() => {
    // Use in-memory SQLite database for test isolation
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  });

  it('should create all required tables and indexes', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((t) => t.name)
      .sort();

    assert.deepEqual(tables, ['books', 'loans', 'members']);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((i) => i.name);

    assert.ok(indexes.includes('idx_books_isbn'));
    assert.ok(indexes.includes('idx_members_code'));
    assert.ok(indexes.includes('idx_loans_book_id'));
    assert.ok(indexes.includes('idx_loans_member_id'));
    assert.ok(indexes.includes('idx_loans_status'));
  });

  it('should enforce SQLite foreign key constraints on loans', () => {
    const fkStatus = db.pragma('foreign_keys', { simple: true });
    assert.equal(fkStatus, 1, 'Foreign keys must be actively enabled');

    // Attempting to insert a loan with non-existent book and member should fail
    const stmt = db.prepare(`
      INSERT INTO loans (book_id, member_id, due_date)
      VALUES (9999, 9999, '2026-11-01')
    `);

    assert.throws(
      () => stmt.run(),
      (err) => {
        assert.match(err.message, /FOREIGN KEY constraint failed/);
        return true;
      }
    );
  });

  it('should enforce CHECK constraints on book copies', () => {
    // available_copies > total_copies should fail
    const invalidCopies = db.prepare(`
      INSERT INTO books (isbn, title, author, total_copies, available_copies)
      VALUES ('111-TEST', 'Test Title', 'Test Author', 2, 5)
    `);

    assert.throws(
      () => invalidCopies.run(),
      (err) => {
        assert.match(err.message, /CHECK constraint failed/);
        return true;
      }
    );

    // Negative copies should fail
    const negativeCopies = db.prepare(`
      INSERT INTO books (isbn, title, author, total_copies, available_copies)
      VALUES ('222-TEST', 'Test Title 2', 'Test Author', -1, -1)
    `);

    assert.throws(
      () => negativeCopies.run(),
      (err) => {
        assert.match(err.message, /CHECK constraint failed/);
        return true;
      }
    );
  });

  it('should enforce UNIQUE constraints on ISBN and member code', () => {
    db.prepare(`
      INSERT INTO books (isbn, title, author, total_copies, available_copies)
      VALUES ('ISBN-UNIQUE-1', 'Book One', 'Author', 1, 1)
    `).run();

    assert.throws(
      () => {
        db.prepare(`
          INSERT INTO books (isbn, title, author, total_copies, available_copies)
          VALUES ('ISBN-UNIQUE-1', 'Duplicate Book', 'Author', 1, 1)
        `).run();
      },
      (err) => {
        assert.match(err.message, /UNIQUE constraint failed/);
        return true;
      }
    );
  });

  it('should seed data safely and be idempotent (repeatable without duplicates)', () => {
    // First seed run
    const firstRun = seed(db);
    assert.equal(firstRun.booksAdded, sampleBooks.length);
    assert.equal(firstRun.membersAdded, sampleMembers.length);

    const countAfterFirst = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
    assert.equal(countAfterFirst, sampleBooks.length);

    // Second seed run should add 0 new items and not crash
    const secondRun = seed(db);
    assert.equal(secondRun.booksAdded, 0);
    assert.equal(secondRun.membersAdded, 0);

    const countAfterSecond = db.prepare('SELECT COUNT(*) as c FROM books').get().c;
    assert.equal(countAfterSecond, sampleBooks.length);
  });

  it('should allow valid loan insertion when book and member exist', () => {
    seed(db);

    const book = db.prepare('SELECT id FROM books LIMIT 1').get();
    const member = db.prepare('SELECT id FROM members LIMIT 1').get();

    const insertLoan = db.prepare(`
      INSERT INTO loans (book_id, member_id, due_date)
      VALUES (?, ?, '2026-11-02')
    `);

    const result = insertLoan.run(book.id, member.id);
    assert.ok(result.lastInsertRowid > 0);

    const loanRecord = db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid);
    assert.equal(loanRecord.book_id, book.id);
    assert.equal(loanRecord.member_id, member.id);
    assert.equal(loanRecord.status, 'ISSUED');
    assert.equal(loanRecord.fine_amount, 0.0);
    assert.equal(loanRecord.fine_paid, 0);
  });
});
