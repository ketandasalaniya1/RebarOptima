import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Building2,
  Plus,
  MapPin,
  Shield,
  UserCheck,
  Edit2,
  Power,
  PowerOff,
  Check,
  AlertCircle,
  Loader2,
  Layers,
} from 'lucide-react';
import { projectsApi, setActiveProjectHeader } from '../../utils/api';
import {
  setProjects,
  setSelectedProject,
  openCreateModal,
  openEditModal,
  openGeofenceModal,
  openAssignPartnerModal,
  updateProjectInList,
} from '../../store/slices/projectSlice';
import { PageHeader, Button, EmptyState, StatusBadge, DataToolbar } from '../../components/ui';
import './ProjectsPage.css';

export default function ProjectsPage() {
  const dispatch = useDispatch();
  const projects = useSelector((state) => state.project.projects || []);
  const selectedProject = useSelector((state) => state.project.selectedProject);
  const user = useSelector((state) => state.auth.user);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [typeFilter, setTypeFilter] = useState('all');

  const roleUpper = (user?.role || '').toUpperCase();
  const isCompanyAdmin = roleUpper === 'ADMIN' || roleUpper === 'OWNER' || user?.accountType === 'developer';

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await projectsApi.getAll();
      dispatch(setProjects(data));
    } catch (err) {
      setError(err.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSelectProject = (project) => {
    setActiveProjectHeader(project?._id || project?.id || null);
    dispatch(setSelectedProject(project));
  };

  const handleToggleStatus = async (project, e) => {
    e.stopPropagation();
    const newStatus = project.status === 'active' ? 'inactive' : 'active';
    const confirmMsg = newStatus === 'inactive'
      ? `Deactivate "${project.name}"? Project records and historical data will be safely preserved.`
      : `Activate "${project.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const projId = project._id || project.id;
      const updated = await projectsApi.updateStatus(projId, newStatus);
      dispatch(updateProjectInList(updated));
    } catch (err) {
      alert(err.message || 'Failed to update project status.');
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (typeFilter !== 'all' && p.projectType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchAddress = (p.address || '').toLowerCase().includes(q);
      const matchPin = (p.pincode || '').includes(q);
      const matchType = (p.projectType || '').toLowerCase().includes(q);
      return matchName || matchAddress || matchPin || matchType;
    }
    return true;
  });

  // Calculate summary metrics
  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const totalGeofences = projects.reduce((sum, p) => sum + (p.geofences?.length || 0), 0);
  const totalPartners = projects.reduce((sum, p) => sum + (p.assignedPartnerAdminIds?.length || 0), 0);

  return (
    <div className="projects-page-container">
      <PageHeader
        title="Project Management"
        subtitle="Organize construction sites, geofences, and Project Partner Admins"
        projectName={selectedProject?.name}
        actions={
          isCompanyAdmin ? (
            <Button variant="primary" onClick={() => dispatch(openCreateModal())}>
              <Plus size={16} />
              Create New Project
            </Button>
          ) : null
        }
      />

      <div className="pp-stats-grid">
        <div className="pp-stat-card">
          <div className="pp-stat-icon-box bg-emerald">
            <Building2 size={20} />
          </div>
          <div className="pp-stat-content">
            <span className="pp-stat-value">{totalProjects}</span>
            <span className="pp-stat-label">Total Projects</span>
          </div>
        </div>

        <div className="pp-stat-card">
          <div className="pp-stat-icon-box bg-blue">
            <Layers size={20} />
          </div>
          <div className="pp-stat-content">
            <span className="pp-stat-value">{activeProjects}</span>
            <span className="pp-stat-label">Active Sites</span>
          </div>
        </div>

        <div className="pp-stat-card">
          <div className="pp-stat-icon-box bg-purple">
            <Shield size={20} />
          </div>
          <div className="pp-stat-content">
            <span className="pp-stat-value">{totalGeofences}</span>
            <span className="pp-stat-label">Geofence Boundaries</span>
          </div>
        </div>

        <div className="pp-stat-card">
          <div className="pp-stat-icon-box bg-amber">
            <UserCheck size={20} />
          </div>
          <div className="pp-stat-content">
            <span className="pp-stat-value">{totalPartners}</span>
            <span className="pp-stat-label">Partner Admin Roles</span>
          </div>
        </div>
      </div>

      <DataToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by project name, address, or PIN code..."
        countLabel={`${filteredProjects.length} of ${projects.length}`}
        filters={
          <>
            <label className="pp-filter-label" htmlFor="pp-status-filter">
              Status
            </label>
            <select
              id="pp-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pp-filter-select"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <label className="pp-filter-label" htmlFor="pp-type-filter">
              Type
            </label>
            <select
              id="pp-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pp-filter-select"
            >
              <option value="all">All Types</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
              <option value="Mixed-use">Mixed-use</option>
              <option value="Villa">Villa</option>
              <option value="Other">Other</option>
            </select>
          </>
        }
      />

      {/* Main Content Area */}
      {loading ? (
        <div className="pp-loading">
          <Loader2 size={32} className="pp-spinner" />
          <span>Loading projects directory...</span>
        </div>
      ) : error ? (
        <div className="pp-alert-box error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button type="button" onClick={fetchProjects} className="pp-retry-btn">
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} />}
          title="No projects configured yet"
          description="Projects organize steel inventory, cutting batches, site geofences, and Partner Admin assignments."
          action={
            isCompanyAdmin ? (
              <Button variant="primary" onClick={() => dispatch(openCreateModal())}>
                <Plus size={16} />
                Create Your First Project
              </Button>
            ) : (
              <p className="pp-empty-note">
                Contact your company administrator to be assigned to active projects.
              </p>
            )
          }
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<AlertCircle size={24} />}
          title="No matching projects"
          description="No projects match the selected search and filter criteria."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        /* Projects Grid */
        <div className="pp-cards-grid">
          {filteredProjects.map((p) => {
            const isSelected = selectedProject && (selectedProject._id || selectedProject.id) === (p._id || p.id);
            const isActive = p.status === 'active';
            const geofenceCount = p.geofences?.length || 0;
            const partnerCount = p.assignedPartnerAdminIds?.length || 0;

            return (
              <div
                key={p._id || p.id}
                className={`pp-card ${isSelected ? 'selected' : ''} ${!isActive ? 'inactive' : ''}`}
              >
                {/* Card Top */}
                <div className="pp-card-header">
                  <div className="pp-card-header-left">
                    <span className="pp-type-tag">{p.projectType || 'Residential'}</span>
                    <StatusBadge status={isActive ? 'active' : 'inactive'} />
                  </div>

                  {isSelected && (
                    <span className="pp-active-context-badge">
                      <Check size={12} />
                      <span>Active Context</span>
                    </span>
                  )}
                </div>

                {/* Card Title & Address */}
                <h3 className="pp-card-name" title={p.name}>
                  {p.name}
                </h3>

                <p className="pp-card-address" title={p.address}>
                  {p.address}
                </p>

                <div className="pp-card-meta">
                  <div className="pp-meta-item">
                    <MapPin size={14} className="text-emerald" />
                    <span>
                      {p.location?.latitude?.toFixed(4)}, {p.location?.longitude?.toFixed(4)}
                    </span>
                  </div>
                  {p.pincode && (
                    <div className="pp-meta-item">
                      <span className="pp-pin-tag">PIN: {p.pincode}</span>
                    </div>
                  )}
                </div>

                {/* Geofence & Partner Stats Summary */}
                <div className="pp-card-stats-row">
                  <div className="pp-card-stat">
                    <Shield size={14} className="text-purple" />
                    <span>
                      <strong>{geofenceCount}</strong> Geofence{geofenceCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="pp-card-stat">
                    <UserCheck size={14} className="text-amber" />
                    <span>
                      <strong>{partnerCount}</strong> Partner Admin{partnerCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pp-card-actions">
                  <button
                    type="button"
                    className={`pp-action-select ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectProject(p)}
                    disabled={isSelected || !isActive}
                  >
                    {isSelected ? 'Currently Selected' : 'Select Project'}
                  </button>

                  <div className="pp-action-icon-buttons">
                    <button
                      type="button"
                      className="pp-icon-btn"
                      onClick={() => dispatch(openGeofenceModal(p))}
                      title="Configure Geofences"
                    >
                      <Shield size={15} />
                    </button>

                    {isCompanyAdmin && (
                      <button
                        type="button"
                        className="pp-icon-btn"
                        onClick={() => dispatch(openAssignPartnerModal(p))}
                        title="Assign Partner Admins"
                      >
                        <UserCheck size={15} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="pp-icon-btn"
                      onClick={() => dispatch(openEditModal(p))}
                      title="Edit Project Details"
                    >
                      <Edit2 size={15} />
                    </button>

                    {isCompanyAdmin && (
                      <button
                        type="button"
                        className={`pp-icon-btn ${isActive ? 'danger' : 'success'}`}
                        onClick={(e) => handleToggleStatus(p, e)}
                        title={isActive ? 'Deactivate Project' : 'Activate Project'}
                      >
                        {isActive ? <PowerOff size={15} /> : <Power size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
