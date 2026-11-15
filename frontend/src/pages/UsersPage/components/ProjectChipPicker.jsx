import React, { useState, useMemo } from 'react';
import { Search, X, Check, Building2, Plus } from 'lucide-react';
import './ProjectChipPicker.css';

/**
 * Searchable Project Chip Picker with "All Projects" Quick Toggle
 */
export default function ProjectChipPicker({
  projects = [],
  selectedProjectIds = [],
  onChange,
  activeProjectId,
}) {
  const [search, setSearch] = useState('');

  const allSelected = useMemo(() => {
    if (!projects.length) return false;
    return projects.every((p) => {
      const pid = String(p._id || p.id);
      return selectedProjectIds.includes(pid);
    });
  }, [projects, selectedProjectIds]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [projects, search]);

  const handleToggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      const allIds = projects.map((p) => String(p._id || p.id));
      onChange(allIds);
    }
  };

  const handleToggleProject = (projectId) => {
    const pidStr = String(projectId);
    if (selectedProjectIds.includes(pidStr)) {
      onChange(selectedProjectIds.filter((id) => id !== pidStr));
    } else {
      onChange([...selectedProjectIds, pidStr]);
    }
  };

  const selectedProjects = useMemo(() => {
    return projects.filter((p) => selectedProjectIds.includes(String(p._id || p.id)));
  }, [projects, selectedProjectIds]);

  return (
    <div className="project-chip-picker">
      <div className="pcp-header">
        <label className="pcp-label">
          <span>Assigned Projects</span>
          <span className="pcp-count">
            ({selectedProjectIds.length} of {projects.length} selected)
          </span>
        </label>
        <button
          type="button"
          className="pcp-toggle-all-btn"
          onClick={handleToggleAll}
        >
          {allSelected ? 'Deselect All' : 'Select All Projects'}
        </button>
      </div>

      {/* Selected Pills Area */}
      {selectedProjects.length > 0 && (
        <div className="pcp-selected-tray">
          {selectedProjects.map((proj) => {
            const pid = String(proj._id || proj.id);
            const isActiveProject = activeProjectId && pid === String(activeProjectId);
            return (
              <span
                key={pid}
                className={`pcp-pill selected ${isActiveProject ? 'is-active-proj' : ''}`}
              >
                <Building2 size={12} />
                <span className="pcp-pill-text">{proj.name}</span>
                {isActiveProject && <span className="pcp-active-badge">Active</span>}
                <button
                  type="button"
                  className="pcp-remove-pill-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleProject(pid);
                  }}
                  title={`Remove ${proj.name}`}
                  aria-label={`Remove ${proj.name}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search Input for Projects */}
      {projects.length > 5 && (
        <div className="pcp-search-box">
          <Search size={14} className="pcp-search-icon" />
          <input
            type="text"
            placeholder="Search projects to assign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pcp-search-input"
          />
          {search && (
            <button
              type="button"
              className="pcp-search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Projects Pill Cloud */}
      <div className="pcp-cloud">
        {filteredProjects.map((proj) => {
          const pid = String(proj._id || proj.id);
          const isSelected = selectedProjectIds.includes(pid);
          return (
            <button
              key={pid}
              type="button"
              className={`pcp-cloud-item ${isSelected ? 'active' : ''}`}
              onClick={() => handleToggleProject(pid)}
            >
              <span className="pcp-cloud-checkbox">
                {isSelected ? <Check size={11} strokeWidth={3} /> : <Plus size={11} />}
              </span>
              <span className="pcp-cloud-name">{proj.name}</span>
            </button>
          );
        })}
        {filteredProjects.length === 0 && (
          <div className="pcp-no-results">No projects found matching "{search}"</div>
        )}
      </div>
    </div>
  );
}

