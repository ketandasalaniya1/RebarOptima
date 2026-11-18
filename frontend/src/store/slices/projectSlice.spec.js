import projectReducer, {
  setProjects,
  setSelectedProject,
  selectProjectById,
  clearProjectContext,
  bumpProjectEpoch,
  selectActiveProjectId,
  selectProjectEpoch,
  ACTIVE_PROJECT_KEY,
} from './projectSlice';

describe('Frontend projectSlice Reducer & Selectors', () => {
  const initialTestState = {
    projects: [],
    selectedProject: null,
    storedProjectHint: null,
    projectsReady: false,
    projectValidated: false,
    projectEpoch: 0,
    loading: false,
    error: null,
    isCreateModalOpen: false,
    editingProject: null,
    geofenceModalProject: null,
    assignPartnerModalProject: null,
  };

  const sampleProjectA = {
    _id: 'proj_001',
    name: 'Skyline Heights',
    code: 'SKY-01',
    status: 'active',
  };

  const sampleProjectB = {
    _id: 'proj_002',
    name: 'Ocean View Residence',
    code: 'OVR-02',
    status: 'active',
  };

  beforeEach(() => {
    // Clear localStorage mock
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('sets projects and marks projectsReady to true', () => {
    const state = projectReducer(initialTestState, setProjects([sampleProjectA, sampleProjectB]));
    expect(state.projects).toHaveLength(2);
    expect(state.projectsReady).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('sets selected project, saves to localStorage, and increments projectEpoch', () => {
    const state = projectReducer(initialTestState, setSelectedProject(sampleProjectA));
    expect(state.selectedProject).toEqual(sampleProjectA);
    expect(state.projectValidated).toBe(true);
    expect(state.storedProjectHint).toBe('proj_001');
    expect(state.projectEpoch).toBe(1);

    // Bumping project switch to sampleProjectB increments projectEpoch again
    const switchedState = projectReducer(state, setSelectedProject(sampleProjectB));
    expect(switchedState.selectedProject).toEqual(sampleProjectB);
    expect(switchedState.projectEpoch).toBe(2);
    expect(switchedState.storedProjectHint).toBe('proj_002');
  });

  it('selects project by id from loaded projects list and bumps epoch', () => {
    const stateWithProjects = {
      ...initialTestState,
      projects: [sampleProjectA, sampleProjectB],
      projectEpoch: 5,
    };

    const state = projectReducer(stateWithProjects, selectProjectById('proj_002'));
    expect(state.selectedProject).toEqual(sampleProjectB);
    expect(state.projectEpoch).toBe(6);
    expect(state.storedProjectHint).toBe('proj_002');
  });

  it('clears project context and increments projectEpoch to invalidate in-flight requests', () => {
    const activeState = {
      ...initialTestState,
      projects: [sampleProjectA],
      selectedProject: sampleProjectA,
      storedProjectHint: 'proj_001',
      projectEpoch: 3,
    };

    const cleared = projectReducer(activeState, clearProjectContext());
    expect(cleared.projects).toEqual([]);
    expect(cleared.selectedProject).toBeNull();
    expect(cleared.storedProjectHint).toBeNull();
    expect(cleared.projectEpoch).toBe(4);
  });

  it('selectActiveProjectId selector extracts active project id properly', () => {
    const rootState = {
      project: {
        selectedProject: { _id: 'proj_abc_123', name: 'Metro Line' },
        projectEpoch: 7,
      },
    };

    expect(selectActiveProjectId(rootState)).toBe('proj_abc_123');
    expect(selectProjectEpoch(rootState)).toBe(7);
  });
});
