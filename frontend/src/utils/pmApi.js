import { apiRequest } from './api';

export const pmApi = {
  // Seed sample enterprise construction project data
  seedSampleData: () => apiRequest('/pm/seed-sample-data', { method: 'POST' }),

  // Executive Dashboard KPIs
  getKpis: () => apiRequest('/pm/dashboard-kpis'),

  // Projects
  getProjects: () => apiRequest('/pm/projects'),
  getProject: (id) => apiRequest(`/pm/projects/${id}`),
  createProject: (data) => apiRequest('/pm/projects', { method: 'POST', body: data }),
  updateProject: (id, data) => apiRequest(`/pm/projects/${id}`, { method: 'PUT', body: data }),
  lockBaseline: (id) => apiRequest(`/pm/projects/${id}/lock-baseline`, { method: 'POST' }),

  // Tasks & WBS
  getTasks: (projectId) => apiRequest(`/pm/projects/${projectId}/tasks`),
  createTask: (projectId, data) => apiRequest(`/pm/projects/${projectId}/tasks`, { method: 'POST', body: data }),
  updateTask: (id, data) => apiRequest(`/pm/tasks/${id}`, { method: 'PUT', body: data }),
  deleteTask: (id) => apiRequest(`/pm/tasks/${id}`, { method: 'DELETE' }),

  // Dependencies
  getDependencies: (projectId) => apiRequest(`/pm/projects/${projectId}/dependencies`),
  createDependency: (projectId, data) => apiRequest(`/pm/projects/${projectId}/dependencies`, { method: 'POST', body: data }),
  deleteDependency: (id) => apiRequest(`/pm/dependencies/${id}`, { method: 'DELETE' }),

  // Delay & CPM Rescheduling
  previewDelay: (projectId, data) => apiRequest(`/pm/projects/${projectId}/delay-preview`, { method: 'POST', body: data }),
  recordDelay: (projectId, data) => apiRequest(`/pm/projects/${projectId}/record-delay`, { method: 'POST', body: data }),
  getDelays: (projectId) => apiRequest(`/pm/projects/${projectId}/delays`),

  // Daily Progress Reports (DPR)
  getDprs: (projectId) => apiRequest(`/pm/projects/${projectId}/dpr`),
  submitDpr: (projectId, data) => apiRequest(`/pm/projects/${projectId}/dpr`, { method: 'POST', body: data }),
  approveDpr: (id) => apiRequest(`/pm/dpr/${id}/approve`, { method: 'PUT' }),

  // Calendar & Working Hours
  updateCalendar: (projectId, data) => apiRequest(`/pm/projects/${projectId}/calendar`, { method: 'PUT', body: data }),

  // Gantt Start Date Rescheduling & Preview
  previewRescheduleStartDate: (projectId, data) => apiRequest(`/pm/projects/${projectId}/reschedule-start-date/preview`, { method: 'POST', body: data }),
  confirmRescheduleStartDate: (projectId, data) => apiRequest(`/pm/projects/${projectId}/reschedule-start-date/confirm`, { method: 'POST', body: data }),

  // Manpower & Workforce Management
  getManpower: (projectId) => apiRequest(`/pm/projects/${projectId}/manpower`),
  createManpower: (projectId, data) => apiRequest(`/pm/projects/${projectId}/manpower`, { method: 'POST', body: data }),
  updateManpower: (projectId, resourceId, data) => apiRequest(`/pm/projects/${projectId}/manpower/${resourceId}`, { method: 'PUT', body: data }),
  deleteManpower: (projectId, resourceId) => apiRequest(`/pm/projects/${projectId}/manpower/${resourceId}`, { method: 'DELETE' }),
  getManpowerConflicts: (projectId) => apiRequest(`/pm/projects/${projectId}/manpower-conflicts`),

  // Quality & Inspections
  getInspections: (projectId) => apiRequest(`/pm/projects/${projectId}/inspections`),
  recordInspection: (projectId, data) => apiRequest(`/pm/projects/${projectId}/inspections`, { method: 'POST', body: data })
};
