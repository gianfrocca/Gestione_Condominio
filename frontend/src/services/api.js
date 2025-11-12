import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Health check
export const healthCheck = () => api.get('/health');

export default api;
