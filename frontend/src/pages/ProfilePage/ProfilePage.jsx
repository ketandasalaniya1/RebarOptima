import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  User as UserIcon, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  Activity, 
  Camera, 
  Trash2, 
  Save, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Building2, 
  Briefcase, 
  MapPin, 
  Phone, 
  Layers, 
  Package, 
  Scale, 
  Zap, 
  Clock, 
  Sparkles, 
  Sliders, 
  Maximize2 
} from 'lucide-react';
import { profileApi } from '../../utils/api';
import { updateUserSuccess } from '../../store/slices/authSlice';
import './ProfilePage.css';

export default function ProfilePage({ onNavigate }) {
  const dispatch = useDispatch();
  const authUser = useSelector((state) => state.auth.user);

  const [activeTab, setActiveTab] = useState('identity');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Profile Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobileNumber: '',
    role: '',
    roleName: '',
    companyName: '',
    projectName: '',
    location: '',
    assignedProjects: [],
    avatar: null,
    effectivePermissions: null,
    preferences: {
      defaultKerf: 3,
      defaultTrimMargin: 25,
      defaultBarLength: 12000,
      defaultAlgorithm: 'genetic',
    }
  });

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Activity & Stats State
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalSteelWeightKg: 0,
    totalSteelWeightMT: 0,
    totalScrapKg: 0,
    totalRemnantKg: 0,
    avgYield: 96.5,
    recentLogs: []
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Avatar Crop / Adjust Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef(null);

  // Fetch full profile & stats on mount
  useEffect(() => {
    fetchProfileData();
    fetchUserStats();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const data = await profileApi.getProfile();
      if (data) {
        setFormData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          mobileNumber: data.mobileNumber || '',
          role: data.role || 'User',
          roleName: data.roleName || data.role || 'User',
          companyName: data.companyName || 'Standard Firm',
          projectName: data.projectName || '',
          location: data.location || '',
          assignedProjects: data.assignedProjects || [],
          avatar: data.avatar || null,
          effectivePermissions: data.effectivePermissions || null,
          preferences: {
            defaultKerf: data.preferences?.defaultKerf ?? 3,
            defaultTrimMargin: data.preferences?.defaultTrimMargin ?? 25,
            defaultBarLength: data.preferences?.defaultBarLength ?? 12000,
            defaultAlgorithm: data.preferences?.defaultAlgorithm || 'genetic',
          }
        });
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
      setProfileError(err.message || 'Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      setLoadingStats(true);
      const data = await profileApi.getStats();
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load user stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);

    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        avatar: formData.avatar,
        preferences: formData.preferences || {
          defaultKerf: 3,
          defaultTrimMargin: 25,
          defaultBarLength: 12000,
          defaultAlgorithm: 'genetic',
        }
      };

      const res = await profileApi.updateProfile(payload);
      
      // Update Redux state & session
      dispatch(updateUserSuccess({
        firstName: res.firstName,
        lastName: res.lastName,
        mobileNumber: res.mobileNumber,
        avatar: res.avatar
      }));

      setProfileSuccess('Settings saved successfully!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // Password Change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    setSavingPassword(true);
    try {
      await profileApi.changePassword({
        currentPassword,
        newPassword
      });

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  // Avatar Image Selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please upload a valid image file (JPG, PNG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Apply Crop & Compress Image via HTML5 Canvas
  const handleApplyCrop = () => {
    if (!rawImageSrc) return;

    const image = new Image();
    image.src = rawImageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const TARGET_SIZE = 256;
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

      const minDim = Math.min(image.width, image.height);
      const cropSize = minDim / zoom;
      
      const centerX = image.width / 2 - (pan.x * (image.width / 200));
      const centerY = image.height / 2 - (pan.y * (image.height / 200));
      
      const sourceX = Math.max(0, Math.min(image.width - cropSize, centerX - cropSize / 2));
      const sourceY = Math.max(0, Math.min(image.height - cropSize, centerY - cropSize / 2));

      ctx.drawImage(
        image,
        sourceX, sourceY, cropSize, cropSize,
        0, 0, TARGET_SIZE, TARGET_SIZE
      );

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      setFormData(prev => ({ ...prev, avatar: compressedDataUrl }));
      setCropModalOpen(false);
      setRawImageSrc(null);

      profileApi.updateProfile({ avatar: compressedDataUrl })
        .then(() => {
          dispatch(updateUserSuccess({ avatar: compressedDataUrl }));
          setProfileSuccess('Profile picture updated!');
          setTimeout(() => setProfileSuccess(''), 2500);
        })
        .catch(err => {
          console.error('Could not auto-save avatar:', err);
        });
    };
  };

  // Remove Photo & Revert to Initials
  const handleRemovePhoto = async () => {
    setFormData(prev => ({ ...prev, avatar: null }));
    try {
      await profileApi.updateProfile({ avatar: null });
      dispatch(updateUserSuccess({ avatar: null }));
      setProfileSuccess('Profile picture removed. Initials restored.');
      setTimeout(() => setProfileSuccess(''), 2500);
    } catch (err) {
      console.error('Failed to remove photo:', err);
    }
  };

  // Mouse pan handlers for crop modal
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const initials = ((formData.firstName?.[0] || authUser?.firstName?.[0] || '') + (formData.lastName?.[0] || authUser?.lastName?.[0] || '')).toUpperCase() || 'U';

  // Password criteria checker
  const isLengthValid = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Format Helper for Weights (Strict Metric: Ton as 0.000, Kg as integer 0)
  const formatTons = (tons) => {
    const val = Number(tons) || 0;
    return val.toFixed(3);
  };

  const formatKg = (kg) => {
    const val = Math.round(Number(kg) || 0);
    return val.toLocaleString('en-US');
  };

  const currentPrefs = formData.preferences || {
    defaultKerf: 3,
    defaultTrimMargin: 25,
    defaultBarLength: 12000,
    defaultAlgorithm: 'genetic',
  };

  return (
    <div className="profile-page">
      {/* Top Banner Header */}
      <div className="profile-banner-card">
        <div className="profile-banner-inner">
          <div className="profile-avatar-wrapper">
            {formData.avatar ? (
              <img src={formData.avatar} alt="User Avatar" className="profile-header-avatar-img" />
            ) : (
              <div className="profile-header-avatar-initials">{initials}</div>
            )}
            <button 
              type="button" 
              className="avatar-change-badge-btn" 
              onClick={() => fileInputRef.current?.click()}
              title="Upload / Change Photo"
            >
              <Camera size={15} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleImageSelect} 
            />
          </div>

          <div className="profile-header-info">
            <div className="profile-header-name-row">
              <h1 className="profile-header-fullname">
                {formData.firstName || authUser?.firstName || 'User'} {formData.lastName || authUser?.lastName || ''}
              </h1>
              <span className="profile-status-pill">
                <span className="status-dot"></span> Active
              </span>
            </div>

            <div className="profile-header-meta-row">
              <span className="profile-role-badge">
                <ShieldCheck size={14} /> {formData.roleName || formData.role || authUser?.role || 'Admin'}
              </span>
              <span className="profile-meta-item">
                <Building2 size={14} /> {formData.companyName || authUser?.companyName || 'Standard Firm'}
              </span>
              {(formData.projectName || authUser?.projectName) && (
                <span className="profile-meta-item">
                  <Briefcase size={14} /> {formData.projectName || authUser?.projectName}
                </span>
              )}
              {formData.location && (
                <span className="profile-meta-item">
                  <MapPin size={14} /> {formData.location}
                </span>
              )}
            </div>
          </div>

          <div className="profile-header-actions">
            {formData.avatar && (
              <button 
                type="button" 
                className="btn-secondary-outline remove-avatar-btn" 
                onClick={handleRemovePhoto}
                title="Remove photo & use initials"
              >
                <Trash2 size={15} /> Remove Photo
              </button>
            )}
            <button 
              type="button" 
              className="btn-primary-gradient" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={16} /> Change Photo
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {profileSuccess && (
        <div className="profile-alert alert-success">
          <CheckCircle2 size={18} />
          <span>{profileSuccess}</span>
        </div>
      )}
      {profileError && (
        <div className="profile-alert alert-error">
          <AlertCircle size={18} />
          <span>{profileError}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="profile-tabs-nav">
        <button 
          className={`profile-tab-btn ${activeTab === 'identity' ? 'active' : ''}`}
          onClick={() => setActiveTab('identity')}
        >
          <UserIcon size={17} /> Identity & Personal Info
        </button>
        <button 
          className={`profile-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <SettingsIcon size={17} /> Optimizer Preferences
        </button>
        <button 
          className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <KeyRound size={17} /> Security & Credentials
        </button>
        <button 
          className={`profile-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Activity size={17} /> My Activity & Impact
        </button>
      </div>

      {/* TAB CONTENT AREA */}
      <div className="profile-tab-content">
        
        {/* TAB 1: IDENTITY & PERSONAL INFO */}
        {activeTab === 'identity' && (
          <div className="tab-pane">
            <form onSubmit={handleSaveProfile} className="profile-form-grid">
              <div className="card profile-card">
                <div className="profile-card-header">
                  <UserIcon size={18} className="card-header-icon" />
                  <div>
                    <h3 className="card-title">Personal Details</h3>
                    <p className="card-subtitle">Manage your personal identification and contact information.</p>
                  </div>
                </div>

                <div className="form-fields-grid two-col">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Work Email</label>
                    <div className="input-with-badge">
                      <input 
                        type="email" 
                        className="form-input disabled-input" 
                        value={formData.email} 
                        readOnly 
                        disabled 
                      />
                      <span className="verified-badge">
                        <CheckCircle2 size={13} /> Verified
                      </span>
                    </div>
                    <span className="form-hint">Email address is managed by your organization admin.</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mobile Number</label>
                    <div className="input-icon-wrapper">
                      <Phone size={15} className="field-inner-icon" />
                      <input 
                        type="tel" 
                        className="form-input with-icon" 
                        placeholder="+91 98765 43210"
                        value={formData.mobileNumber}
                        onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card profile-card">
                <div className="profile-card-header">
                  <Building2 size={18} className="card-header-icon" />
                  <div>
                    <h3 className="card-title">Organization & Site Assignment</h3>
                    <p className="card-subtitle">Your organizational hierarchy and operational site parameters.</p>
                  </div>
                </div>

                <div className="form-fields-grid two-col">
                  <div className="form-group">
                    <label className="form-label">Company / Firm</label>
                    <input 
                      type="text" 
                      className="form-input disabled-input" 
                      value={formData.companyName} 
                      readOnly 
                      disabled 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primary Project / Site</label>
                    <input 
                      type="text" 
                      className="form-input disabled-input" 
                      value={formData.projectName || 'General Site Operations'} 
                      readOnly 
                      disabled 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Site Location</label>
                    <input 
                      type="text" 
                      className="form-input disabled-input" 
                      value={formData.location || 'Headquarters / Main Yard'} 
                      readOnly 
                      disabled 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">System Role</label>
                    <div className="role-display-pill">
                      <ShieldCheck size={16} />
                      <span className="role-name-text">{formData.roleName || formData.role}</span>
                      <span className="role-scope-tag">Standard Access</span>
                    </div>
                  </div>
                </div>

                {formData.effectivePermissions?.modules && (
                  <div className="permissions-summary-box">
                    <h4 className="permissions-box-title">Active Functional Permissions</h4>
                    <div className="permissions-tags-list">
                      {Object.entries(formData.effectivePermissions.modules).map(([modKey, isAllowed]) => {
                        if (!isAllowed) return null;
                        const labels = {
                          overview: 'Overview Dashboard',
                          inventory: 'Inventory & Inward',
                          optimizer: 'Run Optimizer',
                          history: 'Batch History',
                          ledger: 'Ledger & Orders',
                          scrapSales: 'Scrap Sales',
                          activityLogs: 'Activity Audit',
                          settings: 'Company Settings',
                          users: 'User Management',
                          roles: 'Role Policies'
                        };
                        return (
                          <span key={modKey} className="permission-chip">
                            <CheckCircle2 size={12} /> {labels[modKey] || modKey}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="profile-form-footer">
                <button 
                  type="submit" 
                  className="btn-primary-gradient save-profile-btn"
                  disabled={savingProfile}
                >
                  <Save size={16} /> {savingProfile ? 'Saving Changes...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: OPTIMIZER & CUTTING PREFERENCES (STRICTLY METRIC) */}
        {activeTab === 'preferences' && (
          <div className="tab-pane">
            <form onSubmit={handleSaveProfile} className="profile-form-grid">
              <div className="card profile-card">
                <div className="profile-card-header">
                  <Sliders size={18} className="card-header-icon" />
                  <div>
                    <h3 className="card-title">Personal Cutting & Optimizer Defaults</h3>
                    <p className="card-subtitle">
                      Pre-fill your individual preferences when launching new rebar optimization batches. All values strictly follow the <strong>Metric (mm, m, kg, MT)</strong> standard.
                    </p>
                  </div>
                </div>

                <div className="form-fields-grid two-col">
                  <div className="form-group">
                    <label className="form-label">
                      Default Saw Blade Kerf (<span className="metric-unit-tag">mm</span>)
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      max="20" 
                      step="0.5" 
                      className="form-input" 
                      value={currentPrefs.defaultKerf ?? 3}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: { ...currentPrefs, defaultKerf: Number(e.target.value) || 0 }
                      })}
                    />
                    <span className="form-hint">Thickness of the cutting saw/shear blade lost per cut (standard: 3.0 mm).</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Default Bar Trim Margin (<span className="metric-unit-tag">mm</span>)
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      max="150" 
                      step="5" 
                      className="form-input" 
                      value={currentPrefs.defaultTrimMargin ?? 25}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: { ...currentPrefs, defaultTrimMargin: Number(e.target.value) || 0 }
                      })}
                    />
                    <span className="form-hint">End allowance trimmed off damaged raw stock ends before cutting (standard: 25 mm).</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Default Optimization Engine</label>
                    <select 
                      className="form-input form-select"
                      value={currentPrefs.defaultAlgorithm || 'genetic'}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: { ...currentPrefs, defaultAlgorithm: e.target.value }
                      })}
                    >
                      <option value="genetic">Genetic Algorithm (Yield Priority - Minimal Steel Scrap)</option>
                      <option value="first-fit">Best-Fit Decreasing (Speed Priority - Instant Results)</option>
                    </select>
                    <span className="form-hint">Preferred cutting pattern calculation strategy.</span>
                  </div>
                </div>
              </div>

              <div className="profile-form-footer">
                <button 
                  type="submit" 
                  className="btn-primary-gradient save-profile-btn"
                  disabled={savingProfile}
                >
                  <Save size={16} /> {savingProfile ? 'Saving Preferences...' : 'Save Cutting Preferences'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: SECURITY & PASSWORD */}
        {activeTab === 'security' && (
          <div className="tab-pane">
            <div className="profile-form-grid">
              {passwordSuccess && (
                <div className="profile-alert alert-success">
                  <CheckCircle2 size={18} />
                  <span>{passwordSuccess}</span>
                </div>
              )}
              {passwordError && (
                <div className="profile-alert alert-error">
                  <AlertCircle size={18} />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="card profile-card">
                <div className="profile-card-header">
                  <KeyRound size={18} className="card-header-icon" />
                  <div>
                    <h3 className="card-title">Change Account Password</h3>
                    <p className="card-subtitle">Ensure your account is protected with a secure, complex password.</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="password-form">
                  <div className="form-group">
                    <label className="form-label">Current Password *</label>
                    <div className="input-password-wrapper">
                      <input 
                        type={showCurrentPass ? 'text' : 'password'}
                        className="form-input"
                        placeholder="Enter your current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                      <button 
                        type="button" 
                        className="password-toggle-btn"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                      >
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-fields-grid two-col">
                    <div className="form-group">
                      <label className="form-label">New Password *</label>
                      <div className="input-password-wrapper">
                        <input 
                          type={showNewPass ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Enter new strong password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          className="password-toggle-btn"
                          onClick={() => setShowNewPass(!showNewPass)}
                        >
                          {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Confirm New Password *</label>
                      <div className="input-password-wrapper">
                        <input 
                          type={showConfirmPass ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Re-enter new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPass(!showConfirmPass)}
                        >
                          {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="password-rules-box">
                    <h4 className="rules-title">Password Security Requirements</h4>
                    <div className="rules-list">
                      <div className={`rule-item ${isLengthValid ? 'met' : ''}`}>
                        <CheckCircle2 size={14} /> At least 8 characters
                      </div>
                      <div className={`rule-item ${hasUppercase ? 'met' : ''}`}>
                        <CheckCircle2 size={14} /> At least one uppercase letter (A-Z)
                      </div>
                      <div className={`rule-item ${hasNumber ? 'met' : ''}`}>
                        <CheckCircle2 size={14} /> At least one number (0-9)
                      </div>
                      <div className={`rule-item ${hasSpecial ? 'met' : ''}`}>
                        <CheckCircle2 size={14} /> At least one special character (!@#$%^&*)
                      </div>
                      <div className={`rule-item ${isMatch ? 'met' : ''}`}>
                        <CheckCircle2 size={14} /> Passwords match
                      </div>
                    </div>
                  </div>

                  <div className="profile-form-footer" style={{ marginTop: '20px' }}>
                    <button 
                      type="submit" 
                      className="btn-primary-gradient save-profile-btn"
                      disabled={savingPassword || !isLengthValid || !hasUppercase || !hasNumber || !hasSpecial || !isMatch}
                    >
                      <KeyRound size={16} /> {savingPassword ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="card profile-card">
                <div className="profile-card-header">
                  <ShieldCheck size={18} className="card-header-icon" />
                  <div>
                    <h3 className="card-title">Active Session & Security Status</h3>
                    <p className="card-subtitle">Information about your current logged-in browser session.</p>
                  </div>
                </div>

                <div className="session-info-grid">
                  <div className="session-info-item">
                    <span className="session-info-lbl">Authentication Mode</span>
                    <span className="session-info-val">JSON Web Token (Bearer)</span>
                  </div>
                  <div className="session-info-item">
                    <span className="session-info-lbl">Inactivity Auto-Logout</span>
                    <span className="session-info-val">30 Minutes Idle Timeout</span>
                  </div>
                  <div className="session-info-item">
                    <span className="session-info-lbl">Tenant Access</span>
                    <span className="session-info-val">{formData.companyName || 'Standard Firm'}</span>
                  </div>
                  <div className="session-info-item">
                    <span className="session-info-lbl">Security Role</span>
                    <span className="session-info-val">{formData.roleName || formData.role || 'User'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MY ACTIVITY & IMPACT */}
        {activeTab === 'activity' && (
          <div className="tab-pane">
            <div className="stats-kpi-grid">
              <div className="card stat-kpi-card">
                <div className="kpi-icon-wrapper kpi-blue">
                  <Layers size={22} />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Batches Run</span>
                  <span className="kpi-value">{stats.totalBatches}</span>
                  <span className="kpi-sub">Total Cutting Batches</span>
                </div>
              </div>

              <div className="card stat-kpi-card">
                <div className="kpi-icon-wrapper kpi-emerald">
                  <Package size={22} />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Steel Processed</span>
                  <span className="kpi-value">{formatTons(stats.totalSteelWeightMT)} <span className="unit-small">MT</span></span>
                  <span className="kpi-sub">({formatKg(stats.totalSteelWeightKg)} kg)</span>
                </div>
              </div>

              <div className="card stat-kpi-card">
                <div className="kpi-icon-wrapper kpi-green">
                  <Sparkles size={22} />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Remnants Reclaimed</span>
                  <span className="kpi-value">{formatKg(stats.totalRemnantKg)} <span className="unit-small">kg</span></span>
                  <span className="kpi-sub">Saved from waste ({formatTons(stats.totalRemnantKg / 1000)} MT)</span>
                </div>
              </div>

              <div className="card stat-kpi-card">
                <div className="kpi-icon-wrapper kpi-purple">
                  <Zap size={22} />
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Average Yield</span>
                  <span className="kpi-value">{stats.avgYield}%</span>
                  <span className="kpi-sub">Material Efficiency</span>
                </div>
              </div>
            </div>

            <div className="card profile-card" style={{ marginTop: '20px' }}>
              <div className="profile-card-header-flex">
                <div className="profile-card-header">
                  <Clock size={18} className="card-header-icon" />
                  <div>
                    <h3 className="card-title">My Recent Activity Trail</h3>
                    <p className="card-subtitle">Chronological record of operations performed under your user account.</p>
                  </div>
                </div>

                {onNavigate && (
                  <button 
                    type="button" 
                    className="btn-secondary-outline"
                    onClick={() => onNavigate('activity-logs')}
                  >
                    View All Audit Logs
                  </button>
                )}
              </div>

              {loadingStats ? (
                <p className="loading-stats-text">Loading activity records...</p>
              ) : stats.recentLogs.length === 0 ? (
                <div className="empty-activity-state">
                  <Activity size={32} className="empty-icon" />
                  <p>No recent actions logged yet. Operations in Optimizer, Inventory, and Ledger will appear here.</p>
                </div>
              ) : (
                <div className="activity-logs-table-wrapper">
                  <table className="profile-activity-table">
                    <thead>
                      <tr>
                        <th style={{ width: '180px' }}>Timestamp</th>
                        <th style={{ width: '120px' }}>Module</th>
                        <th style={{ width: '160px' }}>Action</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="log-timestamp">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Just now'}
                          </td>
                          <td>
                            <span className="module-tag">{log.module || 'System'}</span>
                          </td>
                          <td>
                            <span className="action-tag">{log.action}</span>
                          </td>
                          <td className="log-desc">{log.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* AVATAR CROP & COMPRESSOR MODAL */}
      {cropModalOpen && (
        <div className="crop-modal-overlay">
          <div className="crop-modal-card">
            <div className="crop-modal-header">
              <h3 className="crop-modal-title">
                <Maximize2 size={18} /> Adjust & Square Crop Profile Photo
              </h3>
              <button 
                type="button" 
                className="crop-close-btn"
                onClick={() => { setCropModalOpen(false); setRawImageSrc(null); }}
              >
                ✕
              </button>
            </div>

            <p className="crop-modal-desc">
              Drag to reposition and use the zoom slider. The image will be automatically compressed to high-efficiency square format to ensure fast loading and zero server load.
            </p>

            <div 
              className="crop-viewport-container"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div 
                className="crop-image-canvas"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
              >
                <img src={rawImageSrc} alt="Crop Preview" draggable="false" />
              </div>
              <div className="crop-overlay-square"></div>
            </div>

            <div className="crop-controls-row">
              <span className="crop-control-lbl">Zoom</span>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.05" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="crop-zoom-slider"
              />
              <button 
                type="button" 
                className="btn-secondary-outline reset-crop-btn"
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              >
                Reset
              </button>
            </div>

            <div className="crop-modal-actions">
              <button 
                type="button" 
                className="btn-secondary-outline"
                onClick={() => { setCropModalOpen(false); setRawImageSrc(null); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary-gradient"
                onClick={handleApplyCrop}
              >
                <CheckCircle2 size={16} /> Crop & Save Avatar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
