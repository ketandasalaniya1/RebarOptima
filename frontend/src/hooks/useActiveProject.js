import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectActiveProjectId, selectProjectEpoch } from '../store/slices/projectSlice';

/**
 * Active org project + epoch for stale-response protection.
 * Pass epoch into async work; ignore results when epoch !== current.
 */
export function useActiveProject() {
  const selectedProject = useSelector((state) => state.project.selectedProject);
  const projectId = useSelector(selectActiveProjectId);
  const projectEpoch = useSelector(selectProjectEpoch);
  const epochRef = useRef(projectEpoch);
  epochRef.current = projectEpoch;

  const isStale = (epochAtStart) => epochAtStart !== epochRef.current;

  return {
    selectedProject,
    projectId: projectId ? String(projectId) : null,
    projectEpoch,
    isStale,
  };
}

/** Re-run effect whenever the active project changes (clears module local state). */
export function useOnProjectSwitch(callback) {
  const { projectId, projectEpoch } = useActiveProject();
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!projectId) return;
    cbRef.current?.(projectId, projectEpoch);
  }, [projectId, projectEpoch]);
}

export default useActiveProject;
