import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  // Prefer admin token when calling admin endpoints
  const isAdminCall = config.url?.includes('/admin/');
  const adminToken  = localStorage.getItem('adminToken');
  const userToken   = localStorage.getItem('token');

  if (isAdminCall && adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (userToken) {
    config.headers.Authorization = `Bearer ${userToken}`;
  }
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
  login:      (identifier, password) => api.post('/auth/login', { identifier, password }),
  register:   (name, phone, password) => api.post('/auth/register', { name, phone, password }),
  verifyOtp:  (phone, code) => api.post('/auth/verify-otp', { phone, code }),
  resendOtp:  (phone) => api.post('/auth/resend-otp', { phone }),
  // formData must contain fields: idNumber, idDocument (file)
  verifyId:   (formData) => api.post('/auth/verify-id', formData, {
    headers: { 'Content-Type': undefined }, // let the browser set the multipart boundary
  }),
  getTrustHistory:  () => api.get('/auth/trust-history'),
  requestDeletion:  () => api.post('/auth/request-deletion'),
};

// ── Admin: Account Deletion Requests ────────────────────────────────────────
export const adminDeletionAPI = {
  list:    () => api.get('/admin/dashboard/deletion-requests'),
  process: (userId) => api.post(`/admin/dashboard/deletion-requests/${userId}/process`),
};

// ── Admin: ID Verifications ─────────────────────────────────────────────────
export const adminVerificationAPI = {
  list:     (status = 'pending') => api.get(`/admin/dashboard/id-verifications?status=${status}`),
  approve:  (userId) => api.post(`/admin/dashboard/id-verifications/${userId}/approve`),
  reject:   (userId, reason) => api.post(`/admin/dashboard/id-verifications/${userId}/reject`, { reason }),
  // Returns a blob — the document endpoint requires an admin Bearer token,
  // which an <img src> can't send, so the image must be fetched and turned
  // into an object URL in the component.
  getDocumentBlob: (userId) => api.get(`/admin/dashboard/id-verifications/${userId}/document`, {
    responseType: 'blob',
  }),
};

// ── Stokvels ──────────────────────────────────────────────────────────────────
export const stokvelAPI = {
  getPoolStatus: (tier)    => api.get(`/stokvels/pool/${tier}`),
  getMyWaitingStatus: ()   => api.get('/stokvels/pool-waiting/my'),
  joinPool:      (tier)    => api.post('/stokvels/join', { tier }),
  getMyGroups:   ()        => api.get('/stokvels/my'),
  getAlerts:     ()        => api.get('/stokvels/alerts'),
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
  getBalance: (days) => api.get('/wallet/balance' + (days ? `?days=${days}` : '')),
  withdraw:   (amount) => api.post('/wallet/withdraw', { amount }),
};

export const promoAPI = {
  redeem: (code) => api.post('/promos/redeem', { code }),
};

export const adminPromoAPI = {
  list:        () => api.get('/admin/dashboard/promos'),
  create:      (data) => api.post('/admin/dashboard/promos', data),
  redemptions: (id) => api.get(`/admin/dashboard/promos/${id}/redemptions`),
  toggle:      (id, active) => api.patch(`/admin/dashboard/promos/${id}`, { active }),
};

// ── Admin: Audit Logs ───────────────────────────────────────────────────────
export const adminLogsAPI = {
  list: (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return api.get(`/admin/dashboard/audit-logs${query ? `?${query}` : ''}`);
  },
  actions: () => api.get('/admin/dashboard/audit-logs/actions'),
};

export const vasAPI = {
  products:        ()       => api.get('/vas/products'),
  purchase:        (data)   => api.post('/vas/purchase', data),
  history:         ()       => api.get('/vas/history'),
  recipients:      ()       => api.get('/vas/recipients'),
  saveRecipient:   (data)   => api.post('/vas/recipients', data),
  deleteRecipient: (id)     => api.delete(`/vas/recipients/${id}`),
};

// ── Admin: VAS Fees ──────────────────────────────────────────────────────────
export const adminVasFeesAPI = {
  list:   () => api.get('/admin/dashboard/vas-fees'),
  update: (productType, feePercent) => api.put(`/admin/dashboard/vas-fees/${productType}`, { feePercent }),
};

export default api;
