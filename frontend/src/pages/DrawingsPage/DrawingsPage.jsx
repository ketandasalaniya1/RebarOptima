import React, { useState, useEffect } from 'react';
import './DrawingsPage.css';
import { drawingsApi } from '../../utils/drawingsApi';
import { useActiveProject } from '../../hooks/useActiveProject';
import { PageHeader, Button } from '../../components/ui';

import {
  LayoutDashboard,
  FolderKanban,
  Layers,
  FileText,
  Clock,
  Send,
  History,
  Users,
  Settings,
  Search,
  Plus,
  RefreshCw,
  Folder
} from 'lucide-react';

import DrawingsDashboard from './components/DrawingsDashboard';
import InternalProjectsView from './components/InternalProjectsView';
import DisciplineLibraryView from './components/DisciplineLibraryView';
import DrawingRegisterView from './components/DrawingRegisterView';
import DrawingDetailsView from './components/DrawingDetailsView';
import RevisionHistoryView from './components/RevisionHistoryView';
import ReviewApprovalQueueView from './components/ReviewApprovalQueueView';
import DocumentTransmittalsView from './components/DocumentTransmittalsView';
import ActivityLogView from './components/ActivityLogView';
import ModulePermissionsView from './components/ModulePermissionsView';
import ModuleSettingsView from './components/ModuleSettingsView';

