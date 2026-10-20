import { api } from './api';

export const loanService = {
  async getLoans(filters = {}) {
    const params = {};
    if (filters.status && filters.status !== 'ALL') params.status = filters.status;
    if (filters.member_id) params.member_id = filters.member_id;
    if (filters.book_id) params.book_id = filters.book_id;
    if (filters.search) params.search = filters.search.trim();

    const response = await api.get('/loans', params);
    return response.data || [];
  },

  async getOverdueLoans() {
    const response = await api.get('/loans/overdue');
    return response.data || [];
  },

  async getLoanById(id) {
    const response = await api.get(`/loans/${id}`);
    return response.data;
  },

  async issueLoan({ book_id, member_id, issue_date, due_date }) {
    const payload = {
      book_id: Number(book_id),
      member_id: Number(member_id),
    };
    if (issue_date) payload.issue_date = issue_date;
    if (due_date) payload.due_date = due_date;

    const response = await api.post('/loans/issue', payload);
    return response.data;
  },

  async returnLoan(id, returnData = {}) {
    const payload = {};
    if (returnData.return_date) {
      payload.return_date = returnData.return_date;
    }
    const response = await api.post(`/loans/${id}/return`, payload);
    return response.data;
  },

  async payFine(id, amount) {
    const payload = {
      amount: Number(amount),
    };
    const response = await api.post(`/loans/${id}/pay-fine`, payload);
    return response.data;
  },
};

export default loanService;
