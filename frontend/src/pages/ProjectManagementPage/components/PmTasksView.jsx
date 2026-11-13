import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Clock,
  ShieldAlert,
  Flag,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Layers,
  FolderKanban,
  CheckSquare,
  AlertCircle,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-react';
import { pmApi } from '../../../utils/pmApi';

/**
 * Checks if a task is a Main Activity (Parent Phase / Work Package).
 * Criteria:
 * 1. Has no parentId (null/undefined)
 * 2. WBS code is top-level (e.g. "1.0", "2.0", "3.0" or no dot "1", "2")
 * 3. OR other tasks in the project point to it via parentId
 */
export function isMainActivity(task, allTasks = []) {
  if (!task) return false;
  if (task.parentId) return false;

  const wbs = (task.wbsCode || '').trim();
  const parts = wbs.split('.').filter(Boolean);
  if (parts.length <= 1) return true;
  if (parts.length === 2 && parts[1] === '0') return true;

  if (task._id && allTasks.some(t => String(t.parentId) === String(task._id))) {
    return true;
  }
  return false;
}

/**
 * Resolves the parent task ID for a sub-activity.
 */
export function getParentIdForSubTask(task, allTasks = []) {
  if (!task) return null;
  if (task.parentId) return String(task.parentId);

  const wbs = (task.wbsCode || '').trim();
  const parts = wbs.split('.').filter(Boolean);
  if (parts.length > 1) {
    const parentWbs = `${parts[0]}.0`;
    const altWbs = parts[0];
    const parent = allTasks.find(t => isMainActivity(t, allTasks) && (t.wbsCode === parentWbs || t.wbsCode === altWbs));
    if (parent) return String(parent._id);
  }
  return null;
}

