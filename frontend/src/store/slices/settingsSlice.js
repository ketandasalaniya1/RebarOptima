import { createSlice } from '@reduxjs/toolkit';

const getInitialState = () => {
  try {
    const themeMode = localStorage.getItem('themeMode') || 'dark';
    const themeColor = localStorage.getItem('themeColor') || 'slate-emerald';
    const defaultKerf = parseFloat(localStorage.getItem('defaultKerf')) || 0;
    const defaultTrimMargin = parseFloat(localStorage.getItem('defaultTrimMargin')) || 0;

    return {
      themeMode,
      themeColor,
      defaultKerf,
      defaultTrimMargin,
    };
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err);
    return {
      themeMode: 'dark',
      themeColor: 'slate-emerald',
      defaultKerf: 0,
      defaultTrimMargin: 0,
    };
  }
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState: getInitialState(),
  reducers: {
    setThemeMode: (state, action) => {
      state.themeMode = action.payload;
      localStorage.setItem('themeMode', action.payload);
      document.documentElement.setAttribute('data-theme', action.payload);
    },
    setThemeColor: (state, action) => {
      state.themeColor = action.payload;
      localStorage.setItem('themeColor', action.payload);
      document.documentElement.setAttribute('data-color-theme', action.payload);
    },
    setDefaults: (state, action) => {
      const { defaultKerf, defaultTrimMargin } = action.payload;
      state.defaultKerf = parseFloat(defaultKerf) || 0;
      state.defaultTrimMargin = parseFloat(defaultTrimMargin) || 0;
      localStorage.setItem('defaultKerf', String(state.defaultKerf));
      localStorage.setItem('defaultTrimMargin', String(state.defaultTrimMargin));
    },
  },
});

export const { setThemeMode, setThemeColor, setDefaults } = settingsSlice.actions;
export default settingsSlice.reducer;
