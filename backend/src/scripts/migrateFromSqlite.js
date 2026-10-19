const Database = require('better-sqlite3');
const config = require('../config');
const { getPool, initSchema, closePool } = require('../models/db');

/**
 * Standalone, idempotent migration script to safely transfer data
 * from the read-only SQLite database to MySQL InnoDB.
 */
async function migrate({ dryRun = false } = {}) {
  console.log('====================================================');
  console.log(' NCLC-2: SQLite to MySQL Safe Data Migration Engine ');
  console.log('====================================================');

  // 1. Open SQLite database in strictly read-only mode
  console.log(`[Source] Connecting to SQLite: ${config.sqliteDbPath} (readonly)`);
  const sqliteDb = new Database(config.sqliteDbPath, { readonly: true, fileMustExist: true });

  // 2. Fetch SQLite source data and counts
  const sourceBooks = sqliteDb.prepare('SELECT * FROM books ORDER BY id ASC').all();
  const sourceMembers = sqliteDb.prepare('SELECT * FROM members ORDER BY id ASC').all();
  const sourceLoans = sqliteDb.prepare('SELECT * FROM loans ORDER BY id ASC').all();

  console.log(`[Source] Found ${sourceBooks.length} books, ${sourceMembers.length} members, ${sourceLoans.length} loans in SQLite.`);

  // 3. Connect to target MySQL
  console.log(`[Target] Connecting to MySQL at ${config.db.host}:${config.db.port}/${config.db.database}`);
  const pool = getPool();

  // Ensure tables exist in target MySQL
  await initSchema(pool);

  // 4. Inspect current destination table counts
  const [[targetBookCountRow]] = await pool.query('SELECT COUNT(*) as c FROM books');
  const [[targetMemberCountRow]] = await pool.query('SELECT COUNT(*) as c FROM members');
  const [[targetLoanCountRow]] = await pool.query('SELECT COUNT(*) as c FROM loans');

  const destBookCount = Number(targetBookCountRow.c);
  const destMemberCount = Number(targetMemberCountRow.c);
  const destLoanCount = Number(targetLoanCountRow.c);

  console.log(`[Target] Existing row counts in MySQL: ${destBookCount} books, ${destMemberCount} members, ${destLoanCount} loans.`);

  if (destBookCount > 0 || destMemberCount > 0 || destLoanCount > 0) {
    console.log('[Notice] Destination MySQL tables already contain data.');
    if (destBookCount === sourceBooks.length && destMemberCount === sourceMembers.length && destLoanCount === sourceLoans.length) {
      console.log('[Notice] Target database appears to be fully migrated and synchronized already.');
      sqliteDb.close();
      await closePool();
      return { success: true, message: 'Already synchronized' };
    }
  }

  if (dryRun) {
    console.log('[DryRun] Dry run requested. No changes written to MySQL.');
    sqliteDb.close();
    await closePool();
    return { success: true, dryRun: true };
  }

  // 5. Perform migration in an explicit MySQL transaction
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    console.log('[Migrate] Step 1/3: Migrating Books...');
    let booksInserted = 0;
    for (const b of sourceBooks) {
      await conn.query(
        `INSERT INTO books (
          id, isbn, title, author, genre, total_copies, available_copies, shelf_location, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        ) ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          author = VALUES(author),
          genre = VALUES(genre),
          total_copies = VALUES(total_copies),
          available_copies = VALUES(available_copies),
          shelf_location = VALUES(shelf_location)`,
        [
          b.id,
          b.isbn,
          b.title,
          b.author,
          b.genre || null,
          b.total_copies,
          b.available_copies,
          b.shelf_location || null,
          b.created_at || new Date(),
          b.updated_at || new Date(),
        ]
      );
      booksInserted++;
    }

    console.log('[Migrate] Step 2/3: Migrating Members...');
    let membersInserted = 0;
    for (const m of sourceMembers) {
      await conn.query(
        `INSERT INTO members (
          id, member_code, name, email, phone, status, max_borrow_limit, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        ) ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          phone = VALUES(phone),
          status = VALUES(status),
          max_borrow_limit = VALUES(max_borrow_limit)`,
        [
          m.id,
          m.member_code,
          m.name,
          m.email,
          m.phone || null,
          m.status || 'ACTIVE',
          m.max_borrow_limit || 3,
          m.created_at || new Date(),
          m.updated_at || new Date(),
        ]
      );
      membersInserted++;
    }

    console.log('[Migrate] Step 3/3: Migrating Loans...');
    let loansInserted = 0;
    for (const l of sourceLoans) {
      await conn.query(
        `INSERT INTO loans (
          id, book_id, member_id, issue_date, due_date, return_date, status, fine_amount, paid_amount, fine_paid, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        ) ON DUPLICATE KEY UPDATE
          return_date = VALUES(return_date),
          status = VALUES(status),
          fine_amount = VALUES(fine_amount),
          paid_amount = VALUES(paid_amount),
          fine_paid = VALUES(fine_paid)`,
        [
          l.id,
          l.book_id,
          l.member_id,
          l.issue_date,
          l.due_date,
          l.return_date || null,
          l.status || 'ISSUED',
          Number(l.fine_amount || 0),
          Number(l.paid_amount || 0),
          l.fine_paid ? 1 : 0,
          l.created_at || new Date(),
          l.updated_at || new Date(),
        ]
      );
      loansInserted++;
    }

    // Align auto-increment counters to prevent ID collisions on future inserts
    if (sourceBooks.length > 0) {
      const maxBookId = Math.max(...sourceBooks.map((b) => b.id));
      await conn.query(`ALTER TABLE books AUTO_INCREMENT = ${maxBookId + 1}`);
    }
    if (sourceMembers.length > 0) {
      const maxMemberId = Math.max(...sourceMembers.map((m) => m.id));
      await conn.query(`ALTER TABLE members AUTO_INCREMENT = ${maxMemberId + 1}`);
    }
    if (sourceLoans.length > 0) {
      const maxLoanId = Math.max(...sourceLoans.map((l) => l.id));
      await conn.query(`ALTER TABLE loans AUTO_INCREMENT = ${maxLoanId + 1}`);
    }

    await conn.commit();
    console.log(`[Success] Migrated: ${booksInserted} books, ${membersInserted} members, ${loansInserted} loans.`);

    // 6. Verify row counts in destination
    const [[finalBooks]] = await conn.query('SELECT COUNT(*) as c FROM books');
    const [[finalMembers]] = await conn.query('SELECT COUNT(*) as c FROM members');
    const [[finalLoans]] = await conn.query('SELECT COUNT(*) as c FROM loans');

    console.log(`[Verification] Final MySQL counts: ${finalBooks.c} books, ${finalMembers.c} members, ${finalLoans.c} loans.`);

    sqliteDb.close();
    conn.release();
    await closePool();

    return {
      success: true,
      source: { books: sourceBooks.length, members: sourceMembers.length, loans: sourceLoans.length },
      destination: { books: Number(finalBooks.c), members: Number(finalMembers.c), loans: Number(finalLoans.c) },
    };
  } catch (err) {
    await conn.rollback();
    conn.release();
    sqliteDb.close();
    await closePool();
    console.error('[Error] Migration transaction failed and rolled back:', err.message);
    throw err;
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[Migration] Finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}

module.exports = { migrate };
