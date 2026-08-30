import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Sun, Moon } from 'lucide-react';
import { setThemeMode } from '../../store/slices/settingsSlice';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.settings?.themeMode) || 'dark';

  const handleToggle = () => {
    const nextTheme = themeMode === 'light' ? 'dark' : 'light';
    dispatch(setThemeMode(nextTheme));
  };

  return (
    <label className="theme-switch" title={themeMode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
      <input 
        type="checkbox" 
        checked={themeMode === 'dark'} 
        onChange={handleToggle}
        aria-label="Toggle theme"
      />
      <span className="slider round">
        <span className="slider-icon light-sun">
          <Sun size={12} strokeWidth={2.5} />
        </span>
        <span className="slider-icon dark-moon">
          <Moon size={12} strokeWidth={2.5} />
        </span>
        <span className="slider-thumb"></span>
      </span>
    </label>
  );
}
