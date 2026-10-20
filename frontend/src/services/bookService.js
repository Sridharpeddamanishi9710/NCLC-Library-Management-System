import { api } from './api';

export const bookService = {
  async getBooks(filters = {}) {
    const params = {};
    if (filters.search) params.search = filters.search.trim();
    if (filters.genre) params.genre = filters.genre.trim();
    if (filters.availableOnly) params.availableOnly = 'true';

    const response = await api.get('/books', params);
    return response.data || [];
  },

  async getBookById(id) {
    const response = await api.get(`/books/${id}`);
    return response.data;
  },

  async createBook(bookData) {
    const payload = {
      isbn: bookData.isbn.trim(),
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      genre: bookData.genre ? bookData.genre.trim() : null,
      total_copies: Number(bookData.total_copies),
      shelf_location: bookData.shelf_location ? bookData.shelf_location.trim() : null,
    };
    const response = await api.post('/books', payload);
    return response.data;
  },

  async updateBook(id, bookData) {
    const payload = {
      isbn: bookData.isbn.trim(),
      title: bookData.title.trim(),
      author: bookData.author.trim(),
      genre: bookData.genre ? bookData.genre.trim() : null,
      total_copies: Number(bookData.total_copies),
      shelf_location: bookData.shelf_location ? bookData.shelf_location.trim() : null,
    };
    const response = await api.put(`/books/${id}`, payload);
    return response.data;
  },

  async deleteBook(id) {
    const response = await api.delete(`/books/${id}`);
    return response;
  },
};

export default bookService;
