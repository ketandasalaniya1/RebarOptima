import React from 'react';
import { ArrowLeft, Save, FileText, Scissors, CheckCircle, RefreshCw } from 'lucide-react';

export default function WorkspaceHeader({
  member,
  project,
  block,
  level,
  workspaceTitle,
  onSave,
  onClose,
  onExportPDF,
  onPushOptimizer,
  saving = false,
  dirty = false
}) {
  const memberMark = member?.displayId || member?.member_id || 'M1';
  const memberType = member?.memberType || 'Structural Member';
  const concreteGrade = member?.concrete_grade || member?.concreteGrade || 'M25';
  const steelGrade = member?.steel_grade || member?.steelGrade || 'Fe500D';

  return (
    <div className="bbs-workspace-header">
      <div className="bbs-workspace-header-left">
        <button className="bbs-btn bbs-btn-secondary bbs-btn-sm" onClick={onClose} title="Back to Structural Members">
          <ArrowLeft size={16} />
          <span>Back to Members</span>
        </button>

        <div className="bbs-workspace-breadcrumbs">
          <span className="bbs-breadcrumb-part">{project?.name || 'Project'}</span>
          <span className="bbs-breadcrumb-sep">/</span>
          <span className="bbs-breadcrumb-part">{block?.name || 'Block'}</span>
          <span className="bbs-breadcrumb-sep">/</span>
          <span className="bbs-breadcrumb-part">{level?.name || 'Floor'}</span>
          <span className="bbs-breadcrumb-sep">/</span>
          <span className="bbs-breadcrumb-active">{memberMark}</span>
        </div>

        <div className="bbs-workspace-title-box">
          <div className="bbs-member-mark-badge large">
            <span className="bbs-mark-text">{memberMark}</span>
          </div>
          <div>
            <h2 className="bbs-workspace-h2">{workspaceTitle || `${memberType} Detailing Workspace`}</h2>
            <div className="bbs-workspace-meta-tags">
              <span className="bbs-badge bbs-badge-type">{memberType}</span>
              <span className="bbs-badge bbs-badge-grade">{concreteGrade}</span>
              <span className="bbs-badge bbs-badge-steel">{steelGrade}</span>
              {member?.completionPercentage === 100 && (
                <span className="bbs-badge bbs-badge-success">
                  <CheckCircle size={12} />
                  <span>Calculated</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bbs-workspace-header-actions">
        {onExportPDF && (
          <button className="bbs-btn bbs-btn-secondary bbs-btn-sm" onClick={onExportPDF} title="Print / PDF Bar Bending Schedule">
            <FileText size={15} />
            <span>PDF BBS</span>
          </button>
        )}

        {onPushOptimizer && (
          <button className="bbs-btn bbs-btn-secondary bbs-btn-sm" onClick={onPushOptimizer} title="Send cuts to 1D Cutting Optimizer">
            <Scissors size={15} />
            <span>Send to Optimizer</span>
          </button>
        )}

        <button
          className="bbs-btn bbs-btn-primary"
          onClick={onSave}
          disabled={saving}
          title="Save reinforcement detailing & update member BBS schedule"
        >
          {saving ? <RefreshCw size={16} className="bbs-spin" /> : <Save size={16} />}
          <span>{saving ? 'Saving Schedule...' : 'Save Schedule'}</span>
        </button>
      </div>
    </div>
  );
}

