import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import { loginSuccess } from '../../store/slices/authSlice';
import { ShieldAlert, Mail, Lock, Eye, EyeOff, Terminal, Server, Database } from 'lucide-react';
import { authApi } from '../../utils/api';
import './SuperadminLoginPage.css';

export default function SuperadminLoginPage() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.developerSignin(email, password);
      dispatch(loginSuccess(data));
      dispatch(setView('superadmin'));
    } catch (err) {
      setError(err.message || 'Invalid Developer access credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dev-login-wrapper">
      <div className="dev-login-bg-effects">
        <div className="dev-bg-grid"></div>
        <div className="dev-bg-glow dev-bg-glow-1"></div>
        <div className="dev-bg-glow dev-bg-glow-2"></div>
      </div>

      <div className="dev-login-card">
        <div className="dev-login-header">
          <div className="dev-shield-badge">
            <ShieldAlert size={32} />
          </div>
          <h1>Platform Developer Console</h1>
          <p className="dev-subtitle">Authorized platform administration access only</p>
        </div>

        {error && <div className="dev-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="dev-login-form">
          <div className="dev-input-group">
            <label>Developer Email</label>
            <div className="dev-input-wrapper">
              <Mail size={18} className="dev-input-icon" />
              <input 
                type="email" 
                placeholder="developer@rebaroptima.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="dev-input-group">
            <label>Security Key</label>
            <div className="dev-input-wrapper">
              <Lock size={18} className="dev-input-icon" />
              <input 
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••••••" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="dev-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="dev-login-btn" disabled={loading}>
            {loading ? (
              <><span className="dev-spinner"></span> Authenticating...</>
            ) : (
              <><Terminal size={16} /> Access Developer Console</>
            )}
          </button>
        </form>

        <div className="dev-security-badges">
          <div className="dev-badge">
            <Server size={14} />
            <span>Backend Authenticated</span>
          </div>
          <div className="dev-badge">
            <Database size={14} />
            <span>Platform Level Access</span>
          </div>
        </div>

        <p className="dev-back-prompt">
          Builder Firm Client?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); dispatch(setView('signin')); }}>
            Standard Login
          </a>
        </p>
      </div>
    </div>
  );
}
