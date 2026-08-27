import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import { logout } from '../../store/slices/authSlice';
import { 
  ShieldAlert, Users, CreditCard, Database, Search, CheckCircle, XCircle, 
  LogOut, Clock, Cpu, Building2, Package, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, AlertTriangle, Activity, FileText, RefreshCw,
  Plus, Edit3, Eye, Layers, Trash2
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
  const [selectedDuration, setSelectedDuration] = useState('lifetime');
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showFinalWarning, setShowFinalWarning] = useState(false);
  const [modalError, setModalError] = useState('');
  const [expandedSubHistory, setExpandedSubHistory] = useState(null);
  const [showEditPkgModal, setShowEditPkgModal] = useState(null);
  const [editPkgData, setEditPkgData] = useState(null);

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
      await developerApi.createSubscription({ companyId, packageId: selectedPkgId, status: 'active', duration: selectedDuration });
      setShowAssignSub(null);
      setSelectedPkgId('');
      setSelectedDuration('lifetime');
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

  const handleSavePackage = async () => {
    setActionLoading(`save-pkg-${showEditPkgModal}`);
    try {
      await developerApi.updatePackage(showEditPkgModal, {
        displayName: editPkgData.displayName,
        description: editPkgData.description,
        limits: {
          ...editPkgData.limits,
          maxUsers: editPkgData.maxUsers === '' ? null : parseInt(editPkgData.maxUsers, 10)
        }
      });
      setShowEditPkgModal(null);
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setActionLoading(''); }
  };

  const handlePasswordSubmit = () => {
    setModalError('');
    if (!deletePassword) {
      setModalError('Developer password is required');
      return;
    }
    setShowFinalWarning(true);
  };

  const handleFinalDelete = async () => {
    setActionLoading(`del-${showDeleteModal}`);
    try {
      await developerApi.deleteCompany(showDeleteModal, deletePassword);
      setShowDeleteModal(null);
      setDeletePassword('');
      setShowFinalWarning(false);
      setModalError('');
      await loadData();
    } catch (err) {
      setModalError(err.message);
      setShowFinalWarning(false);
    } finally {
      setActionLoading('');
    }
  };

  const filteredCompanies = companies.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
  const companyToDelete = companies.find(c => c.id === showDeleteModal);
  const companyToDeleteName = companyToDelete ? companyToDelete.name : 'this firm';

  const subGroups = [];
  const compMap = {};
  subscriptions.forEach(s => {
    if (!compMap[s.companyId]) {
      compMap[s.companyId] = { companyId: s.companyId, companyName: s.companyName, active: null, history: [] };
      subGroups.push(compMap[s.companyId]);
    }
    if (s.status === 'active' || s.status === 'trial') {
      compMap[s.companyId].active = s;
    } else {
      compMap[s.companyId].history.push(s);
    }
  });

  subGroups.forEach(g => {
    if (!g.active && g.history.length > 0) {
      g.active = g.history[0];
      g.history = g.history.slice(1);
    }
  });

  const tabs = [
    { id: 'companies', label: 'Builder Firms', icon: <Building2 size={16} /> },
    { id: 'packages', label: 'Packages', icon: <Package size={16} /> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard size={16} /> },
    { id: 'audit', label: 'Audit Logs', icon: <FileText size={16} /> },
  ];

  const MODULE_LABELS = {
    overview: 'Dashboard Analytics', 
    inventory: 'Rebar Inventory', 
    optimizer: 'Cut-Length Optimizer',
    history: 'Historical Batch Tracking', 
    ledger: 'Stock Ledger & Auditing', 
    scrapSales: 'Scrap Management & Sales',
    settings: 'Firm Configuration', 
    users: 'Multi-User Management', 
    roles: 'Custom Roles & Permissions',
    // Future Scope
    attendance: 'Attendance (Future)',
    generalInventory: 'General Materials Inventory (Future)',
    tasks: 'Task Management (Future)',
    sales: 'Sales Department (Future)'
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
                                    <select value={selectedDuration} onChange={e => setSelectedDuration(e.target.value)}>
                                      <option value="1_month">1 Month</option>
                                      <option value="6_months">6 Months</option>
                                      <option value="1_year">1 Year</option>
                                      <option value="2_years">2 Years</option>
                                      <option value="lifetime">Lifetime</option>
                                    </select>
                                    <button className="dev-btn-sm green" onClick={() => handleAssignSubscription(c.id)} disabled={actionLoading === `sub-${c.id}`}>
                                      {actionLoading === `sub-${c.id}` ? '...' : 'Assign'}
                                    </button>
                                    <button className="dev-btn-sm" onClick={() => { setShowAssignSub(null); setSelectedPkgId(''); setSelectedDuration('lifetime'); }}>✕</button>
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
                                  <button className="dev-btn-sm warning" onClick={() => { setShowDeleteModal(c.id); setDeletePassword(''); setShowFinalWarning(false); setModalError(''); }} title="Hard Delete Firm">
                                    <Trash2 size={12} />
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4>{pkg.displayName || pkg.name}</h4>
                            <button className="dev-expand-btn" onClick={() => {
                              setShowEditPkgModal(pkg.id);
                              setEditPkgData({
                                ...pkg,
                                maxUsers: pkg.limits?.maxUsers !== undefined && pkg.limits?.maxUsers !== null ? pkg.limits.maxUsers : ''
                              });
                            }}><Edit3 size={14} /></button>
                          </div>
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
                          <th>End Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subGroups.map(g => (
                          <React.Fragment key={g.companyId}>
                            <tr className={expandedSubHistory === g.companyId ? 'expanded-row' : ''}>
                              <td className="dev-bold">
                                {g.history.length > 0 ? (
                                  <button className="dev-expand-btn" onClick={() => setExpandedSubHistory(expandedSubHistory === g.companyId ? null : g.companyId)} style={{ display: 'inline', marginRight: '8px' }}>
                                    {expandedSubHistory === g.companyId ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                ) : (
                                  <span style={{ display: 'inline-block', width: '22px' }}></span>
                                )}
                                {g.companyName}
                              </td>
                              {g.active ? (
                                <>
                                  <td><span className="dev-plan-badge">{g.active.packageName}</span></td>
                                  <td><span className={`dev-status-badge ${g.active.status}`}>{g.active.status}</span></td>
                                  <td className="dev-muted">{g.active.startDate ? new Date(g.active.startDate).toLocaleDateString() : '—'}</td>
                                  <td className="dev-muted">{g.active.endDate ? new Date(g.active.endDate).toLocaleDateString() : 'Lifetime'}</td>
                                  <td>
                                    <div className="dev-action-group">
                                      {g.active.status === 'active' && (
                                        <button className="dev-btn-sm warning" onClick={async () => {
                                          try { await developerApi.updateSubscription(g.active.id, { status: 'suspended' }); loadData(); } catch (err) { setError(err.message); }
                                        }}>Suspend</button>
                                      )}
                                      {g.active.status === 'suspended' && (
                                        <button className="dev-btn-sm green" onClick={async () => {
                                          try { await developerApi.updateSubscription(g.active.id, { status: 'active' }); loadData(); } catch (err) { setError(err.message); }
                                        }}>Restore</button>
                                      )}
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <td colSpan={5} className="dev-muted">No active subscription</td>
                              )}
                            </tr>
                            {expandedSubHistory === g.companyId && g.history.length > 0 && (
                              <tr>
                                <td colSpan={6} style={{ padding: '0' }}>
                                  <div style={{ padding: '10px 20px 10px 40px', background: 'rgba(0,0,0,0.2)' }}>
                                    <h4 style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', marginTop: 0 }}>Historical Records</h4>
                                    <table className="dev-table" style={{ background: 'transparent' }}>
                                      <tbody>
                                        {g.history.map(hs => (
                                          <tr key={hs.id}>
                                            <td style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '8px 16px', width: '16%' }}><span className="dev-plan-badge">{hs.packageName}</span></td>
                                            <td style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '8px 16px', width: '16%' }}><span className={`dev-status-badge ${hs.status}`}>{hs.status}</span></td>
                                            <td style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '8px 16px', width: '16%' }} className="dev-muted">{hs.startDate ? new Date(hs.startDate).toLocaleDateString() : '—'}</td>
                                            <td style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', padding: '8px 16px' }} className="dev-muted">{hs.endDate ? new Date(hs.endDate).toLocaleDateString() : 'Lifetime'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                        {subGroups.length === 0 && (
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

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="dev-modal-overlay">
            <div className="dev-modal">
              {!showFinalWarning ? (
                <>
                  <div className="dev-modal-header">
                    <h3 className="danger-text"><AlertTriangle size={18} /> Delete Builder Firm</h3>
                    <button className="dev-close-btn" onClick={() => setShowDeleteModal(null)}>×</button>
                  </div>
                  <div className="dev-modal-body">
                    <p>You are about to hard-delete <span className="dev-highlight-name">{companyToDeleteName}</span>. This requires Developer authorization.</p>
                    {modalError && (
                      <div className="dev-alert danger" style={{ marginTop: '15px' }}>
                        <AlertTriangle size={14} style={{ display: 'inline', marginRight: '5px' }} />
                        {modalError}
                      </div>
                    )}
                    <div className="dev-form-group">
                      <label>Developer Password</label>
                      <input 
                        type="password" 
                        value={deletePassword} 
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Enter master password"
                      />
                    </div>
                  </div>
                  <div className="dev-modal-footer">
                    <button className="dev-btn cancel" onClick={() => { setShowDeleteModal(null); setModalError(''); }}>Cancel</button>
                    <button className="dev-btn danger" onClick={handlePasswordSubmit}>Continue</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="dev-modal-header">
                    <h3 className="danger-text"><AlertTriangle size={18} /> FINAL WARNING</h3>
                    <button className="dev-close-btn" onClick={() => { setShowDeleteModal(null); setShowFinalWarning(false); }}>×</button>
                  </div>
                  <div className="dev-modal-body">
                    <div className="dev-alert danger">
                      <strong>WARNING: Data Destruction</strong>
                      <p>This action will permanently wipe ALL data associated with this firm, including inventory, users, roles, and history. It is completely unrecoverable.</p>
                    </div>
                    <p style={{ marginTop: '15px', textAlign: 'center' }}>Are you absolutely sure you want to delete <span className="dev-highlight-name">{companyToDeleteName}</span>?</p>
                  </div>
                  <div className="dev-modal-footer">
                    <button className="dev-btn cancel" onClick={() => setShowFinalWarning(false)}>No, Go Back</button>
                    <button className="dev-btn danger" onClick={handleFinalDelete} disabled={actionLoading === `del-${showDeleteModal}`}>
                      {actionLoading === `del-${showDeleteModal}` ? 'Deleting...' : 'YES, PERMANENTLY DELETE'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Edit Package Modal */}
        {showEditPkgModal && editPkgData && (
          <div className="dev-modal-overlay">
            <div className="dev-modal">
              <div className="dev-modal-header">
                <h3><Edit3 size={16} style={{ display: 'inline', marginRight: '8px' }} /> Edit Package: {editPkgData.displayName || editPkgData.name}</h3>
                <button className="dev-close-btn" onClick={() => setShowEditPkgModal(null)}>×</button>
              </div>
              <div className="dev-modal-body">
                <div className="dev-form-group" style={{ marginTop: '0' }}>
                  <label>Package Name (Display)</label>
                  <input type="text" value={editPkgData.displayName} onChange={e => setEditPkgData({...editPkgData, displayName: e.target.value})} />
                </div>
                <div className="dev-form-group">
                  <label>Description</label>
                  <input type="text" value={editPkgData.description} onChange={e => setEditPkgData({...editPkgData, description: e.target.value})} />
                </div>
                <div className="dev-form-group">
                  <label>Max Users (Leave empty for Unlimited)</label>
                  <input type="number" min="1" placeholder="e.g. 5" value={editPkgData.maxUsers} onChange={e => setEditPkgData({...editPkgData, maxUsers: e.target.value})} />
                </div>
              </div>
              <div className="dev-modal-footer">
                <button className="dev-btn cancel" onClick={() => setShowEditPkgModal(null)}>Cancel</button>
                <button className="dev-btn" style={{ background: '#059669', color: 'white' }} onClick={handleSavePackage} disabled={actionLoading === `save-pkg-${showEditPkgModal}`}>
                  {actionLoading === `save-pkg-${showEditPkgModal}` ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
