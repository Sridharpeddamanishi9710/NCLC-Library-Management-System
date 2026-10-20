import { api } from './api';

export const systemService = {
  async getHealth() {
    return await api.get('/health');
  },
};

export default systemService;
