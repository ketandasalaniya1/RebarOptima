import { createSlice } from '@reduxjs/toolkit';

const getInitialPermissions = () => {
  try {
    const stored = sessionStorage.getItem('permissions');
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to load permissions:', err);
  }
  return {
    modules: {},
    features: {},
    subscription: null,
    role: null,
    companyStatus: 'active',
    assignedProjects: [],
    dataScope: 'organization'
  };
};

const permissionsSlice = createSlice({
  name: 'permissions',
  initialState: getInitialPermissions(),
  reducers: {
    setPermissions: (state, action) => {
      const perms = action.payload;
      state.modules = perms.modules || {};
      state.features = perms.features || {};
      state.subscription = perms.subscription || null;
      state.role = perms.role || null;
      state.companyStatus = perms.companyStatus || 'active';
      state.assignedProjects = perms.assignedProjects || [];
      state.dataScope = perms.dataScope || 'organization';
      sessionStorage.setItem('permissions', JSON.stringify(perms));
    },
    clearPermissions: (state) => {
      state.modules = {};
      state.features = {};
      state.subscription = null;
      state.role = null;
      state.companyStatus = 'active';
      state.assignedProjects = [];
      state.dataScope = 'organization';
      sessionStorage.removeItem('permissions');
    }
  }
});

export const { setPermissions, clearPermissions } = permissionsSlice.actions;

// Selectors
export const selectHasModule = (state, moduleName) => {
  return state.permissions.modules[moduleName] !== false;
};

export const selectHasFeature = (state, moduleName, featureName) => {
  const key = `${moduleName}.${featureName}`;
  return state.permissions.features[key] !== false;
};

export const selectSubscription = (state) => state.permissions.subscription;
export const selectRole = (state) => state.permissions.role;
export const selectDataScope = (state) => state.permissions.dataScope;

export default permissionsSlice.reducer;
