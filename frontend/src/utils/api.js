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

/** Active project id for X-Project-Id; set by App / project gate (hint only until validated). */
let activeProjectIdForApi = null;

export function setActiveProjectHeader(projectId) {
  activeProjectIdForApi = projectId ? String(projectId) : null;
}

export function getActiveProjectHeader() {
  return activeProjectIdForApi;
}

export async function apiRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem('accessToken');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const skipProjectHeader = options.skipProjectHeader === true || endpoint.startsWith('/projects') || endpoint.startsWith('/auth/');
  // Prefer in-memory id; fall back to localStorage so fetches after project switch
  // don't race App's useEffect that syncs the header.
  const projectHeader =
    headers['X-Project-Id'] ||
    activeProjectIdForApi ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('rebar_active_project_id') : null);
  if (!skipProjectHeader && projectHeader) {
    headers['X-Project-Id'] = String(projectHeader);
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
  
  if (response.status === 401 && !endpoint.startsWith('/auth/')) {
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
        const storedUser = sessionStorage.getItem('user');
        let isDev = false;
        try {
          const parsed = JSON.parse(storedUser || '{}');
          if (parsed.accountType === 'developer' || parsed.role === 'DEVELOPER' || parsed.role === 'SUPER_ADMIN') isDev = true;
        } catch (_) {}
        sessionStorage.clear();
        if (isDev) {
          window.location.href = '/developer-login';
        } else {
          window.location.href = '/login';
        }
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
  getInventory: (projectId) => 
    apiRequest(projectId ? `/inventory?projectId=${projectId}` : '/inventory'),
  inward: (dto) => 
    apiRequest('/inventory/inward', { method: 'POST', body: dto }),
  getScrapRules: () => 
    apiRequest('/inventory/scrap-rules'),
  updateScrapRules: (rules) => 
    apiRequest('/inventory/scrap-rules', { method: 'POST', body: { rules } }),
  getLedger: (projectId) => 
    apiRequest(projectId ? `/inventory/ledger?projectId=${encodeURIComponent(projectId)}` : '/inventory/ledger'),
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
  getHistory: (projectId) => 
    apiRequest(projectId ? `/batches?projectId=${projectId}` : '/batches'),
  getStats: (projectId) =>
    apiRequest(projectId ? `/batches/stats?projectId=${encodeURIComponent(projectId)}` : '/batches/stats'),
  getScrapRecords: (projectId) =>
    apiRequest(projectId ? `/batches/scrap-records?projectId=${encodeURIComponent(projectId)}` : '/batches/scrap-records'),
  updateBatch: (id, batchName) =>
    apiRequest(`/batches/${id}`, { method: 'PUT', body: { batchName } }),
  deleteBatch: (id, restoreStock = false) =>
    apiRequest(`/batches/${id}?restoreStock=${restoreStock}`, { method: 'DELETE' }),
};

export const MAX_BLOCKS_PER_PROJECT = 200;

export const projectsApi = {
  getAll: (status) => apiRequest(`/projects${status ? `?status=${status}` : ''}`),
  getById: (id) => apiRequest(`/projects/${id}`),
  create: (data) => apiRequest('/projects', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/projects/${id}`, { method: 'PUT', body: data }),
  updateStatus: (id, status) => apiRequest(`/projects/${id}/status`, { method: 'PUT', body: { status } }),
  updateGeofences: (id, geofences) => apiRequest(`/projects/${id}/geofences`, { method: 'PUT', body: { geofences } }),
  assignPartnerAdmins: (id, partnerAdminIds) => apiRequest(`/projects/${id}/assign-partner`, { method: 'POST', body: { partnerAdminIds } }),
  getBlocks: (projectId, { includeInactive = false } = {}) =>
    apiRequest(`/projects/${projectId}/blocks${includeInactive ? '?includeInactive=true' : ''}`),
  createBlock: (projectId, data) =>
    apiRequest(`/projects/${projectId}/blocks`, { method: 'POST', body: data }),
  updateBlock: (projectId, blockId, data) =>
    apiRequest(`/projects/${projectId}/blocks/${blockId}`, { method: 'PUT', body: data }),
  archiveBlock: (projectId, blockId, { hard = false } = {}) =>
    apiRequest(`/projects/${projectId}/blocks/${blockId}${hard ? '?hard=true' : ''}`, { method: 'DELETE' }),
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
  // Developer Console — Push & SMTP & FCM
  getWebPushConfig: () => apiRequest('/developer/console/push/config'),
  saveWebPushConfig: (dto) => apiRequest('/developer/console/push/config', { method: 'POST', body: dto }),
  generateVapidKeys: () => apiRequest('/developer/console/push/generate-keys', { method: 'POST' }),
  testPushNotification: (dto) => apiRequest('/developer/console/push/test', { method: 'POST', body: dto }),
  getFcmConfig: () => apiRequest('/developer/console/push/fcm/config'),
  saveFcmConfig: (dto) => apiRequest('/developer/console/push/fcm/config', { method: 'POST', body: dto }),
  testFcmNotification: (dto) => apiRequest('/developer/console/push/fcm/test', { method: 'POST', body: dto }),
  getFcmTokens: () => apiRequest('/developer/console/push/fcm/tokens'),
  registerFcmTokenForUser: (dto) => apiRequest('/developer/console/push/fcm/tokens', { method: 'POST', body: dto }),
  deleteFcmToken: (id) => apiRequest(`/developer/console/push/fcm/tokens/${id}`, { method: 'DELETE' }),
  getSmtpConfig: () => apiRequest('/developer/console/smtp/config'),
  saveSmtpConfig: (dto) => apiRequest('/developer/console/smtp/config', { method: 'POST', body: dto }),
  testSmtpConnection: (dto) => apiRequest('/developer/console/smtp/test', { method: 'POST', body: dto }),
  getNotificationTemplates: () => apiRequest('/developer/console/templates'),
  saveNotificationTemplate: (dto) => apiRequest('/developer/console/templates', { method: 'POST', body: dto }),
  getConsoleLogs: (type = 'email', page = 1, limit = 50) => apiRequest(`/developer/console/logs?type=${type}&page=${page}&limit=${limit}`),
  getSystemHealth: () => apiRequest('/developer/console/health'),
};

// Notifications Client API
export const notificationsApi = {
  getVapidKey: () => apiRequest('/notifications/vapid-key'),
  subscribe: (subscription, userAgent) => apiRequest('/notifications/subscribe', { method: 'POST', body: { subscription, userAgent } }),
  unsubscribe: (endpoint) => apiRequest('/notifications/unsubscribe', { method: 'POST', body: { endpoint } }),
  registerFcmToken: (token, platform = 'web', deviceInfo = '') =>
    apiRequest('/notifications/fcm-token', { method: 'POST', body: { token, platform, deviceInfo } }),
  unregisterFcmToken: (token) =>
    apiRequest('/notifications/fcm-token', { method: 'DELETE', body: { token } }),
};

// Real-Time Chat API
export const chatApi = {
  getConversations: (projectId = '') => apiRequest(`/chat/conversations${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  startDirectChat: (otherUserId, projectId = '') => apiRequest('/chat/conversations/direct', { method: 'POST', body: { otherUserId, projectId } }),
  createGroupChat: (dto) => apiRequest('/chat/conversations/group', { method: 'POST', body: dto }),
  getMessages: (conversationId, limit = 40, before = null) => {
    let url = `/chat/conversations/${conversationId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return apiRequest(url);
  },
  sendMessage: (conversationId, dto) => apiRequest(`/chat/conversations/${conversationId}/messages`, { method: 'POST', body: dto }),
  markAsRead: (conversationId) => apiRequest(`/chat/conversations/${conversationId}/read`, { method: 'POST' }),
  markAsDelivered: (conversationId) => apiRequest(`/chat/conversations/${conversationId}/delivered`, { method: 'POST' }),
  addGroupMember: (conversationId, newUserId) => apiRequest(`/chat/conversations/${conversationId}/members`, { method: 'POST', body: { newUserId } }),
  removeGroupMember: (conversationId, memberId) => apiRequest(`/chat/conversations/${conversationId}/members/${memberId}`, { method: 'DELETE' }),
  updateGroupInfo: (conversationId, dto) => apiRequest(`/chat/conversations/${conversationId}`, { method: 'PUT', body: dto }),
  leaveGroup: (conversationId) => apiRequest(`/chat/conversations/${conversationId}/leave`, { method: 'POST' }),
  searchMessages: (q, conversationId = '') => apiRequest(`/chat/search?q=${encodeURIComponent(q)}${conversationId ? `&conversationId=${conversationId}` : ''}`),
  getCandidates: (search = '', projectId = '') => apiRequest(`/chat/users?search=${encodeURIComponent(search || '')}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`),
  uploadAttachment: (dto) => apiRequest('/chat/attachments', { method: 'POST', body: dto }),
  togglePinConversation: (conversationId) => apiRequest(`/chat/conversations/${conversationId}/pin`, { method: 'POST' }),
  togglePinMessage: (conversationId, messageId) => apiRequest(`/chat/conversations/${conversationId}/pin-message`, { method: 'POST', body: { messageId } }),
  toggleStarMessage: (messageId) => apiRequest(`/chat/messages/${messageId}/star`, { method: 'POST' }),
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
    if (params.projectId) queryParts.push(`projectId=${encodeURIComponent(params.projectId)}`);
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
  reorderLevels: (projectId, blockId, orderedLevelIds) => apiRequest(`/bbs/projects/${projectId}/blocks/${blockId}/levels/reorder`, { method: 'PUT', body: { orderedLevelIds } }),

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

export const generalInventoryApi = {
  // Projects & Stores
  getProjects: () => apiRequest('/general-inventory/projects'),
  createProject: (data) => apiRequest('/general-inventory/projects', { method: 'POST', body: data }),
  getStores: (projectId) => apiRequest(`/general-inventory/projects/${projectId}/stores`),
  createStore: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/stores`, { method: 'POST', body: data }),

  // Materials
  getMaterials: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/general-inventory/projects/${projectId}/materials${qs ? `?${qs}` : ''}`);
  },
  createMaterial: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/materials`, { method: 'POST', body: data }),
  updateMaterial: (projectId, materialId, data) => apiRequest(`/general-inventory/projects/${projectId}/materials/${materialId}`, { method: 'PUT', body: data }),
  deleteMaterial: (projectId, materialId) => apiRequest(`/general-inventory/projects/${projectId}/materials/${materialId}`, { method: 'DELETE' }),

  // Stock & Opening Balance
  getStock: (projectId, storeId) => {
    const qs = storeId ? `?storeId=${storeId}` : '';
    return apiRequest(`/general-inventory/projects/${projectId}/stock${qs}`);
  },
  setOpeningBalance: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/stock/opening-balance`, { method: 'POST', body: data }),

  // Inward Entries
  getInwardEntries: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/general-inventory/projects/${projectId}/inward${qs ? `?${qs}` : ''}`);
  },
  getInwardEntry: (projectId, id) => apiRequest(`/general-inventory/projects/${projectId}/inward/${id}`),
  createInwardEntry: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/inward`, { method: 'POST', body: data }),

  // Outward Issues
  getOutwardEntries: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/general-inventory/projects/${projectId}/outward${qs ? `?${qs}` : ''}`);
  },
  getOutwardEntry: (projectId, id) => apiRequest(`/general-inventory/projects/${projectId}/outward/${id}`),
  getEligibleReturnable: (projectId, storeId) => {
    const qs = storeId ? `?storeId=${storeId}` : '';
    return apiRequest(`/general-inventory/projects/${projectId}/outward/returnable/eligible${qs}`);
  },
  createOutwardEntry: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/outward`, { method: 'POST', body: data }),

  // Material Returns
  getReturns: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/general-inventory/projects/${projectId}/returns${qs ? `?${qs}` : ''}`);
  },
  createReturn: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/returns`, { method: 'POST', body: data }),

  // Store Transfers
  getTransfers: (projectId) => apiRequest(`/general-inventory/projects/${projectId}/transfers`),
  createTransfer: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/transfers`, { method: 'POST', body: data }),

  // Physical Verification & Adjustments
  getVerifications: (projectId, storeId) => {
    const qs = storeId ? `?storeId=${storeId}` : '';
    return apiRequest(`/general-inventory/projects/${projectId}/verifications${qs}`);
  },
  createVerification: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/verifications`, { method: 'POST', body: data }),
  getAdjustments: (projectId, storeId) => {
    const qs = storeId ? `?storeId=${storeId}` : '';
    return apiRequest(`/general-inventory/projects/${projectId}/adjustments${qs}`);
  },
  createAdjustment: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/adjustments`, { method: 'POST', body: data }),

  // Incidents
  getIncidents: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/general-inventory/projects/${projectId}/incidents${qs ? `?${qs}` : ''}`);
  },
  reportIncident: (projectId, data) => apiRequest(`/general-inventory/projects/${projectId}/incidents`, { method: 'POST', body: data }),

  // Ledger & Reports
  getLedger: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/general-inventory/projects/${projectId}/ledger${qs ? `?${qs}` : ''}`);
  },
  getReport: (projectId, reportType, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/general-inventory/projects/${projectId}/reports/${reportType}${qs ? `?${qs}` : ''}`);
  }
};

export const pettyCashApi = {
  getSites: () => apiRequest('/petty-cash/sites'),
  createSite: (data) => apiRequest('/petty-cash/sites', { method: 'POST', body: data }),
  getPersons: () => apiRequest('/petty-cash/persons'),
  createPerson: (data) => apiRequest('/petty-cash/persons', { method: 'POST', body: data }),
  deletePerson: (id) => apiRequest(`/petty-cash/persons/${id}`, { method: 'DELETE' }),
  getCategories: () => apiRequest('/petty-cash/categories'),
  createCategory: (data) => apiRequest('/petty-cash/categories', { method: 'POST', body: data }),
  deleteCategory: (id) => apiRequest(`/petty-cash/categories/${id}`, { method: 'DELETE' }),
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/petty-cash/transactions${qs ? `?${qs}` : ''}`);
  },
  createTransaction: (data) => apiRequest('/petty-cash/transactions', { method: 'POST', body: data }),
  deleteTransaction: (id) => apiRequest(`/petty-cash/transactions/${id}`, { method: 'DELETE' })
};

