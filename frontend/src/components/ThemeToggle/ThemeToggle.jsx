import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Sun, Moon, Laptop } from 'lucide-react';
import { setThemeMode } from '../../store/slices/settingsSlice';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.settings?.themeMode) || 'system';

  return (
    <div className="ro-theme-pill" role="radiogroup" aria-label="Theme mode selector">
      <button
        type="button"
        role="radio"
        aria-checked={themeMode === 'light'}
        className={`ro-theme-pill-btn ${themeMode === 'light' ? 'active' : ''}`}
        onClick={() => dispatch(setThemeMode('light'))}
        title="Light theme"
        aria-label="Light theme"
      >
        <Sun size={13} strokeWidth={2.2} />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={themeMode === 'system'}
        className={`ro-theme-pill-btn ${themeMode === 'system' ? 'active' : ''}`}
        onClick={() => dispatch(setThemeMode('system'))}
        title="Follow system theme"
        aria-label="Follow system theme"
      >
        <Laptop size={13} strokeWidth={2.2} />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={themeMode === 'dark'}
        className={`ro-theme-pill-btn ${themeMode === 'dark' ? 'active' : ''}`}
        onClick={() => dispatch(setThemeMode('dark'))}
        title="Dark theme"
        aria-label="Dark theme"
      >
        <Moon size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}
