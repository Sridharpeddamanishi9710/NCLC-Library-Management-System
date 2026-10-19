const BookModel = require('../models/bookModel');

/**
 * Controller for Book management operations with async MySQL support.
 */
class BookController {
  /**
   * GET /api/books
   * List books with search and filter capabilities.
   */
  static async getAllBooks(req, res, next) {
    try {
      const { search, genre, availableOnly } = req.query;

      const books = await BookModel.findAll({
        search,
        genre,
        availableOnly: availableOnly === 'true' || availableOnly === true,
      });

      res.json({
        success: true,
        count: books.length,
        data: books,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/books/:id
   * Retrieve a book by its numeric ID.
   */
  static async getBookById(req, res, next) {
    try {
      const id = req.validatedId;
      const book = await BookModel.findById(id);

      if (!book) {
        return res.status(404).json({
          success: false,
          error: 'Book not found.',
        });
      }

      res.json({
        success: true,
        data: book,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/books
   * Creates a new book record.
   */
  static async createBook(req, res, next) {
    try {
      const { isbn, title, author, genre, total_copies, available_copies, shelf_location } = req.body;

      // Check for duplicate ISBN
      const existing = await BookModel.findByIsbn(isbn);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'A book with this ISBN already exists.',
        });
      }

      const total = Number(total_copies);
      const available = available_copies !== undefined ? Number(available_copies) : total;

      const newBook = await BookModel.create({
        isbn,
        title,
        author,
        genre,
        total_copies: total,
        available_copies: available,
        shelf_location,
      });

      res.status(201).json({
        success: true,
        message: 'Book created successfully.',
        data: newBook,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/books/:id
   * Updates an existing book.
   */
  static async updateBook(req, res, next) {
    try {
      const id = req.validatedId;
      const existing = await BookModel.findById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Book not found.',
        });
      }

      const { isbn, title, author, genre, total_copies, available_copies, shelf_location } = req.body;
      const updates = {};

      if (isbn !== undefined) {
        const duplicate = await BookModel.findByIsbn(isbn, id);
        if (duplicate) {
          return res.status(409).json({
            success: false,
            error: 'A book with this ISBN already exists.',
          });
        }
        updates.isbn = isbn;
      }

      if (title !== undefined) updates.title = title;
      if (author !== undefined) updates.author = author;
      if (genre !== undefined) updates.genre = genre;
      if (shelf_location !== undefined) updates.shelf_location = shelf_location;

      const currentlyBorrowed = existing.total_copies - existing.available_copies;

      if (total_copies !== undefined) {
        const newTotal = Number(total_copies);
        if (newTotal < currentlyBorrowed) {
          return res.status(400).json({
            success: false,
            error: `Cannot reduce total_copies (${newTotal}) below currently borrowed copies (${currentlyBorrowed}).`,
          });
        }
        updates.total_copies = newTotal;

        if (available_copies === undefined) {
          updates.available_copies = newTotal - currentlyBorrowed;
        }
      }

      if (available_copies !== undefined) {
        const newAvailable = Number(available_copies);
        const effectiveTotal = updates.total_copies !== undefined ? updates.total_copies : existing.total_copies;

        if (newAvailable > effectiveTotal) {
          return res.status(400).json({
            success: false,
            error: `available_copies (${newAvailable}) cannot exceed total_copies (${effectiveTotal}).`,
          });
        }
        updates.available_copies = newAvailable;
      }

      const updated = await BookModel.update(id, updates);

      res.json({
        success: true,
        message: 'Book updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/books/:id
   * Removes a book if no active loans exist.
   */
  static async deleteBook(req, res, next) {
    try {
      const id = req.validatedId;
      const existing = await BookModel.findById(id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Book not found.',
        });
      }

      const activeLoans = await BookModel.getActiveLoansCount(id);
      if (activeLoans > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot delete book with active loans. ${activeLoans} copy/copies are currently issued and must be returned first.`,
        });
      }

      await BookModel.delete(id);

      res.json({
        success: true,
        message: 'Book deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = BookController;