export default function PmTasksView({ project, tasks = [], onRefreshTasks, onOpenDelayModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'MAIN_ONLY' | 'SUB_ONLY' | 'CRITICAL_ONLY'
  const [collapsedParents, setCollapsedParents] = useState(new Set());

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activityCategory, setActivityCategory] = useState('SUB'); // 'MAIN' | 'SUB'
  const [selectedParentId, setSelectedParentId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    wbsCode: '',
    durationDays: 5,
    plannedQty: 100,
    unit: 'm3',
    plannedCost: 500000,
    assignedRole: 'Site Engineer',
    priority: 'MEDIUM',
    isMilestone: false,
    requiresInspection: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute list of Main Activities for parent dropdowns and grouping
  const mainActivities = useMemo(() => {
    return tasks.filter(t => isMainActivity(t, tasks));
  }, [tasks]);

  // Compute Next WBS Code Helpers
  const getNextMainWbs = () => {
    const mainCodes = mainActivities.map(t => {
      const num = parseFloat(t.wbsCode);
      return isNaN(num) ? 0 : Math.floor(num);
    });
    const maxMajor = mainCodes.length > 0 ? Math.max(...mainCodes, 0) : 0;
    return `${maxMajor + 1}.0`;
  };

  const getNextSubWbs = (parentId) => {
    const parent = tasks.find(t => String(t._id) === String(parentId)) || mainActivities[0];
    if (!parent) return '1.1';
    const parentMajor = (parent.wbsCode || '1.0').split('.')[0] || '1';

    const subCodes = tasks
      .filter(t => !isMainActivity(t, tasks) && getParentIdForSubTask(t, tasks) === String(parent._id))
      .map(t => {
        const parts = (t.wbsCode || '').split('.');
        const minor = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        return isNaN(minor) ? 0 : minor;
      });
    const maxMinor = subCodes.length > 0 ? Math.max(...subCodes, 0) : 0;
    return `${parentMajor}.${maxMinor + 1}`;
  };

  // Open modal pre-configured for sub-task or main package
  const openCreateModal = (category = 'SUB', parentId = null) => {
    setActivityCategory(category);
    if (category === 'MAIN') {
      setSelectedParentId('');
      setFormData({
        name: '',
        wbsCode: getNextMainWbs(),
        durationDays: 15,
        plannedQty: 100,
        unit: '%',
        plannedCost: 2000000,
        assignedRole: 'Site Engineer',
        priority: 'MEDIUM',
        isMilestone: false,
        requiresInspection: false
      });
    } else {
      const pid = parentId || (mainActivities[0]?._id ? String(mainActivities[0]._id) : '');
      setSelectedParentId(pid);
      setFormData({
        name: '',
        wbsCode: getNextSubWbs(pid),
        durationDays: 5,
        plannedQty: 100,
        unit: 'm3',
        plannedCost: 500000,
        assignedRole: 'Civil Contractor',
        priority: 'MEDIUM',
        isMilestone: false,
        requiresInspection: false
      });
    }
    setIsCreateOpen(true);
  };

  // Handle Category Toggle in Modal
  const handleCategoryChange = (newCat) => {
    setActivityCategory(newCat);
    if (newCat === 'MAIN') {
      setSelectedParentId('');
      setFormData(prev => ({
        ...prev,
        wbsCode: getNextMainWbs(),
        unit: '%'
      }));
    } else {
      const pid = selectedParentId || (mainActivities[0]?._id ? String(mainActivities[0]._id) : '');
      setSelectedParentId(pid);
      setFormData(prev => ({
        ...prev,
        wbsCode: getNextSubWbs(pid),
        unit: prev.unit === '%' ? 'm3' : prev.unit
      }));
    }
  };

  // Handle Parent Selection change in Modal
  const handleParentSelectChange = (newParentId) => {
    setSelectedParentId(newParentId);
    setFormData(prev => ({
      ...prev,
      wbsCode: getNextSubWbs(newParentId)
    }));
  };

  // Toggle Collapse of a Main Activity section
  const toggleCollapse = (mainId) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(mainId)) {
        next.delete(mainId);
      } else {
        next.add(mainId);
      }
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedParents(new Set(mainActivities.map(m => String(m._id))));
  };

  const expandAll = () => {
    setCollapsedParents(new Set());
  };

  // High-level KPI summary calculations
  const statsSummary = useMemo(() => {
    const total = tasks.length;
    const mains = mainActivities.length;
    const subs = total - mains;
    const criticals = tasks.filter(t => t.isCritical).length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const avgProgress = total > 0 ? Math.round(tasks.reduce((sum, t) => sum + (Number(t.progressPercentage) || 0), 0) / total) : 0;
    return { total, mains, subs, criticals, completed, avgProgress };
  }, [tasks, mainActivities]);

  // Hierarchical Organization
  const hierarchicalGroups = useMemo(() => {
    const result = [];
    const assignedSubIds = new Set();

    mainActivities.forEach(mainTask => {
      const mainId = String(mainTask._id);
      const childTasks = tasks.filter(t => {
        if (isMainActivity(t, tasks)) return false;
        return getParentIdForSubTask(t, tasks) === mainId;
      });

      childTasks.forEach(c => assignedSubIds.add(String(c._id)));

      result.push({
        main: mainTask,
        children: childTasks
      });
    });

    // Capture any orphaned sub-tasks that didn't match a main activity
    const orphanTasks = tasks.filter(t => !isMainActivity(t, tasks) && !assignedSubIds.has(String(t._id)));

    return { groups: result, orphans: orphanTasks };
  }, [tasks, mainActivities]);

  // Filter Tasks based on Search, Status, and Type
  const isTaskMatchingFilter = (t) => {
    const matchesSearch =
      !searchTerm.trim() ||
      (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.wbsCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.assignedRole || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

    let matchesType = true;
    if (typeFilter === 'MAIN_ONLY') {
      matchesType = isMainActivity(t, tasks);
    } else if (typeFilter === 'SUB_ONLY') {
      matchesType = !isMainActivity(t, tasks);
    } else if (typeFilter === 'CRITICAL_ONLY') {
      matchesType = !!t.isCritical;
    }

    return matchesSearch && matchesStatus && matchesType;
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      await pmApi.createTask(project._id, {
        name: formData.name.trim(),
        wbsCode: formData.wbsCode.trim() || (activityCategory === 'MAIN' ? getNextMainWbs() : getNextSubWbs(selectedParentId)),
        parentId: activityCategory === 'SUB' && selectedParentId ? selectedParentId : null,
        durationDays: Number(formData.durationDays) || 1,
        plannedQty: Number(formData.plannedQty) || 0,
        unit: formData.unit,
        plannedCost: Number(formData.plannedCost) || 0,
        assignedRole: formData.assignedRole,
        priority: formData.priority,
        isMilestone: !!formData.isMilestone,
        requiresInspection: !!formData.requiresInspection
      });

      setIsCreateOpen(false);
      onRefreshTasks();
    } catch (err) {
      alert(err.message || 'Failed to create activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await pmApi.updateTask(taskId, { status: newStatus });
      onRefreshTasks();
    } catch (err) {
      alert(err.message || 'Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId, taskName) => {
    if (!window.confirm(`Are you sure you want to delete "${taskName}"? Any dependent linkages will also be removed.`)) return;
    try {
      await pmApi.deleteTask(taskId);
      onRefreshTasks();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  };

  return (
    <div className="pm-tasks-container">
      {/* 1. TOP EXECUTIVE CPM SUMMARY RIBBON */}
      <div className="pm-tasks-stats-ribbon">
        <div className="pm-stat-chip pm-stat-chip-emerald">
          <Layers size={16} />
          <span>Main Work Packages:</span>
          <strong>{statsSummary.mains}</strong>
        </div>

        <div className="pm-stat-chip pm-stat-chip-indigo">
          <CheckSquare size={16} />
          <span>Execution Sub-Tasks:</span>
          <strong>{statsSummary.subs}</strong>
        </div>

        <div className="pm-stat-chip">
          <span>Total WBS Items:</span>
          <strong>{statsSummary.total}</strong>
        </div>

        {statsSummary.criticals > 0 && (
          <div className="pm-stat-chip pm-stat-chip-danger">
            <span className="pm-pulse-dot" />
            <span>Critical Path Items:</span>
            <strong>{statsSummary.criticals}</strong>
          </div>
        )}

        <div className="pm-stat-chip">
          <span>Progress:</span>
          <strong>{statsSummary.avgProgress}%</strong>
          <span className="pm-text-sm pm-text-label">({statsSummary.completed}/{statsSummary.total} Done)</span>
        </div>
      </div>

      {/* 2. TOOLBAR & CONTROLS */}
      <div className="pm-tasks-toolbar">
        <div className="pm-search-wrap">
          <Search size={16} className="pm-search-icon" />
          <input
            type="text"
            placeholder="Search by activity name, WBS, role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="pm-toolbar-actions">
          {/* Hierarchy Type Filter */}
          <select
            className="pm-toolbar-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            title="Filter by Activity Hierarchy"
          >
            <option value="ALL">All Hierarchy Levels</option>
            <option value="MAIN_ONLY">Main Packages Only (1.0, 2.0...)</option>
            <option value="SUB_ONLY">Sub-Activities Only (1.1, 1.2...)</option>
            <option value="CRITICAL_ONLY">Critical Path Items Only</option>
          </select>

          {/* Status Filter */}
          <select
            className="pm-toolbar-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="UNDER_INSPECTION">Under Inspection</option>
            <option value="COMPLETED">Completed</option>
          </select>

          {/* Expand / Collapse All Toggle */}
          {collapsedParents.size > 0 ? (
            <button
              className="pm-btn-icon-text"
              onClick={expandAll}
              title="Expand All Main Activities"
            >
              <ChevronsUpDown size={15} />
              <span>Expand All</span>
            </button>
          ) : (
            <button
              className="pm-btn-icon-text"
              onClick={collapseAll}
              title="Collapse All Sub-Activities"
            >
              <ChevronsDownUp size={15} />
              <span>Collapse All</span>
            </button>
          )}

          {/* Add Activity Button */}
          <button
            className="pm-btn pm-btn-primary"
            onClick={() => openCreateModal('SUB')}
          >
            <Plus size={16} />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* 3. WBS TASKS HIERARCHY TABLE */}
      <div className="pm-card pm-table-card">
        <div className="pm-table-scroll">
          <table className="pm-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>WBS</th>
                <th>Activity Description & Hierarchy</th>
                <th style={{ width: '160px' }}>Assigned Role</th>
                <th style={{ width: '70px' }}>Duration</th>
                <th style={{ width: '190px' }}>Forecast Dates</th>
                <th style={{ width: '120px' }}>Float / Critical</th>
                <th style={{ width: '140px' }}>Quantities</th>
                <th style={{ width: '130px' }}>Progress</th>
                <th style={{ width: '150px' }}>Status</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hierarchicalGroups.groups.length === 0 && hierarchicalGroups.orphans.length === 0 ? (
                <tr>
                  <td colSpan={10} className="pm-empty-td">
                    No project activities found. Click &quot;Add Activity&quot; or &quot;Seed Sample Project&quot; to begin.
                  </td>
                </tr>
              ) : (
                hierarchicalGroups.groups.map(({ main, children }) => {
                  const mainId = String(main._id);
                  const isCollapsed = collapsedParents.has(mainId);
                  const mainMatches = isTaskMatchingFilter(main);

                  // Filter matching children
                  const filteredChildren = children.filter(c => isTaskMatchingFilter(c));
                  const showMainRow = mainMatches || filteredChildren.length > 0;

                  if (!showMainRow) return null;

                  const completedChildren = children.filter(c => c.status === 'COMPLETED').length;

                  return (
                    <React.Fragment key={mainId}>
                      {/* ═══ MAIN ACTIVITY ROW (Phase / Work Package) ═══ */}
                      <tr className="pm-tr-main-activity">
                        {/* WBS Pill */}
                        <td>
                          <span className="pm-wbs-badge-main" title="Main Work Package">
                            <Layers size={11} />
                            {main.wbsCode}
                          </span>
                        </td>

                        {/* Title & Hierarchy Controls */}
                        <td>
                          <div className="pm-main-name-cell">
                            <button
                              type="button"
                              className="pm-chevron-toggle"
                              onClick={() => toggleCollapse(mainId)}
                              title={isCollapsed ? 'Click to expand sub-tasks' : 'Click to collapse sub-tasks'}
                            >
                              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>

                            <span className="pm-main-phase-tag">Main Activity</span>

                            <span className="pm-main-activity-title">{main.name}</span>

                            <span className="pm-subtasks-count-pill" title="Sub-activities under this package">
                              {children.length} sub-tasks ({completedChildren} done)
                            </span>
                          </div>
                        </td>

                        {/* Role */}
                        <td>
                          <span className="pm-font-medium text-slate-200">
                            {main.assignedRole || 'Site Engineer'}
                          </span>
                        </td>

                        {/* Duration */}
                        <td>
                          <strong className="text-emerald-400">{main.durationDays}d</strong>
                        </td>

                        {/* Dates */}
                        <td>
                          <span className="pm-date-small">
                            {main.forecastStart} → {main.forecastFinish}
                          </span>
                        </td>

                        {/* Float / Critical */}
                        <td>
                          {main.isCritical ? (
                            <span className="pm-badge pm-badge-danger">
                              <span className="pm-pulse-dot" /> 0d (Critical)
                            </span>
                          ) : (
                            <span className="pm-badge pm-badge-subtle">
                              +{main.totalFloatDays ?? 0}d
                            </span>
                          )}
                        </td>

                        {/* Quantities */}
                        <td>
                          {main.plannedQty ? `${main.acceptedQty || 0} / ${main.plannedQty} ${main.unit}` : '—'}
                        </td>

                        {/* Progress */}
                        <td>
                          <div className="pm-progress-inline">
                            <span>{main.progressPercentage || 0}%</span>
                            <div className="pm-progress-track">
                              <div
                                className="pm-progress-bar"
                                style={{ width: `${Math.min(100, main.progressPercentage || 0)}%`, background: '#10b981' }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <select
                            className="pm-status-select"
                            value={main.status}
                            onChange={(e) => handleStatusChange(main._id, e.target.value)}
                          >
                            <option value="NOT_STARTED">Not Started</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="BLOCKED">Blocked</option>
                            <option value="UNDER_INSPECTION">Under Inspection</option>
                            <option value="COMPLETED">Completed</option>
                          </select>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="pm-actions-cell" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="pm-btn-add-subtask"
                              title={`Add Sub-Activity under ${main.name}`}
                              onClick={() => openCreateModal('SUB', main._id)}
                            >
                              <Plus size={12} />
                              <span>Sub-task</span>
                            </button>

                            <button
                              type="button"
                              className="pm-icon-btn pm-btn-del"
                              title="Delete Main Activity"
                              onClick={() => handleDeleteTask(main._id, main.name)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ═══ SUB-ACTIVITIES ROWS (Under this Main Activity) ═══ */}
                      {!isCollapsed &&
                        filteredChildren.map(child => (
                          <tr
                            key={child._id}
                            className={`pm-tr-sub-activity ${child.isCritical ? 'pm-tr-critical' : ''}`}
                          >
                            {/* WBS Pill */}
                            <td>
                              <span className="pm-wbs-badge-sub">{child.wbsCode}</span>
                            </td>

                            {/* Sub Activity Title & Indentation Tree */}
                            <td>
                              <div className="pm-sub-name-cell">
                                <CornerDownRight size={14} className="pm-tree-branch" />

                                <span className="pm-subtask-tag">Sub-Activity</span>

                                {child.isMilestone && (
                                  <span className="pm-tag-milestone" title="Key Project Milestone">
                                    <Flag size={12} /> Milestone
                                  </span>
                                )}

                                <span className="pm-sub-activity-title">{child.name}</span>

                                {child.requiresInspection && (
                                  <span className="pm-tag-qa" title="Mandatory QA Inspection Gate">
                                    <ShieldAlert size={12} /> QA Gate
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Assigned Role */}
                            <td>
                              <span className="pm-text-sm text-slate-300">
                                {child.assignedRole || 'Trade Contractor'}
                              </span>
                            </td>

                            {/* Duration */}
                            <td>
                              <span>{child.durationDays}d</span>
                            </td>

                            {/* Forecast Dates */}
                            <td>
                              <span className="pm-date-small">
                                {child.forecastStart} → {child.forecastFinish}
                              </span>
                            </td>

                            {/* Float */}
                            <td>
                              {child.isCritical ? (
                                <span className="pm-badge pm-badge-danger">
                                  <span className="pm-pulse-dot" /> 0d (Critical)
                                </span>
                              ) : (
                                <span className="pm-badge pm-badge-subtle">
                                  +{child.totalFloatDays ?? 0}d
                                </span>
                              )}
                            </td>

                            {/* Quantities */}
                            <td>
                              {child.plannedQty ? (
                                <span className="pm-text-sm">
                                  {child.acceptedQty || 0} / {child.plannedQty} {child.unit}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>

                            {/* Progress */}
                            <td>
                              <div className="pm-progress-inline">
                                <span>{child.progressPercentage || 0}%</span>
                                <div className="pm-progress-track">
                                  <div
                                    className="pm-progress-bar"
                                    style={{ width: `${Math.min(100, child.progressPercentage || 0)}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td>
                              <select
                                className="pm-status-select"
                                value={child.status}
                                onChange={(e) => handleStatusChange(child._id, e.target.value)}
                              >
                                <option value="NOT_STARTED">Not Started</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="BLOCKED">Blocked</option>
                                <option value="UNDER_INSPECTION">Under Inspection</option>
                                <option value="COMPLETED">Completed</option>
                              </select>
                            </td>

                            {/* Actions */}
                            <td>
                              <div className="pm-actions-cell" style={{ justifyContent: 'center' }}>
                                {onOpenDelayModal && (
                                  <button
                                    type="button"
                                    className="pm-icon-btn"
                                    title="Log Delay Event"
                                    onClick={() => onOpenDelayModal(child)}
                                  >
                                    <Clock size={14} />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="pm-icon-btn pm-btn-del"
                                  title="Delete Activity"
                                  onClick={() => handleDeleteTask(child._id, child.name)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              )}

              {/* Orphaned Tasks (if any exist without a defined parent) */}
              {hierarchicalGroups.orphans.filter(isTaskMatchingFilter).map(orphan => (
                <tr key={orphan._id} className="pm-tr-sub-activity">
                  <td>
                    <span className="pm-wbs-badge-sub">{orphan.wbsCode}</span>
                  </td>
                  <td>
                    <div className="pm-sub-name-cell" style={{ paddingLeft: '8px' }}>
                      <span className="pm-subtask-tag">Activity</span>
                      <span className="pm-sub-activity-title">{orphan.name}</span>
                    </div>
                  </td>
                  <td>{orphan.assignedRole || 'Site Engineer'}</td>
                  <td>{orphan.durationDays}d</td>
                  <td><span className="pm-date-small">{orphan.forecastStart} → {orphan.forecastFinish}</span></td>
                  <td>
                    {orphan.isCritical ? (
                      <span className="pm-badge pm-badge-danger">0d</span>
                    ) : (
                      <span className="pm-badge pm-badge-subtle">+{orphan.totalFloatDays ?? 0}d</span>
                    )}
                  </td>
                  <td>{orphan.plannedQty ? `${orphan.acceptedQty || 0} / ${orphan.plannedQty} ${orphan.unit}` : '—'}</td>
                  <td>
                    <div className="pm-progress-inline">
                      <span>{orphan.progressPercentage || 0}%</span>
                      <div className="pm-progress-track">
                        <div className="pm-progress-bar" style={{ width: `${Math.min(100, orphan.progressPercentage || 0)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="pm-status-select"
                      value={orphan.status}
                      onChange={(e) => handleStatusChange(orphan._id, e.target.value)}
                    >
                      <option value="NOT_STARTED">Not Started</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="UNDER_INSPECTION">Under Inspection</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </td>
                  <td>
                    <div className="pm-actions-cell" style={{ justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="pm-icon-btn pm-btn-del"
                        onClick={() => handleDeleteTask(orphan._id, orphan.name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. CREATE ACTIVITY / TASK MODAL */}
      {isCreateOpen && (
        <div className="pm-modal-overlay">
          <div className="pm-modal-content">
            <div className="pm-modal-header">
              <div className="pm-modal-title">
                <Plus size={18} className="text-emerald-400" />
                <h4>Create New Activity</h4>
              </div>
              <button type="button" className="pm-icon-btn" onClick={() => setIsCreateOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="pm-modal-body pm-form-grid">
                {/* Activity Level Selector: Main Package vs Sub-Activity */}
                <div className="pm-form-group pm-col-span-2">
                  <label>Activity Hierarchy Level</label>
                  <div className="pm-segmented-control">
                    <button
                      type="button"
                      className={`pm-segmented-btn ${activityCategory === 'MAIN' ? 'active' : ''}`}
                      onClick={() => handleCategoryChange('MAIN')}
                    >
                      <Layers size={15} />
                      <span>Main Activity (Phase / Work Package)</span>
                    </button>

                    <button
                      type="button"
                      className={`pm-segmented-btn ${activityCategory === 'SUB' ? 'active' : ''}`}
                      onClick={() => handleCategoryChange('SUB')}
                    >
                      <CornerDownRight size={15} />
                      <span>Sub-Activity (Work Execution Item)</span>
                    </button>
                  </div>
                </div>

                {/* If Sub-Activity, Select Parent Work Package */}
                {activityCategory === 'SUB' && (
                  <div className="pm-form-group pm-col-span-2">
                    <label>Parent Work Package (Main Activity) *</label>
                    <select
                      value={selectedParentId}
                      onChange={(e) => handleParentSelectChange(e.target.value)}
                      required
                    >
                      {mainActivities.length === 0 ? (
                        <option value="">No Main Activity exists yet (Create one first)</option>
                      ) : (
                        mainActivities.map(m => (
                          <option key={m._id} value={m._id}>
                            [{m.wbsCode}] {m.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Activity Name */}
                <div className="pm-form-group pm-col-span-2">
                  <label>
                    {activityCategory === 'MAIN' ? 'Work Package / Phase Name *' : 'Sub-Activity Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      activityCategory === 'MAIN'
                        ? 'e.g. 4.0 Terrace Floor & Parapet Wall'
                        : 'e.g. Raft Bottom Rebar Mat Fixing'
                    }
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* WBS Code */}
                <div className="pm-form-group">
                  <label>
                    WBS Code {activityCategory === 'MAIN' ? '(e.g. 1.0, 2.0)' : '(e.g. 1.3)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.wbsCode}
                    onChange={(e) => setFormData({ ...formData, wbsCode: e.target.value })}
                  />
                </div>

                {/* Working Duration */}
                <div className="pm-form-group">
                  <label>Working Duration (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                  />
                </div>

                {/* Planned Quantity */}
                <div className="pm-form-group">
                  <label>Planned Quantity</label>
                  <input
                    type="number"
                    value={formData.plannedQty}
                    onChange={(e) => setFormData({ ...formData, plannedQty: e.target.value })}
                  />
                </div>

                {/* Unit */}
                <div className="pm-form-group">
                  <label>Unit of Measure</label>
                  <input
                    type="text"
                    placeholder="MT, m3, m2, %, etc."
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>

                {/* Assigned Role */}
                <div className="pm-form-group">
                  <label>Assigned Trade / Role</label>
                  <input
                    type="text"
                    value={formData.assignedRole}
                    onChange={(e) => setFormData({ ...formData, assignedRole: e.target.value })}
                  />
                </div>

                {/* Estimated Cost */}
                <div className="pm-form-group">
                  <label>Estimated Cost (INR)</label>
                  <input
                    type="number"
                    value={formData.plannedCost}
                    onChange={(e) => setFormData({ ...formData, plannedCost: e.target.value })}
                  />
                </div>

                {/* Toggles (only for sub-activities or milestones) */}
                <div className="pm-form-group pm-col-span-2 pm-flex-checkboxes">
                  <label className="pm-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isMilestone}
                      onChange={(e) => setFormData({ ...formData, isMilestone: e.target.checked })}
                    />
                    <span>Is Key Milestone (0 duration event)</span>
                  </label>

                  <label className="pm-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requiresInspection}
                      onChange={(e) => setFormData({ ...formData, requiresInspection: e.target.checked })}
                    />
                    <span>Requires Mandatory QA Gate before acceptance</span>
                  </label>
                </div>
              </div>

              <div className="pm-modal-footer">
                <button
                  type="button"
                  className="pm-btn pm-btn-ghost"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="pm-btn pm-btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Creating...'
                    : activityCategory === 'MAIN'
                    ? 'Create Main Work Package'
                    : 'Create Sub-Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
