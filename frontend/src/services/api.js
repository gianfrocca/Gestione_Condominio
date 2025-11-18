import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor per aggiungere automaticamente il token JWT alle richieste
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor per gestire errori di autenticazione
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se errore 401 e non è già un retry, prova a refreshare il token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });

          localStorage.setItem('accessToken', data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh fallito, redirect al login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Units API
export const unitsAPI = {
  getAll: () => api.get('/units'),
  getById: (id) => api.get(`/units/${id}`),
  create: (data) => api.post('/units', data),
  update: (id, data) => api.put(`/units/${id}`, data),
  delete: (id) => api.delete(`/units/${id}`),
};

// Readings API
export const readingsAPI = {
  getAll: (params) => api.get('/readings', { params }),
  create: (data) => api.post('/readings', data),
  createBatch: (readings) => api.post('/readings/batch', { readings }),
  update: (id, data) => api.put(`/readings/${id}`, data),
  delete: (id) => api.delete(`/readings/${id}`),
  getMetersByUnit: (unitId) => api.get(`/readings/meters/unit/${unitId}`),
};

// Bills API
export const billsAPI = {
  getAll: (params) => api.get('/bills', { params }),
  getById: (id) => api.get(`/bills/${id}`),
  create: (formData) => api.post('/bills', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, data) => api.put(`/bills/${id}`, data),
  delete: (id) => api.delete(`/bills/${id}`),
  downloadFile: (id) => api.get(`/bills/${id}/file`, { responseType: 'blob' }),
};

// Calculations API
export const calculationsAPI = {
  calculate: (month) => api.post('/calculations/calculate', { month }),
  getHistory: (params) => api.get('/calculations/history', { params }),
  getAnnualSummary: (year) => api.get(`/calculations/annual-summary/${year}`),
  getMonthlyStats: (month) => api.get(`/calculations/monthly-stats/${month}`),
};

// Settings API
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  getByKey: (key) => api.get(`/settings/${key}`),
  update: (key, data) => api.put(`/settings/${key}`, data),
  updateMultiple: (settings) => api.put('/settings', { settings }),
  create: (data) => api.post('/settings', data),
};

// Reports API
export const reportsAPI = {
  generateMonthly: (month) => api.post('/reports/monthly', { month }, {
    responseType: 'blob'
  }),
  generateAnnual: (year) => api.get(`/reports/annual/${year}`, {
    responseType: 'blob'
  }),
  list: () => api.get('/reports/list'),
  download: (filename) => api.get(`/reports/download/${filename}`, {
    responseType: 'blob'
  }),
};

// Payments API
export const paymentsAPI = {
  getAll: (params) => api.get('/payments', { params }),
  getById: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
  getSummary: (unitId) => api.get(`/payments/summary/${unitId}`),
  getSummaryAll: () => api.get('/payments/summary-all'),
};

// Auth API
export const authAPI = {
  login: (username, password) => axios.post(`${API_BASE_URL}/auth/login`, { username, password }),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }),
  getMe: (token) => axios.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  }),
  changePassword: (token, currentPassword, newPassword) => axios.post(
    `${API_BASE_URL}/auth/change-password`,
    { currentPassword, newPassword },
    { headers: { Authorization: `Bearer ${token}` } }
  ),
  resetPasswordRequest: (email) => axios.post(`${API_BASE_URL}/auth/reset-password-request`, { email }),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }),
};

// Health check
export const healthCheck = () => api.get('/health');

export default api;
