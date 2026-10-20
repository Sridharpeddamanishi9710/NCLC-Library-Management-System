# NCLC-2: Library Management System

A robust, full-stack Library Management System built for the NCLC internship project.

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MySQL 8.0+ (via `mysql2/promise` with connection pooling, transactions, and row-level locking)
- **Data Migration**: Automated migration script preserving SQLite data and primary keys
- **Frontend**: React, Vite
- **Testing**: Node.js Native Test Runner (`node:test`, `node:assert`) with `supertest`, strictly isolated to dedicated MySQL test database (`library_management_test`)

---

## Initial Business Rules
- **Loan Duration**: 14 days
- **Overdue Fine Rate**: ₹10.00 per day overdue
- **Borrow Limit**: Maximum 3 active book loans per member
- **Access Model**: Single librarian/admin operations model

---

## Project Structure
```text
NCLC-Library-Management-System/
├── backend/
│   ├── data/                 # Legacy SQLite databases (library.db & backup, preserved read-only)
│   ├── src/
│   │   ├── config/           # Environment config & library business constants
│   │   ├── controllers/      # BookController, MemberController, LoanController
│   │   ├── middlewares/      # Input validation & centralized error handling
│   │   ├── models/           # MySQL pool (db.js), BookModel, MemberModel, LoanModel, schema.mysql.sql
│   │   ├── routes/           # bookRoutes.js, memberRoutes.js, loanRoutes.js
│   │   ├── scripts/          # initDb.js, migrateFromSqlite.js, and repeatable seed.js
│   │   ├── services/         # Circulation & domain business logic
│   │   ├── app.js            # Express app configuration & middleware pipeline
│   │   └── server.js         # HTTP server entry point with MySQL health check
│   ├── tests/                # Automated database, API, and constraint test suites (isolated test DB)
│   ├── .env.example          # Template environment file
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable React UI components
│   │   ├── pages/            # View pages (Dashboard, Books, Members, Circulation)
│   │   ├── services/         # API HTTP client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── .gitignore                # Excludes node_modules, .env, *.db, dist
└── README.md
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ or v24+)
- npm (v10+ or v11+)
- [MySQL Server 8.0+](https://dev.mysql.com/downloads/mysql/) running locally (default: `127.0.0.1:3306`)

---

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file to `.env`:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*

   Update `.env` with your MySQL root password:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_actual_mysql_password
   DB_NAME=library_management
   DB_NAME_TEST=library_management_test
   ```

4. **Initialize Database Schema**:
   Ensure the database exists (e.g. created via MySQL Workbench or CLI: `CREATE DATABASE library_management;`).
   Then create all tables, constraints, foreign keys, and indexes:
   ```bash
   npm run db:init
   ```

5. **Data Population Options**:
   - **Option A: Migrate from Existing SQLite Database**:
     Safely migrate all books, members, and loans from `backend/data/library.db`:
     ```bash
     npm run db:migrate
     ```
     *Note: The migration script is transactional, preserves IDs, aligns `AUTO_INCREMENT`, and is idempotent.*

   - **Option B: Seed Fresh Sample Data**:
     Insert default sample catalog and members:
     ```bash
     npm run db:seed
     ```
     *Note: The seed script uses `INSERT IGNORE` and is completely safe and repeatable.*

6. **Run Automated Tests**:
   Create the isolated test database once:
   ```sql
   CREATE DATABASE IF NOT EXISTS library_management_test;
   ```
   Then run the full automated test suite:
   ```bash
   npm test
   ```
   *(Runs all test suites sequentially against `library_management_test` without altering production/dev data)*

7. **Start Backend Server**:
   ```bash
   npm run dev
   # or
   npm start
   ```
   The backend API runs at `http://localhost:5000`.
   Verify via health endpoint: `http://localhost:5000/api/health`.

---

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start Frontend Development Server**:
   ```bash
   npm run dev
   ```
   The library application UI runs at `http://localhost:5173`.
   By default, it connects to the backend at `http://localhost:5000/api`.
   You can optionally configure `VITE_API_URL` via `frontend/.env`.

4. **Production Build & Linter**:
   ```bash
   npm run build
   npm run lint
   ```

---

## API Documentation (Milestone 2)

All API responses return consistent JSON formats with appropriate HTTP status codes.

### Standard Response Format
- **Success**: `{ "success": true, "data": ... }` or `{ "success": true, "count": N, "data": [ ... ] }`
- **Error**: `{ "success": false, "error": "Human-readable error description", "details": [ ... ] }`

