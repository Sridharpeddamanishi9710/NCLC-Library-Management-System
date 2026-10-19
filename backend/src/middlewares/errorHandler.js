/**
 * Centralized Express Error Handling Middleware.
 * Catches MySQL and SQLite database constraint violations and operational exceptions,
 * returning clean, uniform JSON responses without leaking system paths or credentials.
 */
function errorHandler(err, req, res, next) {
  // If headers have already been sent, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle MySQL and SQLite UNIQUE constraint violations (HTTP 409 Conflict)
  const isUniqueViolation =
    err.code === 'ER_DUP_ENTRY' ||
    (err.message && err.message.includes('UNIQUE constraint failed'));

  if (isUniqueViolation) {
    const msg = String(err.message || '');
    if (msg.includes('isbn') || msg.includes('idx_books_isbn')) {
      return res.status(409).json({
        success: false,
        error: 'A book with this ISBN already exists.',
      });
    }
    if (msg.includes('member_code') || msg.includes('idx_members_code')) {
      return res.status(409).json({
        success: false,
        error: 'A member with this member code already exists.',
      });
    }
    if (msg.includes('email') || msg.includes('idx_members_email')) {
      return res.status(409).json({
        success: false,
        error: 'A member with this email address already exists.',
      });
    }

    return res.status(409).json({
      success: false,
      error: 'A unique constraint was violated.',
    });
  }

  // Handle MySQL and SQLite CHECK constraint violations (HTTP 400 Bad Request)
  const isCheckViolation =
    err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' ||
    (err.message && err.message.includes('CHECK constraint failed'));

  if (isCheckViolation) {
    return res.status(400).json({
      success: false,
      error: 'Database constraint violation: check values and copy limits.',
    });
  }

  // Handle MySQL and SQLite FOREIGN KEY constraint violations (HTTP 400 Bad Request)
  const isForeignKeyViolation =
    err.code === 'ER_ROW_IS_REFERENCED_2' ||
    err.code === 'ER_NO_REFERENCED_ROW_2' ||
    err.code === 'ER_ROW_IS_REFERENCED' ||
    err.code === 'ER_NO_REFERENCED_ROW' ||
    (err.message && err.message.includes('FOREIGN KEY constraint failed'));

  if (isForeignKeyViolation) {
    return res.status(400).json({
      success: false,
      error: 'Foreign key constraint violated: referenced entity does not exist or has active dependencies.',
    });
  }

  // Handle operational client errors with specific status codes (e.g. 400, 404, 409)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      success: false,
      error: err.message || 'Client error',
    });
  }

  // Log unexpected server errors internally (never log passwords or sensitive data)
  console.error('[Unhandled Error]', err.message);

  return res.status(err.status || 500).json({
    success: false,
    error: err.message && process.env.NODE_ENV !== 'production' ? err.message : 'Internal Server Error',
  });
}

/**
 * 404 Route Not Found Handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
