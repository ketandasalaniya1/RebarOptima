import React from 'react';
import './ui.css';

export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
}) {
  return (
    <nav className={`ro-tabs ${className}`} role="tablist" aria-label="Page navigation tabs">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`ro-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {Icon && <Icon size={15} aria-hidden="true" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="ro-tab-count">{tab.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

