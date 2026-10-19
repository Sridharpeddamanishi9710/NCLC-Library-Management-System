const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MEMBER_STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];

/**
 * Validates route param :id is a positive integer.
 */
function validateId(req, res, next) {
  const rawId = req.params.id;
  const id = parseInt(rawId, 10);

  if (isNaN(id) || id <= 0 || String(id) !== String(rawId).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID. Must be a positive integer.',
    });
  }

  req.validatedId = id;
  next();
}

/**
 * Validates request body for creating a book.
 */
function validateCreateBook(req, res, next) {
  const { isbn, title, author, genre, total_copies, available_copies, shelf_location } = req.body;
  const errors = [];

  if (!isbn || typeof isbn !== 'string' || !isbn.trim()) {
    errors.push('isbn is required and must be a non-empty string.');
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('title is required and must be a non-empty string.');
  }

  if (!author || typeof author !== 'string' || !author.trim()) {
    errors.push('author is required and must be a non-empty string.');
  }

  if (total_copies === undefined || total_copies === null) {
    errors.push('total_copies is required.');
  } else {
    const total = Number(total_copies);
    if (!Number.isInteger(total) || total < 0) {
      errors.push('total_copies must be a non-negative integer.');
    }
  }

  if (available_copies !== undefined && available_copies !== null) {
    const avail = Number(available_copies);
    const total = Number(total_copies);
    if (!Number.isInteger(avail) || avail < 0) {
      errors.push('available_copies must be a non-negative integer.');
    } else if (Number.isInteger(total) && avail > total) {
      errors.push('available_copies cannot exceed total_copies.');
    }
  }

  if (genre !== undefined && genre !== null && typeof genre !== 'string') {
    errors.push('genre must be a string if provided.');
  }

  if (shelf_location !== undefined && shelf_location !== null && typeof shelf_location !== 'string') {
    errors.push('shelf_location must be a string if provided.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }

  next();
}

/**
 * Validates request body for updating a book.
 */
function validateUpdateBook(req, res, next) {
  const { isbn, title, author, genre, total_copies, available_copies, shelf_location } = req.body;
  const errors = [];

  const fieldsProvided = [isbn, title, author, genre, total_copies, available_copies, shelf_location].some(
    (val) => val !== undefined
  );

  if (!fieldsProvided) {
    return res.status(400).json({
      success: false,
      error: 'At least one field must be provided to update.',
    });
  }

  if (isbn !== undefined && (typeof isbn !== 'string' || !isbn.trim())) {
    errors.push('isbn must be a non-empty string if provided.');
  }

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    errors.push('title must be a non-empty string if provided.');
  }

  if (author !== undefined && (typeof author !== 'string' || !author.trim())) {
    errors.push('author must be a non-empty string if provided.');
  }

  if (total_copies !== undefined) {
    const total = Number(total_copies);
    if (!Number.isInteger(total) || total < 0) {
      errors.push('total_copies must be a non-negative integer.');
    }
  }

  if (available_copies !== undefined) {
    const avail = Number(available_copies);
    if (!Number.isInteger(avail) || avail < 0) {
      errors.push('available_copies must be a non-negative integer.');
    }
  }

  if (genre !== undefined && genre !== null && typeof genre !== 'string') {
    errors.push('genre must be a string if provided.');
  }

  if (shelf_location !== undefined && shelf_location !== null && typeof shelf_location !== 'string') {
    errors.push('shelf_location must be a string if provided.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }

  next();
}

/**
 * Validates request body for creating a member.
 */
function validateCreateMember(req, res, next) {
  const { member_code, name, email, phone, status, max_borrow_limit } = req.body;
  const errors = [];

  if (!member_code || typeof member_code !== 'string' || !member_code.trim()) {
    errors.push('member_code is required and must be a non-empty string.');
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('name is required and must be a non-empty string.');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('email is required and must be a non-empty string.');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('email must be a valid email address format.');
  }

  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    errors.push('phone must be a string if provided.');
  }

  if (status !== undefined && status !== null) {
    const upperStatus = String(status).trim().toUpperCase();
    if (!ALLOWED_MEMBER_STATUSES.includes(upperStatus)) {
      errors.push(`status must be one of: ${ALLOWED_MEMBER_STATUSES.join(', ')}.`);
    }
  }

  if (max_borrow_limit !== undefined && max_borrow_limit !== null) {
    const limit = Number(max_borrow_limit);
    if (!Number.isInteger(limit) || limit < 1) {
      errors.push('max_borrow_limit must be an integer greater than or equal to 1.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }

  next();
}

/**
 * Validates request body for updating a member.
 */
function validateUpdateMember(req, res, next) {
  const { member_code, name, email, phone, status, max_borrow_limit } = req.body;
  const errors = [];

  const fieldsProvided = [member_code, name, email, phone, status, max_borrow_limit].some(
    (val) => val !== undefined
  );

  if (!fieldsProvided) {
    return res.status(400).json({
      success: false,
      error: 'At least one field must be provided to update.',
    });
  }

  if (member_code !== undefined && (typeof member_code !== 'string' || !member_code.trim())) {
    errors.push('member_code must be a non-empty string if provided.');
  }

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    errors.push('name must be a non-empty string if provided.');
  }

  if (email !== undefined) {
    if (typeof email !== 'string' || !email.trim()) {
      errors.push('email must be a non-empty string if provided.');
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.push('email must be a valid email address format.');
    }
  }

  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    errors.push('phone must be a string if provided.');
  }

  if (status !== undefined && status !== null) {
    const upperStatus = String(status).trim().toUpperCase();
    if (!ALLOWED_MEMBER_STATUSES.includes(upperStatus)) {
      errors.push(`status must be one of: ${ALLOWED_MEMBER_STATUSES.join(', ')}.`);
    }
  }

  if (max_borrow_limit !== undefined && max_borrow_limit !== null) {
    const limit = Number(max_borrow_limit);
    if (!Number.isInteger(limit) || limit < 1) {
      errors.push('max_borrow_limit must be an integer greater than or equal to 1.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }

  next();
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates request body for issuing a loan.
 */
function validateIssueLoan(req, res, next) {
  const { book_id, member_id, issue_date, due_date } = req.body;
  const errors = [];

  const bId = Number(book_id);
  if (!Number.isInteger(bId) || bId <= 0) {
    errors.push('book_id is required and must be a positive integer.');
  }

  const mId = Number(member_id);
  if (!Number.isInteger(mId) || mId <= 0) {
    errors.push('member_id is required and must be a positive integer.');
  }

  if (issue_date !== undefined && (!DATE_REGEX.test(issue_date) || isNaN(Date.parse(issue_date)))) {
    errors.push('issue_date must be a valid date in YYYY-MM-DD format.');
  }

  if (due_date !== undefined && (!DATE_REGEX.test(due_date) || isNaN(Date.parse(due_date)))) {
    errors.push('due_date must be a valid date in YYYY-MM-DD format.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
  }

  req.validatedIssueData = {
    book_id: bId,
    member_id: mId,
    issue_date,
    due_date,
  };

  next();
}

/**
 * Validates request body for returning a loan.
 */
function validateReturnLoan(req, res, next) {
  const { return_date } = req.body || {};

  if (return_date !== undefined && (!DATE_REGEX.test(return_date) || isNaN(Date.parse(return_date)))) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: ['return_date must be a valid date in YYYY-MM-DD format.'],
    });
  }

  next();
}

/**
 * Validates request body for paying a fine.
 */
function validatePayFine(req, res, next) {
  const { amount } = req.body;
  const numAmount = Number(amount);

  if (amount === undefined || amount === null || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: ['amount is required and must be a positive number.'],
    });
  }

  req.validatedPaymentAmount = numAmount;
  next();
}

module.exports = {
  validateId,
  validateCreateBook,
  validateUpdateBook,
  validateCreateMember,
  validateUpdateMember,
  validateIssueLoan,
  validateReturnLoan,
  validatePayFine,
};

