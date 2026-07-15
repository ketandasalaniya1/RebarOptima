import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import routingReducer from './slices/routingSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    routing: routingReducer,
    settings: settingsReducer,
  },
});
