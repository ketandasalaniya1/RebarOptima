import React, { useState, useEffect } from 'react';
import { Boxes, Building, Layers, Calendar, Plus, RefreshCw, CheckCircle2, FlaskConical, PackageCheck } from 'lucide-react';
import { castingApi } from './castingApi';
import ProjectHierarchyManager from './components/ProjectHierarchyManager';
import MemberRegisterTable from './components/MemberRegisterTable';
import CreateMemberModal from './components/CreateMemberModal';
import CastingEventList from './components/CastingEventList';
import CreateCastingEventModal from './components/CreateCastingEventModal';
import RecordActualPourModal from './components/RecordActualPourModal';
import ActualConsumptionModal from './components/ActualConsumptionModal';
import ConsumptionApprovalModal from './components/ConsumptionApprovalModal';
import ProjectStockRegisterModal from './components/ProjectStockRegisterModal';
import RecipeListTable from './components/RecipeListTable';
import CreateRecipeModal from './components/CreateRecipeModal';
import RecipeApprovalModal from './components/RecipeApprovalModal';
import RecipeDetailModal from './components/RecipeDetailModal';
import SegmentRecipeAssignModal from './components/SegmentRecipeAssignModal';
import MaterialRequirementSheetModal from './components/MaterialRequirementSheetModal';
import './CastingPage.css';

