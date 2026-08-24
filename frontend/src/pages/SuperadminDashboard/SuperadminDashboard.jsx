import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import { logout } from '../../store/slices/authSlice';
import { 
  ShieldAlert, Users, CreditCard, Database, Search, CheckCircle, XCircle, 
  LogOut, Clock, Cpu, Building2, Package, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, AlertTriangle, Activity, FileText, RefreshCw,
  Plus, Edit3, Eye, Layers
} from 'lucide-react';
import { developerApi } from '../../utils/api';
import './SuperadminDashboard.css';

export default function SuperadminDashboard() {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('companies');
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [packages, setPackages] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [expandedCompany, setExpandedCompany] = useState(null);
  const [companyDetail, setCompanyDetail] = useState(null);
  const [showAssignSub, setShowAssignSub] = useState(null);
  const [selectedPkgId, setSelectedPkgId] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c, p, sub, logs] = await Promise.all([
        developerApi.getStats().catch(() => null),
        developerApi.getCompanies().catch(() => []),
        developerApi.getPackages().catch(() => []),
        developerApi.getSubscriptions().catch(() => []),
        developerApi.getAuditLogs({ limit: 50 }).catch(() => []),
      ]);
      setStats(s);
      setCompanies(c || []);
      setPackages(p || []);
      setSubscriptions(sub || []);
      setAuditLogs(logs || []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    dispatch(setView('superadmin-login'));
  };

  const handleStatusChange = async (companyId, newStatus) => {
    setActionLoading(companyId);
    try {
      await developerApi.updateCompanyStatus(companyId, newStatus);
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    } catch (err) { setError(err.message); }
    finally { setActionLoading(''); }
  };

  const handleViewCompany = async (companyId) => {
    if (expandedCompany === companyId) {
      setExpandedCompany(null);
      setCompanyDetail(null);
      return;
    }
    try {
      const detail = await developerApi.getCompany(companyId);
      setCompanyDetail(detail);
      setExpandedCompany(companyId);
    } catch (err) { setError(err.message); }
  };

  const handleAssignSubscription = async (companyId) => {
    if (!selectedPkgId) return;
    setActionLoading(`sub-${companyId}`);
    try {
      await developerApi.createSubscription({ companyId, packageId: selectedPkgId, status: 'active' });
      setShowAssignSub(null);
      setSelectedPkgId('');
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setActionLoading(''); }
  };

  const handleUpdatePackageModules = async (pkgId, modules) => {
    try {
      await developerApi.updatePackage(pkgId, { modules });
      setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, modules } : p));
    } catch (err) { setError(err.message); }
  };

  const filteredCompanies = companies.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { id: 'companies', label: 'Builder Firms', icon: <Building2 size={16} /> },
    { id: 'packages', label: 'Packages', icon: <Package size={16} /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard size={16} /> },
    { id: 'audit', label: 'Audit Logs', icon: <FileText size={16} /> },
  ];

  const MODULE_LABELS = {
    overview: 'Overview', inventory: 'Inventory', optimizer: 'Optimizer',
    history: 'Batch History', ledger: 'Ledger', scrapSales: 'Scrap Sales',
    settings: 'Settings', users: 'User Mgmt', roles: 'Roles & Perms'
  };

  return (
    <div className="dev-dashboard">
      {/* Top Nav */}
      <header className="dev-nav">
        <div className="dev-nav-brand">
          <ShieldAlert size={20} color="#dc2626" />
          <span className="dev-brand-txt">RebarOptima Developer Console</span>
          <span className="dev-badge-version">Platform Admin</span>
        </div>
        <div className="dev-nav-actions">
          <button className="dev-nav-btn refresh-btn" onClick={loadData} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="dev-logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Exit Console
          </button>
        </div>
      </header>

      <main className="dev-content">
        {error && <div className="dev-global-error"><AlertTriangle size={14} /> {error} <button onClick={() => setError('')}>×</button></div>}

        {/* Stats Row */}
        <section className="dev-metrics-row">
          <div className="dev-metric-card">
            <div className="dev-metric-info">
              <span className="dev-metric-label">Builder Firms</span>
              <span className="dev-metric-value">{stats?.totalCompanies ?? '—'}</span>
            </div>
            <div className="dev-metric-icon purple"><Building2 size={22} /></div>
          </div>
          <div className="dev-metric-card">
            <div className="dev-metric-info">
              <span className="dev-metric-label">Active Firms</span>
              <span className="dev-metric-value">{stats?.activeCompanies ?? '—'}</span>
            </div>
            <div className="dev-metric-icon green"><CheckCircle size={22} /></div>
          </div>
          <div className="dev-metric-card">
            <div className="dev-metric-info">
              <span className="dev-metric-label">Total Users</span>
              <span className="dev-metric-value">{stats?.totalUsers ?? '—'}</span>
            </div>
            <div className="dev-metric-icon blue"><Users size={22} /></div>
          </div>
          <div className="dev-metric-card">
            <div className="dev-metric-info">
              <span className="dev-metric-label">Active Subscriptions</span>
              <span className="dev-metric-value">{stats?.totalSubscriptions ?? '—'}</span>
            </div>
            <div className="dev-metric-icon orange"><CreditCard size={22} /></div>
          </div>
        </section>

        {/* Tab Bar */}
        <div className="dev-tab-bar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`dev-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="dev-tab-content">
          {loading ? (
            <div className="dev-loading">
              <div className="dev-spinner-lg"></div>
              <p>Loading platform data...</p>
            </div>
          ) : (
            <>
              {/* COMPANIES TAB */}
              {activeTab === 'companies' && (
                <div className="dev-panel">
                  <div className="dev-panel-header">
                    <h3>Registered Builder Firms</h3>
                    <div className="dev-search-bar">
                      <Search size={14} />
                      <input placeholder="Search firms..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                  </div>
                  <div className="dev-table-wrap">
                    <table className="dev-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Firm Name</th>
                          <th>Users</th>
                          <th>Subscription</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompanies.map(c => (
                          <React.Fragment key={c.id}>
                            <tr className={expandedCompany === c.id ? 'expanded-row' : ''}>
                              <td>
                                <button className="dev-expand-btn" onClick={() => handleViewCompany(c.id)}>
                                  {expandedCompany === c.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              </td>
                              <td className="dev-bold">{c.name}</td>
                              <td>{c.userCount}</td>
                              <td>
                                <span className="dev-plan-badge">{c.subscriptionPlan}</span>
                                {showAssignSub === c.id && (
                                  <div className="dev-inline-assign">
                                    <select value={selectedPkgId} onChange={e => setSelectedPkgId(e.target.value)}>
                                      <option value="">Select Package</option>
                                      {packages.filter(p => p.isActive).map(p => (
                                        <option key={p.id} value={p.id}>{p.displayName}</option>
                                      ))}
                                    </select>
                                    <button className="dev-btn-sm green" onClick={() => handleAssignSubscription(c.id)} disabled={actionLoading === `sub-${c.id}`}>
                                      {actionLoading === `sub-${c.id}` ? '...' : 'Assign'}
                                    </button>
                                    <button className="dev-btn-sm" onClick={() => { setShowAssignSub(null); setSelectedPkgId(''); }}>✕</button>
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`dev-status-badge ${c.status}`}>{c.status}</span>
                              </td>
                              <td className="dev-muted">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                              <td>
                                <div className="dev-action-group">
                                  {c.status === 'active' ? (
                                    <button className="dev-btn-sm warning" onClick={() => handleStatusChange(c.id, 'suspended')} disabled={actionLoading === c.id}>
                                      Suspend
                                    </button>
                                  ) : (
                                    <button className="dev-btn-sm green" onClick={() => handleStatusChange(c.id, 'active')} disabled={actionLoading === c.id}>
                                      Activate
                                    </button>
                                  )}
                                  <button className="dev-btn-sm" onClick={() => { setShowAssignSub(showAssignSub === c.id ? null : c.id); setSelectedPkgId(''); }}>
                                    <CreditCard size={12} /> Sub
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedCompany === c.id && companyDetail && (
                              <tr className="dev-detail-row">
                                <td colSpan={7}>
                                  <div className="dev-company-detail">
                                    <div className="dev-detail-section">
                                      <h4>Organization Info</h4>
                                      <div className="dev-detail-grid">
                                        <div><span className="dev-lbl">Name:</span> {companyDetail.company?.name}</div>
                                        <div><span className="dev-lbl">Project:</span> {companyDetail.company?.projectName || '—'}</div>
                                        <div><span className="dev-lbl">Location:</span> {companyDetail.company?.location || '—'}</div>
                                        <div><span className="dev-lbl">Status:</span> {companyDetail.company?.status || 'active'}</div>
                                      </div>
                                    </div>
                                    <div className="dev-detail-section">
                                      <h4>Users ({companyDetail.users?.length || 0})</h4>
                                      <div className="dev-mini-table">
                                        {(companyDetail.users || []).map((u, i) => (
                                          <div key={i} className="dev-mini-row">
                                            <span className="dev-bold">{u.firstName} {u.lastName}</span>
                                            <span className="dev-muted">{u.email}</span>
                                            <span className="dev-plan-badge">{u.role}</span>
                                            <span className={`dev-status-badge ${u.isActive !== false ? 'active' : 'inactive'}`}>
                                              {u.isActive !== false ? 'Active' : 'Inactive'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    {companyDetail.package && (
                                      <div className="dev-detail-section">
                                        <h4>Subscription: {companyDetail.package.displayName}</h4>
                                        <div className="dev-detail-grid">
                                          <div><span className="dev-lbl">Status:</span> {companyDetail.subscription?.status || '—'}</div>
                                          <div><span className="dev-lbl">Max Users:</span> {companyDetail.package.limits?.maxUsers ?? 'Unlimited'}</div>
                                          <div><span className="dev-lbl">Max Projects:</span> {companyDetail.package.limits?.maxProjects ?? 'Unlimited'}</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {filteredCompanies.length === 0 && (
                          <tr><td colSpan={7} className="dev-empty">No builder firms found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PACKAGES TAB */}
              {activeTab === 'packages' && (
                <div className="dev-panel">
                  <div className="dev-panel-header">
                    <h3>Subscription Packages</h3>
                  </div>
                  <div className="dev-packages-grid">
                    {packages.map(pkg => (
                      <div key={pkg.id} className={`dev-package-card ${!pkg.isActive ? 'inactive' : ''}`}>
                        <div className="dev-pkg-header">
                          <h4>{pkg.displayName || pkg.name}</h4>
                          <span className={`dev-status-badge ${pkg.isActive ? 'active' : 'inactive'}`}>
                            {pkg.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="dev-pkg-desc">{pkg.description}</p>
                        <div className="dev-pkg-limits">
                          <div><span className="dev-lbl">Users:</span> {pkg.limits?.maxUsers ?? '∞'}</div>
                          <div><span className="dev-lbl">Projects:</span> {pkg.limits?.maxProjects ?? '∞'}</div>
                          <div><span className="dev-lbl">Storage:</span> {pkg.limits?.maxStorageMB ? `${pkg.limits.maxStorageMB} MB` : '∞'}</div>
                        </div>
                        <div className="dev-pkg-modules">
                          <h5>Modules</h5>
                          <div className="dev-module-toggles">
                            {Object.entries(MODULE_LABELS).map(([key, label]) => {
                              const enabled = pkg.modules?.[key] !== false;
                              return (
                                <button
                                  key={key}
                                  className={`dev-module-toggle ${enabled ? 'on' : 'off'}`}
                                  onClick={() => {
                                    const newModules = { ...pkg.modules, [key]: !enabled };
                                    handleUpdatePackageModules(pkg.id, newModules);
                                  }}
                                >
                                  {enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBSCRIPTIONS TAB */}
              {activeTab === 'subscriptions' && (
                <div className="dev-panel">
                  <div className="dev-panel-header">
                    <h3>Active Subscriptions</h3>
                  </div>
                  <div className="dev-table-wrap">
                    <table className="dev-table">
                      <thead>
                        <tr>
                          <th>Company</th>
                          <th>Package</th>
                          <th>Status</th>
                          <th>Start Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map(s => (
                          <tr key={s.id}>
                            <td className="dev-bold">{s.companyName}</td>
                            <td><span className="dev-plan-badge">{s.packageName}</span></td>
                            <td><span className={`dev-status-badge ${s.status}`}>{s.status}</span></td>
                            <td className="dev-muted">{s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}</td>
                            <td>
                              <div className="dev-action-group">
                                {s.status === 'active' && (
                                  <button className="dev-btn-sm warning" onClick={async () => {
                                    try { await developerApi.updateSubscription(s.id, { status: 'suspended' }); loadData(); } catch (err) { setError(err.message); }
                                  }}>Suspend</button>
                                )}
                                {s.status === 'suspended' && (
                                  <button className="dev-btn-sm green" onClick={async () => {
                                    try { await developerApi.updateSubscription(s.id, { status: 'active' }); loadData(); } catch (err) { setError(err.message); }
                                  }}>Restore</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {subscriptions.length === 0 && (
                          <tr><td colSpan={5} className="dev-empty">No subscriptions found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* AUDIT LOGS TAB */}
              {activeTab === 'audit' && (
                <div className="dev-panel">
                  <div className="dev-panel-header">
                    <h3>Audit Logs</h3>
                    <button className="dev-btn-sm" onClick={async () => {
                      const logs = await developerApi.getAuditLogs({ limit: 100 }).catch(() => []);
                      setAuditLogs(logs);
                    }}><RefreshCw size={12} /> Refresh</button>
                  </div>
                  <div className="dev-table-wrap">
                    <table className="dev-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Resource</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log, i) => (
                          <tr key={i}>
                            <td className="dev-muted">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</td>
                            <td>
                              <span className={`dev-actor-badge ${log.actorType}`}>{log.actorType}</span>
                            </td>
                            <td><span className="dev-action-label">{log.action}</span></td>
                            <td className="dev-muted">{log.resource}</td>
                            <td className="dev-muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {log.newValue ? JSON.stringify(log.newValue).substring(0, 60) : '—'}
                            </td>
                          </tr>
                        ))}
                        {auditLogs.length === 0 && (
                          <tr><td colSpan={5} className="dev-empty">No audit logs yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
