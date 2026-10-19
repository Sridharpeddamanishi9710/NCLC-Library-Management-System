const express = require('express');
const router = express.Router();
const BookController = require('../controllers/bookController');
const {
  validateId,
  validateCreateBook,
  validateUpdateBook,
} = require('../middlewares/validate');

// Books CRUD routes
router.get('/', BookController.getAllBooks);
router.post('/', validateCreateBook, BookController.createBook);
router.get('/:id', validateId, BookController.getBookById);
router.put('/:id', validateId, validateUpdateBook, BookController.updateBook);
router.delete('/:id', validateId, BookController.deleteBook);

module.exports = router;
