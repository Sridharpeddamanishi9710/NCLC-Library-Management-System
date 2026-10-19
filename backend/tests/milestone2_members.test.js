const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const request = require('supertest');
const { initSchema, setDb, closeDb } = require('../src/models/db');
const app = require('../src/app');

describe('Milestone 2 - Members API (/api/members)', () => {
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

  it('GET /api/members should return empty array when no members exist', async () => {
    const res = await request(app).get('/api/members');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 0);
    assert.deepEqual(res.body.data, []);
  });

  it('POST /api/members should register a new member successfully', async () => {
    const payload = {
      member_code: 'MEM-001',
      name: 'Priya Sharma',
      email: 'priya.sharma@example.com',
      phone: '+91-9988776655',
    };

    const res = await request(app).post('/api/members').send(payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.member_code, 'MEM-001');
    assert.equal(res.body.data.name, 'Priya Sharma');
    assert.equal(res.body.data.email, 'priya.sharma@example.com');
    assert.equal(res.body.data.status, 'ACTIVE'); // Default
    assert.equal(res.body.data.max_borrow_limit, 3); // Default
  });

  it('POST /api/members should reject invalid inputs with 400', async () => {
    // Missing required fields
    const resMissing = await request(app).post('/api/members').send({
      name: 'Incomplete Member',
    });
    assert.equal(resMissing.status, 400);
    assert.equal(resMissing.body.success, false);

    // Invalid email format
    const resInvalidEmail = await request(app).post('/api/members').send({
      member_code: 'MEM-002',
      name: 'Bad Email Member',
      email: 'not-an-email',
    });
    assert.equal(resInvalidEmail.status, 400);
    assert.match(resInvalidEmail.body.details.join(' '), /valid email/i);

    // Invalid status
    const resInvalidStatus = await request(app).post('/api/members').send({
      member_code: 'MEM-003',
      name: 'Bad Status',
      email: 'status@example.com',
      status: 'BANNED', // Not in ('ACTIVE', 'SUSPENDED', 'INACTIVE')
    });
    assert.equal(resInvalidStatus.status, 400);
  });

  it('POST /api/members should return 409 on duplicate member_code or email', async () => {
    const member = {
      member_code: 'MEM-001',
      name: 'Priya Sharma',
      email: 'priya@example.com',
    };

    await request(app).post('/api/members').send(member);

    // Duplicate code
    const resDuplicateCode = await request(app).post('/api/members').send({
      member_code: 'MEM-001',
      name: 'Another Name',
      email: 'different@example.com',
    });
    assert.equal(resDuplicateCode.status, 409);
    assert.match(resDuplicateCode.body.error, /member code already exists/i);

    // Duplicate email
    const resDuplicateEmail = await request(app).post('/api/members').send({
      member_code: 'MEM-002',
      name: 'Another Name',
      email: 'priya@example.com',
    });
    assert.equal(resDuplicateEmail.status, 409);
    assert.match(resDuplicateEmail.body.error, /email address already exists/i);
  });

  it('GET /api/members/:id should return single member or 404', async () => {
    const createRes = await request(app).post('/api/members').send({
      member_code: 'MEM-100',
      name: 'Single Member',
      email: 'single@example.com',
    });

    const id = createRes.body.data.id;

    const res = await request(app).get(`/api/members/${id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.member_code, 'MEM-100');
    assert.equal(res.body.data.active_loans_count, 0);

    const res404 = await request(app).get('/api/members/9999');
    assert.equal(res404.status, 404);

    const resInvalid = await request(app).get('/api/members/bad_id');
    assert.equal(resInvalid.status, 400);
  });

  it('GET /api/members should support search and status filtering', async () => {
    await request(app).post('/api/members').send({
      member_code: 'MEM-201',
      name: 'Rajesh Kumar',
      email: 'rajesh@example.com',
      phone: '9876500001',
      status: 'ACTIVE',
    });

    await request(app).post('/api/members').send({
      member_code: 'MEM-202',
      name: 'Anita Roy',
      email: 'anita@example.com',
      phone: '9876500002',
      status: 'SUSPENDED',
    });

    // Search by name
    const searchRes = await request(app).get('/api/members?search=rajesh');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.count, 1);
    assert.equal(searchRes.body.data[0].member_code, 'MEM-201');

    // Filter by status
    const statusRes = await request(app).get('/api/members?status=SUSPENDED');
    assert.equal(statusRes.body.count, 1);
    assert.equal(statusRes.body.data[0].name, 'Anita Roy');
  });

  it('PUT /api/members/:id should update member details', async () => {
    const createRes = await request(app).post('/api/members').send({
      member_code: 'MEM-301',
      name: 'Old Name',
      email: 'old@example.com',
    });

    const id = createRes.body.data.id;

    const updateRes = await request(app).put(`/api/members/${id}`).send({
      name: 'New Name',
      phone: '+91-1122334455',
      max_borrow_limit: 5,
      status: 'SUSPENDED',
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.name, 'New Name');
    assert.equal(updateRes.body.data.phone, '+91-1122334455');
    assert.equal(updateRes.body.data.max_borrow_limit, 5);
    assert.equal(updateRes.body.data.status, 'SUSPENDED');
  });

  it('DELETE /api/members/:id should prevent deletion or deactivation when active loans exist', async () => {
    // 1. Create a book and member
    const bookStmt = testDb.prepare(`
      INSERT INTO books (isbn, title, author, total_copies, available_copies)
      VALUES ('ISBN-MEMBER-TEST', 'Title', 'Author', 2, 1)
    `);
    const bookId = bookStmt.run().lastInsertRowid;

    const memberRes = await request(app).post('/api/members').send({
      member_code: 'MEM-ACTIVE-LOAN',
      name: 'Borrower',
      email: 'borrower@example.com',
    });
    const memberId = memberRes.body.data.id;

    // 2. Issue an active loan
    testDb.prepare(`
      INSERT INTO loans (book_id, member_id, due_date, status)
      VALUES (?, ?, '2026-11-01', 'ISSUED')
    `).run(bookId, memberId);

    // 3. Delete should fail with 400
    const delRes = await request(app).delete(`/api/members/${memberId}`);
    assert.equal(delRes.status, 400);
    assert.match(delRes.body.error, /active loans/i);

    // Member should still be intact
    const checkMember = await request(app).get(`/api/members/${memberId}`);
    assert.equal(checkMember.status, 200);
  });

  it('DELETE /api/members/:id?action=deactivate should deactivate member when no active loans exist', async () => {
    const memberRes = await request(app).post('/api/members').send({
      member_code: 'MEM-DEACTIVATE',
      name: 'To Deactivate',
      email: 'deact@example.com',
      status: 'ACTIVE',
    });
    const memberId = memberRes.body.data.id;

    const res = await request(app).delete(`/api/members/${memberId}?action=deactivate`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'INACTIVE');

    const checkRes = await request(app).get(`/api/members/${memberId}`);
    assert.equal(checkRes.body.data.status, 'INACTIVE');
  });

  it('DELETE /api/members/:id should safely delete member without loan history', async () => {
    const memberRes = await request(app).post('/api/members').send({
      member_code: 'MEM-CLEAN-DELETE',
      name: 'Clean Delete',
      email: 'clean@example.com',
    });
    const memberId = memberRes.body.data.id;

    const res = await request(app).delete(`/api/members/${memberId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const checkRes = await request(app).get(`/api/members/${memberId}`);
    assert.equal(checkRes.status, 404);
  });
});