export const contractorsApi = {
  list: () => apiRequest('/contractors'),
  getById: (id) => apiRequest(`/contractors/${id}`),
  suggest: (q) => apiRequest(`/contractors/suggest?q=${encodeURIComponent(q || '')}`),
  create: (data) => apiRequest('/contractors', { method: 'POST', body: data }),
  update: (id, data) => apiRequest(`/contractors/${id}`, { method: 'PUT', body: data }),
  remove: (id) => apiRequest(`/contractors/${id}`, { method: 'DELETE' }),
  getDepartments: () => apiRequest('/contractors/departments'),
  suggestDepartments: (q) =>
    apiRequest(`/contractors/departments/suggest?q=${encodeURIComponent(q || '')}`),
  createDepartment: (data) => apiRequest('/contractors/departments', { method: 'POST', body: data }),
};

export const manpowerApi = {
  listLabours: () => apiRequest('/manpower/labours'),
  getLabour: (id) => apiRequest(`/manpower/labours/${id}`),
  createLabour: (data) => apiRequest('/manpower/labours', { method: 'POST', body: data }),
  updateLabour: (id, data) => apiRequest(`/manpower/labours/${id}`, { method: 'PUT', body: data }),
  deleteLabour: (id) => apiRequest(`/manpower/labours/${id}`, { method: 'DELETE' }),
  getContractorMode: (contractorId) =>
    apiRequest(`/manpower/contractor-labours/mode?contractorId=${encodeURIComponent(contractorId || '')}`),
  getContractorLabours: (contractorId) =>
    apiRequest(`/manpower/contractor-labours?contractorId=${encodeURIComponent(contractorId || '')}`),
  createWorker: (data) =>
    apiRequest('/manpower/contractor-labours/workers', { method: 'POST', body: data }),
  updateWorker: (id, data) =>
    apiRequest(`/manpower/contractor-labours/workers/${id}`, { method: 'PUT', body: data }),
  deleteWorker: (id) =>
    apiRequest(`/manpower/contractor-labours/workers/${id}`, { method: 'DELETE' }),
  saveWorkforce: (data) =>
    apiRequest('/manpower/contractor-labours/workforce', { method: 'PUT', body: data }),
};

