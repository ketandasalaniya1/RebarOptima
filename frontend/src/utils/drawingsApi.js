// RebarOptima Standalone Enterprise Drawing & File Management API Client
// Connected to shared apiRequest for automatic Bearer token injection and seamless 401 refresh

import { apiRequest } from './api';

export const drawingsApi = {
  // 1. Dashboard
  getDashboard: () => apiRequest('/drawings/dashboard'),

  // 2. Projects
  getProjects: () => apiRequest('/drawings/projects'),
  createProject: (data) =>
    apiRequest('/projects', {
      method: 'POST',
      body: {
        name: data.projectName || data.name,
        address: data.address || 'Site Location',
        pincode: data.pincode || '382418',
        location:
          data.location && typeof data.location === 'object' && data.location.latitude !== undefined
            ? data.location
            : { latitude: 23.012, longitude: 72.681 },
        projectType: data.projectType || 'Residential',
      },
    }),

  // 3. Disciplines
  getDisciplines: () => apiRequest('/drawings/disciplines'),
  createDiscipline: (data) => apiRequest('/drawings/disciplines', { method: 'POST', body: data }),

  // 4. Drawing Register
  getDrawings: (params = {}) => {
    const query = new URLSearchParams();
    if (params.projectId && params.projectId !== 'all') query.append('projectId', params.projectId);
    if (params.disciplineId && params.disciplineId !== 'all') query.append('disciplineId', params.disciplineId);
    if (params.blockId && params.blockId !== 'all') query.append('blockId', params.blockId);
    if (params.block && params.block !== 'all') query.append('block', params.block);
    if (params.level && params.level !== 'all') query.append('level', params.level);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString();
    return apiRequest(`/drawings/drawings${qs ? `?${qs}` : ''}`);
  },
  createDrawing: (data) => apiRequest('/drawings/drawings', { method: 'POST', body: data }),
  getDrawingDetail: (id) => apiRequest(`/drawings/drawings/${id}`),

  // 4b. Matrix
  getMatrix: (params = {}) => {
    const query = new URLSearchParams();
    if (params.projectId && params.projectId !== 'all') query.append('projectId', params.projectId);
    if (params.disciplineId && params.disciplineId !== 'all') query.append('disciplineId', params.disciplineId);
    if (params.blockId && params.blockId !== 'all') query.append('blockId', params.blockId);
    const qs = query.toString();
    return apiRequest(`/drawings/matrix${qs ? `?${qs}` : ''}`);
  },

  // 4c. Check duplicate
  checkDuplicate: (params = {}) => {
    const query = new URLSearchParams();
    if (params.projectId) query.append('projectId', params.projectId);
    if (params.drawingNumber) query.append('drawingNumber', params.drawingNumber);
    return apiRequest(`/drawings/check-duplicate?${query.toString()}`);
  },

  // 5. Revisions / Versions
  uploadRevision: (drawingId, data) =>
    apiRequest(`/drawings/drawings/${drawingId}/revisions`, { method: 'POST', body: data }),
  makeRevisionCurrent: (drawingId, revisionId) =>
    apiRequest(`/drawings/drawings/${drawingId}/versions/${revisionId}/make-current`, { method: 'POST' }),
  updateRevision: (drawingId, revisionId, data) =>
    apiRequest(`/drawings/drawings/${drawingId}/versions/${revisionId}`, { method: 'PATCH', body: data }),

  // 6. Review & Approval
  submitForReview: (drawingId, revisionId, data = {}) =>
    apiRequest(`/drawings/drawings/${drawingId}/revisions/${revisionId}/submit-review`, { method: 'POST', body: data }),
  recordReview: (drawingId, revisionId, data) =>
    apiRequest(`/drawings/drawings/${drawingId}/revisions/${revisionId}/review`, { method: 'POST', body: data }),
  recordDecision: (drawingId, revisionId, data) =>
    apiRequest(`/drawings/drawings/${drawingId}/revisions/${revisionId}/decision`, { method: 'POST', body: data }),
  publishRevision: (drawingId, revisionId) =>
    apiRequest(`/drawings/drawings/${drawingId}/revisions/${revisionId}/publish`, { method: 'POST' }),

  // 7. Transmittals
  getTransmittals: () => apiRequest('/drawings/transmittals'),
  createTransmittal: (data) => apiRequest('/drawings/transmittals', { method: 'POST', body: data }),
  getTransmittalSlip: (id) => apiRequest(`/drawings/transmittals/${id}`),

  // 8. Audit Activity Log
  getActivityLog: () => apiRequest('/drawings/activity'),

  // 9. Users & Permissions
  getUsers: () => apiRequest('/drawings/users'),
  createUser: (data) => apiRequest('/drawings/users', { method: 'POST', body: data }),

  // 10. Settings
  getSettings: () => apiRequest('/drawings/settings'),
  updateSettings: (data) => apiRequest('/drawings/settings', { method: 'PUT', body: data }),

  // 11. Seed
  seedWorkspace: () => apiRequest('/drawings/seed', { method: 'POST' }),

  // 12. File Download
  downloadDrawing: (id, revisionId = null) => {
    const url = revisionId ? `/drawings/drawings/${id}/download?revisionId=${revisionId}` : `/drawings/drawings/${id}/download`;
    return apiRequest(url);
  }
};
