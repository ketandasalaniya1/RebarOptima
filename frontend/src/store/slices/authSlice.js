import { createSlice } from '@reduxjs/toolkit';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const getInitialState = () => {
  try {
    const token = sessionStorage.getItem('accessToken');
    const storedUser = sessionStorage.getItem('user');
    const lastActivity = sessionStorage.getItem('lastActivity');

    if (token && storedUser) {
      if (lastActivity && (Date.now() - parseInt(lastActivity, 10) > SESSION_TIMEOUT_MS)) {
        sessionStorage.clear();
      } else {
        const user = JSON.parse(storedUser);
        return {
          accessToken: token,
          user,
          isAuthenticated: true,
          isDeveloper: user.accountType === 'developer',
        };
      }
    }
  } catch (err) {
    console.error('Failed to load session from sessionStorage:', err);
  }
  return {
    accessToken: null,
    user: null,
    isAuthenticated: false,
    isDeveloper: false,
  };
};

const authSlice = createSlice({
  name: 'auth',
  initialState: getInitialState(),
  reducers: {
    loginSuccess: (state, action) => {
      const { accessToken, user } = action.payload;
      const now = Date.now().toString();
      state.accessToken = accessToken;
      state.user = user;
      state.isAuthenticated = true;
      state.isDeveloper = user.accountType === 'developer';
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('lastActivity', now);
    },
    logout: (state) => {
      state.accessToken = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isDeveloper = false;
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('lastActivity');
      sessionStorage.removeItem('permissions');
    },
    updateActivity: () => {
      if (sessionStorage.getItem('accessToken')) {
        sessionStorage.setItem('lastActivity', Date.now().toString());
      }
    }
  },
});

export const { loginSuccess, logout, updateActivity } = authSlice.actions;
export default authSlice.reducer;
