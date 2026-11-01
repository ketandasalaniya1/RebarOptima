import React, { useState, useEffect } from 'react';
import './DrawingActivityScreen.css';
import StatusPill from '../../../components/Drawings/StatusPill';
import { History, Download, Filter, Search, FileSpreadsheet } from 'lucide-react';

const ACTION_FILTERS = [
  { value: 'all', label: 'All Actions' },
  { value: 'REVISION_UPLOADED', label: 'Revision Uploaded' },
  { value: 'DECISION_APPROVED', label: 'Approved' },
  { value: 'DECISION_REJECTED', label: 'Rejected' },
  { value: 'TRANSMITTAL_ISSUED', label: 'Transmittal Issued' },
  { value: 'TRANSMITTAL_ACKNOWLEDGED', label: 'Transmittal Acknowledged' }
];

export default function DrawingActivityScreen({ activeProject }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');

  const loadActivities = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('accessToken');
      const sp = new URLSearchParams();
      if (selectedAction !== 'all') sp.append('action', selectedAction);
      const qs = sp.toString();

      const resp = await fetch(`/api/drawings/activity${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (resp.ok) {
        const list = await resp.json();
        setActivities(Array.isArray(list) ? list : []);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.warn('Error loading activities:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [selectedAction]);

  const filteredActivities = activities.filter((act) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      act.title?.toLowerCase().includes(term) ||
      act.description?.toLowerCase().includes(term) ||
      act.performedByName?.toLowerCase().includes(term) ||
      act.drawingNumber?.toLowerCase().includes(term)
    );
  });

  const formatDate = (rawDate) => {
    if (!rawDate) return '—';
    try {
      const d = new Date(rawDate);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(rawDate);
    }
  };

  const handleExportCSV = () => {
    if (filteredActivities.length === 0) {
      alert('No activity records to export.');
      return;
    }

    const headers = ['Date & Time', 'Action', 'Performed By', 'Drawing Number', 'Revision', 'Details'];
    const rows = filteredActivities.map((act) => [
      `"${formatDate(act.createdAt)}"`,
      `"${act.action || 'ACTIVITY'}"`,
      `"${act.performedByName || 'User'}"`,
      `"${act.drawingNumber || '—'}"`,
      `"${act.revisionNumber || '—'}"`,
      `"${(act.description || act.title || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `drawing_activity_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="ro-activity-screen">
      {/* Header */}
      <div className="ro-activity-header">
        <div>
          <h1 className="ro-activity-title">Drawing Activity &amp; Audit Logs</h1>
          <p className="ro-activity-subtitle">
            Immutable ISO 19650 audit trail recording drawing uploads, revision transitions, verdicts, and deliveries.
          </p>
        </div>

        <button
          type="button"
          className="ro-btn-export-csv"
          onClick={handleExportCSV}
        >
          <Download size={15} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="ro-tabs-search-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Action Filter:</label>
          <select
            className="ro-filter-select"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="ro-search-box">
          <Search size={16} className="ro-search-icon" />
          <input
            type="text"
            className="ro-search-input"
            placeholder="Search activity records..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="ro-table-container">
        <table className="ro-drawings-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Drawing Number</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Loading activity logs...
                </td>
              </tr>
            ) : filteredActivities.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <FileSpreadsheet size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
                  <div style={{ fontWeight: 600 }}>No Activity Records Found</div>
                </td>
              </tr>
            ) : (
              filteredActivities.map((act) => (
                <tr key={act._id}>
                  <td style={{ color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                    {formatDate(act.createdAt)}
                  </td>
                  <td>
                    <StatusPill status={act.action} />
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                    {act.performedByName || 'Mohit P.'}
                  </td>
                  <td>
                    <span className="ro-drawing-no">{act.drawingNumber || '—'}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary, #475569)' }}>
                    {act.description || act.title}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

