import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setThemeMode, setThemeColor, setDefaults } from '../../store/slices/settingsSlice';
import { Save, Palette, Sliders, Moon, Sun, Settings, Database, Scale, AlertCircle, CheckCircle2 } from 'lucide-react';
import { companyApi, inventoryApi } from '../../utils/api';
import './SettingsPage.css';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings);

  const [kerf, setKerf] = useState(settings.defaultKerf);
  const [trimMargin, setTrimMargin] = useState(settings.defaultTrimMargin);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [storageData, setStorageData] = useState(null);
  const [loadingStorage, setLoadingStorage] = useState(true);

  // Scrap & Remnant Rules State
  const [scrapRules, setScrapRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [rulesSuccess, setRulesSuccess] = useState('');
  const [rulesError, setRulesError] = useState('');

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const res = await companyApi.getStorage();
        setStorageData(res);
      } catch (err) {
        console.error("Failed to fetch storage:", err);
      } finally {
        setLoadingStorage(false);
      }
    };

    const fetchRules = async () => {
      try {
        setLoadingRules(true);
        const res = await inventoryApi.getScrapRules();
        if (Array.isArray(res)) {
          setScrapRules(res);
        }
      } catch (err) {
        console.error("Failed to fetch scrap rules:", err);
        setRulesError(err.message || 'Failed to load scrap rules');
      } finally {
        setLoadingRules(false);
      }
    };

    fetchStorage();
    fetchRules();
  }, []);

  const handleSaveDefaults = (e) => {
    e.preventDefault();
    dispatch(setDefaults({ defaultKerf: kerf, defaultTrimMargin: trimMargin }));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleRuleChange = (idx, value) => {
    setScrapRules(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        scrapLengthThreshold: value === '' ? '' : value
      };
      return updated;
    });
  };

  const handleSaveRules = async (e) => {
    e.preventDefault();
    setRulesError('');
    setRulesSuccess('');
    setSavingRules(true);
    try {
      const sanitizedRules = scrapRules.map(r => ({
        ...r,
        scrapLengthThreshold: r.scrapLengthThreshold === '' || isNaN(Number(r.scrapLengthThreshold))
          ? 1000 
          : Math.max(100, Math.min(12000, Number(r.scrapLengthThreshold)))
      }));
      const updated = await inventoryApi.updateScrapRules(sanitizedRules);
      setScrapRules(updated);
      setRulesSuccess('Scrap rules updated successfully!');
      setTimeout(() => setRulesSuccess(''), 2500);
    } catch (err) {
      setRulesError(err.message || 'Failed to save scrap rules');
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Settings className="settings-header-icon" size={24} />
        <div>
          <h1 className="settings-title">Company & Optimizer Settings</h1>
          <p className="settings-subtitle">Configure interface colors, scrap rules, cutting parameters, and storage.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Reusable Remnant & Scrap Rules Card */}
        <div className="card settings-card rules-span-card">
          <div className="settings-card-header-flex">
            <div>
              <h3 className="settings-card-title">
                <Scale size={18} style={{ marginRight: '8px', color: 'var(--accent)' }} /> Reusable Remnant & Scrap Cut-Off Rules
              </h3>
              <p className="settings-card-desc">
                Define the minimum threshold length for each bar diameter. Leftover pieces shorter than this length go to <strong>Scrap/Waste</strong> (logged as scrap). Leftover pieces equal to or longer than this length are saved as <strong>Reusable Remnants</strong> to be reused in future cutting batches.
              </p>
            </div>
          </div>

          {rulesError && (
            <div className="settings-alert alert-error">
              <AlertCircle size={16} />
              <span>{rulesError}</span>
            </div>
          )}

          {rulesSuccess && (
            <div className="settings-alert alert-success">
              <CheckCircle2 size={16} />
              <span>{rulesSuccess}</span>
            </div>
          )}

          {loadingRules ? (
            <p className="settings-loading-text">Loading scrap threshold rules...</p>
          ) : (
            <form onSubmit={handleSaveRules} className="scrap-rules-form">
              <div className="scrap-rules-table-wrapper">
                <table className="scrap-rules-table">
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }}>Diameter (mm)</th>
                      <th>Remnant Threshold Length (mm)</th>
                      <th style={{ width: '220px' }}>Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapRules.map((rule, idx) => {
                      const threshold = rule.scrapLengthThreshold !== '' && rule.scrapLengthThreshold !== undefined && rule.scrapLengthThreshold !== null 
                        ? Number(rule.scrapLengthThreshold) 
                        : 1000;
                      return (
                        <tr key={rule._id || rule.diameter}>
                          <td className="rule-dia-cell">
                            <span className="dia-badge-pill">Ø {rule.diameter} mm</span>
                          </td>
                          <td>
                            <div className="rule-input-group">
                              <input
                                type="number"
                                value={rule.scrapLengthThreshold !== undefined && rule.scrapLengthThreshold !== null ? rule.scrapLengthThreshold : ''}
                                onChange={(e) => handleRuleChange(idx, e.target.value)}
                                className="rule-length-input"
                                min="100"
                                max="6000"
                                placeholder="1000"
                              />
                              <span className="unit-label">mm</span>
                            </div>
                          </td>
                          <td className="rule-behavior-cell">
                            <span className="behavior-hint">
                              ≥ {threshold}mm = Remnant, &lt; {threshold}mm = Scrap
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rules-save-row">
                <button type="submit" disabled={savingRules} className="save-rules-btn">
                  <Save size={16} /> {savingRules ? 'Saving Rules...' : 'Save Scrap Rules'}
                </button>
              </div>
            </form>
          )}
        </div>

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

        {/* Storage Stats Card */}
        <div className="card settings-card">
          <h3 className="settings-card-title">
            <Database size={18} style={{ marginRight: '8px' }} /> Subscription & Storage
          </h3>
          <p className="settings-card-desc">Monitor your organization's database storage usage.</p>
          
          <div className="setting-group" style={{ marginTop: '20px' }}>
            {loadingStorage ? (
              <p>Loading storage statistics...</p>
            ) : storageData ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  <span>Consumed Storage</span>
                  <span>{storageData.consumedMB < 0.01 ? '< 0.01' : storageData.consumedMB.toFixed(2)} MB / {storageData.maxMB} MB</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    background: (storageData.consumedMB / storageData.maxMB) > 0.9 ? '#ef4444' : 'var(--primary-color)', 
                    width: `${Math.min((storageData.consumedMB / storageData.maxMB) * 100, 100)}%` 
                  }}></div>
                </div>
                <p className="field-hint" style={{ marginTop: '12px' }}>
                  Approximate raw data size: {storageData.totalBytes.toLocaleString()} bytes. Storage is calculated based on database records and history logs.
                </p>
              </div>
            ) : (
              <p style={{ color: '#ef4444' }}>Unable to load storage details.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
