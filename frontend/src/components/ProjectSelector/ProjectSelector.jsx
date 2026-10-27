import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Building2, ChevronDown, Check, Plus, Search, FolderKanban, AlertCircle } from 'lucide-react';
import { setSelectedProject, openCreateModal } from '../../store/slices/projectSlice';
import { setView } from '../../store/slices/routingSlice';
import { setActiveProjectHeader } from '../../utils/api';
import './ProjectSelector.css';

export default function ProjectSelector() {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const projects = useSelector((state) => state.project.projects || []);
  const selectedProject = useSelector((state) => state.project.selectedProject);
  const loading = useSelector((state) => state.project.loading);
  const user = useSelector((state) => state.auth.user);

  const roleUpper = (user?.role || '').toUpperCase().replace(/[\s-]+/g, '_');
  const canCreateProject =
    roleUpper === 'ADMIN' ||
    roleUpper === 'OWNER' ||
    roleUpper === 'COMPANY_ADMIN' ||
    user?.accountType === 'developer';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (project) => {
    // Sync API header immediately (before child useEffects refetch) to avoid stale project data
    setActiveProjectHeader(project?._id || project?.id || null);
    dispatch(setSelectedProject(project));
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateNew = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    dispatch(openCreateModal());
  };

  const handleManageProjects = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    dispatch(setView('projects'));
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.projectType || '').toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q)
    );
  });

  // Empty state: no projects exist
  if (!loading && projects.length === 0) {
    return (
      <div className="project-selector-container">
        <div className="project-selector-empty">
          <div className="ps-empty-header">
            <Building2 size={16} className="ps-empty-icon" />
            <span className="ps-empty-title">No Projects Found</span>
          </div>
          {canCreateProject ? (
            <button
              type="button"
              className="ps-create-btn"
              onClick={() => dispatch(openCreateModal())}
            >
              <Plus size={14} />
              <span>Create Project</span>
            </button>
          ) : (
            <p className="ps-empty-sub">
              No assigned projects. Contact your firm admin.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="project-selector-container" ref={dropdownRef}>
      <button
        type="button"
        className={`project-selector-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="ps-trigger-icon-box">
          <Building2 size={18} className="ps-trigger-icon" />
        </div>
        <div className="ps-trigger-info">
          <span className="ps-label">Active Project</span>
          <span className="ps-name" title={selectedProject?.name || 'Select a project'}>
            {selectedProject ? selectedProject.name : 'Select a project...'}
          </span>
        </div>
        <ChevronDown size={16} className={`ps-chevron ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="project-selector-dropdown" role="listbox">
          {projects.length > 3 && (
            <div className="ps-search-bar">
              <Search size={14} className="ps-search-icon" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="ps-search-input"
              />
            </div>
          )}

          <div className="ps-list">
            {filteredProjects.length === 0 ? (
              <div className="ps-no-matches">
                <AlertCircle size={14} />
                <span>No matching projects</span>
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isSelected = selectedProject && (selectedProject._id || selectedProject.id) === (p._id || p.id);
                return (
                  <button
                    key={p._id || p.id}
                    type="button"
                    className={`ps-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(p)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="ps-item-content">
                      <div className="ps-item-top">
                        <span className="ps-item-name">{p.name}</span>
                        <span className={`ps-item-status ${p.status === 'active' ? 'active' : 'inactive'}`}>
                          {p.status || 'active'}
                        </span>
                      </div>
                      <div className="ps-item-bottom">
                        <span className="ps-item-type">{p.projectType || 'Residential'}</span>
                        {p.pincode && <span className="ps-item-pin">• {p.pincode}</span>}
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="ps-item-check" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="ps-footer">
            {canCreateProject && (
              <button
                type="button"
                className="ps-footer-action ps-action-create"
                onClick={handleCreateNew}
              >
                <Plus size={14} />
                <span>Create New Project</span>
              </button>
            )}
            <button
              type="button"
              className="ps-footer-action ps-action-manage"
              onClick={handleManageProjects}
            >
              <FolderKanban size={14} />
              <span>All Projects</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
