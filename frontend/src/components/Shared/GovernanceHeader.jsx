import React from 'react';
import { useDispatch } from 'react-redux';
import { Users, Shield, History, Building2 } from 'lucide-react';
import { setView } from '../../store/slices/routingSlice';
import { useActiveProject } from '../../hooks/useActiveProject';
import './GovernanceHeader.css';

/**
 * Shared Governance Header Component for Administration Modules:
 * - Users (/users)
 * - Roles & Permissions (/roles)
 * - Activity Logs (/activity-logs)
 * 
 * Provides unified tab navigation, active project indicator, and action slot.
 */
export default function GovernanceHeader({
  activeTab = 'users',
  title = 'Access & Governance',
  subtitle = 'Manage team members, roles, granular permissions, and security audit logs',
  actions,
}) {
  const dispatch = useDispatch();
  const { selectedProject } = useActiveProject();

  const tabs = [
    {
      id: 'users',
      label: 'Users',
      icon: <Users size={16} />,
      view: 'users',
    },
    {
      id: 'roles',
      label: 'Roles & Permissions',
      icon: <Shield size={16} />,
      view: 'roles',
    },
    {
      id: 'activity-logs',
      label: 'Activity Logs',
      icon: <History size={16} />,
      view: 'activity-logs',
    },
  ];

  const handleTabClick = (targetView) => {
    dispatch(setView(targetView));
  };

  return (
    <header className="gov-header-wrapper">
      <div className="gov-header-top">
        <div className="gov-header-titles">
          <div className="gov-header-title-row">
            <h1 className="gov-header-title">{title}</h1>
            {selectedProject && (
              <span className="gov-project-badge" title={`Active Project: ${selectedProject.name}`}>
                <Building2 size={13} />
                <span>{selectedProject.name}</span>
              </span>
            )}
          </div>
          <p className="gov-header-subtitle">{subtitle}</p>
        </div>

        {actions && (
          <div className="gov-header-actions">
            {actions}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <nav className="gov-tabs-nav" aria-label="Governance sections">
        <div className="gov-tabs-list" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`gov-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.view)}
              >
                <span className="gov-tab-icon">{tab.icon}</span>
                <span className="gov-tab-label">{tab.label}</span>
                {isActive && <span className="gov-tab-active-indicator" />}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

