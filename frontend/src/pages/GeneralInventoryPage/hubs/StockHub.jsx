import React, { useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Layers
} from 'lucide-react';

export default function StockHub({
  materials = [],
  stores = [],
  selectedStoreId = '',
  searchQuery = '',
  setSearchQuery,
  categoryFilter = '',
  setCategoryFilter,
  statusFilter = 'all', // 'all' | 'normal' | 'low' | 'out'
  setStatusFilter,
  categoryOptions = [],
  onOpenInwardWithMaterial,
  onOpenOutwardWithMaterial,
  onOpenNewMaterial,
  onOpenEditMaterial,
  onOpenOpeningBalance,
  onDeactivateMaterial
}) {
  // Filter materials based on search query, category, and status filter
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // Search matching
      const matchesSearch =
        !searchQuery ||
        m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.materialCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.brandOrModel?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category matching
      const matchesCat = !categoryFilter || m.category === categoryFilter;

      // Status matching (from KPI clicks or status filter)
      let matchesStatus = true;
      if (statusFilter === 'normal') {
        matchesStatus = m.status !== 'OUT_OF_STOCK' && m.status !== 'LOW_STOCK';
      } else if (statusFilter === 'low') {
        matchesStatus = m.status === 'LOW_STOCK';
      } else if (statusFilter === 'out') {
        matchesStatus = m.status === 'OUT_OF_STOCK';
      }

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [materials, searchQuery, categoryFilter, statusFilter]);

  return (
    <div className="gi-workspace">
      {/* ── Filter Toolbar ── */}
      <div className="gi-toolbar">
        <div className="gi-toolbar-left">
          <div className="gi-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search materials by name, code, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="gi-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categoryOptions.filter(c => c !== 'Other').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter Pills */}
          <div className="gi-status-pills">
            <button
              type="button"
              className={`gi-status-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter && setStatusFilter('all')}
            >
              All ({materials.length})
            </button>
            <button
              type="button"
              className={`gi-status-pill normal ${statusFilter === 'normal' ? 'active' : ''}`}
              onClick={() => setStatusFilter && setStatusFilter('normal')}
            >
              Healthy
            </button>
            <button
              type="button"
              className={`gi-status-pill low ${statusFilter === 'low' ? 'active' : ''}`}
              onClick={() => setStatusFilter && setStatusFilter('low')}
            >
              Low Stock
            </button>
            <button
              type="button"
              className={`gi-status-pill out ${statusFilter === 'out' ? 'active' : ''}`}
              onClick={() => setStatusFilter && setStatusFilter('out')}
            >
              Out of Stock
            </button>
          </div>
        </div>

        <div className="gi-toolbar-right">
          <button
            type="button"
            className="gi-btn-primary"
            onClick={onOpenNewMaterial}
          >
            <Plus size={16} />
            <span>Register Material</span>
          </button>
        </div>
      </div>

      {/* ── Materials Table / Cards ── */}
      <div className="gi-table-card">
        <div className="gi-table-wrapper">
          <table className="gi-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Category</th>
                <th>Specification / Brand</th>
                <th>Current Balance</th>
                <th>Threshold</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="gi-empty-state">
                      <Package size={40} />
                      <h3>No Materials Found</h3>
                      <p>
                        {searchQuery || categoryFilter || statusFilter !== 'all'
                          ? 'No materials match the filter criteria.'
                          : 'Create materials to start tracking stock across project stores.'}
                      </p>
                      <button
                        type="button"
                        className="gi-btn-primary"
                        onClick={onOpenNewMaterial}
                      >
                        <Plus size={16} />
                        <span>Register First Material</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((m) => (
                  <tr key={m.id || m._id} style={{ opacity: m.isActive === false ? 0.65 : 1 }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      {m.materialCode && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>
                          Code: {m.materialCode}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        {m.category}
                      </span>
                      {m.subcategory && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>
                          {m.subcategory}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{m.sizeOrSpec || 'Standard'}</div>
                      {m.brandOrModel && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-label)' }}>
                          Brand: {m.brandOrModel}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                        {m.currentStock}{' '}
                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-label)' }}>
                          {m.uom}
                        </span>
                      </div>
                    </td>
                    <td>
                      {m.lowStockThreshold} {m.uom}
                    </td>
                    <td>
                      {m.status === 'OUT_OF_STOCK' ? (
                        <span className="gi-badge out">Out of Stock</span>
                      ) : m.status === 'LOW_STOCK' ? (
                        <span className="gi-badge low">Low Stock</span>
                      ) : (
                        <span className="gi-badge normal">Healthy</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'nowrap' }}>
                        <button
                          type="button"
                          className="gi-btn-sm"
                          title="Receive Inward delivery of this item"
                          onClick={() => onOpenInwardWithMaterial && onOpenInwardWithMaterial(m)}
                        >
                          <ArrowDownLeft size={13} />
                          <span>Inward</span>
                        </button>

                        <button
                          type="button"
                          className="gi-btn-sm"
                          title="Issue this item to site team"
                          onClick={() => onOpenOutwardWithMaterial && onOpenOutwardWithMaterial(m)}
                        >
                          <ArrowUpRight size={13} />
                          <span>Issue</span>
                        </button>

                        <button
                          type="button"
                          className="gi-btn-sm"
                          title="Set Opening Balance"
                          onClick={() => onOpenOpeningBalance && onOpenOpeningBalance(m)}
                        >
                          <Layers size={13} />
                          <span>Balance</span>
                        </button>

                        <button
                          type="button"
                          className="gi-btn-sm"
                          title="Edit Material"
                          onClick={() => onOpenEditMaterial && onOpenEditMaterial(m)}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          className="gi-btn-sm"
                          title={m.isActive !== false ? 'Deactivate' : 'Reactivate'}
                          onClick={() => onDeactivateMaterial && onDeactivateMaterial(m)}
                          style={{ color: m.isActive !== false ? '#ef4444' : '#10b981' }}
                        >
                          {m.isActive !== false ? <Trash2 size={13} /> : <CheckCircle2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

