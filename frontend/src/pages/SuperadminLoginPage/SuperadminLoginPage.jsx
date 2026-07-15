import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import { ShieldAlert, Key, Mail, Lock } from 'lucide-react';
import './SuperadminLoginPage.css';

export default function SuperadminLoginPage() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // ponytail: Simple hardcoded check or mock client validation for superadmin session in local sandbox env.
    if (email === 'admin@rebaroptima.com' && password === 'SuperSecureAdmin2026!') {
      localStorage.setItem('superadminToken', 'mock-superadmin-token-xyz');
      dispatch(setView('superadmin'));
    } else {
      setError('Invalid Superadmin access keys.');
    }
    setLoading(false);
  };

  return (
    <div className="superadmin-login-wrapper">
      <div className="superadmin-login-card card">
        <div className="superadmin-login-header">
          <div className="shield-icon-container">
            <ShieldAlert size={28} color="#dc2626" />
          </div>
          <h2>RebarOptima Operator Control</h2>
          <p className="subtitle">Authorized business administration & system operations console only.</p>
        </div>

        {error && <div className="superadmin-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="superadmin-login-form">
          <div className="input-group">
            <label>Operator Email</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" color="#8d86b8" />
              <input 
                type="email" 
                placeholder="operator@rebaroptima.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Security Key</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" color="#8d86b8" />
              <input 
                type="password" 
                placeholder="••••••••••••••••" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="superadmin-login-btn" disabled={loading}>
            {loading ? 'Decrypting Console...' : 'Access Administration Console'}
          </button>
        </form>

        <p className="superadmin-back-prompt">
          Builder Client? <a href="#" onClick={(e) => {
            e.preventDefault();
            dispatch(setView('signin'));
          }}>Standard Login</a>
        </p>
      </div>
    </div>
  );
}