---

### Books API (`/api/books`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/books` | List all books with optional search & filters |
| `GET` | `/api/books/:id` | Get book details and active loans count by numeric ID |
| `POST` | `/api/books` | Add a new book (validates unique ISBN) |
| `PUT` | `/api/books/:id` | Update book metadata and copy quantities |
| `DELETE` | `/api/books/:id` | Safely delete a book (blocked if active loans exist) |

#### Query Parameters for `GET /api/books`
- `search`: Filter by title, author, or ISBN (e.g. `?search=clean`)
- `genre`: Filter by exact genre (e.g. `?genre=Computer+Science`)
- `availableOnly`: Filter books with available copies $> 0$ (e.g. `?availableOnly=true`)

#### Example Request: Create Book (`POST /api/books`)
```json
{
  "isbn": "978-0132350884",
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "genre": "Computer Science",
  "total_copies": 5,
  "shelf_location": "CS-101"
}
```

#### Example Response (`201 Created`)
```json
{
  "success": true,
  "message": "Book created successfully.",
  "data": {
    "id": 1,
    "isbn": "978-0132350884",
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "genre": "Computer Science",
    "total_copies": 5,
    "available_copies": 5,
    "shelf_location": "CS-101",
    "created_at": "2026-10-19 07:00:00",
    "updated_at": "2026-10-19 07:00:00",
    "active_loans_count": 0
  }
}
```

---

### Members API (`/api/members`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/members` | List members with optional search and status filter |
| `GET` | `/api/members/:id` | Get member details and active loans count |
| `POST` | `/api/members` | Register a new member (validates code & email) |
| `PUT` | `/api/members/:id` | Update member profile, borrow limits, or status |
| `DELETE` | `/api/members/:id` | Safely delete or deactivate member (blocked if active loans exist) |

#### Query Parameters for `GET /api/members`
- `search`: Filter by name, email, member code, or phone (e.g. `?search=aarav`)
- `status`: Filter by status (`ACTIVE`, `SUSPENDED`, `INACTIVE`)

#### Deletion / Deactivation Rules (`DELETE /api/members/:id`)
- **Active Loans Protection**: If the member currently has borrowed books (`status = 'ISSUED'`), deletion or deactivation is **blocked with HTTP 400**.
- **Historical Loan Safety**: If the member has past returned loans, calling delete automatically deactivates them (`status = 'INACTIVE'`) to preserve loan auditing history.
- **Explicit Deactivation**: Passing `?action=deactivate` sets `status = 'INACTIVE'`.
- **Clean Removal**: If a member has zero loan history, the record is removed with HTTP 200.

#### Example Request: Register Member (`POST /api/members`)
```json
{
  "member_code": "MEM-1001",
  "name": "Aarav Sharma",
  "email": "aarav.sharma@example.com",
  "phone": "+91-9876543210",
  "status": "ACTIVE",
  "max_borrow_limit": 3
}
```

#### Example Response (`201 Created`)
```json
{
  "success": true,
  "message": "Member registered successfully.",
  "data": {
    "id": 1,
    "member_code": "MEM-1001",
    "name": "Aarav Sharma",
    "email": "aarav.sharma@example.com",
    "phone": "+91-9876543210",
    "status": "ACTIVE",
    "max_borrow_limit": 3,
    "created_at": "2026-10-19 07:00:00",
    "updated_at": "2026-10-19 07:00:00",
    "active_loans_count": 0
  }
}
```

---

### Circulation & Loans API (`/api/loans`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/loans/issue` | Issue a book to an active member with availability and limit enforcement |
| `POST` | `/api/loans/:id/return` | Return a borrowed book, calculate overdue days and fine, restore copies |
| `GET` | `/api/loans` | List loans with joined book and member data, supporting filters |
| `GET` | `/api/loans/overdue` | List currently unreturned overdue loans with pending fine amounts |
| `GET` | `/api/loans/:id` | Get loan details by ID |
| `POST` | `/api/loans/:id/pay-fine` | Record payment towards an outstanding fine balance |

#### 1. Issue Book (`POST /api/loans/issue`)
- **Validation**:
  - `book_id` and `member_id` must be positive integers and exist in database.
  - Member status must be `ACTIVE` (rejects `SUSPENDED` or `INACTIVE` with HTTP 400).
  - Book must have `available_copies > 0`.
  - Member cannot exceed their borrow limit (`max_borrow_limit`) or global maximum (3 active loans).
