const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const request = require('supertest');
const { initSchema, setDb, closeDb } = require('../src/models/db');
const app = require('../src/app');

describe('Milestone 2 - Books API (/api/books)', () => {
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

  it('GET /api/books should return empty array when no books exist', async () => {
    const res = await request(app).get('/api/books');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.data, []);
  });

  it('POST /api/books should create a new book successfully', async () => {
    const payload = {
      isbn: '978-0132350884',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      genre: 'Computer Science',
      total_copies: 5,
      shelf_location: 'CS-101',
    };

    const res = await request(app).post('/api/books').send(payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.isbn, payload.isbn);
    assert.equal(res.body.data.title, payload.title);
    assert.equal(res.body.data.total_copies, 5);
    assert.equal(res.body.data.available_copies, 5); // Defaults to total_copies
    assert.equal(res.body.data.shelf_location, 'CS-101');
  });

  it('POST /api/books should reject missing required fields with 400', async () => {
    const res = await request(app).post('/api/books').send({
      title: 'Missing ISBN and Author',
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.details.length >= 3);
  });

  it('POST /api/books should reject invalid copy numbers with 400', async () => {
    const resNegative = await request(app).post('/api/books').send({
      isbn: '978-0000000001',
      title: 'Invalid Book',
      author: 'Author',
      total_copies: -2,
    });
    assert.equal(resNegative.status, 400);

    const resAvailExceeds = await request(app).post('/api/books').send({
      isbn: '978-0000000002',
      title: 'Invalid Book 2',
      author: 'Author',
      total_copies: 3,
      available_copies: 5,
    });
    assert.equal(resAvailExceeds.status, 400);
  });

  it('POST /api/books should return 409 Conflict for duplicate ISBN', async () => {
    const book = {
      isbn: '978-0132350884',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      total_copies: 3,
    };

    await request(app).post('/api/books').send(book);
    const resDuplicate = await request(app).post('/api/books').send(book);

    assert.equal(resDuplicate.status, 409);
    assert.equal(resDuplicate.body.success, false);
    assert.match(resDuplicate.body.error, /already exists/i);
  });

  it('GET /api/books/:id should return single book or 404', async () => {
    const createRes = await request(app).post('/api/books').send({
      isbn: '978-1111111111',
      title: 'Test Book',
      author: 'Test Author',
      total_copies: 2,
    });

    const bookId = createRes.body.data.id;

    // Existing book
    const res = await request(app).get(`/api/books/${bookId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.title, 'Test Book');
    assert.equal(res.body.data.active_loans_count, 0);

    // Non-existent ID
    const resNotFound = await request(app).get('/api/books/99999');
    assert.equal(resNotFound.status, 404);
    assert.equal(resNotFound.body.success, false);

    // Invalid non-integer ID
    const resInvalid = await request(app).get('/api/books/invalid');
    assert.equal(resInvalid.status, 400);
  });

  it('GET /api/books search and genre filters should work properly', async () => {
    await request(app).post('/api/books').send({
      isbn: '111-A',
      title: 'JavaScript The Good Parts',
      author: 'Douglas Crockford',
      genre: 'Tech',
      total_copies: 3,
    });

    await request(app).post('/api/books').send({
      isbn: '222-B',
      title: 'Python Crash Course',
      author: 'Eric Matthes',
      genre: 'Tech',
      total_copies: 2,
    });

    await request(app).post('/api/books').send({
      isbn: '333-C',
      title: '1984',
      author: 'George Orwell',
      genre: 'Fiction',
      total_copies: 4,
    });

    // Search by title
    const searchRes = await request(app).get('/api/books?search=javascript');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.count, 1);
    assert.equal(searchRes.body.data[0].isbn, '111-A');

    // Search by author
    const authorRes = await request(app).get('/api/books?search=orwell');
    assert.equal(authorRes.body.count, 1);
    assert.equal(authorRes.body.data[0].title, '1984');

    // Search by ISBN
    const isbnRes = await request(app).get('/api/books?search=222-B');
    assert.equal(isbnRes.body.count, 1);
    assert.equal(isbnRes.body.data[0].author, 'Eric Matthes');

    // Filter by genre
    const genreRes = await request(app).get('/api/books?genre=tech');
    assert.equal(genreRes.body.count, 2);

    // Filter by availableOnly
    await request(app).post('/api/books').send({
      isbn: '444-D',
      title: 'Out of Stock Book',
      author: 'Unknown',
      genre: 'Tech',
      total_copies: 1,
      available_copies: 0,
    });

    const availRes = await request(app).get('/api/books?genre=tech&availableOnly=true');
    assert.equal(availRes.body.count, 2);
  });

  it('PUT /api/books/:id should update book details', async () => {
    const createRes = await request(app).post('/api/books').send({
      isbn: '978-5555555555',
      title: 'Original Title',
      author: 'Original Author',
      genre: 'Fiction',
      total_copies: 3,
    });

    const id = createRes.body.data.id;

    const updateRes = await request(app).put(`/api/books/${id}`).send({
      title: 'Updated Title',
      shelf_location: 'NEW-SHELF',
      total_copies: 5,
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.title, 'Updated Title');
    assert.equal(updateRes.body.data.shelf_location, 'NEW-SHELF');
    assert.equal(updateRes.body.data.total_copies, 5);
    assert.equal(updateRes.body.data.available_copies, 5);
  });

  it('PUT /api/books/:id should reject reducing total_copies below borrowed count', async () => {
    const createRes = await request(app).post('/api/books').send({
      isbn: '978-6666666666',
      title: 'Borrowed Book',
      author: 'Author',
      total_copies: 4,
      available_copies: 1, // 3 copies currently borrowed
    });

    const id = createRes.body.data.id;

    // Trying to reduce total_copies to 2 when 3 are currently borrowed
    const res = await request(app).put(`/api/books/${id}`).send({
      total_copies: 2,
    });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Cannot reduce total_copies/i);
  });

  it('DELETE /api/books/:id should prevent deletion when active loans exist', async () => {
    // 1. Create a book
    const bookRes = await request(app).post('/api/books').send({
      isbn: '978-7777777777',
      title: 'Active Loan Book',
      author: 'Author',
      total_copies: 2,
    });
    const bookId = bookRes.body.data.id;

    // 2. Create a member
    const memberStmt = testDb.prepare(`
      INSERT INTO members (member_code, name, email)
      VALUES ('MEM-TEST', 'Test Member', 'test@example.com')
    `);
    const memberId = memberStmt.run().lastInsertRowid;

    // 3. Create an active loan directly
    testDb.prepare(`
      INSERT INTO loans (book_id, member_id, due_date, status)
      VALUES (?, ?, '2026-11-01', 'ISSUED')
    `).run(bookId, memberId);

    // 4. Attempting to delete the book should fail with 400
    const delRes = await request(app).delete(`/api/books/${bookId}`);
    assert.equal(delRes.status, 400);
    assert.match(delRes.body.error, /active loans/i);

    // Book should still exist in database
    const checkBook = await request(app).get(`/api/books/${bookId}`);
    assert.equal(checkBook.status, 200);
  });

  it('DELETE /api/books/:id should delete safely when no active loans exist', async () => {
    const bookRes = await request(app).post('/api/books').send({
      isbn: '978-8888888888',
      title: 'Delete Me Book',
      author: 'Author',
      total_copies: 1,
    });
    const bookId = bookRes.body.data.id;

    const delRes = await request(app).delete(`/api/books/${bookId}`);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    const checkRes = await request(app).get(`/api/books/${bookId}`);
    assert.equal(checkRes.status, 404);
  });
});