export default function CastingPage() {
  const [activeTab, setActiveTab] = useState('structural'); // 'structural' | 'events' | 'recipes'

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
  const [recipes, setRecipes] = useState([]);

  // Modals
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [activeEventForActuals, setActiveEventForActuals] = useState(null);

  // Phase 2 Modals
  const [showCreateRecipeModal, setShowCreateRecipeModal] = useState(false);
  const [editingRecipeData, setEditingRecipeData] = useState(null);
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState(null);
  const [selectedRecipeForApproval, setSelectedRecipeForApproval] = useState(null);
  const [selectedEventForBinding, setSelectedEventForBinding] = useState(null);
  const [activeEventForMRS, setActiveEventForMRS] = useState(null);

  // Phase 3 Modals
  const [activeEventForApproval, setActiveEventForApproval] = useState(null);
  const [showStockRegisterModal, setShowStockRegisterModal] = useState(false);

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
      const [projList, types, recipeList] = await Promise.all([
        castingApi.getProjects().catch(() => []),
        castingApi.getMemberTypes().catch(() => [
          'Slab', 'Beam', 'Column', 'Footing', 'Pedestal', 'Retaining Wall', 'Staircase', 'Grade Slab', 'Plinth Beam', 'Overhead Tank', 'Other'
        ]),
        castingApi.getRecipes().catch(() => ({ success: true, data: [] }))
      ]);

      const safeProjects = Array.isArray(projList) ? projList : (projList?.data || []);
      const safeTypes = Array.isArray(types) ? types : (types?.data || []);
      const safeRecipes = Array.isArray(recipeList) ? recipeList : (recipeList?.data || []);

      setProjects(safeProjects);
      setMemberTypes(safeTypes);
      setRecipes(safeRecipes);

      if (safeProjects.length > 0) {
        setSelectedProject(safeProjects[0]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error connecting to Casting API');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshRecipes = async () => {
    try {
      const res = await castingApi.getRecipes();
      const safe = Array.isArray(res) ? res : (res?.data || []);
      setRecipes(safe);
    } catch (err) {
      console.error('Error refreshing recipes:', err);
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
        castingApi.getBlocks(projectId).catch(() => []),
        castingApi.getEvents({ projectId }).catch(() => [])
      ]);

      const safeBlocks = Array.isArray(blockList) ? blockList : (blockList?.data || []);
      const safeEvents = Array.isArray(eventList) ? eventList : (eventList?.data || []);

      setBlocks(safeBlocks);
      setEvents(safeEvents);

      if (safeBlocks.length > 0) {
        const firstBlock = safeBlocks[0];
        setSelectedBlock(firstBlock);

        // Load levels for all blocks
        const levelsMap = {};
        await Promise.all(
          safeBlocks.map(async (b) => {
            const bId = b.id || b._id;
            const lvls = await castingApi.getLevels(bId).catch(() => []);
            levelsMap[bId] = Array.isArray(lvls) ? lvls : (lvls?.data || []);
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
      const mbrs = await castingApi.getMembers(levelId).catch(() => []);
      setMembers(Array.isArray(mbrs) ? mbrs : (mbrs?.data || []));
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
      const eventList = await castingApi.getEvents({ projectId: selectedProject.id || selectedProject._id }).catch(() => []);
      setEvents(Array.isArray(eventList) ? eventList : (eventList?.data || []));
      if (selectedLevel) {
        await loadLevelMembers(selectedLevel.id || selectedLevel._id);
      }
    }
  };

  // Safe Arrays for Rendering & Calculations
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const safeRecipes = Array.isArray(recipes) ? recipes : [];
  const safeMembers = Array.isArray(members) ? members : [];

  // Compute Global Summary Stats for Active Project
  const totalProjectMembers = Object.values(levels || {}).reduce((sum, lvlArr) => {
    return sum + (Array.isArray(lvlArr) ? lvlArr : []).reduce((lSum, l) => lSum + (l?.memberCount || 0), 0);
  }, 0);

  const totalPlannedVolume = safeEvents.reduce((sum, e) => sum + (Number(e?.plannedTotalVolumeM3) || 0), 0);
  const totalPouredVolume = safeEvents.reduce((sum, e) => sum + (Number(e?.actualTotalVolumeM3) || 0), 0);

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
              Mix Designs, Material Planning (MRS), Structural Register & Multi-Pour Tracking (Phase 1 & 2)
            </p>
          </div>
        </div>

        <div className="casting-header-right">
          <button
            className="btn-secondary-dark"
            onClick={async () => {
              await handleRefreshHierarchy();
              await handleRefreshRecipes();
            }}
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
            <FlaskConical size={20} />
          </div>
          <div className="casting-stat-info">
            <span className="casting-stat-label">Mix Design Recipes</span>
            <span className="casting-stat-val">{recipes.length}</span>
          </div>
        </div>

        <div className="casting-stat-card">
          <div className="casting-stat-icon amber">
            <CheckCircle2 size={20} />
          </div>
          <div className="casting-stat-info">
            <span className="casting-stat-label">Total Planned Volume</span>
            <span className="casting-stat-val">{totalPlannedVolume.toFixed(3)} m³</span>
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

        <button
          className={`casting-tab-btn ${activeTab === 'recipes' ? 'active' : ''}`}
          onClick={() => setActiveTab('recipes')}
        >
          <FlaskConical size={16} />
          <span>Mix Design Recipes</span>
          <span className="casting-tab-count">{recipes.length}</span>
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
          onAssignRecipes={(evt) => setSelectedEventForBinding(evt)}
          onViewMRS={(evt) => setActiveEventForMRS(evt)}
          onReviewConsumption={(evt) => setActiveEventForApproval(evt)}
          onOpenStockRegister={() => setShowStockRegisterModal(true)}
        />
      )}

      {activeTab === 'recipes' && (
        <RecipeListTable
          recipes={recipes}
          onRefresh={handleRefreshRecipes}
          onCreateNew={() => {
            setEditingRecipeData(null);
            setShowCreateRecipeModal(true);
          }}
          onViewRecipe={(rec) => {
            setSelectedRecipeForDetail(rec);
          }}
          onApproveRecipe={(rec, vNum) => {
            setSelectedRecipeForApproval({ recipe: rec, versionNumber: vNum });
          }}
          onForkVersion={async (rec) => {
            try {
              await castingApi.createRecipeVersion(rec._id, {});
              await handleRefreshRecipes();
            } catch (err) {
              alert(err.message || 'Failed to fork new version');
            }
          }}
        />
      )}

      {/* Modal: Create Structural Member (Single / Batch) */}
      {showCreateMemberModal && (
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
      )}

      {/* Modal: Schedule Casting Event (Multi-Member / Multi-Block) */}
      {showCreateEventModal && (
        <CreateCastingEventModal
          isOpen={showCreateEventModal}
          onClose={() => setShowCreateEventModal(false)}
          projects={safeProjects}
          selectedProject={selectedProject}
          onEventCreated={handleRefreshEvents}
        />
      )}

      {/* Modal: Record Actual Pour Execution */}
      {activeEventForActuals && (
        <RecordActualPourModal
          isOpen={!!activeEventForActuals}
          onClose={() => setActiveEventForActuals(null)}
          event={activeEventForActuals}
          onActualRecorded={handleRefreshEvents}
        />
      )}

      {/* Modal: Create / Edit Mix Design Recipe (Phase 2) */}
      {showCreateRecipeModal && (
        <CreateRecipeModal
          isOpen={showCreateRecipeModal}
          initialData={editingRecipeData}
          onClose={() => {
            setShowCreateRecipeModal(false);
            setEditingRecipeData(null);
          }}
          onSubmit={async (payload) => {
            if (editingRecipeData && editingRecipeData._id) {
              const vNum = editingRecipeData.activeVersionDetails?.versionNumber || '1.0';
              await castingApi.updateRecipeVersion(editingRecipeData._id, vNum, payload);
            } else {
              await castingApi.createRecipe(payload);
            }
            await handleRefreshRecipes();
          }}
        />
      )}

      {/* Modal: Recipe Detail Inspector (Phase 2) */}
      {selectedRecipeForDetail && (
        <RecipeDetailModal
          isOpen={!!selectedRecipeForDetail}
          onClose={() => setSelectedRecipeForDetail(null)}
          recipe={selectedRecipeForDetail}
          onApproveRecipe={(rec, vNum) => {
            setSelectedRecipeForDetail(null);
            setSelectedRecipeForApproval({ recipe: rec, versionNumber: vNum });
          }}
          onForkVersion={async (rec) => {
            try {
              await castingApi.createRecipeVersion(rec._id, {});
              await handleRefreshRecipes();
              setSelectedRecipeForDetail(null);
            } catch (err) {
              alert(err.message || 'Failed to fork new version');
            }
          }}
          onEditRecipe={(rec) => {
            setSelectedRecipeForDetail(null);
            setEditingRecipeData(rec);
            setShowCreateRecipeModal(true);
          }}
          onSubmitForReview={async (rec, vNum) => {
            try {
              await castingApi.submitRecipeVersion(rec._id, vNum);
              await handleRefreshRecipes();
              setSelectedRecipeForDetail(null);
            } catch (err) {
              alert(err.message || 'Failed to submit recipe for review');
            }
          }}
        />
      )}

      {/* Modal: Recipe Approval & Maker-Checker Review (Phase 2) */}
      {selectedRecipeForApproval && (
        <RecipeApprovalModal
          isOpen={!!selectedRecipeForApproval}
          onClose={() => setSelectedRecipeForApproval(null)}
          recipe={selectedRecipeForApproval.recipe}
          versionNumber={selectedRecipeForApproval.versionNumber}
          onApprove={async (recId, vNum, remarks) => {
            await castingApi.approveRecipeVersion(recId, vNum, remarks);
            await handleRefreshRecipes();
          }}
          onReject={async (recId, vNum, remarks) => {
            await castingApi.rejectRecipeVersion(recId, vNum, remarks);
            await handleRefreshRecipes();
          }}
        />
      )}

      {/* Modal: Segment Recipe Assigner (Phase 2) */}
      {selectedEventForBinding && (
        <SegmentRecipeAssignModal
          isOpen={!!selectedEventForBinding}
          onClose={() => setSelectedEventForBinding(null)}
          event={selectedEventForBinding}
          recipes={recipes}
          onSaveBindings={async (eventId, bindings) => {
            await castingApi.bindSegmentRecipes(eventId, bindings);
            await handleRefreshEvents();
          }}
          onGenerateMRS={async (eventId, reason) => {
            await castingApi.generateMRS(eventId, reason);
            await handleRefreshEvents();
            // Open MRS modal immediately
            const updatedEvt = events.find(e => (e.id || e._id) === eventId) || selectedEventForBinding;
            setActiveEventForMRS(updatedEvt);
          }}
        />
      )}

      {/* Modal: Material Requirement Sheet (Phase 2) */}
      {activeEventForMRS && (
        <MaterialRequirementSheetModal
          isOpen={!!activeEventForMRS}
          onClose={() => setActiveEventForMRS(null)}
          event={activeEventForMRS}
          onRegenerateMRS={async (eventId, reason) => {
            await castingApi.generateMRS(eventId, reason);
            await handleRefreshEvents();
          }}
        />
      )}

      {/* Modal: Actual Pour & Material Consumption Recording (Phase 3) */}
      {activeEventForActuals && (
        <ActualConsumptionModal
          isOpen={!!activeEventForActuals}
          onClose={() => setActiveEventForActuals(null)}
          event={activeEventForActuals}
          onSaved={handleRefreshEvents}
        />
      )}

      {/* Modal: Consumption Approval & Atomic Posting (Phase 3) */}
      {activeEventForApproval && (
        <ConsumptionApprovalModal
          isOpen={!!activeEventForApproval}
          onClose={() => setActiveEventForApproval(null)}
          event={activeEventForApproval}
          onActionComplete={handleRefreshEvents}
        />
      )}

      {/* Modal: Project Material Stock Register & Inward (Phase 3) */}
      {showStockRegisterModal && selectedProject && (
        <ProjectStockRegisterModal
          isOpen={showStockRegisterModal}
          onClose={() => setShowStockRegisterModal(false)}
          projectId={selectedProject.id || selectedProject._id}
          projectName={selectedProject.name}
        />
      )}
    </div>
  );
}
