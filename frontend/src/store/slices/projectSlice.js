import { createSlice } from '@reduxjs/toolkit';

export const ACTIVE_PROJECT_KEY = 'rebar_active_project_id';

const projectSlice = createSlice({
  name: 'project',
  initialState: {
    projects: [],
    selectedProject: null,
    /** Hint from localStorage only — never proof of authorization */
    storedProjectHint: typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_PROJECT_KEY) : null,
    projectsReady: false,
    projectValidated: false,
    /** Bumped on every project switch so in-flight fetches can be ignored */
    projectEpoch: 0,
    loading: false,
    error: null,
    isCreateModalOpen: false,
    editingProject: null,
    geofenceModalProject: null,
    assignPartnerModalProject: null,
  },
  reducers: {
    setProjects: (state, action) => {
      const list = Array.isArray(action.payload)
        ? action.payload
        : Array.isArray(action.payload?.data)
          ? action.payload.data
          : [];
      state.projects = list;
      state.loading = false;
      state.error = null;
      state.projectsReady = true;
      // Do not auto-trust localStorage here — App validates via GET /projects/:id
      if (list.length === 0) {
        state.selectedProject = null;
        state.projectValidated = true;
      }
    },
    setSelectedProject: (state, action) => {
      const prevId = state.selectedProject?._id || state.selectedProject?.id;
      state.selectedProject = action.payload;
      state.projectValidated = !!action.payload;
      if (action.payload) {
        const id = action.payload._id || action.payload.id;
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        state.storedProjectHint = id;
        if (String(prevId) !== String(id)) {
          state.projectEpoch += 1;
        }
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
        state.storedProjectHint = null;
        state.projectEpoch += 1;
      }
    },
    selectProjectById: (state, action) => {
      const id = action.payload;
      const found = state.projects.find((p) => (p._id || p.id) === id);
      if (found) {
        const prevId = state.selectedProject?._id || state.selectedProject?.id;
        state.selectedProject = found;
        state.projectValidated = true;
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
        state.storedProjectHint = id;
        if (String(prevId) !== String(id)) {
          state.projectEpoch += 1;
        }
      }
    },
    addProject: (state, action) => {
      state.projects.unshift(action.payload);
      state.selectedProject = action.payload;
      state.projectValidated = true;
      state.projectsReady = true;
      const id = action.payload._id || action.payload.id;
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
      state.storedProjectHint = id;
      state.projectEpoch += 1;
    },
    updateProjectInList: (state, action) => {
      const updated = action.payload;
      const idx = state.projects.findIndex((p) => (p._id || p.id) === (updated._id || updated.id));
      if (idx !== -1) {
        state.projects[idx] = updated;
      }
      if (
        state.selectedProject &&
        (state.selectedProject._id || state.selectedProject.id) === (updated._id || updated.id)
      ) {
        state.selectedProject = updated;
      }
    },
    clearProjectContext: (state) => {
      state.projects = [];
      state.selectedProject = null;
      state.projectsReady = false;
      state.projectValidated = false;
      state.storedProjectHint = null;
      state.projectEpoch += 1;
      state.loading = false;
      state.error = null;
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    },
    setProjectValidated: (state, action) => {
      state.projectValidated = !!action.payload;
    },
    bumpProjectEpoch: (state) => {
      state.projectEpoch += 1;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
      state.projectsReady = true;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    fetchProjectsStart: (state) => {
      state.loading = true;
      state.projectsReady = false;
    },
    fetchProjectsFailure: (state, action) => {
      state.error = action.payload;
      state.loading = false;
      state.projectsReady = true;
    },
    openCreateModal: (state) => {
      state.editingProject = null;
      state.isCreateModalOpen = true;
    },
    openEditModal: (state, action) => {
      state.editingProject = action.payload;
      state.isCreateModalOpen = true;
    },
    closeCreateModal: (state) => {
      state.isCreateModalOpen = false;
      state.editingProject = null;
    },
    openGeofenceModal: (state, action) => {
      state.geofenceModalProject = action.payload;
    },
    closeGeofenceModal: (state) => {
      state.geofenceModalProject = null;
    },
    openAssignPartnerModal: (state, action) => {
      state.assignPartnerModalProject = action.payload;
    },
    closeAssignPartnerModal: (state) => {
      state.assignPartnerModalProject = null;
    },
  },
});

export const {
  setProjects,
  setSelectedProject,
  selectProjectById,
  addProject,
  updateProjectInList,
  clearProjectContext,
  setProjectValidated,
  bumpProjectEpoch,
  setLoading,
  setError,
  fetchProjectsStart,
  fetchProjectsFailure,
  openCreateModal,
  openEditModal,
  closeCreateModal,
  openGeofenceModal,
  closeGeofenceModal,
  openAssignPartnerModal,
  closeAssignPartnerModal,
} = projectSlice.actions;

export const selectActiveProjectId = (state) =>
  state.project?.selectedProject?._id || state.project?.selectedProject?.id || null;

export const selectProjectEpoch = (state) => state.project?.projectEpoch || 0;

export default projectSlice.reducer;
