import { apiRequest } from './api';

export const crmApi = {
  // Global search & seed
  search: (query) => apiRequest(`/crm/search?q=${encodeURIComponent(query)}`),
  seedSampleData: () => apiRequest('/crm/seed-sample-data', { method: 'POST' }),

  // Customers
  getCustomers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/customers${qs ? `?${qs}` : ''}`);
  },
  getCustomer360: (id) => apiRequest(`/crm/customers/${id}`),
  createCustomer: (data) => apiRequest('/crm/customers', { method: 'POST', body: data }),
  updateCustomer: (id, data) => apiRequest(`/crm/customers/${id}`, { method: 'PUT', body: data }),
  checkDuplicate: (data) => apiRequest('/crm/customers/check-duplicate', { method: 'POST', body: data }),
  addCustomerInterest: (customerId, data) => apiRequest(`/crm/customers/${customerId}/interests`, { method: 'POST', body: data }),
  addCustomerActivity: (customerId, data) => apiRequest(`/crm/customers/${customerId}/activities`, { method: 'POST', body: data }),

  // Projects & Units
  getProjects: () => apiRequest('/crm/projects'),
  getProjectDetail: (id) => apiRequest(`/crm/projects/${id}`),
  createProject: (data) => apiRequest('/crm/projects', { method: 'POST', body: data }),
  getUnits: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/units${qs ? `?${qs}` : ''}`);
  },
  getUnitProfile: (id) => apiRequest(`/crm/units/${id}`), // Unit Wise Profile
  createUnit: (data) => apiRequest('/crm/units', { method: 'POST', body: data }),
  updateUnit: (id, data) => apiRequest(`/crm/units/${id}`, { method: 'PUT', body: data }),
  reserveUnit: (id, data) => apiRequest(`/crm/units/${id}/reserve`, { method: 'POST', body: data }),
  releaseUnit: (id) => apiRequest(`/crm/units/${id}/release`, { method: 'POST' }),

  // Leads & Pipeline
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/leads${qs ? `?${qs}` : ''}`);
  },
  getPipelineStats: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/leads/pipeline-stats${qs ? `?${qs}` : ''}`);
  },
  getLeadDetail: (id) => apiRequest(`/crm/leads/${id}`),
  updateLeadStage: (id, data) => apiRequest(`/crm/leads/${id}/stage`, { method: 'PUT', body: data }),
  addLeadActivity: (id, data) => apiRequest(`/crm/leads/${id}/activities`, { method: 'POST', body: data }),
  reassignLead: (id, data) => apiRequest(`/crm/leads/${id}/assign`, { method: 'PUT', body: data }),

  // Site Visits & Tasks
  getVisits: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/visits${qs ? `?${qs}` : ''}`);
  },
  scheduleVisit: (data) => apiRequest('/crm/visits', { method: 'POST', body: data }),
  updateVisitStatus: (id, data) => apiRequest(`/crm/visits/${id}/status`, { method: 'PUT', body: data }),
  getTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (data) => apiRequest('/crm/tasks', { method: 'POST', body: data }),
  completeTask: (id, data = {}) => apiRequest(`/crm/tasks/${id}/complete`, { method: 'PUT', body: data }),

  // Bookings
  getBookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/bookings${qs ? `?${qs}` : ''}`);
  },
  getBookingDetail: (id) => apiRequest(`/crm/bookings/${id}`),
  createBooking: (data) => apiRequest('/crm/bookings', { method: 'POST', body: data }),
  confirmBooking: (id) => apiRequest(`/crm/bookings/${id}/confirm`, { method: 'PUT' }),
  cancelBooking: (id, data) => apiRequest(`/crm/bookings/${id}/cancel`, { method: 'PUT', body: data }),

  // Payments & Receipts
  getPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/payments${qs ? `?${qs}` : ''}`);
  },
  recordPayment: (data) => apiRequest('/crm/payments', { method: 'POST', body: data }),
  getReceipt: (id) => apiRequest(`/crm/payments/${id}/receipt`),
  reversePayment: (id, data) => apiRequest(`/crm/payments/${id}/reverse`, { method: 'PUT', body: data }),

  // Reports
  getDashboardAnalytics: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/reports/dashboard${qs ? `?${qs}` : ''}`);
  },
  getSalespersonStats: () => apiRequest('/crm/reports/salespersons'),

  // Settings
  getSettings: () => apiRequest('/crm/settings'),
  updateSettings: (data) => apiRequest('/crm/settings', { method: 'PUT', body: data })
};
