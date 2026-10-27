import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  AlertTriangle,
  HardHat,
  Briefcase,
  Phone,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Layers,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

export default function PmManpowerView({ project, tasks, onRefreshTasks }) {
  const [manpower, setManpower] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // New Resource Form
  const [name, setName] = useState('');
  const [role, setRole] = useState('Steel Fixer Lead');
  const [category, setCategory] = useState('LABOUR_GANG');
  const [headcount, setHeadcount] = useState(1);
  const [dailyCapacityHours, setDailyCapacityHours] = useState(8.0);
  const [contactPhone, setContactPhone] = useState('');
  const [skillsStr, setSkillsStr] = useState('');

  // Assign form
  const [assignResourceId, setAssignResourceId] = useState('');
  const [assignHours, setAssignHours] = useState(8.0);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (project?._id) {
      loadManpowerData();
    }
  }, [project?._id]);

  const loadManpowerData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [manRes, confRes] = await Promise.all([
        pmApi.getManpower(project._id),
        pmApi.getManpowerConflicts(project._id)
      ]);
      setManpower(manRes.data || []);
      setConflicts(confRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load manpower data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a resource name.');
      return;
    }

    try {
      setError(null);
      await pmApi.createManpower(project._id, {
        name: name.trim(),
        role,
        category,
        headcount: Number(headcount) || 1,
        dailyCapacityHours: Number(dailyCapacityHours) || 8.0,
        contactPhone: contactPhone.trim(),
        skills: skillsStr ? skillsStr.split(',').map(s => s.trim()).filter(Boolean) : []
      });

      setName('');
      setContactPhone('');
      setSkillsStr('');
      setIsAddModalOpen(false);
      setSuccessMsg('Workforce resource created successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
      loadManpowerData();
    } catch (err) {
      setError(err.message || 'Failed to create resource');
    }
  };

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    try {
      await pmApi.deleteManpower(project._id, resourceId);
      loadManpowerData();
    } catch (err) {
      alert(err.message || 'Failed to delete resource');
    }
  };

  const handleAssignToTask = async (e) => {
    e.preventDefault();
    if (!selectedTask || !assignResourceId) return;

    const resource = manpower.find(m => m._id === assignResourceId);
    if (!resource) return;

    try {
      const currentAllocations = selectedTask.manpowerAllocations || [];
      const updatedAllocations = [
        ...currentAllocations.filter(a => a.resourceId !== assignResourceId),
        {
          resourceId: String(resource._id),
          resourceName: resource.name,
          role: resource.role,
          headcount: resource.headcount,
          plannedDailyHours: Number(assignHours) || 8.0
        }
      ];

      await pmApi.updateTask(selectedTask._id, {
        assignedUserName: resource.name,
        assignedRole: resource.role,
        assignedUserId: String(resource._id),
        manpowerAllocations: updatedAllocations
      });

      setIsAssignModalOpen(false);
      setSelectedTask(null);
      setSuccessMsg(`Assigned ${resource.name} to task successfully!`);
      setTimeout(() => setSuccessMsg(null), 3500);
      if (onRefreshTasks) onRefreshTasks();
      loadManpowerData();
    } catch (err) {
      setError(err.message || 'Failed to assign manpower');
    }
  };

  // Metrics
  const totalHeadcount = manpower.reduce((acc, m) => acc + (m.headcount || 1), 0);
  const staffCount = manpower.filter(m => m.category === 'STAFF').length;
  const gangsCount = manpower.filter(m => m.category === 'LABOUR_GANG').length;
  const subCount = manpower.filter(m => m.category === 'SUBCONTRACTOR').length;

  return (
    <div className="pm-manpower-view">
      {/* HEADER BAR */}
      <div className="pm-view-header">
        <div>
          <h3>Manpower & Workforce Management</h3>
          <p className="pm-view-subtitle">
            Plan workforce requirements, assign site engineers and labour gangs to activities, and resolve scheduling conflicts & over-allocation.
          </p>
        </div>
        <div className="pm-view-header-actions">
          <button className="pm-btn pm-btn-secondary" onClick={loadManpowerData} title="Refresh">
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="pm-btn pm-btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={14} /> Add Resource / Gang
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {successMsg && (
        <div className="pm-success-banner">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="pm-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* OVER-ALLOCATION & CONFLICTS WARNING BANNER */}
      {conflicts.length > 0 && (
        <div className="pm-conflicts-banner">
          <div className="pm-conflicts-header">
            <ShieldAlert size={20} className="pm-text-danger" />
            <div>
              <strong>{conflicts.length} Manpower Over-Allocation & Concurrent Conflicts Detected</strong>
              <p>The following workforce resources are concurrently allocated across overlapping active tasks beyond standard capacity:</p>
            </div>
          </div>

          <div className="pm-conflicts-list">
            {conflicts.map((c, idx) => (
              <div key={idx} className="pm-conflict-card">
                <div className="pm-conflict-top">
                  <div>
                    <span className="pm-conflict-name">{c.resourceName}</span>
                    <span className="pm-badge pm-badge-danger">{c.role}</span>
                    <span className="pm-conflict-dates">Dates: <strong>{c.conflictDate}</strong></span>
                  </div>
                  <div className="pm-conflict-hours">
                    <span className="pm-text-danger font-bold">{c.totalAllocatedHours}h</span> / {c.dailyCapacityHours}h daily capacity
                  </div>
                </div>
                <div className="pm-conflict-tasks">
                  <small>Concurrent Overlapping Tasks:</small>
                  <ul>
                    {c.tasks.map(t => (
                      <li key={t.taskId}>
                        <code>{t.wbsCode}</code> {t.taskName} ({t.allocatedHours}h/day)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* METRIC KPI CARDS */}
      <div className="pm-kpi-grid">
        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-purple">
            <Users size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Total Site Workforce</span>
            <span className="pm-kpi-value">{totalHeadcount} Workers</span>
            <span className="pm-kpi-sub">Across all gangs & staff</span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-blue">
            <Briefcase size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Site Staff & Engineers</span>
            <span className="pm-kpi-value">{staffCount} Engineers</span>
            <span className="pm-kpi-sub">Supervisory & QA leads</span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-emerald">
            <HardHat size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Labour Crews & Gangs</span>
            <span className="pm-kpi-value">{gangsCount} Active Gangs</span>
            <span className="pm-kpi-sub">Rebar, formwork & concrete</span>
          </div>
        </div>

        <div className="pm-kpi-card">
          <div className="pm-kpi-icon-wrap pm-icon-amber">
            <AlertTriangle size={20} />
          </div>
          <div className="pm-kpi-details">
            <span className="pm-kpi-label">Allocation Conflicts</span>
            <span className={`pm-kpi-value ${conflicts.length > 0 ? 'pm-text-danger' : 'pm-text-success'}`}>
              {conflicts.length} Over-Allocations
            </span>
            <span className="pm-kpi-sub">{subCount} Subcontractors active</span>
          </div>
        </div>
      </div>

      {/* WORKFORCE DIRECTORY TABLE */}
      <div className="pm-card">
        <div className="pm-card-header">
          <h4>Workforce & Resource Roster</h4>
        </div>
        <div className="pm-card-body pm-no-pad">
          {isLoading ? (
            <div className="pm-loading-state">
              <RefreshCw size={24} className="pm-spin" />
              <p>Loading workforce and manpower allocations...</p>
            </div>
          ) : manpower.length === 0 ? (
            <div className="pm-empty-state">
              <Users size={32} className="pm-text-muted" />
              <h4>No workforce resources registered</h4>
              <p>Click "Add Resource / Gang" to create site engineers, steel-fixing crews, or contractors.</p>
            </div>
          ) : (
            <div className="pm-table-responsive">
              <table className="pm-table">
                <thead>
                  <tr>
                    <th>Resource / Team Name</th>
                    <th>Category</th>
                    <th>Primary Trade / Role</th>
                    <th>Headcount</th>
                    <th>Daily Capacity</th>
                    <th>Contact Phone</th>
                    <th>Trade Skills</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manpower.map(m => (
                    <tr key={m._id}>
                      <td>
                        <strong className="pm-resource-name">{m.name}</strong>
                      </td>
                      <td>
                        <span className={`pm-badge ${m.category === 'STAFF' ? 'pm-badge-accent' : m.category === 'LABOUR_GANG' ? 'pm-badge-success' : 'pm-badge-subtle'}`}>
                          {m.category === 'STAFF' ? 'Site Staff' : m.category === 'LABOUR_GANG' ? 'Labour Gang' : m.category === 'SUBCONTRACTOR' ? 'Subcontractor' : 'Specialist'}
                        </span>
                      </td>
                      <td>{m.role}</td>
                      <td>
                        <strong>{m.headcount} {m.headcount === 1 ? 'person' : 'workers'}</strong>
                      </td>
                      <td>{m.dailyCapacityHours} hrs/day</td>
                      <td>
                        {m.contactPhone ? (
                          <span className="pm-phone-tag"><Phone size={11} /> {m.contactPhone}</span>
                        ) : (
                          <span className="pm-text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="pm-skills-tags">
                          {(m.skills || []).map((s, i) => (
                            <span key={i} className="pm-skill-badge">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          className="pm-icon-btn pm-text-danger"
                          onClick={() => handleDeleteResource(m._id)}
                          title="Delete resource"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* TASK ALLOCATION MATRIX SECTION */}
      <div className="pm-card" style={{ marginTop: '20px' }}>
        <div className="pm-card-header">
          <h4>Activity Manpower Assignments</h4>
        </div>
        <div className="pm-card-body pm-no-pad">
          <div className="pm-table-responsive">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>WBS</th>
                  <th>Activity Description</th>
                  <th>Duration</th>
                  <th>Forecast Dates</th>
                  <th>Assigned Resource / Gang</th>
                  <th>Required Trade Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 15).map(t => (
                  <tr key={t._id}>
                    <td><code>{t.wbsCode}</code></td>
                    <td><strong>{t.name}</strong></td>
                    <td><span className="pm-badge pm-badge-subtle">{t.durationDays}d</span></td>
                    <td><small>{t.forecastStart || t.plannedStart} → {t.forecastFinish || t.plannedFinish}</small></td>
                    <td>
                      {t.assignedUserName ? (
                        <span className="pm-badge pm-badge-accent">
                          <UserCheck size={11} className="pm-mr-1" />
                          {t.assignedUserName}
                        </span>
                      ) : (
                        <span className="pm-badge pm-badge-warning">Unassigned</span>
                      )}
                    </td>
                    <td>{t.assignedRole || 'Site Engineer'}</td>
                    <td>
                      <button
                        className="pm-btn pm-btn-xs pm-btn-secondary"
                        onClick={() => {
                          setSelectedTask(t);
                          setAssignResourceId(manpower[0]?._id || '');
                          setIsAssignModalOpen(true);
                        }}
                      >
                        Assign / Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE RESOURCE MODAL */}
      {isAddModalOpen && (
        <div className="pm-modal-overlay">
          <div className="pm-modal-content pm-manpower-modal">
            <div className="pm-modal-header">
              <div className="pm-modal-title">
                <Users size={18} className="pm-text-accent" />
                <h3>Add Workforce Resource / Labour Crew</h3>
              </div>
              <button className="pm-modal-close-btn" onClick={() => setIsAddModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateResource}>
              <div className="pm-modal-body">
                <div className="pm-form-group">
                  <label>Resource or Crew Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Er. Vikram Patel or Gang A - Raft Rebar Crew"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="pm-form-row-2">
                  <div className="pm-form-group">
                    <label>Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="STAFF">Site Staff / Engineer</option>
                      <option value="LABOUR_GANG">Labour Gang / Crew</option>
                      <option value="SUBCONTRACTOR">Subcontractor</option>
                      <option value="SPECIALIST">Specialist Consultant</option>
                    </select>
                  </div>

                  <div className="pm-form-group">
                    <label>Primary Role / Trade</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      <option value="Senior Site Engineer">Senior Site Engineer</option>
                      <option value="Planning Lead">Planning Lead</option>
                      <option value="QA/QC Lead Inspector">QA/QC Lead Inspector</option>
                      <option value="Site Supervisor">Site Supervisor</option>
                      <option value="Steel Fixer Lead">Steel Fixer Lead</option>
                      <option value="Formwork Foreman">Formwork Foreman</option>
                      <option value="Excavation Contractor">Excavation Contractor</option>
                      <option value="Concreting Gang">Concreting Gang</option>
                      <option value="MEP Contractor">MEP Contractor</option>
                    </select>
                  </div>
                </div>

                <div className="pm-form-row-2">
                  <div className="pm-form-group">
                    <label>Headcount (Persons in Crew)</label>
                    <input
                      type="number"
                      min="1"
                      value={headcount}
                      onChange={(e) => setHeadcount(e.target.value)}
                    />
                  </div>

                  <div className="pm-form-group">
                    <label>Daily Working Capacity (Hours)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={dailyCapacityHours}
                      onChange={(e) => setDailyCapacityHours(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pm-form-group">
                  <label>Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98XXX XXXXX"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>

                <div className="pm-form-group">
                  <label>Trade Skills (Comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. 32mm Rebar Bending, Slump Test, Staging"
                    value={skillsStr}
                    onChange={(e) => setSkillsStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="pm-modal-footer">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary">
                  Save Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN RESOURCE TO TASK MODAL */}
      {isAssignModalOpen && selectedTask && (
        <div className="pm-modal-overlay">
          <div className="pm-modal-content pm-manpower-modal">
            <div className="pm-modal-header">
              <div className="pm-modal-title">
                <UserCheck size={18} className="pm-text-accent" />
                <h3>Assign Manpower to Activity</h3>
              </div>
              <button className="pm-modal-close-btn" onClick={() => setIsAssignModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAssignToTask}>
              <div className="pm-modal-body">
                <div className="pm-task-assign-summary">
                  <strong>Activity:</strong> <code>{selectedTask.wbsCode}</code> {selectedTask.name}
                  <div className="pm-task-assign-meta">
                    Duration: {selectedTask.durationDays}d | Forecast: {selectedTask.forecastStart || selectedTask.plannedStart} to {selectedTask.forecastFinish || selectedTask.plannedFinish}
                  </div>
                </div>

                <div className="pm-form-group">
                  <label>Select Workforce Resource / Crew *</label>
                  <select
                    value={assignResourceId}
                    onChange={(e) => setAssignResourceId(e.target.value)}
                    required
                  >
                    <option value="">Select Resource...</option>
                    {manpower.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.role} — {m.headcount} pax, {m.dailyCapacityHours}h/d)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pm-form-group">
                  <label>Allocated Daily Hours per Working Day</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="16"
                    value={assignHours}
                    onChange={(e) => setAssignHours(e.target.value)}
                  />
                  <small className="pm-field-hint">Hours per day dedicated by this crew to this specific activity</small>
                </div>
              </div>

              <div className="pm-modal-footer">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={() => setIsAssignModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
