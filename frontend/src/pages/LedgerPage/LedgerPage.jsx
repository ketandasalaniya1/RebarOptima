import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { inventoryApi, batchesApi } from '../../utils/api';
import { 
  TrendingUp, 
  TrendingDown, 
  Sparkles, 
  BookOpen, 
  ClipboardCheck, 
  Calendar, 
  Filter, 
  Search,
  PackagePlus,
  Scale,
  CheckCircle2,
  XCircle,
  Clock,
  Plus
} from 'lucide-react';
import './LedgerPage.css';

export default function LedgerPage() {
  const user = useSelector((state) => state.auth.user);
  
  // Tab states: 'ledger' | 'orders' | 'requests'
  const [activeTab, setActiveTab] = useState('ledger'); 
  const [ledger, setLedger] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering & Search states
  const [ledgerFilter, setLedgerFilter] = useState('ALL'); 
  const [searchQuery, setSearchQuery] = useState('');

  // Order Requests State
  const [requests, setRequests] = useState([
    { id: 1, date: '2026-07-12 10:30', site: 'Sector-62 Site', requester: 'Amit Sharma (Engineer)', diameter: 12, quantity: 150, status: 'Pending', approver: '', approvedQuantity: 150 },
    { id: 2, date: '2026-07-14 09:15', site: 'Noida Site', requester: 'Amit Sharma (Engineer)', diameter: 16, quantity: 80, status: 'Approved', approver: 'Ketan (Owner)', approvedQuantity: 75 }
  ]);

  const [requestForm, setRequestForm] = useState({
    diameter: 12,
    quantity: '',
    site: user?.companyName ? `${user.companyName} Site` : 'Builder Site'
  });

  const [editQtyMap, setEditQtyMap] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError('');
      const [ledgerData, ordersData] = await Promise.all([
        inventoryApi.getLedger(),
        batchesApi.getHistory()
      ]);
      setLedger(ledgerData || []);
      setOrders(ordersData || []);
    } catch (err) {
      setError(err.message || 'Failed to load ledger data.');
    } finally {
      setLoading(false);
    }
  }

  // Calculate Ledger Summary Metrics (in kg)
  const totalInwardKg = ledger
    .filter(t => t.type === 'INWARD')
    .reduce((sum, t) => sum + (t.weightInKgs || 0), 0);
  
  const totalConsumedKg = ledger
    .filter(t => t.type === 'OUTWARD')
    .reduce((sum, t) => sum + (t.weightInKgs || 0), 0);

  const totalRemnantsKg = ledger
    .filter(t => t.type === 'REMNANT')
    .reduce((sum, t) => sum + (t.weightInKgs || 0), 0);

  const netLiveStockKg = Math.max(0, totalInwardKg - totalConsumedKg + totalRemnantsKg);

  // Filtered Ledger List
  const filteredLedger = ledger.filter(item => {
    const matchesFilter = ledgerFilter === 'ALL' || item.type === ledgerFilter;
    const itemSearchStr = `${item.brandName || ''} ${item.vendorName || ''} ${item.referenceName || ''} ${item.diameter}mm`.toLowerCase();
    const matchesSearch = itemSearchStr.includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Filtered Orders List
  const filteredOrders = orders.filter(order => {
    return order.batchName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Engineer Request Submission
  const handleRequestSubmit = (e) => {
    e.preventDefault();
    const qty = parseInt(requestForm.quantity) || 0;
    if (qty <= 0) return;

    const newReq = {
      id: Date.now(),
      date: new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
      site: requestForm.site,
      requester: `${user?.firstName || 'User'} (${user?.role || 'Staff'})`,
      diameter: Number(requestForm.diameter),
      quantity: qty,
      status: 'Pending',
      approver: '',
      approvedQuantity: qty
    };

    setRequests(prev => [newReq, ...prev]);
    setRequestForm(prev => ({ ...prev, quantity: '' }));
    setSuccess('Steel order request submitted successfully!');
    setTimeout(() => setSuccess(''), 1500);
  };

  // Owner/Admin approval & editing
  const handleApprove = (id) => {
    const editVal = editQtyMap[id];
    setRequests(prev => prev.map(req => {
      if (req.id !== id) return req;
      const finalQty = editVal !== undefined ? (parseInt(editVal) || 0) : req.quantity;
      return {
        ...req,
        status: 'Approved',
        approver: `${user?.firstName || 'User'} (${user?.role || 'Admin'})`,
        approvedQuantity: finalQty
      };
    }));
    setSuccess('Order request approved successfully!');
    setTimeout(() => setSuccess(''), 1500);
  };

  const handleReject = (id) => {
    setRequests(prev => prev.map(req => {
      if (req.id !== id) return req;
      return {
        ...req,
        status: 'Rejected',
        approver: `${user?.firstName || 'User'} (${user?.role || 'Admin'})`,
        approvedQuantity: 0
      };
    }));
    setSuccess('Order request rejected.');
    setTimeout(() => setSuccess(''), 1500);
  };

  const handleEditQtyChange = (id, val) => {
    setEditQtyMap(prev => ({ ...prev, [id]: val }));
  };

  return (
    <div className="ledger-page">
      {/* Header */}
      <div className="ledger-header">
        <div>
          <h1 className="ledger-title">Ledger & Procurement</h1>
          <p className="ledger-subtitle">Track material ledger logs, optimization batches, and site purchase requests.</p>
        </div>
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ledger'); setSearchQuery(''); }}
          >
            <BookOpen size={16} /> Audit Ledger
          </button>
          <button 
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab('orders'); setSearchQuery(''); }}
          >
            <ClipboardCheck size={16} /> Batch Orders
          </button>
          <button 
            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => { setActiveTab('requests'); setSearchQuery(''); }}
          >
            <Clock size={16} /> Order Requests
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {activeTab === 'ledger' && (
        <>
          {/* Summary Cards */}
          <div className="ledger-stats-grid">
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Inward Deliveries</span>
                <span className="mini-val">{totalInwardKg.toLocaleString()} <span className="u">kg</span></span>
              </div>
              <div className="mini-icon inward"><TrendingUp size={20} /></div>
            </div>
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Consumed Optimization Weight</span>
                <span className="mini-val text-orange">{totalConsumedKg.toLocaleString()} <span className="u">kg</span></span>
              </div>
              <div className="mini-icon outward"><TrendingDown size={20} /></div>
            </div>
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Recovered Remnants Yield</span>
                <span className="mini-val text-green">{totalRemnantsKg.toLocaleString()} <span className="u">kg</span></span>
              </div>
              <div className="mini-icon remnants"><Sparkles size={20} /></div>
            </div>
            <div className="card stat-mini">
              <div className="stat-info">
                <span className="mini-lbl">Current Warehouse Valuation</span>
                <span className="mini-val">₹{(netLiveStockKg * 60).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="mini-icon stock"><Scale size={20} /></div>
            </div>
          </div>

          {/* Ledger table card */}
          <div className="card table-card">
            <div className="table-header">
              <div className="filters-row">
                <button 
                  className={`filter-badge ${ledgerFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('ALL')}
                >
                  All Logs
                </button>
                <button 
                  className={`filter-badge ${ledgerFilter === 'INWARD' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('INWARD')}
                >
                  Inwards
                </button>
                <button 
                  className={`filter-badge ${ledgerFilter === 'OUTWARD' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('OUTWARD')}
                >
                  Outwards
                </button>
                <button 
                  className={`filter-badge ${ledgerFilter === 'REMNANT' ? 'active' : ''}`}
                  onClick={() => setLedgerFilter('REMNANT')}
                >
                  Remnants
                </button>
              </div>

              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search brand, vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Diameter</th>
                    <th>Length</th>
                    <th>Qty (Bars)</th>
                    <th>Weight</th>
                    <th>Cost (per kg)</th>
                    <th>Reference / Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((item) => (
                    <tr key={item._id}>
                      <td className="ledger-date-col">
                        <Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {new Date(item.createdAt).toLocaleString('en-GB')}
                      </td>
                      <td>
                        <span className={`ledger-type-badge ${item.type.toLowerCase()}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="font-bold">{item.diameter} mm</td>
                      <td>{(item.length / 1000).toFixed(1)} m</td>
                      <td className="font-bold">{item.quantity}</td>
                      <td>{Math.round(item.weightInKgs).toLocaleString()} kg</td>
                      <td>₹{item.costPerKg?.toFixed(2)}</td>
                      <td>
                        <div className="vendor-ref-cell">
                          <span className="font-bold">{item.vendorName || '-'}</span>
                          <span className="text-secondary" style={{ fontSize: '11px' }}>{item.brandName ? `Brand: ${item.brandName}` : ''}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="card table-card">
          <div className="table-header">
            <h3 className="table-card-heading">Processed Batches Summary</h3>
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search batch name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="empty-state">
              <p>No processed optimization batches found matching query.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Commit Date</th>
                    <th>Batch Identifier</th>
                    <th>Required Length</th>
                    <th>Yield Stock</th>
                    <th>Scrap Waste</th>
                    <th>Remnants Saved</th>
                    <th>Avg. Utilization</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const date = new Date(order.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit'
                    });

                    const totalBars = order.layouts?.reduce((sum, l) => sum + Number(l.repetition), 0) || 0;
                    const totalParts = order.layouts?.reduce((sum, l) => {
                      const partsCount = l.parts?.length || (l.stockLength > l.waste ? 1 : 0);
                      return sum + (partsCount * Number(l.repetition));
                    }, 0) || 0;

                    return (
                      <tr key={order._id}>
                        <td className="ledger-date-col">
                          <Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {date}
                        </td>
                        <td className="font-bold">{order.batchName}</td>
                        <td>
                          {(order.summary.totalPartsLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                          <div className="text-secondary" style={{ fontSize: '11px' }}>({totalParts} cuts)</div>
                        </td>
                        <td>
                          {(order.summary.totalUsedStockLength / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m
                          <div className="text-secondary" style={{ fontSize: '11px' }}>({totalBars} bars)</div>
                        </td>
                        <td className="text-danger font-bold">
                          {order.summary.totalScrapKg?.toFixed(2)} kg
                        </td>
                        <td className="text-cyan font-bold">
                          {order.summary.totalRemnantKg?.toFixed(2)} kg
                        </td>
                        <td>
                          <div className="order-util-cell">
                            <span className="font-bold text-green">{order.summary.avgUtilization?.toFixed(2)}%</span>
                            <div className="mini-progress-bar-container">
                              <div className="mini-progress-bar" style={{ width: `${order.summary.avgUtilization}%` }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="order-status-badge badge-completed">Processed</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="requests-portal">
          <div className="requests-grid">
            {/* Left Column: Engineer request creation form */}
            <div className="card request-form-card">
              <h3 className="table-card-heading">Raise Steel Order Request</h3>
              <p className="form-card-subtitle">Required for on-site material procurement requests. Subject to Owner/Admin approvals.</p>

              <form onSubmit={handleRequestSubmit} className="request-form">
                <div className="form-group">
                  <label>Project / Site Location</label>
                  <input
                    type="text"
                    required
                    value={requestForm.site}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, site: e.target.value }))}
                    className="voucher-input"
                  />
                </div>

                <div className="form-group">
                  <label>Diameter of Steel Bar (mm)</label>
                  <select
                    value={requestForm.diameter}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, diameter: Number(e.target.value) }))}
                    className="voucher-select"
                  >
                    {[8, 10, 12, 16, 20, 25, 32].map(d => (
                      <option key={d} value={d}>{d} mm</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Required Quantity (Bars)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 150"
                    value={requestForm.quantity}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="voucher-input"
                  />
                </div>

                <button type="submit" className="submit-inward-btn">
                  Submit Request
                </button>
              </form>
            </div>

            {/* Right Column: Approvals list */}
            <div className="card requests-history-card">
              <h3 className="table-card-heading">Order Requests Ledger</h3>
              <p className="form-card-subtitle">Approval status and procurement authorization history logs.</p>

              <div className="table-responsive">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Requester / Site</th>
                      <th>Dia</th>
                      <th>Requested</th>
                      <th>Approval Rate (Qty)</th>
                      <th>Status</th>
                      <th>Approved By</th>
                      {user?.role !== 'ENGINEER' && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => {
                      const isPending = req.status === 'Pending';
                      const isApproved = req.status === 'Approved';
                      const isOwnerAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

                      return (
                        <tr key={req.id}>
                          <td>{req.date}</td>
                          <td>
                            <div className="font-bold">{req.requester}</div>
                            <div className="text-secondary" style={{ fontSize: '11px' }}>{req.site}</div>
                          </td>
                          <td className="font-bold">{req.diameter} mm</td>
                          <td>{req.quantity}</td>
                          <td>
                            {isPending && isOwnerAdmin ? (
                              <input
                                type="number"
                                className="voucher-input edit-qty-input"
                                style={{ maxWidth: '80px', padding: '4px 8px' }}
                                defaultValue={req.quantity}
                                onChange={(e) => handleEditQtyChange(req.id, e.target.value)}
                              />
                            ) : (
                              <span className="font-bold">{req.approvedQuantity}</span>
                            )}
                          </td>
                          <td>
                            <span className={`order-status-badge badge-${req.status.toLowerCase()}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="text-secondary">{req.approver || '-'}</td>
                          {user?.role !== 'ENGINEER' && (
                            <td>
                              {isPending ? (
                                <div className="action-buttons-flex">
                                  <button 
                                    className="btn-approve" 
                                    onClick={() => handleApprove(req.id)}
                                    title="Approve request"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                  <button 
                                    className="btn-reject" 
                                    onClick={() => handleReject(req.id)}
                                    title="Reject request"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-secondary">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
