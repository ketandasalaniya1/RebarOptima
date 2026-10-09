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
  deleteEvent: (id, reason = '') => apiRequest(`/casting/events/${id}`, { method: 'DELETE', body: { reason } })
};