- **Behavior**:
  - Automatically sets `issue_date` to current date and `due_date` to 14 days later (or custom if provided).
  - Atomically inserts loan and decrements `available_copies` by 1.

##### Example Request:
```json
{
  "book_id": 1,
  "member_id": 2
}
```

##### Example Response (`201 Created`):
```json
{
  "success": true,
  "message": "Book issued successfully.",
  "data": {
    "id": 1,
    "book_id": 1,
    "member_id": 2,
    "issue_date": "2026-10-19",
    "due_date": "2026-11-02",
    "return_date": null,
    "status": "ISSUED",
    "overdue_days": 0,
    "fine_amount": 0,
    "paid_amount": 0,
    "outstanding_fine": 0,
    "fine_paid": true,
    "currency": "₹",
    "book_title": "Clean Code",
    "member_name": "Diya Patel"
  }
}
```

#### 2. Return Book (`POST /api/loans/:id/return`)
- **Validation**:
  - Loan must exist and not already be returned.
- **Formulas**:
  $$\text{Overdue Days} = \max(0, \text{Return Date} - \text{Due Date})$$
  $$\text{Fine Amount} = \text{Overdue Days} \times ₹10.00$$
- **Behavior**:
  - Atomically records `return_date`, sets `status = 'RETURNED'`, sets `fine_amount`, and increments book's `available_copies` by 1.

##### Example Response (`200 OK`):
```json
{
  "success": true,
  "message": "Book returned successfully.",
  "data": {
    "id": 1,
    "status": "RETURNED",
    "return_date": "2026-11-07",
    "overdue_days": 5,
    "fine_amount": 50,
    "paid_amount": 0,
    "outstanding_fine": 50,
    "fine_paid": false,
    "currency": "₹"
  }
}
```

#### 3. Loan Queries (`GET /api/loans` & `GET /api/loans/overdue`)
- **Status Consistency**: Unreturned loans past their due date dynamically report as `status: 'OVERDUE'` with live pending fines.
- **Query Parameters**:
  - `status`: Filter by `ISSUED`, `RETURNED`, or `OVERDUE`
  - `member_id`: Filter by member ID
  - `book_id`: Filter by book ID
  - `search`: Filter by book title/ISBN or member name/code

#### 4. Fine Settlement (`POST /api/loans/:id/pay-fine`)
- **Validation**:
  - Payment amount must be a positive number.
  - Payment cannot exceed the current outstanding fine balance.
  - Rejects payment if fine is already settled or zero.
- **Behavior**:
  - Updates `paid_amount` and marks `fine_paid = 1` once the balance reaches 0.

##### Example Request:
```json
{
  "amount": 25.0
}
```

##### Example Response (`200 OK`):
```json
{
  "success": true,
  "message": "Fine payment recorded successfully.",
  "data": {
    "id": 1,
    "fine_amount": 50,
    "paid_amount": 25,
    "outstanding_fine": 25,
    "fine_paid": false,
    "currency": "₹"
  }
}
```

---

## Validation & Error Handling

- **`400 Bad Request`**: Sent when validation fails (missing required fields, negative values, borrow limits exceeded, zero copies available, suspended member borrowing, duplicate returns, overpaying fines).
- **`404 Not Found`**: Sent when requested book, member, or loan ID does not exist.
- **`409 Conflict`**: Sent when duplicate values violate unique constraints (`isbn`, `member_code`, `email`).
- **`500 Internal Server Error`**: Catches unhandled errors without leaking database paths or sensitive server details in production.

---

## Test Execution

Run all test suites across the entire project:
```bash
cd backend
npm test
```

### Test Suites Included (42 Tests):
1. `tests/milestone1.test.js`: Schema structure, foreign key enforcement, copy CHECK constraints, safe idempotency of seed data.
2. `tests/milestone2_books.test.js`: Books CRUD, search, genre filter, availableOnly filter, validation, duplicate ISBN, copy adjustment constraints, deletion restrictions on active loans.
3. `tests/milestone2_members.test.js`: Members CRUD, search, status filter, email validation, duplicate code/email, loan counts, deletion restrictions, and safe deactivation.
4. `tests/milestone3_loans.test.js`: Atomic loan issue, copy decrement, limit checking, suspended member protection, concurrent `FOR UPDATE` lock protection, return processing, overdue calculation, ₹10/day fine formula, duplicate return prevention, overdue query, partial/full fine payments, overpayment rejection.

