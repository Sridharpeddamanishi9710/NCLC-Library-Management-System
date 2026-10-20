import React, { useState, useMemo } from 'react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const INITIAL_FORM = {
  isbn: '',
  title: '',
  author: '',
  genre: '',
  total_copies: 1,
  shelf_location: '',
};

export function BooksPage({
  books = [],
  isLoading,
  onCreateBook,
  onUpdateBook,
  onDeleteBook,
  showToast,
  externalAddModalOpen = false,
  onCloseExternalAddModal = () => {},
}) {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  // Modals state
  const [internalFormModalOpen, setInternalFormModalOpen] = useState(false);
  const isFormModalOpen = internalFormModalOpen || externalAddModalOpen;
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View Details Modal
  const [viewingBook, setViewingBook] = useState(null);

  // Delete Confirm Modal
  const [deletingBook, setDeletingBook] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleOpenCreate = () => {
    setEditingBook(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setInternalFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setInternalFormModalOpen(false);
    onCloseExternalAddModal();
  };

  // Extract unique genres for filter dropdown
  const genres = useMemo(() => {
    const set = new Set();
    books.forEach((b) => {
      if (b.genre && b.genre.trim()) {
        set.add(b.genre.trim());
      }
    });
    return Array.from(set).sort();
  }, [books]);

  // Filtered books
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      if (availableOnly && (book.available_copies || 0) <= 0) {
        return false;
      }
      if (selectedGenre && book.genre !== selectedGenre) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = (book.title || '').toLowerCase().includes(query);
        const matchesAuthor = (book.author || '').toLowerCase().includes(query);
        const matchesIsbn = (book.isbn || '').toLowerCase().includes(query);
        const matchesShelf = (book.shelf_location || '').toLowerCase().includes(query);
        return matchesTitle || matchesAuthor || matchesIsbn || matchesShelf;
      }
      return true;
    });
  }, [books, search, selectedGenre, availableOnly]);

  const handleOpenEdit = (book) => {
    setEditingBook(book);
    setFormData({
      isbn: book.isbn || '',
      title: book.title || '',
      author: book.author || '',
      genre: book.genre || '',
      total_copies: book.total_copies || 1,
      shelf_location: book.shelf_location || '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.isbn || !formData.isbn.trim()) {
      errors.isbn = 'ISBN is required.';
    }
    if (!formData.title || !formData.title.trim()) {
      errors.title = 'Title is required.';
    }
    if (!formData.author || !formData.author.trim()) {
      errors.author = 'Author is required.';
    }
    const copies = Number(formData.total_copies);
    if (!Number.isInteger(copies) || copies < 1) {
      errors.total_copies = 'Total copies must be an integer of at least 1.';
    }
    if (editingBook) {
      const activeLoans = editingBook.active_loans_count || 0;
      if (copies < activeLoans) {
        errors.total_copies = `Cannot reduce total copies below active loans count (${activeLoans}).`;
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingBook) {
        await onUpdateBook(editingBook.id, formData);
        showToast({ type: 'success', message: `Book "${formData.title}" updated successfully.` });
      } else {
        await onCreateBook(formData);
        showToast({ type: 'success', message: `Book "${formData.title}" added to catalog.` });
      }
      handleCloseFormModal();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Failed to save book record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (book) => {
    setDeletingBook(book);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBook) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteBook(deletingBook.id);
      showToast({ type: 'success', message: `Book "${deletingBook.title}" removed successfully.` });
      setDeletingBook(null);
    } catch (err) {
      setDeleteError(err.message || 'Cannot delete book with active loans.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="page-container books-page">
      {/* Top Filter and Actions Bar */}
      <div className="page-actions-bar card">
        <div className="search-filter-group">
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="form-control search-input"
              placeholder="Search by title, author, ISBN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-select-wrap">
            <select
              className="form-control form-select"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              aria-label="Filter by Genre"
            >
              <option value="">All Genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <label className="checkbox-label" title="Show only books with available copies">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            <span>Available Copies Only</span>
          </label>
        </div>

        <div className="page-action-buttons">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreate}
          >
            <span className="btn-icon">➕</span> Add New Book
          </button>
        </div>
      </div>

      {/* Books Table View */}
      <div className="card table-card">
        <div className="card-header-flex">
          <h3 className="card-title">
            📚 Catalog Titles ({filteredBooks.length} of {books.length})
          </h3>
          <span className="text-muted-sm">
            {availableOnly ? 'Showing available books only' : 'All books listed'}
          </span>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading catalog from MySQL database...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="empty-state">
            <p>No books match your current search or filter criteria.</p>
            {(search || selectedGenre || availableOnly) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch('');
                  setSelectedGenre('');
                  setAvailableOnly(false);
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title & Author</th>
                  <th>ISBN</th>
                  <th>Genre</th>
                  <th>Availability</th>
                  <th>Location</th>
                  <th>Active Loans</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book) => {
                  const isAvailable = (book.available_copies || 0) > 0;
                  return (
                    <tr key={book.id}>
                      <td>
                        <div className="book-title-cell">
                          <span className="fw-600">{book.title}</span>
                          <span className="text-muted-sm">{book.author}</span>
                        </div>
                      </td>
                      <td>
                        <code className="isbn-tag">{book.isbn}</code>
                      </td>
                      <td>
                        <span className="genre-pill">{book.genre || 'General'}</span>
                      </td>
                      <td>
                        <div className="availability-cell">
                          <span className={`pill-count ${isAvailable ? 'pill-success' : 'pill-zero'}`}>
                            {book.available_copies} / {book.total_copies}
                          </span>
                          <span className="text-muted-xs">
                            {isAvailable ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>
                      </td>
                      <td>{book.shelf_location || '—'}</td>
                      <td>
                        <span className="active-loans-tag">
                          {book.active_loans_count !== undefined ? book.active_loans_count : '—'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="action-buttons-group">
                          <button
                            type="button"
                            className="btn-action btn-view"
                            title="View Details"
                            onClick={() => setViewingBook(book)}
                          >
                            👁️
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-edit"
                            title="Edit Book"
                            onClick={() => handleOpenEdit(book)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-delete"
                            title="Delete Book"
                            onClick={() => handleDeleteClick(book)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Book Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => handleCloseFormModal()}
        title={editingBook ? '✏️ Edit Book Record' : '➕ Add Book to Catalog'}
        maxWidth="540px"
      >
        <form onSubmit={handleSubmitForm} className="modal-form">
          <div className="form-group">
            <label className="form-label" htmlFor="book-title">
              Book Title <span className="text-danger">*</span>
            </label>
            <input
              id="book-title"
              type="text"
              className={`form-control ${formErrors.title ? 'is-invalid' : ''}`}
              placeholder="e.g. Clean Code"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            {formErrors.title && <div className="invalid-feedback">{formErrors.title}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="book-author">
              Author <span className="text-danger">*</span>
            </label>
            <input
              id="book-author"
              type="text"
              className={`form-control ${formErrors.author ? 'is-invalid' : ''}`}
              placeholder="e.g. Robert C. Martin"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              required
            />
            {formErrors.author && <div className="invalid-feedback">{formErrors.author}</div>}
          </div>

          <div className="form-row">
            <div className="form-group form-col">
              <label className="form-label" htmlFor="book-isbn">
                ISBN <span className="text-danger">*</span>
              </label>
              <input
                id="book-isbn"
                type="text"
                className={`form-control ${formErrors.isbn ? 'is-invalid' : ''}`}
                placeholder="e.g. 978-0132350884"
                value={formData.isbn}
                onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                required
              />
              {formErrors.isbn && <div className="invalid-feedback">{formErrors.isbn}</div>}
            </div>

            <div className="form-group form-col">
              <label className="form-label" htmlFor="book-genre">
                Genre
              </label>
              <input
                id="book-genre"
                type="text"
                className="form-control"
                placeholder="e.g. Computer Science"
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-col">
              <label className="form-label" htmlFor="book-total-copies">
                Total Copies <span className="text-danger">*</span>
              </label>
              <input
                id="book-total-copies"
                type="number"
                min="1"
                className={`form-control ${formErrors.total_copies ? 'is-invalid' : ''}`}
                value={formData.total_copies}
                onChange={(e) => setFormData({ ...formData, total_copies: e.target.value })}
                required
              />
              {formErrors.total_copies && (
                <div className="invalid-feedback">{formErrors.total_copies}</div>
              )}
            </div>

            <div className="form-group form-col">
              <label className="form-label" htmlFor="book-shelf">
                Shelf Location
              </label>
              <input
                id="book-shelf"
                type="text"
                className="form-control"
                placeholder="e.g. CS-101"
                value={formData.shelf_location}
                onChange={(e) => setFormData({ ...formData, shelf_location: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleCloseFormModal()}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : editingBook ? 'Update Book' : 'Add Book'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Book Details Modal */}
      {viewingBook && (
        <Modal
          isOpen={Boolean(viewingBook)}
          onClose={() => setViewingBook(null)}
          title="📖 Book Details"
          maxWidth="500px"
          footer={
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingBook(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const b = viewingBook;
                  setViewingBook(null);
                  handleOpenEdit(b);
                }}
              >
                Edit Book Details
              </button>
            </div>
          }
        >
          <div className="details-card-body">
            <div className="details-header-block">
              <h4 className="details-title">{viewingBook.title}</h4>
              <p className="details-subtitle">by {viewingBook.author}</p>
            </div>
            <div className="details-grid">
              <div className="details-row">
                <span className="details-label">ISBN:</span>
                <code className="isbn-tag">{viewingBook.isbn}</code>
              </div>
              <div className="details-row">
                <span className="details-label">Genre:</span>
                <span>{viewingBook.genre || 'General'}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Total Copies:</span>
                <span className="fw-600">{viewingBook.total_copies}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Available Copies:</span>
                <span className={`pill-count ${(viewingBook.available_copies || 0) > 0 ? 'pill-success' : 'pill-zero'}`}>
                  {viewingBook.available_copies}
                </span>
              </div>
              <div className="details-row">
                <span className="details-label">Shelf Location:</span>
                <span>{viewingBook.shelf_location || 'Not Assigned'}</span>
              </div>
              <div className="details-row">
                <span className="details-label">Active Loans:</span>
                <span className="fw-600">{viewingBook.active_loans_count || 0}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingBook)}
        onClose={() => setDeletingBook(null)}
        onConfirm={handleConfirmDelete}
        title="⚠️ Delete Book Confirmation"
        message={
          deletingBook
            ? `Are you sure you want to permanently delete "${deletingBook.title}" (ISBN: ${deletingBook.isbn})? This operation cannot be undone.`
            : ''
        }
        confirmText="Delete Book"
        isDanger={true}
        isLoading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}

export default BooksPage;
