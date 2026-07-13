import React, { useState, useEffect } from 'react';
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
  Scale
} from 'lucide-react';
import './LedgerPage.css';

export default function LedgerPage() {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'orders'
  const [ledger, setLedger] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering & Search states
  const [ledgerFilter, setLedgerFilter] = useState('ALL'); // 'ALL' | 'INWARD' | 'OUTWARD' | 'REMNANT'
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="ledger-page">
      {/* Header */}
      <div className="ledger-header">
        <div>
          <h1 className="ledger-title">Steel Ledger & Order Summary</h1>
          <p className="ledger-subtitle">Track rebar inventory stock movements and audit project orders.</p>
        </div>
        <div className="ledger-tab-buttons">
          <button 
            className={`ledger-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('ledger');
              setSearchQuery('');
            }}
          >
            <BookOpen size={16} /> Steel Ledger
          </button>
          <button 
            className={`ledger-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('orders');
              setSearchQuery('');
            }}
          >
            <ClipboardCheck size={16} /> Order Summary
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ margin: '16px 0' }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="ledger-page loading-state">
          <div className="loader"></div>
          <p>Loading ledger details...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="ledger-metrics-grid">
            <div className="card metric-card inward-card-theme">
              <div className="metric-info">
                <span className="metric-label">Total Inward Stock</span>
                <span className="metric-val">{(totalInwardKg / 1000).toFixed(2)} <span className="metric-unit">Tons</span></span>
                <span className="metric-sub">{totalInwardKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
              </div>
              <div className="metric-icon">
                <PackagePlus size={24} color="#2da44e" />
              </div>
            </div>

            <div className="card metric-card consumed-card-theme">
              <div className="metric-info">
                <span className="metric-label">Total Consumed (Outward)</span>
                <span className="metric-val">{(totalConsumedKg / 1000).toFixed(2)} <span className="metric-unit">Tons</span></span>
                <span className="metric-sub">{totalConsumedKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
              </div>
              <div className="metric-icon">
                <TrendingDown size={24} color="#ea4a4a" />
              </div>
            </div>

            <div className="card metric-card remnant-card-theme">
              <div className="metric-info">
                <span className="metric-label">Reusable Remnants Inwarded</span>
                <span className="metric-val">{(totalRemnantsKg / 1000).toFixed(2)} <span className="metric-unit">Tons</span></span>
                <span className="metric-sub">{totalRemnantsKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
              </div>
              <div className="metric-icon">
                <Sparkles size={24} color="#3ac0e8" />
              </div>
            </div>

            <div className="card metric-card live-card-theme">
              <div className="metric-info">
                <span className="metric-label">Approx. Current Live Weight</span>
                <span className="metric-val">{(netLiveStockKg / 1000).toFixed(2)} <span className="metric-unit">Tons</span></span>
                <span className="metric-sub">{netLiveStockKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
              </div>
              <div className="metric-icon">
                <Scale size={24} color="#a855f7" />
              </div>
            </div>
          </div>

          {/* Filtering Bar */}
          <div className="ledger-controls no-print">
            <div className="search-box-wrapper">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder={activeTab === 'ledger' ? "Search by brand, vendor, batch..." : "Search orders by name..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            
            {activeTab === 'ledger' && (
              <div className="filter-wrapper">
                <Filter size={16} className="filter-icon" />
                <select 
                  value={ledgerFilter} 
                  onChange={(e) => setLedgerFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">All Transactions</option>
                  <option value="INWARD">Purchased Stock (Inwards)</option>
                  <option value="OUTWARD">Stock Consumption (Outwards)</option>
                  <option value="REMNANT">Remnant Savings</option>
                </select>
              </div>
            )}
          </div>

          {/* Tab Content: Steel Ledger */}
          {activeTab === 'ledger' && (
            <div className="card ledger-table-card">
              <h3 className="table-card-heading">Transaction Journal</h3>
              {filteredLedger.length === 0 ? (
                <div className="empty-ledger-state">
                  <p>No transaction records found matching your filters.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="ledger-table-data">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Specification</th>
                        <th>Qty (Bars)</th>
                        <th>Weight (kg)</th>
                        <th>Reference / Description</th>
                        <th>Vendor & Brand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLedger.map((item) => {
                        const date = new Date(item.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        let badgeClass = '';
                        let badgeText = '';
                        if (item.type === 'INWARD') {
                          badgeClass = 'badge-inward';
                          badgeText = 'Inward Purchase';
                        } else if (item.type === 'OUTWARD') {
                          badgeClass = 'badge-outward';
                          badgeText = 'Outward Cut';
                        } else if (item.type === 'REMNANT') {
                          badgeClass = 'badge-remnant';
                          badgeText = 'Remnant In';
                        }

                        return (
                          <tr key={item._id}>
                            <td className="ledger-date-col">
                              <Calendar size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {date}
                            </td>
                            <td>
                              <span className={`transaction-badge ${badgeClass}`}>{badgeText}</span>
                            </td>
                            <td className="font-bold">
                              {item.diameter}mm × {(item.length / 1000).toFixed(1)}m
                            </td>
                            <td className="font-bold">{item.quantity}</td>
                            <td>{Math.round(item.weightInKgs).toLocaleString()} kg</td>
                            <td className="text-secondary">{item.referenceName || '-'}</td>
                            <td>
                              {item.brandName || item.vendorName ? (
                                <div style={{ fontSize: '12px' }}>
                                  <div className="font-bold">{item.brandName || '-'}</div>
                                  <div className="text-secondary" style={{ fontSize: '11px' }}>{item.vendorName || '-'}</div>
                                </div>
                              ) : '-'}
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

          {/* Tab Content: Order Summary */}
          {activeTab === 'orders' && (
            <div className="card ledger-table-card">
              <h3 className="table-card-heading">Committed Optimization Orders</h3>
              {filteredOrders.length === 0 ? (
                <div className="empty-ledger-state">
                  <p>No project orders found.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="ledger-table-data">
                    <thead>
                      <tr>
                        <th>Date Committed</th>
                        <th>Order / Batch Name</th>
                        <th>Parts Demanded</th>
                        <th>Stock Consumed</th>
                        <th>Scrap Generated</th>
                        <th>Remnants Saved</th>
                        <th>Avg. Utilization</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => {
                        const date = new Date(order.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
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
        </>
      )}
    </div>
  );
}
