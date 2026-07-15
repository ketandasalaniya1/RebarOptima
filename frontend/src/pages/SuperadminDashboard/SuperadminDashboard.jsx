import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import { 
  ShieldAlert, 
  Users, 
  CreditCard, 
  Database, 
  Mail, 
  Search, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  Bell, 
  Clock, 
  Cpu 
} from 'lucide-react';
import './SuperadminDashboard.css';

export default function SuperadminDashboard() {
  const dispatch = useDispatch();
  
  // Mock Builder Accounts List
  const [builders, setBuilders] = useState([
    { id: 'BLD-9812', name: 'L&T Construction', sitesCount: 22, staffCount: 180, plan: 'Enterprise Pro', billingStatus: 'Paid', renewalDate: '2026-12-01', verified: true },
    { id: 'BLD-4521', name: 'Godrej Properties', sitesCount: 14, staffCount: 95, plan: 'Enterprise', billingStatus: 'Paid', renewalDate: '2026-10-15', verified: true },
    { id: 'BLD-1190', name: 'Tata Projects', sitesCount: 31, staffCount: 240, plan: 'Enterprise Pro', billingStatus: 'Paid', renewalDate: '2027-01-20', verified: true },
    { id: 'BLD-8823', name: 'K Raheja Corp', sitesCount: 8, staffCount: 45, plan: 'Standard', billingStatus: 'Pending', renewalDate: '2026-07-28', verified: false },
    { id: 'BLD-0412', name: 'Shapoorji Pallonji', sitesCount: 18, staffCount: 130, plan: 'Enterprise', billingStatus: 'Paid', renewalDate: '2026-09-05', verified: true },
  ]);

  const [search, setSearch] = useState('');
  const [notificationMsg, setNotificationMsg] = useState('');
  const [promoSuccess, setPromoSuccess] = useState(false);

  const handleVerifyToggle = (id) => {
    setBuilders(prev => prev.map(b => b.id === id ? { ...b, verified: !b.verified } : b));
  };

  const handleSendPromotion = (e) => {
    e.preventDefault();
    if (!notificationMsg.trim()) return;
    setPromoSuccess(true);
    setTimeout(() => {
      setPromoSuccess(false);
      setNotificationMsg('');
    }, 2500);
  };

  const handleLogout = () => {
    localStorage.removeItem('superadminToken');
    dispatch(setView('superadmin-login'));
  };

  const filteredBuilders = builders.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  // Telemetry estimations
  const totalBuildersCount = 1042; // Simulated scaling count
  const totalSitesCount = 5120;
  const activeStaffCount = 12450;
  const estDbGrowthPerMonth = '7.5 GB';

  return (
    <div className="superadmin-dashboard">
      {/* Top Navbar */}
      <header className="superadmin-nav">
        <div className="nav-brand">
          <ShieldAlert size={20} color="#dc2626" />
          <span className="brand-txt">RebarOptima Operator Panel</span>
          <span className="badge-console">v2.1-Prod</span>
        </div>
        <div className="nav-actions">
          <div className="telemetry-info">
            <Cpu size={14} /> System Health: <span className="text-green">99.98%</span>
          </div>
          <button className="superadmin-logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Exit Operator Panel
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="superadmin-content">
        {/* Analytics Summary */}
        <section className="superadmin-metrics-row">
          <div className="card metric-panel">
            <div className="metric-info">
              <span className="panel-lbl">Total SaaS Builders</span>
              <span className="panel-val">{totalBuildersCount}</span>
            </div>
            <div className="panel-icon purple"><Users size={22} /></div>
          </div>
          <div className="card metric-panel">
            <div className="metric-info">
              <span className="panel-lbl">Active Project Sites</span>
              <span className="panel-val">{totalSitesCount}</span>
            </div>
            <div className="panel-icon blue"><Clock size={22} /></div>
          </div>
          <div className="card metric-panel">
            <div className="metric-info">
              <span className="panel-lbl">Active Builder Staff</span>
              <span className="panel-val">{activeStaffCount}</span>
            </div>
            <div className="panel-icon orange"><Users size={22} /></div>
          </div>
          <div className="card metric-panel">
            <div className="metric-info">
              <span className="panel-lbl">DB Volume (Monthly Growth)</span>
              <span className="panel-val">{estDbGrowthPerMonth}</span>
            </div>
            <div className="panel-icon red"><Database size={22} /></div>
          </div>
        </section>

        {/* Dual Column Layout */}
        <div className="superadmin-grid">
          {/* Left Column - Builders Verification & billing */}
          <div className="grid-left-col">
            <div className="card list-panel">
              <div className="panel-header">
                <h3 className="panel-title">Registered Builder Firms</h3>
                <div className="search-bar">
                  <Search size={14} className="s-icon" />
                  <input 
                    type="text" 
                    placeholder="Search builders..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="superadmin-search"
                  />
                </div>
              </div>

              <div className="table-responsive">
                <table className="superadmin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Builder Name</th>
                      <th>Sites</th>
                      <th>Staff Count</th>
                      <th>Sub Plan</th>
                      <th>Renewal Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBuilders.map(b => (
                      <tr key={b.id}>
                        <td className="text-secondary">{b.id}</td>
                        <td className="font-bold">{b.name}</td>
                        <td>{b.sitesCount}</td>
                        <td>{b.staffCount}</td>
                        <td><span className="plan-badge">{b.plan}</span></td>
                        <td>{b.renewalDate}</td>
                        <td>
                          {b.billingStatus === 'Paid' ? (
                            <span className="billing-status status-paid">Paid</span>
                          ) : (
                            <span className="billing-status status-pending">Pending</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className={`btn-verify ${b.verified ? 'verified' : 'unverified'}`}
                            onClick={() => handleVerifyToggle(b.id)}
                          >
                            {b.verified ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {b.verified ? 'Verified' : 'Verify'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Backup Audit & Communications */}
          <div className="grid-right-col">
            {/* Backup Status panel */}
            <div className="card control-panel">
              <h3 className="panel-title">
                <Database size={16} style={{ marginRight: '6px' }} /> Database Backup Telemetry
              </h3>
              <div className="backup-telemetry-list">
                <div className="backup-item">
                  <div className="backup-info">
                    <span className="backup-name">Daily Automated Snapshots</span>
                    <span className="backup-date text-secondary">Scheduled at 03:00 AM UTC</span>
                  </div>
                  <span className="badge-ok">Active (OK)</span>
                </div>
                <div className="backup-item">
                  <div className="backup-info">
                    <span className="backup-name">Weekly Encrypted S3 Archive</span>
                    <span className="backup-date text-secondary">Last Sync: 2 days ago</span>
                  </div>
                  <span className="badge-ok">Active (OK)</span>
                </div>
                <div className="backup-item">
                  <div className="backup-info">
                    <span className="backup-name">Atlas Cluster Sharding Integrity</span>
                    <span className="backup-date text-secondary">Replica Set: Cluster0-Primary</span>
                  </div>
                  <span className="badge-ok">Healthy</span>
                </div>
              </div>
            </div>

            {/* Notification/Promotion panel */}
            <div className="card control-panel">
              <h3 className="panel-title">
                <Bell size={16} style={{ marginRight: '6px' }} /> Broadcast Operator Notifications
              </h3>
              <p className="panel-desc">Dispatch global renewal alerts or promotional campaign notifications to all builder tenants.</p>

              <form onSubmit={handleSendPromotion} className="promo-form">
                <textarea
                  className="superadmin-textarea"
                  rows={4}
                  required
                  placeholder="Enter broadcast message text here (e.g. 'Renewal Reminder: RebarOptima subscriptions will renew on...')"
                  value={notificationMsg}
                  onChange={(e) => setNotificationMsg(e.target.value)}
                />
                <button type="submit" className="btn-broadcast">
                  <Mail size={14} /> Send Broadcast Message
                </button>
                {promoSuccess && (
                  <span className="broadcast-success">Broadcast message sent successfully to all tenants!</span>
                )}
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
