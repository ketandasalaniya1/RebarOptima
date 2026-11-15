import React, { useState } from 'react';
import {
  Shield, Check, X, ChevronDown, ChevronRight, Lock, Copy, Save, RotateCcw, Info
} from 'lucide-react';
import {
  MODULE_GROUPS,
  splitModuleFeatures,
  isModuleEnabled,
} from '../permissionMatrix';
import './PermissionMatrix.css';

/**
 * Granular Permissions Matrix Component
 * - Grouped by operational modules (Steel & BBS, Site Operations, Sales, Admin)
 * - Module master toggle switch + Granular CRUD toggles (View, Create, Edit, Delete)
 * - Specialized feature switches (Export, Run Optimizer, etc.)
 * - Read-only banner & "Duplicate & Customize" button for system roles
 * - Floating save/discard bar for unsaved matrix changes
 */
export default function PermissionMatrix({
  role,
  isSystemRole,
  modules = {},
  formPermissions = {},
  isDirty = false,
  saving = false,
  onModuleToggle,
  onFeatureToggle,
  onSave,
  onDiscard,
  onDuplicate,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [openMoreModule, setOpenMoreModule] = useState(null);

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <div className="perm-matrix-wrapper">
      {/* System Role Read-Only Banner */}
      {isSystemRole && (
        <div className="perm-system-banner">
          <div className="psb-icon">
            <Lock size={16} />
          </div>
          <div className="psb-text">
            <strong>System Default Template</strong>
            <p>
              Standard system roles are protected against direct modification to prevent operational lockout.
              To tailor these permissions, duplicate this role into a custom company role.
            </p>
          </div>
          <button
            type="button"
            className="ro-btn ro-btn--secondary ro-btn--sm psb-duplicate-btn"
            onClick={onDuplicate}
            disabled={saving}
          >
            <Copy size={14} /> Duplicate & Customize
          </button>
        </div>
      )}

      {/* Module Groups Matrix */}
      <div className="perm-groups-container">
        {MODULE_GROUPS.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.id]);

          return (
            <div key={group.id} className="perm-group-card">
              <button
                type="button"
                className="perm-group-header"
                onClick={() => toggleGroupCollapse(group.id)}
                aria-expanded={!isCollapsed}
              >
                <div className="pgh-title-box">
                  <span className="pgh-chevron">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </span>
                  <span className="pgh-title">{group.label}</span>
                  <span className="pgh-count">({group.modules.length} Modules)</span>
                </div>
              </button>

              {!isCollapsed && (
                <div className="perm-modules-table-wrap">
                  <table className="perm-modules-table">
                    <thead>
                      <tr>
                        <th style={{ width: '38%' }}>Module</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>View</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>Create</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>Edit</th>
                        <th style={{ width: '12%', textAlign: 'center' }}>Delete</th>
                        <th style={{ width: '14%', textAlign: 'center' }}>More Features</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.modules.map((modKey) => {
                        const modDef = modules[modKey];
                        if (!modDef) return null;

                        const modPerms = formPermissions[modKey] || {};
                        const modEnabled = isModuleEnabled(modPerms);
                        const { crud, more } = splitModuleFeatures(modDef.features);

                        return (
                          <React.Fragment key={modKey}>
                            <tr className={`pm-row ${!modEnabled ? 'pm-row-disabled' : ''}`}>
                              {/* Module Info & Master Toggle */}
                              <td className="pm-cell-info">
                                <div className="pm-info-box">
                                  <label className="pm-master-toggle" title="Enable or disable entire module">
                                    <input
                                      type="checkbox"
                                      checked={modEnabled}
                                      onChange={() => onModuleToggle(modKey)}
                                      disabled={saving}
                                    />
                                    <span className="pm-slider" />
                                  </label>
                                  <div className="pm-text-box">
                                    <span className="pm-name">{modDef.name || modKey}</span>
                                    {modDef.description && (
                                      <span className="pm-desc">{modDef.description}</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* CRUD: View (locked ON when module is enabled) */}
                              <td className="pm-cell-toggle">
                                <label className="pm-checkbox-pill">
                                  <input
                                    type="checkbox"
                                    checked={modEnabled && modPerms.view !== false}
                                    onChange={() => onFeatureToggle(modKey, 'view')}
                                    disabled={saving || modEnabled} // View is required when module is active
                                  />
                                  <span className="pm-check-box">
                                    <Check size={12} strokeWidth={3} />
                                  </span>
                                </label>
                              </td>

                              {/* CRUD: Create */}
                              <td className="pm-cell-toggle">
                                {crud.create ? (
                                  <label className="pm-checkbox-pill">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(modPerms[crud.create])}
                                      onChange={() => onFeatureToggle(modKey, crud.create)}
                                      disabled={saving}
                                    />
                                    <span className="pm-check-box">
                                      <Check size={12} strokeWidth={3} />
                                    </span>
                                  </label>
                                ) : (
                                  <span className="pm-na">—</span>
                                )}
                              </td>

                              {/* CRUD: Edit */}
                              <td className="pm-cell-toggle">
                                {crud.edit ? (
                                  <label className="pm-checkbox-pill">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(modPerms[crud.edit])}
                                      onChange={() => onFeatureToggle(modKey, crud.edit)}
                                      disabled={saving}
                                    />
                                    <span className="pm-check-box">
                                      <Check size={12} strokeWidth={3} />
                                    </span>
                                  </label>
                                ) : (
                                  <span className="pm-na">—</span>
                                )}
                              </td>

                              {/* CRUD: Delete */}
                              <td className="pm-cell-toggle">
                                {crud.delete ? (
                                  <label className="pm-checkbox-pill">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(modPerms[crud.delete])}
                                      onChange={() => onFeatureToggle(modKey, crud.delete)}
                                      disabled={saving}
                                    />
                                    <span className="pm-check-box">
                                      <Check size={12} strokeWidth={3} />
                                    </span>
                                  </label>
                                ) : (
                                  <span className="pm-na">—</span>
                                )}
                              </td>

                              {/* More Features Toggle Button */}
                              <td className="pm-cell-more">
                                {more.length > 0 ? (
                                  <button
                                    type="button"
                                    className={`pm-more-btn ${openMoreModule === modKey ? 'active' : ''}`}
                                    onClick={() =>
                                      setOpenMoreModule(openMoreModule === modKey ? null : modKey)
                                    }
                                  >
                                    <span>{more.length} Features</span>
                                    <ChevronDown size={13} />
                                  </button>
                                ) : (
                                  <span className="pm-na">—</span>
                                )}
                              </td>
                            </tr>

                            {/* Expanded Specialized Features Drawer / Sub-row */}
                            {openMoreModule === modKey && more.length > 0 && (
                              <tr className="pm-more-tray-row">
                                <td colSpan="6" className="pm-more-tray-cell">
                                  <div className="pm-more-features-cloud">
                                    <div className="pm-more-title">Specialized Permissions:</div>
                                    <div className="pm-more-items-grid">
                                      {more.map((featKey) => {
                                        const featLabel = modDef.features[featKey] || featKey;
                                        const isFeatActive = Boolean(modPerms[featKey]);

                                        return (
                                          <label key={featKey} className="pm-more-item-card">
                                            <input
                                              type="checkbox"
                                              checked={isFeatActive}
                                              onChange={() => onFeatureToggle(modKey, featKey)}
                                              disabled={saving}
                                            />
                                            <span className="pm-more-item-label">{featLabel}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unsaved Changes Floating Bar */}
      {isDirty && (
        <div className="perm-floating-save-bar" role="alert">
          <div className="pfs-info">
            <Info size={16} />
            <span>You have unsaved changes in this permissions matrix.</span>
          </div>
          <div className="pfs-actions">
            <button
              type="button"
              className="ro-btn ro-btn--secondary ro-btn--sm"
              onClick={onDiscard}
              disabled={saving}
            >
              <RotateCcw size={14} /> Discard
            </button>
            <button
              type="button"
              className="ro-btn ro-btn--primary ro-btn--sm"
              onClick={onSave}
              disabled={saving}
            >
              <Save size={14} />
              {saving ? 'Saving...' : (isSystemRole ? 'Save as Custom Role' : 'Save Changes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

