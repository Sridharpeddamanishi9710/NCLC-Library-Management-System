const { getPool, initSchema, closePool } = require('../models/db');
const config = require('../config');

const sampleBooks = [
  {
    isbn: '978-0132350884',
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    author: 'Robert C. Martin',
    genre: 'Computer Science',
    total_copies: 5,
    available_copies: 5,
    shelf_location: 'CS-101',
  },
  {
    isbn: '978-0201616224',
    title: 'The Pragmatic Programmer: Your Journey to Mastery',
    author: 'David Thomas, Andrew Hunt',
    genre: 'Computer Science',
    total_copies: 4,
    available_copies: 4,
    shelf_location: 'CS-102',
  },
  {
    isbn: '978-0134685991',
    title: 'Effective Java (3rd Edition)',
    author: 'Joshua Bloch',
    genre: 'Computer Science',
    total_copies: 3,
    available_copies: 3,
    shelf_location: 'CS-103',
  },
  {
    isbn: '978-0262033848',
    title: 'Introduction to Algorithms (CLRS)',
    author: 'Thomas H. Cormen, Charles E. Leiserson',
    genre: 'Computer Science',
    total_copies: 6,
    available_copies: 6,
    shelf_location: 'CS-104',
  },
  {
    isbn: '978-0451524935',
    title: '1984',
    author: 'George Orwell',
    genre: 'Dystopian Fiction',
    total_copies: 3,
    available_copies: 3,
    shelf_location: 'FIC-201',
  },
  {
    isbn: '978-0061120084',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    genre: 'Classic Fiction',
    total_copies: 4,
    available_copies: 4,
    shelf_location: 'FIC-202',
  },
  {
    isbn: '978-0307474728',
    title: 'Sapiens: A Brief History of Humankind',
    author: 'Yuval Noah Harari',
    genre: 'History / Non-Fiction',
    total_copies: 5,
    available_copies: 5,
    shelf_location: 'HIST-301',
  },
  {
    isbn: '978-0553380163',
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    genre: 'Science',
    total_copies: 2,
    available_copies: 2,
    shelf_location: 'SCI-401',
  },
];

const sampleMembers = [
  {
    member_code: 'MEM-1001',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    phone: '+91-9876543210',
    status: 'ACTIVE',
    max_borrow_limit: 3,
  },
  {
    member_code: 'MEM-1002',
    name: 'Diya Patel',
    email: 'diya.patel@example.com',
    phone: '+91-9876543211',
    status: 'ACTIVE',
    max_borrow_limit: 3,
  },
  {
    member_code: 'MEM-1003',
    name: 'Rohan Verma',
    email: 'rohan.verma@example.com',
    phone: '+91-9876543212',
    status: 'ACTIVE',
    max_borrow_limit: 3,
  },
  {
    member_code: 'MEM-1004',
    name: 'Ananya Iyer',
    email: 'ananya.iyer@example.com',
    phone: '+91-9876543213',
    status: 'ACTIVE',
    max_borrow_limit: 3,
  },
  {
    member_code: 'MEM-1005',
    name: 'Vikram Singh',
    email: 'vikram.singh@example.com',
    phone: '+91-9876543214',
    status: 'ACTIVE',
    max_borrow_limit: 3,
  },
];

/**
 * Seeds books and members safely into MySQL without overwriting or deleting data.
 * @param {import('mysql2/promise').Pool} [targetPool]
 */
async function seed(targetPool) {
  const pool = targetPool || getPool();
  await initSchema(pool);

  console.log('[Seed] Seeding sample data into MySQL (safe & repeatable)...');

  let booksAdded = 0;
  let membersAdded = 0;

  for (const book of sampleBooks) {
    const [res] = await pool.query(
      `INSERT IGNORE INTO books (
        isbn, title, author, genre, total_copies, available_copies, shelf_location
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        book.isbn,
        book.title,
        book.author,
        book.genre,
        book.total_copies,
        book.available_copies,
        book.shelf_location,
      ]
    );
    if (res.affectedRows > 0) booksAdded++;
  }

  for (const member of sampleMembers) {
    const [res] = await pool.query(
      `INSERT IGNORE INTO members (
        member_code, name, email, phone, status, max_borrow_limit
      ) VALUES (
        ?, ?, ?, ?, ?, ?
      )`,
      [
        member.member_code,
        member.name,
        member.email,
        member.phone,
        member.status,
        member.max_borrow_limit,
      ]
    );
    if (res.affectedRows > 0) membersAdded++;
  }

  const [[totalB]] = await pool.query('SELECT COUNT(*) as c FROM books');
  const [[totalM]] = await pool.query('SELECT COUNT(*) as c FROM members');

  console.log(`[Seed] Books added: ${booksAdded} (Total books in DB: ${totalB.c})`);
  console.log(`[Seed] Members added: ${membersAdded} (Total members in DB: ${totalM.c})`);

  if (!targetPool) {
    await closePool();
  }

  return { booksAdded, membersAdded, totalBooks: Number(totalB.c), totalMembers: Number(totalM.c) };
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error seeding database:', err.message);
      process.exit(1);
    });
}

module.exports = { seed, sampleBooks, sampleMembers };
