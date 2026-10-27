import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ChevronRight, Home, Building2, Layers } from 'lucide-react';
import { setView } from '../../store/slices/routingSlice';
import './Breadcrumbs.css';

const VIEW_TITLES = {
  overview: 'Overview',
  projects: 'Projects',
  inventory: 'Steel Inventory',
  inputs: 'Run Optimizer',
  results: 'Cutting Layouts',
  history: 'Batch History',
  ledger: 'Ledger & Procurement',
  bbs: 'Bar Bending Schedule (BBS)',
  'bbs-projects': 'BBS Projects',
  'bbs-dashboard': 'BBS Dashboard',
  'bbs-wizard': 'BBS Wizard',
  'bbs-shapes': 'BBS Shapes',
  'bbs-reports': 'BBS Reports',
  casting: 'Casting Management',
  'general-inventory': 'Site Inventory',
  crm: 'Real Estate CRM',
  drawings: 'Drawings & Files',
  users: 'User Management',
  roles: 'Roles & Permissions',
  settings: 'Settings',
  profile: 'My Profile',
  'activity-logs': 'Activity Logs',
};

export default function Breadcrumbs() {
  const dispatch = useDispatch();
  const currentView = useSelector((state) => state.routing.view);
  const selectedProject = useSelector((state) => state.project.selectedProject);

  const navigate = (view) => {
    dispatch(setView(view));
  };

  const getSegments = () => {
    const segments = [];

    // Base segment
    segments.push({
      label: 'Home',
      icon: <Home size={14} className="bc-icon" />,
      onClick: () => navigate('overview'),
    });

    if (currentView === 'overview') {
      return segments;
    }

    if (currentView === 'projects') {
      segments.push({
        label: 'Projects',
        icon: <Building2 size={14} className="bc-icon" />,
        isCurrent: true,
      });
      return segments;
    }

    // Organization-level modules
    if (['users', 'roles', 'settings', 'profile', 'activity-logs'].includes(currentView)) {
      segments.push({
        label: 'Organization',
      });
      segments.push({
        label: VIEW_TITLES[currentView] || currentView,
        isCurrent: true,
      });
      return segments;
    }

    // Project-dependent or operational modules
    if (selectedProject) {
      segments.push({
        label: 'Projects',
        onClick: () => navigate('projects'),
      });
      segments.push({
        label: selectedProject.name,
        icon: <Building2 size={14} className="bc-icon text-emerald" />,
        onClick: () => navigate('overview'),
      });
    }

    segments.push({
      label: VIEW_TITLES[currentView] || currentView,
      isCurrent: true,
    });

    return segments;
  };

  const segments = getSegments();

  return (
    <nav className="rebar-breadcrumbs" aria-label="Breadcrumb">
      <ol className="bc-list">
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1 || seg.isCurrent;
          return (
            <li key={idx} className={`bc-item ${isLast ? 'active' : ''}`}>
              {idx > 0 && <ChevronRight size={13} className="bc-separator" />}
              {isLast ? (
                <span className="bc-current" aria-current="page">
                  {seg.icon}
                  <span>{seg.label}</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="bc-link"
                  onClick={seg.onClick}
                >
                  {seg.icon}
                  <span>{seg.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {selectedProject && (
        <div className="bc-project-badge" title="Active Project">
          <span className="bc-project-dot"></span>
          <span className="bc-project-name">{selectedProject.name}</span>
          <span className="bc-project-type">({selectedProject.projectType || 'Project'})</span>
        </div>
      )}
    </nav>
  );
}
