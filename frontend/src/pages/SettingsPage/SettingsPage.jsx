import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setThemeMode, setThemeColor, setDefaults } from '../../store/slices/settingsSlice';
import { Save, Palette, Sliders, Moon, Sun, Settings } from 'lucide-react';
import './SettingsPage.css';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings);

  const [kerf, setKerf] = useState(settings.defaultKerf);
  const [trimMargin, setTrimMargin] = useState(settings.defaultTrimMargin);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveDefaults = (e) => {
    e.preventDefault();
    dispatch(setDefaults({ defaultKerf: kerf, defaultTrimMargin: trimMargin }));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Settings className="settings-header-icon" size={24} />
        <div>
          <h1 className="settings-title">User & Optimizer Settings</h1>
          <p className="settings-subtitle">Configure interface colors, themes, and global cutting parameters.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Visual Customization Card */}
        <div className="card settings-card">
          <h3 className="settings-card-title">
            <Palette size={18} style={{ marginRight: '8px' }} /> Theme & Styling
          </h3>
          <p className="settings-card-desc">Personalize your RebarOptima workspace theme and styling accents.</p>

          <div className="setting-group">
            <label className="setting-label">Theme Mode</label>
            <div className="theme-mode-buttons">
              <button 
                className={`theme-btn ${settings.themeMode === 'light' ? 'active' : ''}`}
                onClick={() => dispatch(setThemeMode('light'))}
              >
                <Sun size={16} /> Light Mode
              </button>
              <button 
                className={`theme-btn ${settings.themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => dispatch(setThemeMode('dark'))}
              >
                <Moon size={16} /> Dark Mode
              </button>
            </div>
          </div>

          <div className="setting-group">
            <label className="setting-label">Accent Color Theme</label>
            <div className="theme-color-buttons">
              <button 
                className={`color-btn slate-emerald ${settings.themeColor === 'slate-emerald' ? 'active' : ''}`}
                onClick={() => dispatch(setThemeColor('slate-emerald'))}
              >
                <span className="color-dot emerald"></span> Slate & Emerald
              </button>
              <button 
                className={`color-btn steel-blue ${settings.themeColor === 'steel-blue' ? 'active' : ''}`}
                onClick={() => dispatch(setThemeColor('steel-blue'))}
              >
                <span className="color-dot cobalt"></span> Steel & Blue
              </button>
              <button 
                className={`color-btn classic-purple ${settings.themeColor === 'classic-purple' ? 'active' : ''}`}
                onClick={() => dispatch(setThemeColor('classic-purple'))}
              >
                <span className="color-dot purple"></span> Classic Purple
              </button>
            </div>
          </div>
        </div>

        {/* Optimizer Parameters Defaults Card */}
        <div className="card settings-card">
          <h3 className="settings-card-title">
            <Sliders size={18} style={{ marginRight: '8px' }} /> Default Optimizer Configurations
          </h3>
          <p className="settings-card-desc">Set default settings for cutting layouts. These populate automatically on the run optimizer sheet.</p>

          <form onSubmit={handleSaveDefaults} className="settings-form">
            <div className="form-group">
              <label className="setting-label">Default Kerf (mm)</label>
              <div className="input-with-unit">
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="50"
                  value={kerf}
                  onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
                  className="settings-input"
                />
                <span className="unit-tag">mm</span>
              </div>
              <span className="field-hint">Blade thickness consumed during cutting. Defaults to 0 if negligible.</span>
            </div>

            <div className="form-group">
              <label className="setting-label">Default Trim Margin (mm)</label>
              <div className="input-with-unit">
                <input 
                  type="number" 
                  step="1"
                  min="0"
                  max="500"
                  value={trimMargin}
                  onChange={(e) => setTrimMargin(parseFloat(e.target.value) || 0)}
                  className="settings-input"
                />
                <span className="unit-tag">mm</span>
              </div>
              <span className="field-hint">Margin of waste discarded from the ends of stock bars. Defaults to 0 if negligible.</span>
            </div>

            <button type="submit" className="save-defaults-btn">
              <Save size={16} /> Save Optimizer Defaults
            </button>
            
            {saveSuccess && (
              <span className="settings-save-success">Settings saved successfully!</span>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