export default function DrawingsPage() {
  const { projectId: activeProjectId, projectEpoch, selectedProject } = useActiveProject();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Core Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [transmittals, setTransmittals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);

  // Selected Item States
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [selectedDrawingDetail, setSelectedDrawingDetail] = useState(null);
  const [preselectedTransmittalIds, setPreselectedTransmittalIds] = useState([]);

  // Filter & Search States — locked to active org project (not company-wide client filter)
  const [projectFilter, setProjectFilter] = useState('all');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeProjectId) setProjectFilter(String(activeProjectId));
  }, [activeProjectId, projectEpoch]);

  // Initial Data Load
  const loadAllData = async () => {
    setLoading(true);
    try {
      const pid = activeProjectId || undefined;
      const [dash, prjs, discs, dws, trans, acts, usrs, stts] = await Promise.all([
        drawingsApi.getDashboard().catch(() => null),
        drawingsApi.getProjects().catch(() => []),
        drawingsApi.getDisciplines().catch(() => []),
        drawingsApi.getDrawings(pid ? { projectId: pid } : undefined).catch(() => ({ drawings: [] })),
        drawingsApi.getTransmittals().catch(() => []),
        drawingsApi.getActivityLog().catch(() => []),
        drawingsApi.getUsers().catch(() => []),
        drawingsApi.getSettings().catch(() => null)
      ]);

      setDashboardData(dash);
      setProjects(prjs);
      setDisciplines(discs);
      setDrawings(dws.drawings || []);
      setTransmittals(trans);
      setActivities(acts);
      setUsers(usrs);
      setSettings(stts);

      // Default select first drawing if available
      if (dws.drawings && dws.drawings.length > 0 && !selectedDrawing) {
        setSelectedDrawing(dws.drawings[0]);
      }
    } catch (err) {
      console.error('Error loading drawings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, projectEpoch]);

  // Filtered Drawings
  const filteredDrawings = (drawings || []).filter((d) => {
    if (projectFilter !== 'all' && String(d.projectId) !== String(projectFilter)) return false;
    if (disciplineFilter !== 'all' && String(d.disciplineId) !== String(disciplineFilter) && d.disciplineCode !== disciplineFilter) return false;
    if (statusFilter !== 'all' && d.currentStatus !== statusFilter) return false;
    if (searchTerm.trim()) {
      const t = searchTerm.trim().toLowerCase();
      const matchNo = d.drawingNumber?.toLowerCase().includes(t);
      const matchTitle = d.title?.toLowerCase().includes(t);
      const matchPrj = d.projectName?.toLowerCase().includes(t);
      const matchDisc = d.disciplineName?.toLowerCase().includes(t);
      if (!matchNo && !matchTitle && !matchPrj && !matchDisc) return false;
    }
    return true;
  });

  // Drill down to drawing detail
  const handleSelectDrawing = async (dw) => {
    setSelectedDrawing(dw);
    try {
      const detail = await drawingsApi.getDrawingDetail(dw._id);
      setSelectedDrawingDetail(detail);
      setActiveTab('details');
    } catch (err) {
      alert('Error loading drawing details: ' + err.message);
    }
  };

  // Drill down to project drawings
  const handleSelectProject = (prj) => {
    setProjectFilter(prj._id);
    setActiveTab('register');
  };

  // Drill down to discipline drawings
  const handleSelectDiscipline = (disc) => {
    setDisciplineFilter(disc._id || disc.code);
    setActiveTab('register');
  };

  // Open transmittal modal with preselected drawings
  const handleOpenTransmittalWithDrawings = (drawingIds) => {
    setPreselectedTransmittalIds(drawingIds);
    setActiveTab('transmittals');
  };

  // Creation Handlers
  const handleCreateProject = async (data) => {
    const res = await drawingsApi.createProject(data);
    await loadAllData();
    return res;
  };

  const handleCreateDiscipline = async (data) => {
    const res = await drawingsApi.createDiscipline(data);
    await loadAllData();
    return res;
  };

  const handleCreateDrawing = async (data) => {
    const res = await drawingsApi.createDrawing(data);
    await loadAllData();
    return res;
  };

  const handleUploadRevision = async (drawingId, data) => {
    const res = await drawingsApi.uploadRevision(drawingId, data);
    await loadAllData();
    if (selectedDrawing?._id === drawingId) {
      const detail = await drawingsApi.getDrawingDetail(drawingId);
      setSelectedDrawingDetail(detail);
    }
    return res;
  };

  const handleRecordDecision = async (drawingId, revisionId, data) => {
    const res = await drawingsApi.recordDecision(drawingId, revisionId, data);
    await loadAllData();
    if (selectedDrawing?._id === drawingId) {
      const detail = await drawingsApi.getDrawingDetail(drawingId);
      setSelectedDrawingDetail(detail);
    }
    return res;
  };

  const handleCreateTransmittal = async (data) => {
    const res = await drawingsApi.createTransmittal(data);
    await loadAllData();
    setPreselectedTransmittalIds([]);
    return res;
  };

  const handleCreateUser = async (data) => {
    const res = await drawingsApi.createUser(data);
    await loadAllData();
    return res;
  };

  const handleSaveSettings = async (data) => {
    const res = await drawingsApi.updateSettings(data);
    setSettings(res);
    return res;
  };

  const handleSeedWorkspace = async () => {
    const res = await drawingsApi.seedWorkspace();
    await loadAllData();
    return res;
  };

  return (
    <div className="drawings-module-root">
      <PageHeader
        title="Drawing & File Management"
        subtitle="ISO 19650 document control, registers, revisions, and transmittals."
        projectName={selectedProject?.name}
        actions={
          <>
            <div className="drawings-header-search">
              <Search size={15} className="search-icon" aria-hidden />
              <input
                type="search"
                placeholder="Search drawings, projects, files…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search drawings"
              />
            </div>
            <Button variant="secondary" onClick={loadAllData} title="Refresh Workspace">
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              Refresh
            </Button>
          </>
        }
      />

      {/* ── Sub-Navigation Tabs Bar (11 Required Screens) ───────────────── */}
      <div className="drawings-nav-tabs-bar">
        <button
          className={`drawings-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={15} /> Dashboard
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FolderKanban size={15} /> Projects
          <span className="drawings-tab-badge">{projects?.length || 4}</span>
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'disciplines' ? 'active' : ''}`}
          onClick={() => setActiveTab('disciplines')}
        >
          <Layers size={15} /> Disciplines
          <span className="drawings-tab-badge">{disciplines?.length || 7}</span>
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          <FileText size={15} /> Drawing Register
          <span className="drawings-tab-badge">{drawings?.length || 0}</span>
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          <Search size={15} /> Drawing Details
          {selectedDrawing && (
            <span className="drawings-tab-badge" style={{ background: 'rgba(56, 189, 248, 0.25)', color: '#38bdf8' }}>
              {selectedDrawing.drawingNumber}
            </span>
          )}
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'revisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('revisions')}
        >
          <History size={15} /> Revision History
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <Clock size={15} /> Review &amp; Approval
          <span className="drawings-tab-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
            {dashboardData?.pendingApproval || 8}
          </span>
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'transmittals' ? 'active' : ''}`}
          onClick={() => setActiveTab('transmittals')}
        >
          <Send size={15} /> Transmittals
          <span className="drawings-tab-badge">{transmittals?.length || 1}</span>
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <History size={15} /> Activity Log
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={15} /> Users &amp; Permissions
        </button>

        <button
          className={`drawings-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={15} /> Settings
        </button>
      </div>

      {/* ── Main Viewport Content ───────────────────────────────────────── */}
      <div className="drawings-viewport">
        {activeTab === 'dashboard' && (
          <DrawingsDashboard
            dashboardData={dashboardData}
            onNavigateTab={setActiveTab}
            onOpenNewProject={() => setActiveTab('projects')}
            onOpenNewDrawing={() => setActiveTab('register')}
          />
        )}

        {activeTab === 'projects' && (
          <InternalProjectsView
            projects={projects}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
          />
        )}

        {activeTab === 'disciplines' && (
          <DisciplineLibraryView
            disciplines={disciplines}
            onSelectDiscipline={handleSelectDiscipline}
            onCreateDiscipline={handleCreateDiscipline}
          />
        )}

        {activeTab === 'register' && (
          <DrawingRegisterView
            drawings={filteredDrawings}
            projects={projects}
            disciplines={disciplines}
            selectedProjectId={projectFilter}
            selectedDisciplineId={disciplineFilter}
            selectedStatus={statusFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onProjectFilterChange={setProjectFilter}
            onDisciplineFilterChange={setDisciplineFilter}
            onStatusFilterChange={setStatusFilter}
            onSelectDrawing={handleSelectDrawing}
            onCreateDrawing={handleCreateDrawing}
            onOpenTransmittalWithDrawings={handleOpenTransmittalWithDrawings}
          />
        )}

        {activeTab === 'details' && (
          <DrawingDetailsView
            drawingData={selectedDrawingDetail || { drawing: selectedDrawing, currentRevision: null, revisions: [], reviews: [], approvals: [], transmittals: [], activities: [] }}
            onBack={() => setActiveTab('register')}
            onUploadRevision={handleUploadRevision}
            onRecordDecision={handleRecordDecision}
            onIssueTransmittal={handleOpenTransmittalWithDrawings}
          />
        )}

        {activeTab === 'revisions' && (
          <RevisionHistoryView
            selectedDrawing={selectedDrawing}
            revisions={selectedDrawingDetail?.revisions}
            onOpenUploadModal={() => {
              if (selectedDrawing) {
                handleSelectDrawing(selectedDrawing);
              } else {
                setActiveTab('register');
              }
            }}
            onSelectRevision={() => {}}
          />
        )}

        {activeTab === 'queue' && (
          <ReviewApprovalQueueView
            selectedDrawing={selectedDrawing}
            onRecordDecision={handleRecordDecision}
          />
        )}

        {activeTab === 'transmittals' && (
          <DocumentTransmittalsView
            transmittals={transmittals}
            projects={projects}
            availableDrawings={drawings}
            preselectedDrawingIds={preselectedTransmittalIds}
            onCreateTransmittal={handleCreateTransmittal}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityLogView activities={activities} />
        )}

        {activeTab === 'users' && (
          <ModulePermissionsView
            users={users}
            disciplines={disciplines}
            onCreateUser={handleCreateUser}
          />
        )}

        {activeTab === 'settings' && (
          <ModuleSettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onSeedWorkspace={handleSeedWorkspace}
          />
        )}
      </div>
    </div>
  );
}
