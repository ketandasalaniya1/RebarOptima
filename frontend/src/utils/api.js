const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export async function apiRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem('accessToken');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers,
  };
  
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  
  let response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  let data = await response.json().catch(() => null);
  
  if (response.status === 401 && !endpoint.includes('/auth/signin') && !endpoint.includes('/auth/refresh')) {
    if (isRefreshing) {
      try {
        const newToken = await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        config.headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        data = await response.json().catch(() => null);
      } catch (err) {
        throw err;
      }
    } else {
      isRefreshing = true;
      try {
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token available');
        
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        
        const refreshData = await refreshRes.json();
        if (!refreshRes.ok) throw new Error('Refresh failed');
        
        sessionStorage.setItem('accessToken', refreshData.accessToken);
        if (refreshData.refreshToken) {
          sessionStorage.setItem('refreshToken', refreshData.refreshToken);
        }
        
        isRefreshing = false;
        processQueue(null, refreshData.accessToken);
        
        config.headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        data = await response.json().catch(() => null);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        sessionStorage.clear();
        window.location.href = '/login';
        throw refreshErr;
      }
    }
  }
  
  if (!response.ok) {
    const errorMsg = (Array.isArray(data?.message) ? data.message[0] : data?.message) || `HTTP error! status: ${response.status}`;
    throw new Error(errorMsg);
  }
  
  return data;
}

export const authApi = {
  signin: (email, password) => 
    apiRequest('/auth/signin', { method: 'POST', body: { email, password } }),
  signup: (dto) => 
    apiRequest('/auth/signup', { method: 'POST', body: dto }),
  developerSignin: (email, password) =>
    apiRequest('/auth/developer/signin', { method: 'POST', body: { email, password } }),
};

export const inventoryApi = {
  getInventory: () => 
    apiRequest('/inventory'),
  inward: (dto) => 
    apiRequest('/inventory/inward', { method: 'POST', body: dto }),
  getScrapRules: () => 
    apiRequest('/inventory/scrap-rules'),
  updateScrapRules: (rules) => 
    apiRequest('/inventory/scrap-rules', { method: 'POST', body: { rules } }),
  getLedger: () => 
    apiRequest('/inventory/ledger'),
  deleteStockItem: (id) =>
    apiRequest(`/inventory/${id}`, { method: 'DELETE' }),
  updateStockItem: (id, quantity) =>
    apiRequest(`/inventory/${id}`, { method: 'PUT', body: { quantity } }),
  getScrapSales: () =>
    apiRequest('/inventory/scrapsales'),
  createScrapSale: (dto) =>
    apiRequest('/inventory/scrapsales', { method: 'POST', body: dto }),
  updateScrapSale: (id, dto) =>
    apiRequest(`/inventory/scrapsales/${id}`, { method: 'PUT', body: dto }),
  deleteScrapSale: (id) =>
    apiRequest(`/inventory/scrapsales/${id}`, { method: 'DELETE' }),
};

export const batchesApi = {
  optimize: (payload) =>
    apiRequest('/batches/optimize', { method: 'POST', body: payload }),
  commitBatch: (batchData) => 
    apiRequest('/batches', { method: 'POST', body: batchData }),
  getHistory: () => 
    apiRequest('/batches'),
  getStats: () => 
    apiRequest('/batches/stats'),
  getScrapRecords: () =>
    apiRequest('/batches/scrap-records'),
  updateBatch: (id, batchName) =>
    apiRequest(`/batches/${id}`, { method: 'PUT', body: { batchName } }),
  deleteBatch: (id, restoreStock = false) =>
    apiRequest(`/batches/${id}?restoreStock=${restoreStock}`, { method: 'DELETE' }),
};