export const attendanceApi = {
  getAssignments: () => apiRequest('/attendance/assignments'),
  setAssignments: (labourIds) =>
    apiRequest('/attendance/assignments', { method: 'PUT', body: { labourIds } }),
  getEligible: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    return apiRequest(`/attendance/eligible?${qs.toString()}`);
  },
  saveSession: (data) => apiRequest('/attendance/sessions', { method: 'PUT', body: data }),
  listSessions: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    return apiRequest(`/attendance/sessions?${qs.toString()}`);
  },
  getSession: (id) => apiRequest(`/attendance/sessions/${id}`),
  voidSession: (id) => apiRequest(`/attendance/sessions/${id}`, { method: 'DELETE' }),
  reportSummary: (params = {}) => {
    const qs = new URLSearchParams(params);
    return apiRequest(`/attendance/reports/summary?${qs.toString()}`);
  },
  reportDetail: (params = {}) => {
    const qs = new URLSearchParams(params);
    return apiRequest(`/attendance/reports/detail?${qs.toString()}`);
  },
  reportMeta: () => apiRequest('/attendance/reports/meta'),
  reportPreview: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    return apiRequest(`/attendance/reports/preview?${qs.toString()}`);
  },
  exportExcelUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/attendance/reports/export.xlsx?${qs}`;
  },
  exportPdfUrl: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/attendance/reports/export.pdf?${qs}`;
  },
  /** Authenticated blob download with project header + one refresh retry (same as apiRequest). */
  downloadExport: async (kind, params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    const path =
      kind === 'xlsx'
        ? `/attendance/reports/export.xlsx?${qs}`
        : `/attendance/reports/export.pdf?${qs}`;
    const buildHeaders = (token) => {
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const projectHeader =
        activeProjectIdForApi ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('rebar_active_project_id') : null);
      if (projectHeader) headers['X-Project-Id'] = String(projectHeader);
      return headers;
    };

    let token = sessionStorage.getItem('accessToken');
    let res = await fetch(`${API_BASE_URL}${path}`, { headers: buildHeaders(token) });

    if (res.status === 401) {
      const refreshToken = sessionStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('Session expired');
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const refreshData = await refreshRes.json().catch(() => null);
      if (!refreshRes.ok) {
        sessionStorage.clear();
        window.location.href = '/login';
        throw new Error('Session expired');
      }
      sessionStorage.setItem('accessToken', refreshData.accessToken);
      if (refreshData.refreshToken) {
        sessionStorage.setItem('refreshToken', refreshData.refreshToken);
      }
      token = refreshData.accessToken;
      res = await fetch(`${API_BASE_URL}${path}`, { headers: buildHeaders(token) });
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const filename = kind === 'xlsx' ? 'attendance-report.xlsx' : 'attendance-report.pdf';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

export const reportsApi = {
  getConfigOptions: async () => {
    const res = await apiRequest('/reports/config-options');
    return res.data;
  },
  preview: async (config) => {
    const res = await apiRequest('/reports/preview', {
      method: 'POST',
      body: config,
    });
    return res.data;
  },
  downloadPdf: async (config) => {
    const token = sessionStorage.getItem('accessToken');
    const projectHeader = activeProjectIdForApi || (typeof localStorage !== 'undefined' ? localStorage.getItem('rebar_active_project_id') : null);
    const res = await fetch(`${API_BASE_URL}/reports/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(projectHeader ? { 'X-Project-Id': projectHeader } : {}),
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Failed to download PDF report');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `RebarOptima_Report_${config.reportMode}_${config.startDate}.pdf`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  downloadExcel: async (config) => {
    const token = sessionStorage.getItem('accessToken');
    const projectHeader = activeProjectIdForApi || (typeof localStorage !== 'undefined' ? localStorage.getItem('rebar_active_project_id') : null);
    const res = await fetch(`${API_BASE_URL}/reports/excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(projectHeader ? { 'X-Project-Id': projectHeader } : {}),
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Failed to export Excel workbook');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `RebarOptima_Export_${config.extractType}.xlsx`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

