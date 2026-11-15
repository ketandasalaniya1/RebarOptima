import React from 'react';
import { useDispatch } from 'react-redux';
import { Package, Zap, BarChart3, History, BookOpen, Layers } from 'lucide-react';
import { setView } from '../../store/slices/routingSlice';
import { useActiveProject } from '../../hooks/useActiveProject';
import './SteelHeader.css';

/**
 * Shared Steel Header Component for Steel Suite:
 * - Inventory (/inventory)
 * - Run Optimizer (/inputs)
 * - Results & Visual Patterns (/results)
 * - Batch History (/history)
 * - Material Ledger (/ledger)
 * 
 * Provides unified tab navigation, active project context, and custom action slots.
 */
export default function SteelHeader({
  activeTab = 'inventory',
  title = 'Steel & Reinforcement Suite',
  subtitle = 'Manage 12m standard stock, remnants, 1D cut optimization, and audit ledger',
  actions,
}) {
  const dispatch = useDispatch();
  const { selectedProject } = useActiveProject();

  const tabs = [
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <Package size={16} />,
      view: 'inventory',
    },
    {
      id: 'inputs',
      label: 'Run Optimizer',
      icon: <Zap size={16} />,
      view: 'inputs',
    },
    {
      id: 'results',
      label: 'Results & Patterns',
      icon: <BarChart3 size={16} />,
      view: 'results',
    },
    {
      id: 'history',
      label: 'Batch History',
      icon: <History size={16} />,
      view: 'history',
    },
    {
      id: 'ledger',
      label: 'Material Ledger',
      icon: <BookOpen size={16} />,
      view: 'ledger',
    },
  ];

  const handleTabClick = (targetView) => {
    dispatch(setView(targetView));
  };

  return (
    <div className="steel-header-wrapper">
      <div className="steel-header-top">
        <div className="steel-header-titles">
          <div className="steel-header-title-row">
            <h1 className="steel-header-title">{title}</h1>
            {selectedProject && (
              <span className="steel-project-badge" title="Active Project Context">
                <Layers size={13} />
                <span>{selectedProject.name || selectedProject.projectName || 'Active Project'}</span>
              </span>
            )}
          </div>
          {subtitle && <p className="steel-header-subtitle">{subtitle}</p>}
        </div>

        {actions && <div className="steel-header-actions">{actions}</div>}
      </div>

      <nav className="steel-tabs-nav" aria-label="Steel Navigation Tabs">
        <div className="steel-tabs-list" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`steel-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.view)}
              >
                <span className="steel-tab-icon">{tab.icon}</span>
                <span className="steel-tab-label">{tab.label}</span>
                {isActive && <div className="steel-tab-active-indicator" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

