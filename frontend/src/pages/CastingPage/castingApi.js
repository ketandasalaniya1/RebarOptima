import { apiRequest } from '../../utils/api';

export const castingApi = {
  // Member Types
  getMemberTypes: () => apiRequest('/casting/member-types'),

  // Projects
  getProjects: () => apiRequest('/casting/projects'),
  getProjectById: (id) => apiRequest(`/casting/projects/${id}`),
  createProject: (data) => apiRequest('/casting/projects', { method: 'POST', body: data }),
  updateProject: (id, data) => apiRequest(`/casting/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject: (id, reason = '') => apiRequest(`/casting/projects/${id}`, { method: 'DELETE', body: { reason } }),

  // Blocks
  getBlocks: (projectId) => apiRequest(`/casting/projects/${projectId}/blocks`),
  createBlock: (projectId, data) => apiRequest(`/casting/projects/${projectId}/blocks`, { method: 'POST', body: data }),
  updateBlock: (id, data) => apiRequest(`/casting/blocks/${id}`, { method: 'PUT', body: data }),
  deleteBlock: (id) => apiRequest(`/casting/blocks/${id}`, { method: 'DELETE' }),

  // Levels
  getLevels: (blockId) => apiRequest(`/casting/blocks/${blockId}/levels`),
  createLevel: (blockId, data) => apiRequest(`/casting/blocks/${blockId}/levels`, { method: 'POST', body: data }),
  updateLevel: (id, data) => apiRequest(`/casting/levels/${id}`, { method: 'PUT', body: data }),
  deleteLevel: (id) => apiRequest(`/casting/levels/${id}`, { method: 'DELETE' }),

  // Structural Members
  getMembers: (levelId) => apiRequest(`/casting/levels/${levelId}/members`),
  getProjectMembers: (projectId) => apiRequest(`/casting/projects/${projectId}/all-members`),
  createMember: (levelId, data) => apiRequest(`/casting/levels/${levelId}/members`, { method: 'POST', body: data }),
  createMembersBatch: (levelId, data) => apiRequest(`/casting/levels/${levelId}/members/batch`, { method: 'POST', body: data }),
  updateMember: (id, data) => apiRequest(`/casting/members/${id}`, { method: 'PUT', body: data }),
  deleteMember: (id) => apiRequest(`/casting/members/${id}`, { method: 'DELETE' }),

  // Casting Events & Pour Segments
  getEvents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.status) query.set('status', params.status);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return apiRequest(`/casting/events${qs ? `?${qs}` : ''}`);
  },
  getEventById: (id) => apiRequest(`/casting/events/${id}`),
  createEvent: (data) => apiRequest('/casting/events', { method: 'POST', body: data }),
  updateEvent: (id, data) => apiRequest(`/casting/events/${id}`, { method: 'PUT', body: data }),
  deleteEvent: (id, reason = '') => apiRequest(`/casting/events/${id}`, { method: 'DELETE', body: { reason } }),

  // Phase 2: Concrete Mix Recipes
  getRecipes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.grade) query.set('grade', params.grade);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    const qs = query.toString();
    return apiRequest(`/casting/recipes${qs ? `?${qs}` : ''}`);
  },
  getRecipeById: (id) => apiRequest(`/casting/recipes/${id}`),
  createRecipe: (data) => apiRequest('/casting/recipes', { method: 'POST', body: data }),
  createRecipeVersion: (id, data) => apiRequest(`/casting/recipes/${id}/versions`, { method: 'POST', body: data }),
  updateRecipeVersion: (id, vNum, data) => apiRequest(`/casting/recipes/${id}/versions/${vNum}`, { method: 'PUT', body: data }),
  submitRecipeVersion: (id, vNum) => apiRequest(`/casting/recipes/${id}/versions/${vNum}/submit`, { method: 'POST' }),
  approveRecipeVersion: (id, vNum, remarks = '') => apiRequest(`/casting/recipes/${id}/versions/${vNum}/approve`, { method: 'POST', body: { remarks } }),
  rejectRecipeVersion: (id, vNum, remarks = '') => apiRequest(`/casting/recipes/${id}/versions/${vNum}/reject`, { method: 'POST', body: { remarks } }),
  archiveRecipe: (id) => apiRequest(`/casting/recipes/${id}`, { method: 'DELETE' }),

  // Phase 2: Segment Recipe Binding & Material Requirement Sheet (MRS)
  bindSegmentRecipes: (eventId, bindings) => apiRequest(`/casting/events/${eventId}/segments/recipes`, { method: 'PUT', body: { bindings } }),
  generateMRS: (eventId, changeReason = '') => apiRequest(`/casting/events/${eventId}/mrs/generate`, { method: 'POST', body: { changeReason } }),
  getMRS: (eventId, revision = null) => {
    const qs = revision ? `?revision=${revision}` : '';
    return apiRequest(`/casting/events/${eventId}/mrs${qs}`);
  },
  getMRSRevisions: (eventId) => apiRequest(`/casting/events/${eventId}/mrs/revisions`)
};

