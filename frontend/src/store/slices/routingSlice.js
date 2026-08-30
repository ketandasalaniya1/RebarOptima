import { createSlice } from '@reduxjs/toolkit';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const getInitialView = () => {
  const path = window.location.pathname;
  const token = sessionStorage.getItem('accessToken');
  const lastActivity = sessionStorage.getItem('lastActivity');
  const isExpired = lastActivity && (Date.now() - parseInt(lastActivity, 10) > SESSION_TIMEOUT_MS);

  if (token && !isExpired) {
    // Check if developer
    try {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      if (user.accountType === 'developer') {
        if (path === '/developer') return 'superadmin';
        return 'superadmin';
      }
    } catch { /* ignore */ }

    if (path === '/inventory') return 'inventory';
    if (path === '/inputs') return 'inputs';
    if (path === '/results') return 'results';
    if (path === '/history') return 'history';
    if (path === '/ledger') return 'ledger';
    if (path === '/settings') return 'settings';
    if (path === '/profile') return 'profile';
    if (path === '/developer' || path === '/superadmin') return 'superadmin';
    if (path === '/roles') return 'roles';
    if (path === '/users') return 'users';
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
