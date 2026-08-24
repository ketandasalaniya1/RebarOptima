import React, { useState } from 'react';
import { User, Lock, EyeOff, Eye, Map, ClipboardList, TrendingUp, Shield, Users } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import logo from '../../assets/logo.png';
import { authApi } from '../../utils/api';
import { useDispatch } from 'react-redux';
import { setPermissions } from '../../store/slices/permissionsSlice';
import './SignInPage.css';

const SignInPage = ({ onSignIn, onNavigateToSignUp, onNavigateToDeveloper }) => {
  const dispatch = useDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const data = await authApi.signin(email, password);
      if (data.permissions) {
        dispatch(setPermissions(data.permissions));
      }
      if (onSignIn) {
        onSignIn(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signin-page-wrapper">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="signin-container">
        
        {/* Main Card */}
        <div className="signin-card">
          
          {/* Left Section */}
          <div className="signin-left">
            <div className="signin-left-content">
              <div className="logo-container">
                <div className="logo-img-wrapper">
                  <img src={logo} alt="RebarOptima" className="logo-img" />
                </div>
              </div>

              <div className="welcome-text">
                <h1>Welcome <span className="highlight-text">Back!</span></h1>
                <p>Sign in to continue managing your construction projects seamlessly.</p>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-icon"><Map size={20} color="#a468eb" /></div>
                  <div className="feature-text">
                    <h3>Track Projects</h3>
                    <p>Stay updated on all site activities</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon"><ClipboardList size={20} color="#a468eb" /></div>
                  <div className="feature-text">
                    <h3>Manage Tasks</h3>
                    <p>Assign and monitor tasks efficiently</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon"><TrendingUp size={20} color="#a468eb" /></div>
                  <div className="feature-text">
                    <h3>Build Better</h3>
                    <p>Make smarter decisions every day</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="diagonal-overlay"></div>
          </div>

          {/* Right Section */}
          <div className="signin-right">
            <div className="signin-form-container">
              <div className="mobile-logo">
                  <img src={logo} alt="RebarOptima" className="logo-img" />
              </div>

              <div className="form-header">
                <h2>Sign In</h2>
                <p className="subtitle">Enter your credentials to access your account</p>
              </div>

              {error && <div className="auth-error-message">{error}</div>}

              <form className="signin-form" onSubmit={handleSubmit}>
                <div className="input-group">
                  <label>Email Address</label>
                  <div className="input-wrapper">
                    <User size={18} className="input-icon" color="#8d86b8" />
                    <input 
                      type="email" 
                      placeholder="Enter your email" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Password</label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" color="#8d86b8" />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Enter your password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <Eye size={18} color="#8d86b8" /> : <EyeOff size={18} color="#8d86b8" />}
                    </button>
                  </div>
                </div>

                <div className="form-actions">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span className="checkmark"></span>
                    Remember Me
                  </label>
                  <a href="#" className="forgot-password">Forgot Password?</a>
                </div>

                <button type="submit" className="signin-button" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>


              <p className="signup-prompt">
                Don't have an account? <a href="#" onClick={(e) => {
                  e.preventDefault();
                  if (onNavigateToSignUp) onNavigateToSignUp();
                }}>Sign Up</a>
              </p>
              
              <p className="signup-prompt" style={{ marginTop: '12px', opacity: 0.6 }}>
                Platform admin? <a href="#" onClick={(e) => {
                  e.preventDefault();
                  if (onNavigateToDeveloper) onNavigateToDeveloper();
                }}>Developer Console</a>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="signin-bottom-bar">
          <div className="bottom-bar-item left-item">
            <div className="bottom-icon-wrapper">
              <Shield size={20} color="var(--accent)" />
            </div>
            <div className="bottom-text">
              <h4>Secure Access</h4>
              <p>Your data is protected with enterprise-grade security.</p>
            </div>
          </div>
          
          <div className="bottom-separator"></div>

          <div className="bottom-bar-item right-item">
            <div className="bottom-icon-wrapper">
              <Users size={20} color="var(--accent)" />
            </div>
            <div className="bottom-text">
              <h4>Trusted by Construction Professionals</h4>
              <p>Join thousands of teams building the future.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
