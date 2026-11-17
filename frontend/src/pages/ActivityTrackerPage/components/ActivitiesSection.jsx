import React, { useState } from 'react';
import {
  Search,
  Plus,
  Filter,
  ChevronRight,
  ChevronDown,
  Layers,
  MoreVertical,
  Scale,
  Edit2,
  Archive,
  Eye,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

export default function ActivitiesSection({
  activities = [],
  floors = [],
  loading,
  onOpenCreate,
  onOpenEdit,
  onOpenDailyUpdate,
  onOpenWeightage,
  onOpenDetail,
  onArchiveActivity,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [expandedParents, setExpandedParents] = useState({});

  const toggleExpand = (parentId) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }));
  };

  // Group into Level 1 and Level 2
  const level1Activities = activities.filter((a) => (a.level || 1) === 1);
  const childMap = {};
  activities.forEach((a) => {
    if (a.parentId) {
      if (!childMap[a.parentId]) childMap[a.parentId] = [];
      childMap[a.parentId].push(a);
    }
  });

  // Filter logic
  const matchesFilter = (act) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = act.name?.toLowerCase().includes(q);
      const matchCode = act.code?.toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    if (statusFilter !== 'ALL' && act.status !== statusFilter) {
      return false;
    }
    if (floorFilter !== 'ALL') {
      const fId = act.floorId?._id || act.floorId;
      if (fId !== floorFilter) return false;
    }
    return true;
  };

  const filteredL1 = level1Activities.filter((l1) => {
    if (matchesFilter(l1)) return true;
    const children = childMap[l1._id] || [];
    return children.some(matchesFilter);
  });

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'completed';
      case 'in_progress':
        return 'in_progress';
      case 'on_hold':
        return 'on_hold';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'not_started';
    }
  };

  const getProgressColorClass = (progress) => {
    if (progress >= 100) return 'green';
    if (progress > 30) return 'blue';
    return 'amber';
  };

  return (
    <div className="ro-act-section-card">
      {/* Toolbar */}
      <div className="ro-act-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div className="ro-act-search-wrap">
            <Search size={16} className="ro-act-search-icon" />
            <input
              type="text"
              className="ro-act-search-input"
              placeholder="Search activities by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="ro-act-select"
            style={{ width: 'auto', minWidth: '130px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>

          {floors.length > 0 && (
            <select
              className="ro-act-select"
              style={{ width: 'auto', minWidth: '130px' }}
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              <option value="ALL">All Floors / Levels</option>
              {floors.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          className="ro-act-btn ro-act-btn-primary"
          onClick={() => onOpenCreate()}
        >
          <Plus size={16} /> New Activity
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading activities...
        </div>
      ) : filteredL1.length === 0 ? (
        <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Layers size={40} style={{ opacity: 0.35, marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            No activities match your filters
          </div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>
            Try adjusting your search criteria or create a new Level 1 activity.
          </div>
          <button
            type="button"
            className="ro-act-btn ro-act-btn-primary"
            style={{ marginTop: '16px' }}
            onClick={() => onOpenCreate()}
          >
            <Plus size={16} /> Create Activity
          </button>
        </div>
      ) : (
        <div className="ro-act-table-wrap">
          <table className="ro-act-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>Activity Name & Hierarchy</th>
                <th style={{ width: '12%' }}>Mode</th>
                <th style={{ width: '18%' }}>Progress</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '10%' }}>Weight</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredL1.map((l1) => {
                const children = childMap[l1._id] || [];
                const isExpanded = !!expandedParents[l1._id];
                const hasChildren = children.length > 0;
                const isOverdue =
                  l1.status !== 'completed' &&
                  l1.endDate &&
                  new Date(l1.endDate) < new Date(new Date().toISOString().split('T')[0]);

                return (
                  <React.Fragment key={l1._id}>
                    {/* Level 1 Parent Row */}
                    <tr>
                      <td>
                        <div className="ro-act-name-cell">
                          {hasChildren ? (
                            <button
                              type="button"
                              className="ro-act-btn-ghost"
                              style={{ padding: '2px', marginRight: '2px' }}
                              onClick={() => toggleExpand(l1._id)}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          ) : (
                            <div style={{ width: '20px' }} />
                          )}
                          <span
                            className="ro-act-parent-badge"
                            style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                            }}
                          >
                            L1
                          </span>
                          <div>
                            <span
                              className="ro-act-name-primary"
                              onClick={() => onOpenDetail(l1, children)}
                            >
                              {l1.name}
                            </span>
                            {l1.code && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                                [{l1.code}]
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor:
                              l1.progressMode === 'AUTOMATIC'
                                ? 'rgba(99, 102, 241, 0.12)'
                                : 'rgba(16, 185, 129, 0.12)',
                            color: l1.progressMode === 'AUTOMATIC' ? '#6366f1' : '#10b981',
                          }}
                        >
                          {l1.progressMode === 'AUTOMATIC' ? 'AUTO' : 'MANUAL'}
                        </span>
                      </td>
                      <td>
                        <div className="ro-act-progress-wrap">
                          <div className="ro-act-progress-bar-bg">
                            <div
                              className={`ro-act-progress-bar-fill ${getProgressColorClass(l1.currentProgress || 0)}`}
                              style={{ width: `${Math.min(100, Math.max(0, l1.currentProgress || 0))}%` }}
                            />
                          </div>
                          <span className="ro-act-progress-text">{l1.currentProgress || 0}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`ro-act-status-pill ${getStatusClass(l1.status)}`}>
                            {(l1.status || 'not_started').replace('_', ' ')}
                          </span>
                          {isOverdue && <span className="ro-act-overdue-pill">Overdue</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>—</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          <button
                            type="button"
                            className="ro-act-btn-ghost"
                            title="View Detail"
                            onClick={() => onOpenDetail(l1, children)}
                          >
                            <Eye size={15} />
                          </button>
                          {l1.progressMode === 'AUTOMATIC' && hasChildren ? (
                            <button
                              type="button"
                              className="ro-act-btn-ghost"
                              title="Manage Weightages"
                              onClick={() => onOpenWeightage(l1, children)}
                            >
                              <Scale size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ro-act-btn-ghost"
                              title="Log Daily Update"
                              onClick={() => onOpenDailyUpdate(l1)}
                            >
                              <Calendar size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="ro-act-btn-ghost"
                            title="Add Child Task"
                            onClick={() => onOpenCreate(l1._id)}
                          >
                            <Plus size={15} />
                          </button>
                          <button
                            type="button"
                            className="ro-act-btn-ghost"
                            title="Edit"
                            onClick={() => onOpenEdit(l1)}
                          >
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Level 2 Children Rows */}
                    {isExpanded &&
                      children.map((c) => {
                        const childOverdue =
                          c.status !== 'completed' &&
                          c.endDate &&
                          new Date(c.endDate) < new Date(new Date().toISOString().split('T')[0]);

                        return (
                          <tr
                            key={c._id}
                            style={{
                              backgroundColor: 'var(--main-bg)',
                            }}
                          >
                            <td>
                              <div className="ro-act-name-cell" style={{ paddingLeft: '32px' }}>
                                <span
                                  className="ro-act-parent-badge"
                                  style={{
                                    backgroundColor: 'rgba(2, 132, 199, 0.15)',
                                    color: '#0284c7',
                                  }}
                                >
                                  L2
                                </span>
                                <div>
                                  <span
                                    className="ro-act-name-primary"
                                    onClick={() => onOpenDetail(c, [])}
                                  >
                                    {c.name}
                                  </span>
                                  {c.code && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                                      [{c.code}]
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(148, 163, 184, 0.15)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                MANUAL
                              </span>
                            </td>
                            <td>
                              <div className="ro-act-progress-wrap">
                                <div className="ro-act-progress-bar-bg">
                                  <div
                                    className={`ro-act-progress-bar-fill ${getProgressColorClass(c.currentProgress || 0)}`}
                                    style={{ width: `${Math.min(100, Math.max(0, c.currentProgress || 0))}%` }}
                                  />
                                </div>
                                <span className="ro-act-progress-text">{c.currentProgress || 0}%</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className={`ro-act-status-pill ${getStatusClass(c.status)}`}>
                                  {(c.status || 'not_started').replace('_', ' ')}
                                </span>
                                {childOverdue && <span className="ro-act-overdue-pill">Overdue</span>}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {c.weightage || 0}%
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                <button
                                  type="button"
                                  className="ro-act-btn-ghost"
                                  title="View Detail"
                                  onClick={() => onOpenDetail(c, [])}
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="ro-act-btn-ghost"
                                  title="Log Daily Update"
                                  onClick={() => onOpenDailyUpdate(c)}
                                >
                                  <Calendar size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="ro-act-btn-ghost"
                                  title="Edit"
                                  onClick={() => onOpenEdit(c)}
                                >
                                  <Edit2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

