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
  revealSensitiveFields: (id) => apiRequest(`/crm/customers/${id}/sensitive-fields`),
  createCustomer: (data) => apiRequest('/crm/customers', { method: 'POST', body: data }),
  updateCustomer: (id, data) => apiRequest(`/crm/customers/${id}`, { method: 'PUT', body: data }),
  checkDuplicate: (data) => apiRequest('/crm/customers/check-duplicate', { method: 'POST', body: data }),
  addCustomerInterest: (customerId, data) => apiRequest(`/crm/customers/${customerId}/interests`, { method: 'POST', body: data }),
  addCustomerActivity: (customerId, data) => apiRequest(`/crm/customers/${customerId}/activities`, { method: 'POST', body: data }),

  // Projects, Blocks & Units
  getUnitMasterData: () => apiRequest('/crm/settings/unit-master-data'),
  getProjects: () => apiRequest('/crm/projects'),
  getProjectDetail: (id) => apiRequest(`/crm/projects/${id}`),
  createProject: (data) => apiRequest('/crm/projects', { method: 'POST', body: data }),
  getBlocks: (projectId) => apiRequest(`/crm/blocks${projectId ? `?projectId=${projectId}` : ''}`),
  getFloors: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/floors${qs ? `?${qs}` : ''}`);
  },
  createBlock: (data) => apiRequest('/crm/blocks', { method: 'POST', body: data }),
  clearSeedUnits: (projectId) => apiRequest(`/crm/projects/${projectId}/clear-seed-units`, { method: 'POST' }),
  getUnits: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/units${qs ? `?${qs}` : ''}`);
  },
  getUnitProfile: (id) => apiRequest(`/crm/units/${id}`), // Unit Wise Profile
  createUnit: (data) => apiRequest('/crm/units', { method: 'POST', body: data }),
  updateUnit: (id, data) => apiRequest(`/crm/units/${id}`, { method: 'PUT', body: data }),
  reserveUnit: (id, data) => apiRequest(`/crm/units/${id}/reserve`, { method: 'POST', body: data }),
  releaseUnit: (id) => apiRequest(`/crm/units/${id}/release`, { method: 'POST' }),
  blockUnit: (id, data = {}) => apiRequest(`/crm/units/${id}/block`, { method: 'POST', body: data }),
  unblockUnit: (id) => apiRequest(`/crm/units/${id}/unblock`, { method: 'POST' }),

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
  updateSettings: (data) => apiRequest('/crm/settings', { method: 'PUT', body: data }),

  // Today Summary & Appointments
  getTodaySummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/today-summary${qs ? `?${qs}` : ''}`);
  },
  getAppointments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/appointments${qs ? `?${qs}` : ''}`);
  },
  createAppointment: (data) => apiRequest('/crm/appointments', { method: 'POST', body: data }),
  toggleTask: (taskId) => apiRequest(`/crm/tasks/${taskId}/toggle`, { method: 'PUT' }),

  // WhatsApp Templates
  getTemplates: () => apiRequest('/crm/templates'),
  createTemplate: (data) => apiRequest('/crm/templates', { method: 'POST', body: data }),
  updateTemplate: (id, data) => apiRequest(`/crm/templates/${id}`, { method: 'PUT', body: data }),
  deleteTemplate: (id) => apiRequest(`/crm/templates/${id}`, { method: 'DELETE' }),

  // Guided Follow-up Outcomes & Timeline
  logFollowupResult: (leadId, data) => apiRequest(`/crm/leads/${leadId}/followup-result`, { method: 'POST', body: data }),
  getLeadTimeline: (leadId) => apiRequest(`/crm/leads/${leadId}/timeline`),

  // Tasks & Calendar
  updateTask: (id, data) => apiRequest(`/crm/tasks/${id}`, { method: 'PUT', body: data }),
  deleteTask: (id) => apiRequest(`/crm/tasks/${id}`, { method: 'DELETE' }),
  getCalendarEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/calendar-events${qs ? `?${qs}` : ''}`);
  },
  submitAppointmentFeedback: (id, data) => apiRequest(`/crm/appointments/${id}/feedback`, { method: 'POST', body: data }),

  // Leads & Pipeline
  createLead: (data) => apiRequest('/crm/leads', { method: 'POST', body: data }),
  getPipelineStages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/leads/pipeline/stages${qs ? `?${qs}` : ''}`);
  },
  updatePipelineStages: (data) => apiRequest('/crm/leads/pipeline/stages', { method: 'PUT', body: data }),

  // Follow-ups Queue & Interactive Log
  getFollowups: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/crm/followups${qs ? `?${qs}` : ''}`);
  },
  logFollowupInteraction: (data) => apiRequest('/crm/followups/log', { method: 'POST', body: data }),

  // Lead Import Pipeline
  uploadImportFile: (formData) => apiRequest('/crm/leads/import/upload', { method: 'POST', body: formData }),
  executeLeadImport: (data) => apiRequest('/crm/leads/import/execute', { method: 'POST', body: data }),
  getImportHistory: () => apiRequest('/crm/leads/import/history'),
  getSampleTemplateUrl: () => '/api/crm/leads/import/sample-template'
};
