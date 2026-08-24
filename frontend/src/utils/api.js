const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const data = await response.json().catch(() => null);
  
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
  deleteBatch: (id) =>
    apiRequest(`/batches/${id}`, { method: 'DELETE' }),
};

// Developer API
export const developerApi = {
  getMe: () => apiRequest('/developer/me'),
  getStats: () => apiRequest('/developer/stats'),
  // Companies
  getCompanies: () => apiRequest('/developer/companies'),
  getCompany: (id) => apiRequest(`/developer/companies/${id}`),
  updateCompanyStatus: (id, status) => apiRequest(`/developer/companies/${id}/status`, { method: 'PUT', body: { status } }),
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

// Roles API
export const rolesApi = {
  getRoles: () => apiRequest('/roles'),
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

// Permissions API
export const permissionsApi = {
  getEffective: () => apiRequest('/permissions/effective'),
  getModules: () => apiRequest('/modules'),
};
