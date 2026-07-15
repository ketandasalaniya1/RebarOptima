import { createSlice } from '@reduxjs/toolkit';

const getInitialView = () => {
  const path = window.location.pathname;
  const token = localStorage.getItem('accessToken');

  if (token) {
    if (path === '/inventory') return 'inventory';
    if (path === '/inputs') return 'inputs';
    if (path === '/results') return 'results';
    if (path === '/history') return 'history';
    if (path === '/ledger') return 'ledger';
    if (path === '/settings') return 'settings';
    if (path === '/superadmin') return 'superadmin';
    return 'overview';
  } else {
    if (path === '/register') return 'signup';
    if (path === '/superadmin-login') return 'superadmin-login';
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
      else if (newView === 'superadmin-login') targetPath = '/superadmin-login';
      else if (newView === 'superadmin') targetPath = '/superadmin';
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
