import { createSlice } from '@reduxjs/toolkit';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const getInitialView = () => {
  const path = window.location.pathname;
  if (path.startsWith('/t/')) return 'public-transmittal';
  const token = sessionStorage.getItem('accessToken');
  const lastActivity = sessionStorage.getItem('lastActivity');
  const isExpired = lastActivity && (Date.now() - parseInt(lastActivity, 10) > SESSION_TIMEOUT_MS);

  let isDevUser = false;
  if (token && !isExpired) {
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      if (user.accountType === 'developer' || user.role === 'DEVELOPER' || user.role === 'SUPER_ADMIN') {
        isDevUser = true;
      }
    } catch { /* ignore */ }
  }

  // If authenticated as a platform developer, always route to superadmin console
  if (isDevUser) {
    return 'superadmin';
  }

  // Developer/Superadmin dedicated entry points when not logged in as developer
  if (path === '/developer-login' || path === '/superadmin-login') return 'superadmin-login';
  if (path === '/developer' || path === '/superadmin') return 'superadmin-login';
  if (path === '/register') return 'signup';

  if (token && !isExpired) {
    if (path === '/inventory') return 'inventory';
    if (path === '/inputs') return 'inputs';
    if (path === '/results') return 'results';
    if (path === '/history') return 'history';
    if (path === '/bbs') return 'bbs';
    if (path === '/casting') return 'casting';
    if (path === '/general-inventory') return 'general-inventory';
    if (path === '/crm') return 'crm';
    if (path.startsWith('/t/')) return 'public-transmittal';
    if (path === '/drawings/matrix') return 'drawings-matrix';
    if (path === '/drawings/approvals') return 'drawings-approvals';
    if (path === '/drawings/transmittals') return 'drawings-transmittals';
    if (path === '/drawings/activity') return 'drawings-activity';
    if (path === '/drawings/plan-pass') return 'drawings-plan-pass';
    if (path.startsWith('/drawings/')) return 'drawings-viewer';
    if (path === '/drawings') return 'drawings';
    if (path === '/petty-cash') return 'petty-cash';
    if (path === '/contractors') return 'contractors';
    if (path === '/manpower/labour') return 'manpower-labour';
    if (path === '/manpower/contractor-labour') return 'manpower-contractor-labour';
    if (path === '/attendance' || path === '/attendance/mark') return 'attendance-mark';
    if (path === '/attendance/history') return 'attendance-history';
    if (path === '/attendance/reports') return 'attendance-reports';
    if (path === '/reports') return 'reports';
    if (path === '/chat') return 'chat';
    if (path === '/ledger') return 'ledger';
    if (path === '/activity-logs') return 'activity-logs';
    if (path === '/project-management') return 'project-management';
    if (path === '/settings') return 'settings';
    if (path === '/profile') return 'profile';
    if (path === '/projects') return 'projects';
    if (path === '/roles') return 'roles';
    if (path === '/users') return 'users';
    if (path === '/bbs/dashboard') return 'bbs-dashboard';
    if (path === '/bbs/wizard') return 'bbs-wizard';
    if (path === '/bbs/shapes') return 'bbs-shapes';
    if (path === '/bbs/reports') return 'bbs-reports';
    return 'overview';
  } else {
    if (path === '/register') return 'signup';
    if (path === '/developer-login' || path === '/superadmin-login') return 'superadmin-login';
    return 'signin';
  }
};

const routingSlice = createSlice({
  name: 'routing',
  initialState: {
    view: getInitialView(),
  },
  reducers: {
    setView: (state, action) => {
      const newView = action.payload;
      state.view = newView;

      // Update history if pathname doesn't match
      let targetPath = '/';
      if (newView === 'signup') targetPath = '/register';
      else if (newView === 'signin') targetPath = '/login';
      else if (newView === 'superadmin-login') targetPath = '/developer-login';
      else if (newView === 'superadmin') targetPath = '/developer';
      else if (newView === 'roles') targetPath = '/roles';
      else if (newView === 'users') targetPath = '/users';
      else if (newView === 'bbs-projects') targetPath = '/bbs';
      else if (newView === 'bbs-dashboard') targetPath = '/bbs/dashboard';
      else if (newView === 'bbs-wizard') targetPath = '/bbs/wizard';
      else if (newView === 'bbs-shapes') targetPath = '/bbs/shapes';
      else if (newView === 'bbs-reports') targetPath = '/bbs/reports';
      else if (newView === 'general-inventory') targetPath = '/general-inventory';
      else if (newView === 'manpower-labour') targetPath = '/manpower/labour';
      else if (newView === 'manpower-contractor-labour') targetPath = '/manpower/contractor-labour';
      else if (newView === 'attendance-mark') targetPath = '/attendance/mark';
      else if (newView === 'attendance-history') targetPath = '/attendance/history';
      else if (newView === 'attendance-reports') targetPath = '/attendance/reports';
      else if (newView === 'drawings-matrix') targetPath = '/drawings/matrix';
      else if (newView === 'drawings-approvals') targetPath = '/drawings/approvals';
      else if (newView === 'drawings-transmittals') targetPath = '/drawings/transmittals';
      else if (newView === 'drawings-activity') targetPath = '/drawings/activity';
      else if (newView === 'drawings-plan-pass') targetPath = '/drawings/plan-pass';
      else if (newView === 'drawings') targetPath = '/drawings';
      else if (newView === 'public-transmittal') targetPath = window.location.pathname;
      else if (newView !== 'overview') targetPath = `/${newView}`;

      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view: newView }, '', targetPath);
      }
    },
    syncViewFromPopState: (state, action) => {
      state.view = action.payload;
    }
  },
});

export const { setView, syncViewFromPopState } = routingSlice.actions;
export default routingSlice.reducer;
