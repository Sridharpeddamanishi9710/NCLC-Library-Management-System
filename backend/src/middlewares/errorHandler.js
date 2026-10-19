/**
 * Centralized Express Error Handling Middleware.
 * Catches database constraint violations and unexpected errors, returning clean JSON responses.
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle SQLite UNIQUE constraint errors
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    if (err.message.includes('books.isbn')) {
      return res.status(409).json({
        success: false,
        error: 'A book with this ISBN already exists.',
      });
    }
    if (err.message.includes('members.member_code')) {
      return res.status(409).json({
        success: false,
        error: 'A member with this member code already exists.',
      });
    }
    if (err.message.includes('members.email')) {
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

  // Handle SQLite CHECK constraint errors
  if (err.message && err.message.includes('CHECK constraint failed')) {
    return res.status(400).json({
      success: false,
      error: 'Database constraint violation: check values and copy limits.',
    });
  }

  // Handle SQLite FOREIGN KEY constraint errors
  if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
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

  // Log unexpected server errors internally
  console.error('[Unhandled Error]', err);

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