// Developer API
export const developerApi = {
  getMe: () => apiRequest('/developer/me'),
  getStats: () => apiRequest('/developer/stats'),
  // Companies
  getCompanies: () => apiRequest('/developer/companies'),
  getCompany: (id) => apiRequest(`/developer/companies/${id}`),
  updateCompanyStatus: (id, status) => apiRequest(`/developer/companies/${id}/status`, { method: 'PUT', body: { status } }),
  deleteCompany: (id, password) => apiRequest(`/developer/companies/${id}`, { method: 'DELETE', body: { password } }),
  // Packages
  getPackages: () => apiRequest('/developer/packages'),
  createPackage: (dto) => apiRequest('/developer/packages', { method: 'POST', body: dto }),
  updatePackage: (id, dto) => apiRequest(`/developer/packages/${id}`, { method: 'PUT', body: dto }),
  // Subscriptions
  getSubscriptions: () => apiRequest('/developer/subscriptions'),
  createSubscription: (dto) => apiRequest('/developer/subscriptions', { method: 'POST', body: dto }),
  updateSubscription: (id, dto) => apiRequest(`/developer/subscriptions/${id}`, { method: 'PUT', body: dto }),
  // Users
  getUsers: (companyId) => apiRequest(`/developer/users${companyId ? `?companyId=${companyId}` : ''}`),
  // Audit
  getAuditLogs: (params = {}) => {
    const queryParts = [];
    if (params.limit) queryParts.push(`limit=${params.limit}`);
    if (params.companyId) queryParts.push(`companyId=${params.companyId}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    return apiRequest(`/developer/audit-logs${query}`);
  },
  // Modules
  getModules: () => apiRequest('/developer/modules'),
};

// Public API
export const publicApi = {
  getPackages: () => apiRequest('/public/packages'),
};

// Roles API
export const rolesApi = {
  getRoles: async () => {
    const roles = await apiRequest('/roles');
    if (!Array.isArray(roles)) return roles;
    const order = ['Admin', 'Project Manager', 'Senior Site Engineer', 'Site Supervisor', 'Junior Site Engineer', 'Purchase Manager', 'Accountant', 'Sales Executive', 'Store Keeper'];
    return roles.sort((a, b) => {
      if (a.isSystem && b.isSystem) {
        const idxA = order.indexOf(a.name);
        const idxB = order.indexOf(b.name);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      }
      if (a.isSystem) return -1;
      if (b.isSystem) return 1;
      return a.name.localeCompare(b.name);
    });
  },
  createRole: (dto) => apiRequest('/roles', { method: 'POST', body: dto }),
  updateRole: (id, dto) => apiRequest(`/roles/${id}`, { method: 'PUT', body: dto }),
  deleteRole: (id) => apiRequest(`/roles/${id}`, { method: 'DELETE' }),
  getSystemRoles: () => apiRequest('/system-roles'),
};

// User Management API
export const usersApi = {
  getUsers: () => apiRequest('/users'),
  createUser: (dto) => apiRequest('/users', { method: 'POST', body: dto }),
  updateUser: (id, dto) => apiRequest(`/users/${id}`, { method: 'PUT', body: dto }),
  updateUserStatus: (id, isActive) => apiRequest(`/users/${id}/status`, { method: 'PUT', body: { isActive } }),
};

// Profile & Personal Account API
export const profileApi = {
  getProfile: () => apiRequest('/users/me'),
  updateProfile: (dto) => apiRequest('/users/me', { method: 'PUT', body: dto }),
  changePassword: (dto) => apiRequest('/users/me/password', { method: 'PUT', body: dto }),
  getStats: () => apiRequest('/users/me/stats'),
};

// Permissions API
export const permissionsApi = {
  getEffective: () => apiRequest('/permissions/effective'),
  getModules: () => apiRequest('/modules'),
};

// Company API
export const companyApi = {
  getStorage: () => apiRequest('/companies/storage'),
};

// Activity Logs API
export const activityLogsApi = {
  getLogs: (params = {}) => {
    const queryParts = [];
    if (params.module) queryParts.push(`module=${encodeURIComponent(params.module)}`);
    if (params.userId) queryParts.push(`userId=${encodeURIComponent(params.userId)}`);
    if (params.action) queryParts.push(`action=${encodeURIComponent(params.action)}`);
    if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
    if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params.page) queryParts.push(`page=${encodeURIComponent(params.page)}`);
    if (params.limit) queryParts.push(`limit=${encodeURIComponent(params.limit)}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    return apiRequest(`/activity-logs${query}`);
  },
  exportLogs: async (params = {}) => {
    const token = sessionStorage.getItem('accessToken');
    const queryParts = [];
    if (params.module) queryParts.push(`module=${encodeURIComponent(params.module)}`);
    if (params.userId) queryParts.push(`userId=${encodeURIComponent(params.userId)}`);
    if (params.action) queryParts.push(`action=${encodeURIComponent(params.action)}`);
    if (params.startDate) queryParts.push(`startDate=${encodeURIComponent(params.startDate)}`);
    if (params.endDate) queryParts.push(`endDate=${encodeURIComponent(params.endDate)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';

    const res = await fetch(`${API_BASE_URL}/activity-logs/export${query}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
    if (!res.ok) throw new Error('Failed to export activity logs');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebaroptima_activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};

// BBS (Bar Bending Schedule) API
export const bbsApi = {
  // Projects
  createProject: (dto) => apiRequest('/bbs/projects', { method: 'POST', body: dto }),
  getProjects: () => apiRequest('/bbs/projects'),
  getProject: (projectId) => apiRequest(`/bbs/projects/${projectId}`),
  updateProject: (projectId, dto) => apiRequest(`/bbs/projects/${projectId}`, { method: 'PUT', body: dto }),
  deleteProject: (projectId) => apiRequest(`/bbs/projects/${projectId}`, { method: 'DELETE' }),

  // Blocks
  createBlock: (projectId, name) => apiRequest(`/bbs/projects/${projectId}/blocks`, { method: 'POST', body: { name } }),
  getBlocks: (projectId) => apiRequest(`/bbs/projects/${projectId}/blocks`),
  updateBlock: (blockId, name) => apiRequest(`/bbs/blocks/${blockId}`, { method: 'PUT', body: { name } }),
  deleteBlock: (blockId) => apiRequest(`/bbs/blocks/${blockId}`, { method: 'DELETE' }),

  // Levels
  createLevel: (projectId, blockId, name) => apiRequest(`/bbs/projects/${projectId}/blocks/${blockId}/levels`, { method: 'POST', body: { name } }),
  getLevels: (projectId) => apiRequest(`/bbs/projects/${projectId}/levels`),
  updateLevel: (levelId, name) => apiRequest(`/bbs/levels/${levelId}`, { method: 'PUT', body: { name } }),
  deleteLevel: (levelId) => apiRequest(`/bbs/levels/${levelId}`, { method: 'DELETE' }),

  // Members
  createMember: (dto) => apiRequest('/bbs/members', { method: 'POST', body: dto }),
  getMembers: (projectId) => apiRequest(`/bbs/projects/${projectId}/members`),
  getMembersByCell: (projectId, blockId, levelId) => apiRequest(`/bbs/projects/${projectId}/members/cell?blockId=${blockId}&levelId=${levelId}`),
  getMember: (memberId) => apiRequest(`/bbs/members/${memberId}`),
  updateMember: (memberId, dto) => apiRequest(`/bbs/members/${memberId}`, { method: 'PUT', body: dto }),
  deleteMember: (memberId) => apiRequest(`/bbs/members/${memberId}`, { method: 'DELETE' }),

  // Rebars
  addRebarItem: (dto) => apiRequest('/bbs/rebars', { method: 'POST', body: dto }),
  getRebarItems: (memberId) => apiRequest(`/bbs/members/${memberId}/rebars`),
  updateRebarItem: (rebarId, dto) => apiRequest(`/bbs/rebars/${rebarId}`, { method: 'PUT', body: dto }),
  deleteRebarItem: (rebarId) => apiRequest(`/bbs/rebars/${rebarId}`, { method: 'DELETE' }),

  // Dashboard & Reports
  getDashboardMatrix: (projectId) => apiRequest(`/bbs/projects/${projectId}/matrix`),
  getMTO: (projectId) => apiRequest(`/bbs/projects/${projectId}/mto`),
  getProjectRebars: (projectId) => apiRequest(`/bbs/projects/${projectId}/rebars`),

  // Shape Register & Templates
  getShapes: () => apiRequest('/bbs/shapes'),
  createShape: (dto) => apiRequest('/bbs/shapes', { method: 'POST', body: dto }),
  getTemplates: () => apiRequest('/bbs/templates'),
  createTemplate: (dto) => apiRequest('/bbs/templates', { method: 'POST', body: dto }),
};
