# NCLC-2: Library Management System

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B%20%7C%20v24%2B-brightgreen.svg)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-v19.2-61dafb.svg)](https://react.dev/)
[![Vite Version](https://img.shields.io/badge/Vite-v8.3-646cff.svg)](https://vite.dev/)
[![MySQL Version](https://img.shields.io/badge/MySQL-8.0%2B-4479A1.svg)](https://www.mysql.com/)
[![Tests](https://img.shields.io/badge/Tests-42%20Passed-success.svg)](#running-tests--quality-assurance)
[![Code Quality](https://img.shields.io/badge/Lint-Oxlint%20Clean-blue.svg)](#frontend-code-quality--linting)

A full-stack, enterprise-grade **Library Management System** built for the **NCLC internship program**. Designed with a decoupled architecture featuring a **React 19 (Vite 8)** frontend and a **Node.js / Express** backend backed by **MySQL 8.0** using connection pooling, transactional workflows, and row-level locking.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [System Architecture & Business Rules](#system-architecture--business-rules)
- [Project Structure](#project-structure)
- [Getting Started & Installation Guide](#getting-started--installation-guide)
  - [Prerequisites](#prerequisites)
  - [Backend Setup & Environment Configuration](#1-backend-setup--environment-configuration)
  - [Database Initialization & Migration Options](#2-database-initialization--data-options)
  - [Frontend Setup & Environment Configuration](#3-frontend-setup--configuration)
  - [Running the Application](#4-running-the-application)
- [Running Tests & Quality Assurance](#running-tests--quality-assurance)
  - [Backend Automated Test Suite](#backend-automated-test-suite)
  - [Frontend Code Quality & Linting](#frontend-code-quality--linting)
  - [Frontend Production Build](#frontend-production-build)
- [API Documentation](#api-documentation)
  - [Standard API Response Format](#standard-api-response-format)
  - [System Health Endpoint](#system-health-endpoint)
  - [Books API](#books-api-apibooks)
  - [Members API](#members-api-apimembers)
  - [Circulation & Loans API](#circulation--loans-api-apiloans)
- [Validation & Error Handling](#validation--error-handling)
- [UI Screenshots & Media](#ui-screenshots--media)
- [Future Enhancements](#future-enhancements)

---

## Project Overview

The **NCLC-2 Library Management System** provides librarians with an intuitive, responsive administrative portal to manage books, track patron memberships, issue and check in loans, monitor overdue accounts, and settle accrued fines.

### Core Objectives
1. **Catalog & Inventory Integrity**: Prevent book deletion when active copies are borrowed; enforce strict copy counts where $\text{available\_copies} \le \text{total\_copies}$.
2. **Patron Management**: Enforce borrowing limits and membership status validation (`ACTIVE`, `SUSPENDED`, `INACTIVE`) with historical audit preservation.
3. **Concurrency-Safe Circulation**: Atomic loan issue and return workflows backed by MySQL transactions and `SELECT ... FOR UPDATE` row-level locks.
4. **Automated Fine Calculations**: Transparent calendar overdue tracking with automated fine assessments at ₹10.00/day and partial/full settlement workflows.
5. **Modern, Responsive User Experience**: Zero-bloat, component-driven React 19 UI with real-time analytics, instant multi-field search, accessible modals, and toast notifications.

---

## Key Features

- **Executive Dashboard**:
  - Live inventory cards (Total Books, Total Copies, Available Copies, Active Borrowers).
  - High-priority overdue loan banner displaying live accrued fine liability.
  - Quick action toolbar (*Issue Loan*, *Return Book*, *Add Book*, *Register Member*, *Collect Fines*).
  - Real-time catalog stock monitor highlighting low-stock items ($\le 1$ copy).
  - Recent circulation ledger snapshot.

- **Book Catalog Management (`/books`)**:
  - Full CRUD operations with client-side and server-side validation.
  - Instant search across Title, Author, ISBN, and Shelf Location.
  - Multi-select genre filtering and an "Available Copies Only" toggle.
  - Safe deletion checks that block deletion if copies are currently issued.

- **Member Directory (`/members`)**:
  - Patron registration and profile updates with email format validation.
  - Status management (`ACTIVE`, `SUSPENDED`, `INACTIVE`).
  - Configurable member borrowing limit (1–10 books, default: 3).
  - Safe deletion and deactivation: members with active loans cannot be removed or deactivated; members with past borrowing history are safely transitioned to `INACTIVE` to safeguard audit history.

- **Circulation Engine (`/loans`)**:
  - **Issue Loan**: Automatic 14-day due date calculation; eligibility checks (blocks inactive members, limit-exceeded members, and out-of-stock titles).
  - **Return Book**: One-click check-in with dynamic overdue calculation and fine assessment.
  - **Query Ledger**: Filterable by loan status (`ISSUED`, `OVERDUE`, `RETURNED`) or search by book and member.

- **Overdue & Fines Settlement Center (`/fines`)**:
  - Dedicated ledger for unreturned overdue loans and returned loans with unpaid fines.
  - Accrued, collected, and net outstanding fine metrics.
  - Partial or full payment collection with instant balance updates and receipts.

---

## Tech Stack

| Layer | Technologies | Details |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 8, JavaScript (ESM) | Responsive Single-Page Application (SPA) with native hash router |
| **Styling** | Vanilla CSS3 Design System | Cohesive color palette, accessible modals, animations, mobile drawer |
| **Frontend Tooling** | Oxlint, Vite Preview | Fast static analysis, zero linter warnings/errors |
| **Backend API** | Node.js (v20+ / v24+), Express 5 | RESTful API with structured routes, controllers, and middleware |
| **Database** | MySQL 8.0+ | InnoDB storage engine, foreign keys, table-level check constraints, connection pool |
| **Database Driver** | `mysql2/promise` | Connection pooling (`10` connections), transaction management, parameterized SQL |
| **Data Migration** | Node.js Custom ETL Script | Transactional, idempotent data migration from legacy SQLite to MySQL |
| **Backend Testing** | Node.js Native Test Runner (`node:test`) | 42 automated tests executed sequentially via `--test-concurrency=1` |
| **HTTP Assertion** | Supertest | Integration testing against isolated MySQL test database |

---

## System Architecture & Business Rules

### Initial Business Rules

$$\text{Loan Duration} = 14\text{ Calendar Days}$$

$$\text{Overdue Fine Formula} = \max(0, \text{Return Date} - \text{Due Date}) \times ₹10.00$$

$$\text{Maximum Active Loans} = 3\text{ Books per Member (Default)}$$

1. **Borrowing Eligibility**: A member must have an `ACTIVE` status and fewer active loans than their assigned `max_borrow_limit` (maximum 3).
2. **Book Availability**: A book copy can only be checked out if `available_copies > 0`.
3. **Atomic Operations**: Issuing a book inserts the loan record and decrements `available_copies` within a single MySQL transaction using `SELECT ... FOR UPDATE` locking to prevent race conditions.
4. **Return Consistency**: Returning a book records the return date, calculates overdue days, assigns the fine, increments `available_copies`, and updates loan status atomically.
5. **Dynamic Overdue Status**: Any loan whose `due_date` has elapsed without a `return_date` is dynamically classified as `OVERDUE` with live fine calculation, even if stored as `ISSUED`.
6. **Data Deletion Safety**:
   - Books with currently active loans cannot be deleted (HTTP 400).
   - Members with active loans cannot be deleted or deactivated (HTTP 400).
   - Deleting a member with past returned loans safely sets `status = 'INACTIVE'` to preserve historical circulation logs.

---

## Project Structure

```text
NCLC-Library-Management-System/
├── backend/
│   ├── data/                 # Legacy SQLite databases (library.db & backup, read-only)
│   ├── src/
│   │   ├── config/           # Environment variables & business rule constants
│   │   ├── controllers/      # bookController.js, memberController.js, loanController.js
│   │   ├── middlewares/      # Input validation & centralized error handler
│   │   ├── models/           # db.js (connection pool), models, schema.mysql.sql
│   │   ├── routes/           # bookRoutes.js, memberRoutes.js, loanRoutes.js
│   │   ├── scripts/          # initDb.js, migrateFromSqlite.js, seed.js
│   │   ├── services/         # circulationService.js (domain logic & transactions)
│   │   ├── app.js            # Express app assembly & middleware pipeline
│   │   └── server.js         # HTTP server entry point with MySQL health check
│   ├── tests/                # Automated integration tests (isolated test DB)
│   │   ├── testHelper.js     # Test DB isolation & reset helper
│   │   ├── milestone1.test.js
│   │   ├── milestone2_books.test.js
│   │   ├── milestone2_members.test.js
│   │   └── milestone3_loans.test.js
│   ├── .env.example          # Backend environment variables template
│   └── package.json          # Backend scripts and dependencies
├── frontend/
│   ├── src/
│   │   ├── components/       # Header, Sidebar, Modal, ConfirmModal, StatCard, Toast
│   │   ├── pages/            # DashboardPage, BooksPage, MembersPage, CirculationPage, FinesPage
│   │   ├── services/         # api.js, bookService.js, memberService.js, loanService.js, systemService.js
│   │   ├── App.jsx           # App state manager & view router
│   │   ├── App.css           # Custom styles
│   │   ├── index.css         # Complete UI design system & responsive layout
│   │   └── main.jsx          # React DOM root entry
│   ├── index.html            # Application HTML shell
│   ├── package.json          # Frontend scripts and dependencies
│   └── vite.config.js        # Vite configuration with React plugin
├── .gitignore                # Excludes node_modules, .env, *.db, dist
└── README.md                 # Complete system documentation
```

---

## Getting Started & Installation Guide

Follow these steps to set up and run the Library Management System locally on Windows.

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ or v24+ LTS recommended)
- `npm` (v10+ or v11+)
- [MySQL Server 8.0+](https://dev.mysql.com/downloads/mysql/) running locally (default: `127.0.0.1:3306`)
- MySQL Workbench or MySQL CLI

> [!TIP]
> **Windows PowerShell Execution Policy Note**: If running `npm` commands in PowerShell throws a `PSSecurityException` (`running scripts is disabled on this system`), run commands using `npm.cmd <script>` (e.g., `npm.cmd test`), or set your execution policy once via:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

---

### 1. Backend Setup & Environment Configuration

1. **Navigate to the backend directory**:
   ```powershell
   cd backend
   ```

2. **Install backend dependencies**:
   ```powershell
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example `.env.example` file to create your local `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

4. **Edit `backend/.env` with your local credentials**:
   Open `backend/.env` in your editor and configure your MySQL settings. **Use only your own local credentials; never commit this file**:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # MySQL Database Configuration
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_actual_mysql_password
   DB_NAME=library_management
   DB_NAME_TEST=library_management_test

   # Legacy SQLite Source (Read-only data source during migration)
   DATABASE_PATH=./data/library.db

   # Library Business Rules
   LOAN_DURATION_DAYS=14
   FINE_RATE_PER_DAY=10.0
   CURRENCY_SYMBOL=₹
   MAX_ACTIVE_LOANS_PER_MEMBER=3
   ```

---

### 2. Database Initialization & Data Options

Open MySQL Workbench or MySQL CLI and create the development and testing databases:
```sql
CREATE DATABASE IF NOT EXISTS library_management;
CREATE DATABASE IF NOT EXISTS library_management_test;
```

#### Step A: Initialize the MySQL Schema
Initialize the tables (`books`, `members`, `loans`), check constraints, foreign keys, and indexes:
```powershell
npm run db:init
```

#### Step B: Populate Data (Choose ONE Option)

> [!IMPORTANT]
> Choose either **Option 1** (if migrating an existing SQLite database) or **Option 2** (if setting up a fresh demonstration catalog). Do not run both.

- **Option 1: Migrate from Existing SQLite Database**:
  Transfers all existing books, members, and loan history from `backend/data/library.db` into MySQL with preserved primary keys, aligned `AUTO_INCREMENT`, and zero data loss:
  ```powershell
  npm run db:migrate
  ```

- **Option 2: Seed Fresh Sample Catalog**:
  Populates default sample books (8 titles) and members (5 accounts) using safe, idempotent `INSERT IGNORE` queries:
  ```powershell
  npm run db:seed
  ```

---

### 3. Frontend Setup & Configuration

1. **Navigate to the frontend directory**:
   ```powershell
   cd ..\frontend
   ```

2. **Install frontend dependencies**:
   ```powershell
   npm install
   ```

3. **Optional API Configuration**:
   The frontend defaults to connecting to `http://localhost:5000/api`. If you run the backend on a different port or host, create a `frontend/.env` file:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

---

### 4. Running the Application

For normal local development, run both the backend and frontend in separate terminal windows:

#### Terminal 1 — Start the Backend API:
```powershell
cd backend
npm run dev
```
- API server listens at `http://localhost:5000`.
- Verify connectivity at the health check endpoint: `http://localhost:5000/api/health`.

#### Terminal 2 — Start the Frontend UI:
```powershell
cd frontend
npm run dev
```
- The Vite development server starts at `http://localhost:5173`.
- Open `http://localhost:5173` in your browser.

---

## Running Tests & Quality Assurance

### Backend Automated Test Suite

The test suite runs against the dedicated, isolated `library_management_test` database. It never modifies the development or production database.

```powershell
cd backend
npm test
```

#### Test Suite Breakdown (42 Passing Tests):
- **Milestone 1 — Schema & Integrity (6 tests)**:
  - Table and index verification in MySQL.
  - Foreign key constraint enforcement on loans (`ON DELETE RESTRICT`).
  - Table-level CHECK constraint enforcement (`available_copies <= total_copies`).
  - Unique constraint enforcement on ISBN and Member Code.
  - Safe, idempotent seed script execution.
- **Milestone 2 — Books API (11 tests)**:
  - CRUD operations, missing field validations, copy range constraints.
  - Duplicate ISBN conflict rejection (`HTTP 409`).
  - Multi-field search and genre filter verification.
  - Active loan deletion restrictions.
- **Milestone 2 — Members API (10 tests)**:
  - CRUD operations, email format validation, duplicate code rejection (`HTTP 409`).
  - Safe deactivation (`?action=deactivate`) vs. clean deletion.
  - Active loan deletion protection.
- **Milestone 3 — Circulation & Fines (15 tests)**:
  - Atomic book issuance and copy decrement.
  - Borrowing limit enforcement (maximum 3 loans) and availability checks.
  - Concurrent loan attempt safety with `SELECT ... FOR UPDATE` row locks.
  - On-time and late book returns with ₹10/day fine formula.
  - Duplicate return rejection.
  - Unreturned overdue loan query consistency.
  - Partial fine payment and full fine settlement verification.

---

### Frontend Code Quality & Linting

Run static code analysis across all frontend components, pages, and services using Oxlint:
```powershell
cd frontend
npm run lint
```
*Current status: 0 errors, 0 warnings across 19 files.*

---

### Frontend Production Build

Compile and bundle the production-ready frontend assets with Vite:
```powershell
cd frontend
npm run build
```
Assets are emitted to `frontend/dist/`. To preview the production bundle locally:
```powershell
npm run preview
```

---

## API Documentation

All API endpoints return standardized JSON structures with corresponding HTTP status codes.

### Standard API Response Format

- **Success**:
  ```json
  {
    "success": true,
    "message": "Operation description (optional)",
    "data": { ... }
  }
  ```
- **Error**:
  ```json
  {
    "success": false,
    "error": "Descriptive human-readable error message",
    "details": [ ... ]
  }
  ```

---

### System Health Endpoint

#### `GET /api/health`
Checks server and database connectivity, returns current row counts, and verifies circulation rules.

**Response (`200 OK`)**:
```json
{
  "status": "UP",
  "service": "NCLC Library Management System Backend",
  "environment": "development",
  "database": {
    "engine": "MySQL",
    "host": "127.0.0.1",
    "port": 3306,
    "database": "library_management",
    "counts": {
      "books": 8,
      "members": 5,
      "loans": 0
    }
  },
  "rules": {
    "loanDurationDays": 14,
    "fineRatePerDay": 10,
    "currencySymbol": "₹",
    "maxActiveLoansPerMember": 3
  }
}
```

---

### Books API (`/api/books`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/books` | List books with optional search, genre, and availability filters |
| `GET` | `/api/books/:id` | Retrieve single book details including active loan count |
| `POST` | `/api/books` | Add a new book to the catalog |
| `PUT` | `/api/books/:id` | Update an existing book's details |
| `DELETE` | `/api/books/:id` | Delete a book (blocked if active loans exist) |

#### Query Parameters for `GET /api/books`:
- `search`: Case-insensitive search on title, author, or ISBN (e.g., `?search=clean`)
- `genre`: Exact genre filter (e.g., `?genre=Computer+Science`)
- `availableOnly`: When `true`, returns only books where `available_copies > 0`

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

---

### Members API (`/api/members`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/members` | List members with optional text search and status filter |
| `GET` | `/api/members/:id` | Retrieve single member details and active loans count |
| `POST` | `/api/members` | Register a new library member |
| `PUT` | `/api/members/:id` | Update member profile and borrowing parameters |
| `DELETE` | `/api/members/:id` | Safely remove or deactivate member (blocked if active loans exist) |

#### Query Parameters for `GET /api/members`:
- `search`: Filter by name, email, member code, or phone (e.g., `?search=sharma`)
- `status`: Filter by status (`ACTIVE`, `SUSPENDED`, `INACTIVE`)
- `action`: Used with `DELETE` to request deactivation (`?action=deactivate`)

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

---

### Circulation & Loans API (`/api/loans`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/loans/issue` | Issue a book to a member (enforces availability and limit checks) |
| `POST` | `/api/loans/:id/return` | Return a borrowed book, calculate overdue fine, and restore copies |
| `GET` | `/api/loans` | List loans with joined book and member data |
| `GET` | `/api/loans/overdue` | List currently unreturned overdue loans with live pending fines |
| `GET` | `/api/loans/:id` | Retrieve single loan details |
| `POST` | `/api/loans/:id/pay-fine` | Record payment toward an outstanding fine |

#### 1. Issue Book (`POST /api/loans/issue`)
```json
{
  "book_id": 1,
  "member_id": 2
}
```
*Response (`201 Created`)*:
```json
{
  "success": true,
  "message": "Book issued successfully.",
  "data": {
    "id": 1,
    "book_id": 1,
    "member_id": 2,
    "issue_date": "2026-10-20",
    "due_date": "2026-11-03",
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
Optional request body allows specifying a custom return date for testing:
```json
{
  "return_date": "2026-11-08"
}
```
*Response (`200 OK`)*:
```json
{
  "success": true,
  "message": "Book returned successfully.",
  "data": {
    "id": 1,
    "status": "RETURNED",
    "return_date": "2026-11-08",
    "overdue_days": 5,
    "fine_amount": 50,
    "paid_amount": 0,
    "outstanding_fine": 50,
    "fine_paid": false,
    "currency": "₹"
  }
}
```

#### 3. Settle Fine (`POST /api/loans/:id/pay-fine`)
```json
{
  "amount": 25.0
}
```
*Response (`200 OK`)*:
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

| Status Code | Meaning | Example Trigger |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Validation failure or business rule violation | Missing fields, borrow limit reached, zero copies available, suspended member borrowing, duplicate return |
| **`404 Not Found`** | Resource does not exist | Book ID, Member ID, or Loan ID not found |
| **`409 Conflict`** | Unique constraint violation | Duplicate ISBN, duplicate member code, or duplicate email address |
| **`500 Internal Error`** | Unhandled server error | Database connectivity error; masked cleanly in production |

---

## UI Screenshots & Media

> *To add screenshots to your repository, capture views of the running application, place them in a `docs/screenshots/` directory, and link them using the markdown below.*

- **Dashboard Overview**:
  `docs/screenshots/dashboard.png` *(Displays KPI cards, overdue warning banner, quick action bar, and stock monitoring)*
- **Book Catalog & Search**:
  `docs/screenshots/book_catalog.png` *(Displays catalog table, genre filters, and Add Book modal)*
- **Member Directory**:
  `docs/screenshots/member_directory.png` *(Displays registered patron list, status badges, and registration modal)*
- **Circulation & Book Issue**:
  `docs/screenshots/circulation_issue.png` *(Displays loan issue dialog with real-time member limit validation)*
- **Overdue Loans & Fine Settlements**:
  `docs/screenshots/fines_settlement.png` *(Displays overdue accounts ledger and fine payment collection modal)*

---

## Future Enhancements

These planned improvements represent natural next steps for expanding the platform beyond the internship scope:

- [ ] **Role-Based Authentication (RBAC)**: Implement JWT-based authentication with distinct roles for Head Librarians, Assistant Staff, and Student/Faculty Patrons.
- [ ] **Barcode & QR Scanner Integration**: Enable camera-based barcode scanning for rapid physical book checkout and check-in.
- [ ] **Automated Email / SMS Notifications**: Scheduled reminders for approaching due dates and overdue fine alerts.
- [ ] **Book Reservation & Waitlist Queue**: Allow patrons to reserve titles that currently have zero available copies, automatically notifying the next in line upon return.
- [ ] **Export & Reporting Module**: Export monthly circulation summaries, inventory audit sheets, and fine receipts to PDF and CSV formats.
- [ ] **Dark Mode Toggle**: Built-in theme switcher with CSS custom property variables.
