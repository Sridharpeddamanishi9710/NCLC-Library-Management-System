import { api } from './api';

export const memberService = {
  async getMembers(filters = {}) {
    const params = {};
    if (filters.search) params.search = filters.search.trim();
    if (filters.status && filters.status !== 'ALL') params.status = filters.status;

    const response = await api.get('/members', params);
    return response.data || [];
  },

  async getMemberById(id) {
    const response = await api.get(`/members/${id}`);
    return response.data;
  },

  async createMember(memberData) {
    const payload = {
      member_code: memberData.member_code.trim(),
      name: memberData.name.trim(),
      email: memberData.email.trim(),
      phone: memberData.phone ? memberData.phone.trim() : null,
      status: memberData.status || 'ACTIVE',
      max_borrow_limit: memberData.max_borrow_limit
        ? Number(memberData.max_borrow_limit)
        : 3,
    };
    const response = await api.post('/members', payload);
    return response.data;
  },

  async updateMember(id, memberData) {
    const payload = {
      member_code: memberData.member_code.trim(),
      name: memberData.name.trim(),
      email: memberData.email.trim(),
      phone: memberData.phone ? memberData.phone.trim() : null,
      status: memberData.status || 'ACTIVE',
      max_borrow_limit: memberData.max_borrow_limit
        ? Number(memberData.max_borrow_limit)
        : 3,
    };
    const response = await api.put(`/members/${id}`, payload);
    return response.data;
  },

  async deleteMember(id, action = null) {
    const params = {};
    if (action === 'deactivate') {
      params.action = 'deactivate';
    }
    const response = await api.delete(`/members/${id}`, params);
    return response;
  },
};

export default memberService;
