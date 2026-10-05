import { apiRequest } from '../../utils/api';

export const bbsApi = {
  // Projects
  getProjects: () => apiRequest('/bbs/projects'),
  getProjectById: (id) => apiRequest(`/bbs/projects/${id}`),
  createProject: (data) => apiRequest('/bbs/projects', { method: 'POST', body: data }),
  updateProject: (id, data) => apiRequest(`/bbs/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject: (id) => apiRequest(`/bbs/projects/${id}`, { method: 'DELETE' }),

  // Blocks
  getBlocks: (projectId) => apiRequest(`/bbs/projects/${projectId}/blocks`),
  createBlock: (projectId, data) => apiRequest(`/bbs/projects/${projectId}/blocks`, { method: 'POST', body: data }),
  updateBlock: (id, data) => apiRequest(`/bbs/blocks/${id}`, { method: 'PUT', body: data }),
  deleteBlock: (id) => apiRequest(`/bbs/blocks/${id}`, { method: 'DELETE' }),

  // Levels
  getLevels: (blockId) => apiRequest(`/bbs/blocks/${blockId}/levels`),
  createLevel: (blockId, data) => apiRequest(`/bbs/blocks/${blockId}/levels`, { method: 'POST', body: data }),
  updateLevel: (id, data) => apiRequest(`/bbs/levels/${id}`, { method: 'PUT', body: data }),
  reorderLevels: (blockId, levelIds) => apiRequest(`/bbs/blocks/${blockId}/levels/reorder`, { method: 'PUT', body: { levelIds } }),
  deleteLevel: (id) => apiRequest(`/bbs/levels/${id}`, { method: 'DELETE' }),

  // Structural Members
  getMemberTypes: () => apiRequest('/bbs/member-types'),
  getMembers: (levelId) => apiRequest(`/bbs/levels/${levelId}/members`),
  createMember: (levelId, data) => apiRequest(`/bbs/levels/${levelId}/members`, { method: 'POST', body: data }),
  createMembersBatch: (levelId, data) => apiRequest(`/bbs/levels/${levelId}/members/batch`, { method: 'POST', body: data }),
  updateMember: (id, data) => apiRequest(`/bbs/members/${id}`, { method: 'PUT', body: data }),
  deleteMember: (id) => apiRequest(`/bbs/members/${id}`, { method: 'DELETE' }),

  // Shape Library & Parametric Blocks (Phase 2A)
  getShapes: () => apiRequest('/bbs/shapes'),
  createShape: (data) => apiRequest('/bbs/shapes', { method: 'POST', body: data }),
  updateShape: (id, data) => apiRequest(`/bbs/shapes/${id}`, { method: 'PUT', body: data }),
  deleteShape: (id) => apiRequest(`/bbs/shapes/${id}`, { method: 'DELETE' }),
};

