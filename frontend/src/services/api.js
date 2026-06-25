import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
};

// ── Stokvels ──────────────────────────────────────────────────────────────────
export const stokvelAPI = {
  getPoolStatus: (tier)    => api.get(`/stokvels/pool/${tier}`),
  joinPool:      (tier)    => api.post('/stokvels/join', { tier }),
  getMyGroups:   ()        => api.get('/stokvels/my'),
  getGroup:      (id)      => api.get(`/stokvels/${id}`),
  getCycles:     (id)      => api.get(`/stokvels/${id}/cycles`),
  getCurrentCycle: (id)    => api.get(`/stokvels/${id}/cycles/current`),
  contribute:    (id)      => api.post(`/stokvels/${id}/contribute`),
  leavePool:     (id)      => api.delete(`/stokvels/join/${id}`),
  reinstate:     (id)      => api.post(`/stokvels/${id}/reinstate`),
  requestSwap:   (id, targetMemberId) => api.post(`/stokvels/${id}/swap`, { targetMemberId }),
};

// ── Wallet ────────────────────────────────────────────────────────────────────
export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
};

export default api;
