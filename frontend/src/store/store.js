import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import routingReducer from './slices/routingSlice';
import settingsReducer from './slices/settingsSlice';
import permissionsReducer from './slices/permissionsSlice';
import bbsReducer from './slices/bbsSlice';
import projectReducer from './slices/projectSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    routing: routingReducer,
    settings: settingsReducer,
    permissions: permissionsReducer,
    bbs: bbsReducer,
    project: projectReducer,
  },
});
