import React from 'react';
import { Building2, Store, Plus, RefreshCw, Layers } from 'lucide-react';
import { Select } from '../../../components/ui';

export default function StickyHeader({
  projects = [],
  selectedProjectId = '',
  onSelectProject,
  stores = [],
  selectedStoreId = '',
  onSelectStore,
  onOpenNewStore,
  onSyncData,
  isLoading = false
}) {
  return (
    <div className="gi-sticky-header">
      <div className="gi-sticky-header-inner">
        {/* Project Selector */}
        <div className="gi-header-project-group">
          <Building2 size={16} className="gi-header-icon" />
          <span className="gi-header-label">Project:</span>
          <Select
            className="gi-project-select"
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            disabled={isLoading || projects.length === 0}
          >
            {projects.length === 0 && <option value="">No Project Available</option>}
            {projects.map((p) => (
              <option key={p.id || p._id} value={p.id || p._id}>
                {p.name} {p.code ? `(${p.code})` : ''}
              </option>
            ))}
          </Select>
        </div>

        {/* Store Selector Pills */}
        <div className="gi-store-pills-bar">
          <span className="gi-store-pills-label">Store:</span>
          <div className="gi-store-pills-scroll">
            <button
              type="button"
              className={`gi-store-pill ${selectedStoreId === '' ? 'active' : ''}`}
              onClick={() => onSelectStore('')}
            >
              <Layers size={14} />
              <span>All Godowns ({stores.length})</span>
            </button>

            {stores.map((s) => {
              const sid = s.id || s._id;
              const isSelected = selectedStoreId === sid;
              return (
                <button
                  key={sid}
                  type="button"
                  className={`gi-store-pill ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectStore(sid)}
                >
                  <Store size={14} />
                  <span>{s.name}</span>
                  {s.isDefault && <span className="gi-store-pill-badge">Main</span>}
                </button>
              );
            })}

            <button
              type="button"
              className="gi-store-pill add-new"
              onClick={onOpenNewStore}
              title="Add new godown / store"
            >
              <Plus size={14} />
              <span>Add Store</span>
            </button>
          </div>
        </div>

        {/* Right Sync Button */}
        <div className="gi-header-actions">
          <button
            type="button"
            className="gi-btn-sync"
            onClick={onSyncData}
            disabled={isLoading}
            title="Refresh live inventory data"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span className="gi-sync-text">{isLoading ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

