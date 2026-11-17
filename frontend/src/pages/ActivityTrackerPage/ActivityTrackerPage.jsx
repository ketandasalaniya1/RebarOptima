import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Layers,
  Calendar,
  Clock,
  TrendingUp,
  FileText,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { useActiveProject } from '../../hooks/useActiveProject';
import { activityTrackerApi } from '../../utils/activityTrackerApi';
import ActivitiesSection from './components/ActivitiesSection';
import DailyPlannerSection from './components/DailyPlannerSection';
import DailyUpdatesSection from './components/DailyUpdatesSection';
import ProgressOverviewSection from './components/ProgressOverviewSection';
import ReportsSection from './components/ReportsSection';
import ActivityFormModal from './components/ActivityFormModal';
import DailyUpdateModal from './components/DailyUpdateModal';
import WeightageModal from './components/WeightageModal';
import CorrectionModal from './components/CorrectionModal';
import ActivityDetailDrawer from './components/ActivityDetailDrawer';
import './ActivityTrackerPage.css';

export default function ActivityTrackerPage() {
  const { projectId: activeProjectId, selectedProject, allProjects = [], switchProject } = useActiveProject();

  // Selected State
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || '');
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [floors, setFloors] = useState([]);
  const [assignees, setAssignees] = useState([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState('activities'); // 'activities' | 'planner' | 'daily-updates' | 'overview' | 'reports'

  // Module Data
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [parentForCreate, setParentForCreate] = useState(null);

  const [dailyUpdateModalOpen, setDailyUpdateModalOpen] = useState(false);
  const [activityForUpdate, setActivityForUpdate] = useState(null);

  const [weightageModalOpen, setWeightageModalOpen] = useState(false);
  const [parentForWeightage, setParentForWeightage] = useState(null);
  const [childrenForWeightage, setChildrenForWeightage] = useState([]);

  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [dailyUpdateForCorrection, setDailyUpdateForCorrection] = useState(null);
  const [activityNameForCorrection, setActivityNameForCorrection] = useState('');

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [activityForDetail, setActivityForDetail] = useState(null);
  const [childrenForDetail, setChildrenForDetail] = useState([]);

  // Sync with global active project
  useEffect(() => {
    if (activeProjectId && activeProjectId !== selectedProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Load Blocks when Project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    loadBlocks(selectedProjectId);
    loadAssignees(selectedProjectId);
  }, [selectedProjectId]);

  const loadBlocks = async (projId) => {
    try {
      const res = await activityTrackerApi.listBlocks(projId);
      const bList = Array.isArray(res) ? res : res?.blocks || [];
      setBlocks(bList);
      if (bList.length > 0) {
        setSelectedBlockId((prev) => {
          const exists = bList.some((b) => b._id === prev);
          return exists ? prev : bList[0]._id;
        });
      } else {
        setSelectedBlockId('');
      }
    } catch (err) {
      console.error('Failed to load blocks for project', err);
      setBlocks([]);
      setSelectedBlockId('');
    }
  };

  const loadAssignees = async (projId) => {
    try {
      const res = await activityTrackerApi.getAssignees(projId);
      setAssignees(res?.users || []);
    } catch (err) {
      console.error('Failed to load assignees', err);
      setAssignees([]);
    }
  };

  // Load Floors when Block changes
  useEffect(() => {
    if (!selectedProjectId || !selectedBlockId) {
      setFloors([]);
      return;
    }
    loadFloors(selectedProjectId, selectedBlockId);
  }, [selectedProjectId, selectedBlockId]);

  const loadFloors = async (projId, bId) => {
    try {
      const res = await activityTrackerApi.listFloors(projId, bId);
      setFloors(Array.isArray(res) ? res : res?.floors || []);
    } catch (err) {
      console.error('Failed to load floors', err);
      setFloors([]);
    }
  };

  // Load Activities & Summary for Current Block
  const loadModuleData = useCallback(async () => {
    if (!selectedProjectId || !selectedBlockId) return;
    setLoading(true);
    try {
      const [actRes, sumRes] = await Promise.all([
        activityTrackerApi.getActivities({
          projectId: selectedProjectId,
          blockId: selectedBlockId,
        }),
        activityTrackerApi.getSummary(selectedProjectId, selectedBlockId),
      ]);
      setActivities(actRes?.activities || []);
      setSummary(sumRes || null);
    } catch (err) {
      console.error('Failed to load activity tracker data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProjectId, selectedBlockId]);

  useEffect(() => {
    loadModuleData();
  }, [loadModuleData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadModuleData();
  };

  const handleProjectSelect = (e) => {
    const pId = e.target.value;
    setSelectedProjectId(pId);
    if (switchProject) switchProject(pId);
  };

  // Handlers for Modals & Drawers
  const handleOpenCreate = (parentId = null) => {
    setEditingActivity(null);
    setParentForCreate(parentId);
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (act) => {
    setEditingActivity(act);
    setParentForCreate(act.parentId || null);
    setCreateModalOpen(true);
  };

  const handleOpenDailyUpdate = (act) => {
    setActivityForUpdate(act);
    setDailyUpdateModalOpen(true);
  };

  const handleOpenWeightage = (parentAct, childList) => {
    setParentForWeightage(parentAct);
    setChildrenForWeightage(childList || []);
    setWeightageModalOpen(true);
  };

  const handleOpenCorrection = (dailyUpdate, actName) => {
    setDailyUpdateForCorrection(dailyUpdate);
    setActivityNameForCorrection(actName || '');
    setCorrectionModalOpen(true);
  };

  const handleOpenDetail = (act, childList = []) => {
    setActivityForDetail(act);
    setChildrenForDetail(childList);
    setDetailDrawerOpen(true);
  };

  const handleArchive = async (act) => {
    if (!window.confirm(`Are you sure you want to archive activity "${act.name}"?`)) return;
    try {
      await activityTrackerApi.archiveActivity(act._id);
      loadModuleData();
    } catch (err) {
      alert(`Archive failed: ${err.message}`);
    }
  };

  // Computed KPI metrics
  const totalCount = activities.length;
  const inProgressCount = summary?.statusCounts?.in_progress || activities.filter((a) => a.status === 'in_progress').length;
  const completedCount = summary?.statusCounts?.completed || activities.filter((a) => a.status === 'completed').length;
  const overdueCount =
    summary?.statusCounts?.overdue ||
    activities.filter(
      (a) =>
        a.status !== 'completed' &&
        a.endDate &&
        new Date(a.endDate) < new Date(new Date().toISOString().split('T')[0])
    ).length;
  const overallProgress = summary?.overallProgress || 0;

  return (
    <div className="ro-act-page">
      {/* 1. Header Control Bar */}
      <div className="ro-act-header">
        <div className="ro-act-header-left">
          <div className="ro-act-icon-badge">
            <Activity size={24} />
          </div>
          <div>
            <div className="ro-act-title-row">
              <h1 className="ro-act-title">Activity & Progress Tracker</h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                }}
              >
                CRAVETOBUILD ENGINE
              </span>
            </div>
            <p className="ro-act-subtitle">
              Work Breakdown Structure, Daily Field Logs &amp; Mathematical Period Progress Analytics
            </p>
          </div>
        </div>

        <div className="ro-act-header-actions">
          <button
            type="button"
            className="ro-act-btn ro-act-btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="ro-act-btn ro-act-btn-primary"
            onClick={() => handleOpenCreate()}
            disabled={!selectedBlockId}
          >
            <Plus size={16} />
            <span>New Activity</span>
          </button>
        </div>
      </div>

      {/* 2. Selectors Bar: Project & Block */}
      <div className="ro-act-selectors-bar">
        <div className="ro-act-selectors-group">
          <div className="ro-act-selector-item">
            <span className="ro-act-selector-label">
              <Building2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
              Active Project:
            </span>
            <select
              className="ro-act-select"
              value={selectedProjectId}
              onChange={handleProjectSelect}
            >
              {allProjects.map((p) => (
                <option key={p._id || p.id} value={p._id || p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ro-act-selector-item">
            <span className="ro-act-selector-label">
              <Layers size={13} style={{ display: 'inline', marginRight: '4px' }} />
              Active Block:
            </span>
            <select
              className="ro-act-select"
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              disabled={blocks.length === 0}
            >
              {blocks.length === 0 ? (
                <option value="">No Blocks Found</option>
              ) : (
                blocks.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {selectedBlockId ? `${activities.length} activities configured in this block` : 'Select a block to inspect activities'}
        </div>
      </div>

      {/* 3. KPI Metrics Summary Cards */}
      <div className="ro-act-kpi-grid">
        <div className="ro-act-kpi-card">
          <div className="ro-act-kpi-icon emerald">
            <TrendingUp size={20} />
          </div>
          <div className="ro-act-kpi-info">
            <div className="ro-act-kpi-val">{overallProgress}%</div>
            <div className="ro-act-kpi-label">Overall Block Progress</div>
          </div>
        </div>

        <div className="ro-act-kpi-card">
          <div className="ro-act-kpi-icon blue">
            <ListTodo size={20} />
          </div>
          <div className="ro-act-kpi-info">
            <div className="ro-act-kpi-val">{totalCount}</div>
            <div className="ro-act-kpi-label">Total Activities</div>
          </div>
        </div>

        <div className="ro-act-kpi-card">
          <div className="ro-act-kpi-icon slate">
            <Clock size={20} />
          </div>
          <div className="ro-act-kpi-info">
            <div className="ro-act-kpi-val">{inProgressCount}</div>
            <div className="ro-act-kpi-label">In Progress</div>
          </div>
        </div>

        <div className="ro-act-kpi-card">
          <div className="ro-act-kpi-icon emerald">
            <CheckCircle2 size={20} />
          </div>
          <div className="ro-act-kpi-info">
            <div className="ro-act-kpi-val">{completedCount}</div>
            <div className="ro-act-kpi-label">Completed</div>
          </div>
        </div>

        <div className="ro-act-kpi-card">
          <div className="ro-act-kpi-icon red">
            <AlertTriangle size={20} />
          </div>
          <div className="ro-act-kpi-info">
            <div className="ro-act-kpi-val">{overdueCount}</div>
            <div className="ro-act-kpi-label">Overdue Tasks</div>
          </div>
        </div>
      </div>

      {/* 4. Primary Navigation Tabs */}
      <div className="ro-act-nav-tabs">
        <button
          type="button"
          className={`ro-act-tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          <Layers size={16} />
          <span>WBS Activities</span>
        </button>

        <button
          type="button"
          className={`ro-act-tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          <Calendar size={16} />
          <span>Daily Planner</span>
        </button>

        <button
          type="button"
          className={`ro-act-tab-btn ${activeTab === 'daily-updates' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily-updates')}
        >
          <Clock size={16} />
          <span>Daily Updates Log</span>
        </button>

        <button
          type="button"
          className={`ro-act-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={16} />
          <span>Progress Overview</span>
        </button>

        <button
          type="button"
          className={`ro-act-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <FileText size={16} />
          <span>Reports Engine (DPR/WPR)</span>
        </button>
      </div>

      {/* 5. Tab Content Sections */}
      {!selectedBlockId ? (
        <div className="ro-act-section-card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <Layers size={44} style={{ opacity: 0.35, marginBottom: '12px' }} />
          <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>
            No Block Selected
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', margin: '6px auto 0' }}>
            Please select a block from the project selector bar above to inspect activities and track daily progress.
          </p>
        </div>
      ) : (
        <>
          {activeTab === 'activities' && (
            <ActivitiesSection
              activities={activities}
              floors={floors}
              loading={loading}
              onOpenCreate={handleOpenCreate}
              onOpenEdit={handleOpenEdit}
              onOpenDailyUpdate={handleOpenDailyUpdate}
              onOpenWeightage={handleOpenWeightage}
              onOpenDetail={handleOpenDetail}
              onArchiveActivity={handleArchive}
            />
          )}

          {activeTab === 'planner' && (
            <DailyPlannerSection
              blockId={selectedBlockId}
              onOpenDailyUpdate={handleOpenDailyUpdate}
              onOpenDetail={handleOpenDetail}
            />
          )}

          {activeTab === 'daily-updates' && (
            <DailyUpdatesSection
              blockId={selectedBlockId}
              activities={activities}
              onOpenCorrection={handleOpenCorrection}
              onOpenDailyUpdate={handleOpenDailyUpdate}
            />
          )}

          {activeTab === 'overview' && (
            <ProgressOverviewSection
              blockId={selectedBlockId}
              activities={activities}
              floors={floors}
              summary={summary}
              onOpenDetail={handleOpenDetail}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsSection
              blockId={selectedBlockId}
              floors={floors}
            />
          )}
        </>
      )}

      {/* 6. Modals & Drawers */}
      <ActivityFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        projectId={selectedProjectId}
        blockId={selectedBlockId}
        floors={floors}
        parentActivities={activities.filter((a) => (a.level || 1) === 1)}
        assignees={assignees}
        initialData={editingActivity}
        parentActivityId={parentForCreate}
        onSuccess={loadModuleData}
      />

      <DailyUpdateModal
        isOpen={dailyUpdateModalOpen}
        onClose={() => setDailyUpdateModalOpen(false)}
        activity={activityForUpdate}
        onSuccess={loadModuleData}
      />

      <WeightageModal
        isOpen={weightageModalOpen}
        onClose={() => setWeightageModalOpen(false)}
        parentActivity={parentForWeightage}
        childActivities={childrenForWeightage}
        onSuccess={loadModuleData}
      />

      <CorrectionModal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        dailyUpdate={dailyUpdateForCorrection}
        activityName={activityNameForCorrection}
        onSuccess={loadModuleData}
      />

      <ActivityDetailDrawer
        isOpen={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        activity={activityForDetail}
        childActivities={childrenForDetail}
        onOpenDailyUpdate={handleOpenDailyUpdate}
        onOpenWeightage={handleOpenWeightage}
        onOpenCorrection={handleOpenCorrection}
        onEditActivity={handleOpenEdit}
      />
    </div>
  );
}

