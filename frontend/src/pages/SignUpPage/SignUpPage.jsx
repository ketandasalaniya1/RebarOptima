import React, { useState } from 'react';
import { User, Lock, EyeOff, Eye, Mail, Building2, CheckCircle2, Shield, BarChart3, Users, Phone, MapPin } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import logo from '../../assets/logo.png';
import { authApi } from '../../utils/api';
import './SignUpPage.css';

const SignUpPage = ({ onSignUp, onNavigateToSignIn }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('OWNER');
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [promoConsent, setPromoConsent] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Password requirements check
    const hasNum = /\d/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (password.length < 8 || !hasNum || !hasUpper || !hasSpecial) {
      setError('Password does not meet all requirements.');
      return;
    }

    if (!termsConsent) {
      setError('You must accept the Terms and Conditions.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authApi.signup({
        email,
        password,
        firstName,
        lastName,
        role,
        companyName,
        projectName,
        location,
        mobileNumber,
        promoConsent,
        newsletterConsent
      });
      if (onSignUp) {
        onSignUp(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-page-wrapper">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="signup-container">
        
        {/* Main Card */}
        <div className="signup-card">
          
          {/* Left Section */}
          <div className="signup-left">
            <div className="signup-left-content">
              <div className="logo-container">
                <div className="logo-img-wrapper">
                  <img src={logo} alt="RebarOptima" className="logo-img" />
                </div>
              </div>

              <div className="welcome-text">
                <h1>Build Better.<br/><span className="highlight-text">Manage Smarter.</span><br/>Grow Together.</h1>
                <p>Create your account and take control of your construction projects.</p>
              </div>

              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-icon"><Shield size={20} color="#059669" /></div>
                  <div className="feature-text">
                    <h3>Centralized Project Management</h3>
                    <p>Keep all your projects, tasks & teams in one place.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon"><BarChart3 size={20} color="#059669" /></div>
                  <div className="feature-text">
                    <h3>Real-time Collaboration</h3>
                    <p>Work together and stay updated in real time.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon"><Lock size={20} color="#059669" /></div>
                  <div className="feature-text">
                    <h3>Secure & Reliable</h3>
                    <p>Enterprise-grade security for your data.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="diagonal-overlay"></div>
          </div>

          {/* Right Section */}
          <div className="signup-right">
            <div className="signup-form-container">
              <div className="mobile-logo">
                  <img src={logo} alt="RebarOptima" className="logo-img" />
              </div>

              <div className="form-header">
                <h2>Create Your Account</h2>
                <p className="subtitle">Let's get started with your free account</p>
              </div>

              {error && <div className="auth-error-message">{error}</div>}

              <form className="signup-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="input-group">
                    <label>First Name</label>
                    <div className="input-wrapper">
                      <User size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type="text" 
                        placeholder="First name" 
                        required 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Last Name</label>
                    <div className="input-wrapper">
                      <User size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type="text" 
                        placeholder="Last name" 
                        required 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label>Account Role</label>
                    <div className="input-wrapper">
                      <Users size={18} className="input-icon" color="#8d86b8" />
                      <select 
                        className="signup-select"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        required
                      >
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="ENGINEER">Engineer</option>
                      </select>
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Firm Name</label>
                    <div className="input-wrapper">
                      <Building2 size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type="text" 
                        placeholder="Company/Firm name" 
                        required 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label>Initial Project Name</label>
                    <div className="input-wrapper">
                      <Building2 size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type="text" 
                        placeholder="e.g. Sector-62 Site" 
                        required 
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Project Location</label>
                    <div className="input-wrapper">
                      <MapPin size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type="text" 
                        placeholder="e.g. Noida, India" 
                        required 
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label>Email Address</label>
                    <div className="input-wrapper">
                      <Mail size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type="email" 
                        placeholder="Enter email address" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Mobile Number</label>
                    <div className="input-wrapper">
                      <Phone size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type="tel" 
                        placeholder="10-digit number" 
                        required 
                        pattern="[0-9]{10}"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="input-group">
                    <label>Password</label>
                    <div className="input-wrapper">
                      <Lock size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Create password" 
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

                  <div className="input-group">
                    <label>Confirm Password</label>
                    <div className="input-wrapper">
                      <Lock size={18} className="input-icon" color="#8d86b8" />
                      <input 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="Confirm password" 
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button 
                        type="button" 
                        className="toggle-password"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <Eye size={18} color="#8d86b8" /> : <EyeOff size={18} color="#8d86b8" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="password-requirements">
                  <p>Password must contain:</p>
                  <div className="req-grid">
                    <div className="req-item"><CheckCircle2 size={14} color="#059669" /> At least 8 characters</div>
                    <div className="req-item"><CheckCircle2 size={14} color="#059669" /> One number</div>
                    <div className="req-item"><CheckCircle2 size={14} color="#059669" /> One uppercase letter</div>
                    <div className="req-item"><CheckCircle2 size={14} color="#059669" /> One special character</div>
                  </div>
                </div>

                <div className="form-actions-consent">
                  <label className="checkbox-consent">
                    <input 
                      type="checkbox" 
                      checked={promoConsent}
                      onChange={(e) => setPromoConsent(e.target.checked)}
                    />
                    <span>Yes, send me SMS/Whatsapp promotional updates.</span>
                  </label>

                  <label className="checkbox-consent">
                    <input 
                      type="checkbox" 
                      checked={newsletterConsent}
                      onChange={(e) => setNewsletterConsent(e.target.checked)}
                    />
                    <span>Subscribe to email newsletters and product tips.</span>
                  </label>

                  <label className="checkbox-consent terms-consent">
                    <input 
                      type="checkbox" 
                      required 
                      checked={termsConsent}
                      onChange={(e) => setTermsConsent(e.target.checked)}
                    />
                    <span>I accept the <a href="#">Terms and Conditions</a> and <a href="#">Privacy Policy</a> *</span>
                  </label>
                </div>

                <button type="submit" className="signup-button" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              <p className="signup-prompt">
                Already have an account? <a href="#" onClick={(e) => {
                  e.preventDefault();
                  if (onNavigateToSignIn) onNavigateToSignIn();
                }}>Sign In</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
