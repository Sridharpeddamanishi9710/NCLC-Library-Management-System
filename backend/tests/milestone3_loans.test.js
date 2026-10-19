const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const request = require('supertest');
const { initSchema, setDb, closeDb } = require('../src/models/db');
const app = require('../src/app');

describe('Milestone 3 - Circulation Engine & Fine Calculation (/api/loans)', () => {
  let testDb;

  beforeEach(() => {
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    initSchema(testDb);
    setDb(testDb);
  });

  afterEach(() => {
    closeDb();
    setDb(null);
  });

  // Helper to quickly create test book and member
  function createFixtures() {
    const bookStmt = testDb.prepare(`
      INSERT INTO books (isbn, title, author, genre, total_copies, available_copies)
      VALUES ('ISBN-CIR-1', 'Clean Architecture', 'Robert C. Martin', 'Tech', 3, 3)
    `);
    const bookId = bookStmt.run().lastInsertRowid;

    const memberStmt = testDb.prepare(`
      INSERT INTO members (member_code, name, email, status, max_borrow_limit)
      VALUES ('MEM-CIR-1', 'Rohan Sharma', 'rohan@example.com', 'ACTIVE', 3)
    `);
    const memberId = memberStmt.run().lastInsertRowid;

    return { bookId: Number(bookId), memberId: Number(memberId) };
  }

  describe('1. Loan Issue API (POST /api/loans/issue)', () => {
    it('should issue a book successfully and decrement available_copies', async () => {
      const { bookId, memberId } = createFixtures();

      const res = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.book_id, bookId);
      assert.equal(res.body.data.member_id, memberId);
      assert.equal(res.body.data.status, 'ISSUED');
      assert.ok(res.body.data.issue_date);
      assert.ok(res.body.data.due_date);

      // Verify book available_copies was decremented from 3 to 2
      const book = testDb.prepare('SELECT available_copies FROM books WHERE id = ?').get(bookId);
      assert.equal(book.available_copies, 2);
    });

    it('should reject issue if book or member does not exist', async () => {
      const { bookId, memberId } = createFixtures();

      const resBadBook = await request(app).post('/api/loans/issue').send({
        book_id: 99999,
        member_id: memberId,
      });
      assert.equal(resBadBook.status, 404);
      assert.match(resBadBook.body.error, /Book not found/i);

      const resBadMember = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: 99999,
      });
      assert.equal(resBadMember.status, 404);
      assert.match(resBadMember.body.error, /Member not found/i);
    });

    it('should reject borrowing for SUSPENDED or INACTIVE members', async () => {
      const { bookId } = createFixtures();

      const suspendedStmt = testDb.prepare(`
        INSERT INTO members (member_code, name, email, status)
        VALUES ('MEM-SUSP', 'Suspended Member', 'susp@example.com', 'SUSPENDED')
      `);
      const suspMemberId = Number(suspendedStmt.run().lastInsertRowid);

      const res = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: suspMemberId,
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Only ACTIVE members/i);

      // Verify available copies remained unchanged
      const book = testDb.prepare('SELECT available_copies FROM books WHERE id = ?').get(bookId);
      assert.equal(book.available_copies, 3);
    });

    it('should reject borrowing when no copies are available', async () => {
      const { memberId } = createFixtures();

      const bookStmt = testDb.prepare(`
        INSERT INTO books (isbn, title, author, total_copies, available_copies)
        VALUES ('ISBN-ZERO-COPY', 'Out of stock', 'Author', 1, 0)
      `);
      const emptyBookId = Number(bookStmt.run().lastInsertRowid);

      const res = await request(app).post('/api/loans/issue').send({
        book_id: emptyBookId,
        member_id: memberId,
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /No available copies/i);
    });

    it('should reject borrowing when active loan limit (3) is reached', async () => {
      const { memberId } = createFixtures();

      // Create 3 books and issue all 3 to member
      for (let i = 1; i <= 3; i++) {
        const b = testDb
          .prepare(
            `INSERT INTO books (isbn, title, author, total_copies, available_copies) VALUES ('ISBN-LIMIT-${i}', 'Title ${i}', 'Author', 2, 2)`
          )
          .run();
        await request(app).post('/api/loans/issue').send({
          book_id: Number(b.lastInsertRowid),
          member_id: memberId,
        });
      }

      // Attempt 4th issue to the same member
      const b4 = testDb
        .prepare(
          `INSERT INTO books (isbn, title, author, total_copies, available_copies) VALUES ('ISBN-LIMIT-4', 'Title 4', 'Author', 2, 2)`
        )
        .run();

      const res = await request(app).post('/api/loans/issue').send({
        book_id: Number(b4.lastInsertRowid),
        member_id: memberId,
      });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Borrowing limit reached/i);
    });
  });

  describe('2. Loan Return API (POST /api/loans/:id/return)', () => {
    it('should return on-time book without fine and increment available_copies', async () => {
      const { bookId, memberId } = createFixtures();

      const issueRes = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
        issue_date: '2026-10-01',
        due_date: '2026-10-15',
      });
      const loanId = issueRes.body.data.id;

      // Return on or before due date (e.g. 2026-10-10)
      const returnRes = await request(app).post(`/api/loans/${loanId}/return`).send({
        return_date: '2026-10-10',
      });

      assert.equal(returnRes.status, 200);
      assert.equal(returnRes.body.data.status, 'RETURNED');
      assert.equal(returnRes.body.data.return_date, '2026-10-10');
      assert.equal(returnRes.body.data.overdue_days, 0);
      assert.equal(returnRes.body.data.fine_amount, 0);
      assert.equal(returnRes.body.data.fine_paid, true);

      // Book copies restored to 3
      const book = testDb.prepare('SELECT available_copies FROM books WHERE id = ?').get(bookId);
      assert.equal(book.available_copies, 3);
    });

    it('should calculate correct overdue days and ₹10/day fine on late return', async () => {
      const { bookId, memberId } = createFixtures();

      const issueRes = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
        issue_date: '2026-10-01',
        due_date: '2026-10-15',
      });
      const loanId = issueRes.body.data.id;

      // Return 5 days overdue (2026-10-20)
      const returnRes = await request(app).post(`/api/loans/${loanId}/return`).send({
        return_date: '2026-10-20',
      });

      assert.equal(returnRes.status, 200);
      assert.equal(returnRes.body.data.status, 'RETURNED');
      assert.equal(returnRes.body.data.overdue_days, 5);
      assert.equal(returnRes.body.data.fine_amount, 50); // 5 days * ₹10
      assert.equal(returnRes.body.data.outstanding_fine, 50);
      assert.equal(returnRes.body.data.fine_paid, false);

      // Copies restored
      const book = testDb.prepare('SELECT available_copies FROM books WHERE id = ?').get(bookId);
      assert.equal(book.available_copies, 3);
    });

    it('should prevent duplicate returns with 400', async () => {
      const { bookId, memberId } = createFixtures();

      const issueRes = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
      });
      const loanId = issueRes.body.data.id;

      await request(app).post(`/api/loans/${loanId}/return`);

      // Second return attempt
      const secondReturn = await request(app).post(`/api/loans/${loanId}/return`);
      assert.equal(secondReturn.status, 400);
      assert.match(secondReturn.body.error, /already been returned/i);
    });
  });

  describe('3. Loan Queries (GET /api/loans, GET /api/loans/:id, GET /api/loans/overdue)', () => {
    it('GET /api/loans should list loans with joined book and member details', async () => {
      const { bookId, memberId } = createFixtures();

      await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
      });

      const res = await request(app).get('/api/loans');
      assert.equal(res.status, 200);
      assert.equal(res.body.count, 1);
      assert.equal(res.body.data[0].book_title, 'Clean Architecture');
      assert.equal(res.body.data[0].member_name, 'Rohan Sharma');
    });

    it('GET /api/loans/overdue should list only unreturned overdue loans', async () => {
      const { bookId, memberId } = createFixtures();

      // 1. Overdue unreturned loan (due in past)
      await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
        issue_date: '2026-09-01',
        due_date: '2026-09-15',
      });

      // 2. On-time active loan (due in future)
      const b2 = testDb
        .prepare(`INSERT INTO books (isbn, title, author, total_copies, available_copies) VALUES ('ISBN-FUT', 'Future', 'A', 2, 2)`)
        .run();
      await request(app).post('/api/loans/issue').send({
        book_id: Number(b2.lastInsertRowid),
        member_id: memberId,
        issue_date: '2026-10-18',
        due_date: '2026-11-01',
      });

      const overdueRes = await request(app).get('/api/loans/overdue');
      assert.equal(overdueRes.status, 200);
      assert.equal(overdueRes.body.count, 1);
      assert.equal(overdueRes.body.data[0].status, 'OVERDUE');
      assert.ok(overdueRes.body.data[0].overdue_days > 0);
      assert.ok(overdueRes.body.data[0].fine_amount > 0);
    });

    it('GET /api/loans/:id should retrieve loan by ID or 404', async () => {
      const { bookId, memberId } = createFixtures();

      const issueRes = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
      });
      const loanId = issueRes.body.data.id;

      const res = await request(app).get(`/api/loans/${loanId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.id, loanId);

      const notFound = await request(app).get('/api/loans/99999');
      assert.equal(notFound.status, 404);
    });
  });

  describe('4. Fine Settlement API (POST /api/loans/:id/pay-fine)', () => {
    it('should support partial payment and full settlement of overdue fine', async () => {
      const { bookId, memberId } = createFixtures();

      // Issue with past due date
      const issueRes = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
        issue_date: '2026-10-01',
        due_date: '2026-10-10',
      });
      const loanId = issueRes.body.data.id;

      // Return 5 days late -> Fine is ₹50
      await request(app).post(`/api/loans/${loanId}/return`).send({
        return_date: '2026-10-15',
      });

      // 1. Partial payment: pay ₹20 of ₹50
      const partPay = await request(app).post(`/api/loans/${loanId}/pay-fine`).send({
        amount: 20,
      });
      assert.equal(partPay.status, 200);
      assert.equal(partPay.body.data.paid_amount, 20);
      assert.equal(partPay.body.data.outstanding_fine, 30);
      assert.equal(partPay.body.data.fine_paid, false);

      // 2. Full settlement: pay remaining ₹30
      const fullPay = await request(app).post(`/api/loans/${loanId}/pay-fine`).send({
        amount: 30,
      });
      assert.equal(fullPay.status, 200);
      assert.equal(fullPay.body.data.paid_amount, 50);
      assert.equal(fullPay.body.data.outstanding_fine, 0);
      assert.equal(fullPay.body.data.fine_paid, true);

      // 3. Subsequent payment attempt should be rejected (fine already paid)
      const extraPay = await request(app).post(`/api/loans/${loanId}/pay-fine`).send({
        amount: 10,
      });
      assert.equal(extraPay.status, 400);
      assert.match(extraPay.body.error, /already been fully paid/i);
    });

    it('should reject payment exceeding outstanding balance', async () => {
      const { bookId, memberId } = createFixtures();

      const issueRes = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
        issue_date: '2026-10-01',
        due_date: '2026-10-10',
      });
      const loanId = issueRes.body.data.id;

      // Fine = ₹20
      await request(app).post(`/api/loans/${loanId}/return`).send({
        return_date: '2026-10-12',
      });

      // Try paying ₹50 on a ₹20 fine
      const res = await request(app).post(`/api/loans/${loanId}/pay-fine`).send({
        amount: 50,
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /exceeds outstanding fine balance/i);
    });

    it('should reject payment when no fine exists', async () => {
      const { bookId, memberId } = createFixtures();

      const issueRes = await request(app).post('/api/loans/issue').send({
        book_id: bookId,
        member_id: memberId,
      });
      const loanId = issueRes.body.data.id;

      // Return on-time -> Fine = 0
      await request(app).post(`/api/loans/${loanId}/return`);

      const res = await request(app).post(`/api/loans/${loanId}/pay-fine`).send({
        amount: 10,
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /No fine is associated/i);
    });
  });
});
