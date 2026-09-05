import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ShieldAlert, AlertTriangle, LogOut, Check, X, HardDrive, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { publicApi } from '../../utils/api';
import { logout } from '../../store/slices/authSlice';
import { setView } from '../../store/slices/routingSlice';
import './SubscribePage.css';

export default function SubscribePage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const permissions = useSelector((state) => state.permissions.permissions);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactSuccess, setContactSuccess] = useState(false);

  const isSuspended = permissions?.companyStatus === 'suspended';

  useEffect(() => {
    publicApi.getPackages()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setPackages(data);
        } else {
          // Fallback default packages
          setPackages([
            {
              id: 'starter',
              name: 'STARTER',
              displayName: 'Starter Plan',
              description: 'Essential rebar optimization for growing contractor firms',
              limits: { maxStorageMB: 100, maxUsers: 5 },
              modules: { inventory: true, batches: true, bbs: true, ledger: true }
            },
            {
              id: 'pro',
              name: 'PRO',
              displayName: 'Professional Plan',
              description: 'Advanced features & higher capacity for multi-project enterprises',
              limits: { maxStorageMB: 500, maxUsers: 25 },
              modules: { inventory: true, batches: true, bbs: true, ledger: true, activityLogs: true, roles: true }
            },
            {
              id: 'enterprise',
              name: 'ENTERPRISE',
              displayName: 'Enterprise Edition',
              description: 'Unlimited capacity, dedicated support, and custom platform control',
              limits: { maxStorageMB: 5000, maxUsers: 100 },
              modules: { inventory: true, batches: true, bbs: true, ledger: true, activityLogs: true, roles: true, users: true }
            }
          ]);
        }
      })
      .catch(() => {
        setPackages([
          {
            id: 'pro',
            name: 'PRO',
            displayName: 'Professional Plan',
            description: 'Advanced optimization & high capacity for construction firms',
            limits: { maxStorageMB: 500, maxUsers: 25 },
            modules: { inventory: true, batches: true, bbs: true, ledger: true }
          }
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(setView('signin'));
  };

  const handleRequestSubscription = (pkgName) => {
    setContactSuccess(true);
    setTimeout(() => setContactSuccess(false), 5000);
  };

  return (
    <div className="subscribe-page-container">
      {/* Header Bar */}
      <header className="subscribe-header">
        <div className="subscribe-brand">
          <div className="subscribe-logo-icon">RO</div>
          <span className="subscribe-title">RebarOptima</span>
        </div>
        <button className="subscribe-logout-btn" onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      {/* Alert Banner */}
      <div className={`subscribe-banner ${isSuspended ? 'suspended' : 'expired'}`}>
        <div className="subscribe-banner-icon">
          {isSuspended ? <ShieldAlert size={26} /> : <AlertTriangle size={26} />}
        </div>
        <div className="subscribe-banner-content">
          <h3>
            {isSuspended
              ? `Account Suspended: ${user?.companyName || 'Your Organization'}`
              : `Subscription Expired: ${user?.companyName || 'Your Organization'}`}
          </h3>
          <p>
            {isSuspended
              ? 'Your organization account has been suspended by the platform superadmin. Access to application features is temporarily restricted. Please choose a subscription plan or contact support to reactivate your account.'
              : 'Your organization subscription plan has expired. To restore full access to inventory, optimization batches, and reports, please renew or upgrade your subscription plan below.'}
          </p>
        </div>
      </div>

      {/* Plans Section */}
      <main className="subscribe-plans-section">
        <h2 className="subscribe-section-title">Select a Subscription Plan</h2>
        <p className="subscribe-section-subtitle">
          Unlock high-performance rebar cutting optimization, inventory tracking, and project management.
        </p>

        {contactSuccess && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            padding: '14px 20px',
            borderRadius: '10px',
            marginBottom: '24px',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            <CheckCircle2 size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
            Subscription request sent to platform support! An administrator will contact your firm shortly.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading subscription plans...</div>
        ) : (
          <div className="subscribe-plans-grid">
            {packages.map((pkg, idx) => {
              const isPopular = pkg.name === 'PRO' || idx === 1;
              return (
                <div key={pkg.id || idx} className={`subscribe-plan-card ${isPopular ? 'featured' : ''}`}>
                  {isPopular && <div className="subscribe-popular-tag">Recommended</div>}

                  <h3 className="subscribe-plan-name">{pkg.displayName || pkg.name}</h3>
                  <p className="subscribe-plan-desc">{pkg.description || 'Full featured rebar management package'}</p>

                  <div className="subscribe-plan-limits">
                    <div className="subscribe-limit-item">
                      <HardDrive size={16} style={{ color: '#10b981' }} />
                      <span><strong>{pkg.limits?.maxStorageMB || 500} MB</strong> Storage Space</span>
                    </div>
                    <div className="subscribe-limit-item">
                      <Users size={16} style={{ color: '#3b82f6' }} />
                      <span><strong>{pkg.limits?.maxUsers || 25} Users</strong> Included</span>
                    </div>
                  </div>

                  <div className="subscribe-features-list">
                    <div className="subscribe-feature-item">
                      <Check size={16} style={{ color: '#10b981' }} />
                      <span>Linear Rebar Cutting Optimization</span>
                    </div>
                    <div className="subscribe-feature-item">
                      <Check size={16} style={{ color: '#10b981' }} />
                      <span>Inventory & Scrap Rule Management</span>
                    </div>
                    <div className="subscribe-feature-item">
                      <Check size={16} style={{ color: '#10b981' }} />
                      <span>BBS & Bar Bending Schedule Import</span>
                    </div>
                    <div className={`subscribe-feature-item ${pkg.modules?.activityLogs === false ? 'disabled' : ''}`}>
                      {pkg.modules?.activityLogs !== false ? (
                        <Check size={16} style={{ color: '#10b981' }} />
                      ) : (
                        <X size={16} style={{ color: '#6b7280' }} />
                      )}
                      <span>Audit Logs & Security History</span>
                    </div>
                  </div>

                  <button
                    className={`subscribe-action-btn ${isPopular ? 'primary' : 'secondary'}`}
                    onClick={() => handleRequestSubscription(pkg.displayName || pkg.name)}
                  >
                    Subscribe Now <ArrowRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="subscribe-footer-help">
        Need assistance or custom enterprise billing? Contact Support at <a href="mailto:support@rebaroptima.com">support@rebaroptima.com</a>
      </footer>
    </div>
  );
}
