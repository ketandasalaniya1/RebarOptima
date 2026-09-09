import { createSlice } from '@reduxjs/toolkit';

const bbsSlice = createSlice({
  name: 'bbs',
  initialState: {
    // Active project context
    activeProjectId: null,
    activeProject: null,

    // Hierarchy data
    projects: [],
    blocks: [],
    levels: [],
    members: [],

    // Dashboard KPIs
    kpis: {
      totalSteelWeight: 0,
      totalSteelWeightMT: 0,
      totalConcreteVolume: 0,
      totalMembers: 0,
      calculatedMembers: 0,
      remainingMembers: 0,
      progressPercent: 0,
    },

    // Member wizard state
    activeMemberId: null,
    activeMember: null,
    rebarItems: [],

    // Shape library
    shapes: [],
    templates: [],

    // MTO data
    mto: null,

    // Loading states
    loading: false,
    error: null,
  },
  reducers: {
    // ── Loading ──────────────────────────────────────
    setLoading: (state, action) => {
      state.loading = action.payload;
      if (action.payload) state.error = null;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },

    // ── Projects ────────────────────────────────────
    setProjects: (state, action) => {
      state.projects = action.payload;
      state.loading = false;
    },
    setActiveProject: (state, action) => {
      state.activeProject = action.payload;
      state.activeProjectId = action.payload?._id || null;
    },
    clearActiveProject: (state) => {
      state.activeProjectId = null;
      state.activeProject = null;
      state.blocks = [];
      state.levels = [];
      state.members = [];
      state.kpis = bbsSlice.getInitialState().kpis;
    },

    // ── Hierarchy ───────────────────────────────────
    setBlocks: (state, action) => {
      state.blocks = action.payload;
    },
    setLevels: (state, action) => {
      state.levels = action.payload;
    },
    setMembers: (state, action) => {
      state.members = action.payload;
    },

    // ── Dashboard ───────────────────────────────────
    setDashboardData: (state, action) => {
      const { project, blocks, levels, members, kpis } = action.payload;
      state.activeProject = project;
      state.activeProjectId = project?._id || null;
      state.blocks = blocks;
      state.levels = levels;
      state.members = members;
      state.kpis = kpis;
      state.loading = false;
    },

    // ── Member Wizard ───────────────────────────────
    setActiveMember: (state, action) => {
      state.activeMember = action.payload;
      state.activeMemberId = action.payload?._id || null;
    },
    setRebarItems: (state, action) => {
      state.rebarItems = action.payload;
    },
    clearActiveMember: (state) => {
      state.activeMemberId = null;
      state.activeMember = null;
      state.rebarItems = [];
    },

    // ── Shape & Template Library ────────────────────
    setShapes: (state, action) => {
      state.shapes = action.payload;
    },
    setTemplates: (state, action) => {
      state.templates = action.payload;
    },

    // ── MTO ─────────────────────────────────────────
    setMTO: (state, action) => {
      state.mto = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setLoading,
  setError,
  setProjects,
  setActiveProject,
  clearActiveProject,
  setBlocks,
  setLevels,
  setMembers,
  setDashboardData,
  setActiveMember,
  setRebarItems,
  clearActiveMember,
  setShapes,
  setTemplates,
  setMTO,
} = bbsSlice.actions;

export default bbsSlice.reducer;
