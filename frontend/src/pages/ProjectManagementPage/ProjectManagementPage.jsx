import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  BarChart3,
  CalendarCheck,
  ShieldCheck,
  Users,
  Calendar,
  Clock,
  Database,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { pmApi } from '../../utils/pmApi';
import PmDashboardView from './components/PmDashboardView';
import PmProjectsView from './components/PmProjectsView';
import PmTasksView from './components/PmTasksView';
import PmGanttView from './components/PmGanttView';
import PmManpowerView from './components/PmManpowerView';
import PmCalendarView from './components/PmCalendarView';
import PmDailyProgressView from './components/PmDailyProgressView';
import PmQualityView from './components/PmQualityView';
import PmDelayModal from './components/PmDelayModal';
import './ProjectManagementPage.css';

export default function ProjectManagementPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [dprs, setDprs] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [kpis, setKpis] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [error, setError] = useState(null);

  // Initial load
  useEffect(() => {
    loadProjectsAndKpis();
  }, []);

  // When project selection changes, load its child data
  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadProjectsAndKpis = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [projRes, kpiRes] = await Promise.all([
        pmApi.getProjects(),
        pmApi.getKpis()
      ]);

      const projList = projRes?.data || [];
      setProjects(projList);
      setKpis(kpiRes?.data || null);

      if (projList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projList[0]._id);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(err.message || 'Failed to load project management data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectDetails = async (projId) => {
    try {
      const [tasksRes, depsRes, dprRes, inspRes] = await Promise.all([
        pmApi.getTasks(projId),
        pmApi.getDependencies(projId),
        pmApi.getDprs(projId),
        pmApi.getInspections(projId)
      ]);

      setTasks(tasksRes?.data || []);
      setDependencies(depsRes?.data || []);
      setDprs(dprRes?.data || []);
      setInspections(inspRes?.data || []);
    } catch (err) {
      console.error('Error loading project details:', err);
    }
  };

  const handleSeedData = async () => {
    try {
      setIsSeeding(true);
      await pmApi.seedSampleData();
      await loadProjectsAndKpis();
    } catch (err) {
      alert(err.message || 'Failed to seed sample project');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLockBaseline = async () => {
    if (!selectedProjectId) return;
    if (!window.confirm('Are you sure you want to lock the approved baseline? This sets the contractual commitment dates against which delay variances will be measured.')) return;

    try {
      await pmApi.lockBaseline(selectedProjectId);
      await loadProjectsAndKpis();
      await loadProjectDetails(selectedProjectId);
    } catch (err) {
      alert(err.message || 'Failed to lock baseline');
    }
  };

  const currentProject = projects.find(p => p._id === selectedProjectId);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'tasks', label: 'Tasks & WBS', icon: CheckSquare },
    { id: 'gantt', label: 'Gantt Schedule', icon: BarChart3 },
    { id: 'manpower', label: 'Manpower & Workforce', icon: Users },
    { id: 'calendar', label: 'Calendar & Hours', icon: Calendar },
    { id: 'dpr', label: 'Daily Reports (DPR)', icon: CalendarCheck },
    { id: 'quality', label: 'Quality & QA', icon: ShieldCheck }
  ];

  return (
    <div className="pm-workspace">
      {/* TOP HEADER */}
      <div className="pm-header">
        <div className="pm-header-left">
          <div className="pm-title-row">
            <h2>Project & Task Management</h2>
            <span className="pm-badge pm-badge-subtle">Enterprise Construction CPM</span>
          </div>
          <p className="pm-subtitle">
            Critical Path Method (CPM) scheduling, interactive Gantt timelines, daily progress reporting, and delay downstream impact control.
          </p>
        </div>

        <div className="pm-header-right">
          {projects.length > 0 && (
            <div className="pm-project-selector-wrap">
              <label>Active Project:</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                {projects.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="pm-btn pm-btn-ghost"
            title="Refresh Data"
            onClick={() => {
              loadProjectsAndKpis();
              if (selectedProjectId) loadProjectDetails(selectedProjectId);
            }}
          >
            <RefreshCw size={16} />
          </button>

          <button
            className="pm-btn pm-btn-secondary"
            onClick={handleSeedData}
            disabled={isSeeding}
          >
            <Database size={16} />
            <span>{isSeeding ? 'Seeding...' : 'Seed Sample Project'}</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="pm-error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      <div className="pm-tabs-nav">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`pm-tab-btn ${isActive ? 'pm-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN VIEWPORT */}
      <div className="pm-content-viewport">
        {isLoading ? (
          <div className="pm-loading-state">
            <RefreshCw size={28} className="pm-spin" />
            <p>Loading enterprise project schedule & CPM data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <PmDashboardView
                kpis={kpis}
                projects={projects}
                tasks={tasks}
                onSelectProject={(id) => {
                  setSelectedProjectId(id);
                  setActiveTab('gantt');
                }}
                onSeedData={handleSeedData}
                isSeeding={isSeeding}
              />
            )}

            {activeTab === 'projects' && (
              <PmProjectsView
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => {
                  setSelectedProjectId(id);
                  setActiveTab('gantt');
                }}
                onRefreshProjects={loadProjectsAndKpis}
              />
            )}

            {activeTab === 'tasks' && (
              <PmTasksView
                project={currentProject}
                tasks={tasks}
                onRefreshTasks={() => {
                  loadProjectDetails(selectedProjectId);
                  loadProjectsAndKpis();
                }}
                onOpenDelayModal={() => setIsDelayModalOpen(true)}
              />
            )}

            {activeTab === 'gantt' && (
              <PmGanttView
                project={currentProject}
                tasks={tasks}
                dependencies={dependencies}
                onOpenDelayModal={() => setIsDelayModalOpen(true)}
                onLockBaseline={handleLockBaseline}
                onRefreshSchedule={() => {
                  loadProjectsAndKpis();
                  loadProjectDetails(selectedProjectId);
                }}
              />
            )}

            {activeTab === 'manpower' && (
              <PmManpowerView
                project={currentProject}
                tasks={tasks}
                onRefreshTasks={() => loadProjectDetails(selectedProjectId)}
              />
            )}

            {activeTab === 'calendar' && (
              <PmCalendarView
                project={currentProject}
                onRefreshProject={() => {
                  loadProjectsAndKpis();
                  loadProjectDetails(selectedProjectId);
                }}
              />
            )}

            {activeTab === 'dpr' && (
              <PmDailyProgressView
                project={currentProject}
                tasks={tasks}
                dprs={dprs}
                onRefreshDprs={() => {
                  loadProjectDetails(selectedProjectId);
                  loadProjectsAndKpis();
                }}
              />
            )}

            {activeTab === 'quality' && (
              <PmQualityView
                project={currentProject}
                tasks={tasks}
                inspections={inspections}
                onRefreshInspections={() => loadProjectDetails(selectedProjectId)}
              />
            )}
          </>
        )}
      </div>

      {/* DELAY & CPM RESCHEDULING MODAL */}
      <PmDelayModal
        isOpen={isDelayModalOpen}
        onClose={() => setIsDelayModalOpen(false)}
        projectId={selectedProjectId}
        tasks={tasks}
        onDelayApplied={() => {
          loadProjectDetails(selectedProjectId);
          loadProjectsAndKpis();
        }}
      />
    </div>
  );
}
