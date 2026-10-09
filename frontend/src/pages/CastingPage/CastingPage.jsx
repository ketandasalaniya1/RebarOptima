import React, { useState, useEffect } from 'react';
import { Boxes, Building, Layers, Calendar, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';
import { castingApi } from './castingApi';
import ProjectHierarchyManager from './components/ProjectHierarchyManager';
import MemberRegisterTable from './components/MemberRegisterTable';
import CreateMemberModal from './components/CreateMemberModal';
import CastingEventList from './components/CastingEventList';
import CreateCastingEventModal from './components/CreateCastingEventModal';
import RecordActualPourModal from './components/RecordActualPourModal';
import './CastingPage.css';

export default function CastingPage() {
  const [activeTab, setActiveTab] = useState('structural'); // 'structural' | 'events'

  // Hierarchy Data States
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);

  const [levels, setLevels] = useState({}); // blockId -> Array of levels
  const [selectedLevel, setSelectedLevel] = useState(null);

  const [members, setMembers] = useState([]);
  const [memberTypes, setMemberTypes] = useState([]);
  const [events, setEvents] = useState([]);

  // Modals
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [activeEventForActuals, setActiveEventForActuals] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initial Load: Projects & Member Types
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [projList, types] = await Promise.all([
        castingApi.getProjects(),
        castingApi.getMemberTypes().catch(() => [
          'Slab', 'Beam', 'Column', 'Footing', 'Pedestal', 'Retaining Wall', 'Staircase', 'Grade Slab', 'Plinth Beam', 'Overhead Tank', 'Other'
        ])
      ]);

      setProjects(projList || []);
      setMemberTypes(types || []);

      if (projList && projList.length > 0) {
        setSelectedProject(projList[0]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error connecting to Casting API');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Load Blocks & Events when Selected Project Changes
  useEffect(() => {
    if (!selectedProject) {
      setBlocks([]);
      setSelectedBlock(null);
      setLevels({});
      setSelectedLevel(null);
      setMembers([]);
      setEvents([]);
      return;
    }

    const pId = selectedProject.id || selectedProject._id;
    loadProjectDetails(pId);
  }, [selectedProject]);

  const loadProjectDetails = async (projectId) => {
    try {
      const [blockList, eventList] = await Promise.all([
        castingApi.getBlocks(projectId),
        castingApi.getEvents({ projectId })
      ]);

      setBlocks(blockList || []);
      setEvents(eventList || []);

      if (blockList && blockList.length > 0) {
        const firstBlock = blockList[0];
        setSelectedBlock(firstBlock);

        // Load levels for all blocks
        const levelsMap = {};
        await Promise.all(
          blockList.map(async (b) => {
            const bId = b.id || b._id;
            const lvls = await castingApi.getLevels(bId).catch(() => []);
            levelsMap[bId] = lvls;
          })
        );

        setLevels(levelsMap);

        const firstBlockLevels = levelsMap[firstBlock.id || firstBlock._id] || [];
        if (firstBlockLevels.length > 0) {
          setSelectedLevel(firstBlockLevels[0]);
        } else {
          setSelectedLevel(null);
        }
      } else {
        setSelectedBlock(null);
        setSelectedLevel(null);
        setMembers([]);
      }
    } catch (err) {
      console.error('Error loading project details:', err);
    }
  };

  // 3. Load Members when Selected Level Changes
  useEffect(() => {
    if (!selectedLevel) {
      setMembers([]);
      return;
    }

    const lId = selectedLevel.id || selectedLevel._id;
    loadLevelMembers(lId);
  }, [selectedLevel]);

  const loadLevelMembers = async (levelId) => {
    try {
      const mbrs = await castingApi.getMembers(levelId);
      setMembers(mbrs || []);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  // Refresh handlers
  const handleRefreshHierarchy = async () => {
    if (selectedProject) {
      await loadProjectDetails(selectedProject.id || selectedProject._id);
      if (selectedLevel) {
        await loadLevelMembers(selectedLevel.id || selectedLevel._id);
      }
    } else {
      await loadInitialData();
    }
  };

  const handleRefreshEvents = async () => {
    if (selectedProject) {
      const eventList = await castingApi.getEvents({ projectId: selectedProject.id || selectedProject._id });
      setEvents(eventList || []);
      if (selectedLevel) {
        await loadLevelMembers(selectedLevel.id || selectedLevel._id);
      }
    }
  };

  // Compute Global Summary Stats for Active Project
  const totalProjectMembers = Object.values(levels).reduce((sum, lvlArr) => {
    return sum + (lvlArr || []).reduce((lSum, l) => lSum + (l.memberCount || 0), 0);
  }, 0);

  const totalPlannedVolume = events.reduce((sum, e) => sum + (Number(e.plannedTotalVolumeM3) || 0), 0);
  const totalPouredVolume = events.reduce((sum, e) => sum + (Number(e.actualTotalVolumeM3) || 0), 0);

  return (
    <div className="casting-container">
      {/* Module Header */}
      <div className="casting-header">
        <div className="casting-header-left">
          <div className="casting-header-icon">
            <Boxes size={24} />
          </div>
          <div>
            <h1 className="casting-title">Casting Management</h1>
            <p className="casting-subtitle">
              Structural Register, Volume Calculation Engine & Multi-Pour Event Log (Phase 1)
            </p>
          </div>
        </div>

        <div className="casting-header-right">
          <button
            className="btn-secondary-dark"
            onClick={handleRefreshHierarchy}
            title="Refresh Casting Data"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="casting-stats-grid">
        <div className="casting-stat-card">
          <div className="casting-stat-icon teal">
            <Building size={20} />
          </div>
          <div className="casting-stat-info">
            <span className="casting-stat-label">Casting Projects</span>
            <span className="casting-stat-val">{projects.length}</span>
          </div>
        </div>

        <div className="casting-stat-card">
          <div className="casting-stat-icon blue">
            <Layers size={20} />
          </div>
          <div className="casting-stat-info">
            <span className="casting-stat-label">Active Project Members</span>
            <span className="casting-stat-val">{totalProjectMembers}</span>
          </div>
        </div>

        <div className="casting-stat-card">
          <div className="casting-stat-icon purple">
            <Calendar size={20} />
          </div>
          <div className="casting-stat-info">
            <span className="casting-stat-label">Total Planned Volume</span>
            <span className="casting-stat-val">{totalPlannedVolume.toFixed(3)} m³</span>
          </div>
        </div>

        <div className="casting-stat-card">
          <div className="casting-stat-icon amber">
            <CheckCircle2 size={20} />
          </div>
          <div className="casting-stat-info">
            <span className="casting-stat-label">Total Poured Concrete</span>
            <span className="casting-stat-val">{totalPouredVolume.toFixed(3)} m³</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="casting-tabs-bar">
        <button
          className={`casting-tab-btn ${activeTab === 'structural' ? 'active' : ''}`}
          onClick={() => setActiveTab('structural')}
        >
          <Layers size={16} />
          <span>Structural Register</span>
          <span className="casting-tab-count">{members.length}</span>
        </button>

        <button
          className={`casting-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <Calendar size={16} />
          <span>Casting Events & Pour Log</span>
          <span className="casting-tab-count">{events.length}</span>
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'structural' && (
        <div className="structural-workspace">
          {/* Left Pane: Hierarchy Manager */}
          <ProjectHierarchyManager
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={(p) => {
              setSelectedProject(p);
            }}
            blocks={blocks}
            selectedBlock={selectedBlock}
            onSelectBlock={(b) => {
              setSelectedBlock(b);
              const bId = b.id || b._id;
              const lvls = levels[bId] || [];
              if (lvls.length > 0) setSelectedLevel(lvls[0]);
              else setSelectedLevel(null);
            }}
            levels={levels}
            selectedLevel={selectedLevel}
            onSelectLevel={(l) => {
              setSelectedLevel(l);
            }}
            onRefreshHierarchy={handleRefreshHierarchy}
          />

          {/* Right Pane: Members Table */}
          <MemberRegisterTable
            members={members}
            selectedProject={selectedProject}
            selectedBlock={selectedBlock}
            selectedLevel={selectedLevel}
            onOpenCreateModal={() => setShowCreateMemberModal(true)}
            onRefreshMembers={() => {
              if (selectedLevel) loadLevelMembers(selectedLevel.id || selectedLevel._id);
            }}
          />
        </div>
      )}

      {activeTab === 'events' && (
        <CastingEventList
          events={events}
          projects={projects}
          selectedProject={selectedProject}
          onOpenCreateModal={() => setShowCreateEventModal(true)}
          onRecordActuals={(evt) => setActiveEventForActuals(evt)}
          onRefreshEvents={handleRefreshEvents}
        />
      )}

      {/* Modal: Create Structural Member (Single / Batch) */}
      <CreateMemberModal
        isOpen={showCreateMemberModal}
        onClose={() => setShowCreateMemberModal(false)}
        selectedProject={selectedProject}
        selectedBlock={selectedBlock}
        selectedLevel={selectedLevel}
        memberTypes={memberTypes}
        onMemberCreated={async () => {
          if (selectedLevel) {
            await loadLevelMembers(selectedLevel.id || selectedLevel._id);
          }
          await handleRefreshHierarchy();
        }}
      />

      {/* Modal: Schedule Casting Event (Multi-Member / Multi-Block) */}
      <CreateCastingEventModal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        projects={projects}
        selectedProject={selectedProject}
        onEventCreated={handleRefreshEvents}
      />

      {/* Modal: Record Actual Pour Execution */}
      <RecordActualPourModal
        isOpen={!!activeEventForActuals}
        onClose={() => setActiveEventForActuals(null)}
        event={activeEventForActuals}
        onActualRecorded={handleRefreshEvents}
      />
    </div>
  );
}
