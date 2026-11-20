import React from 'react';
import { Tag, CheckCircle2, Database, Check, Sparkles, AlertCircle, Layers } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import './CommitBatchDrawer.css';
import { Input } from '../../../components/ui';

/**
 * Slide-over Drawer for Committing Optimization Results to Yard Inventory
 * Preserves 3-step animated progress view and audit breakdown.
 */
export default function CommitBatchDrawer({
  isOpen,
  onClose,
  batchNameInput,
  setBatchNameInput,
  handleConfirmSaveBatch,
  saveLoading,
  saveSuccess,
  saveStep,
  saveError,
  summaryData,
}) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={saveLoading ? undefined : onClose}
      title="Save & Commit Cutting Batch"
      subtitle="Deduct used stock bars from yard inventory and register reusable offcuts"
      icon={<Layers size={20} className="text-emerald" />}
      width="540px"
      ariaLabel="Commit Batch Drawer"
      footer={
        !saveLoading && !saveSuccess ? (
          <div className="commit-drawer-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirmSaveBatch}
              disabled={!batchNameInput.trim()}
            >
              <CheckCircle2 size={16} /> Save & Commit Batch
            </button>
          </div>
        ) : null
      }
    >
      <div className="commit-drawer-content">
        {!saveLoading && !saveSuccess ? (
          <>
            <div className="form-group">
              <label className="commit-field-label">Batch Reference / Name *</label>
              <Input
                type="text"
                className="commit-text-input"
                value={batchNameInput}
                onChange={(e) => setBatchNameInput(e.target.value)}
                placeholder="e.g. Batch #14/11/26 - Ground Floor Columns"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && batchNameInput.trim()) {
                    handleConfirmSaveBatch();
                  }
                }}
              />
              <span className="commit-field-hint">
                This name will be recorded permanently in the Material Ledger and Batch History.
              </span>
            </div>

            {/* Audit Pre-Commit Breakdown */}
            {summaryData && (
              <div className="commit-audit-card">
                <h4 className="audit-card-title">Pre-Commit Material Audit</h4>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-lbl">Prime Stock Bars Used</span>
                    <span className="audit-val">{summaryData.totalBarsUsed || 0} bars</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-lbl">Total Steel Cut</span>
                    <span className="audit-val text-blue">{(summaryData.totalCutWeightKg ? (summaryData.totalCutWeightKg / 1000).toFixed(2) : '0.00')} MT</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-lbl">Reusable Remnants Saved</span>
                    <span className="audit-val text-emerald">{summaryData.totalRemnantsKg ? summaryData.totalRemnantsKg.toFixed(2) : '0.00'} kg</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-lbl">Scrap Offcuts Audited</span>
                    <span className="audit-val text-rose">{summaryData.totalScrapKg ? summaryData.totalScrapKg.toFixed(2) : '0.00'} kg</span>
                  </div>
                </div>
              </div>
            )}

            {saveError && (
              <div className="drawer-alert error">
                <AlertCircle size={15} />
                <span>{saveError}</span>
              </div>
            )}
          </>
        ) : (
          /* 3-Step Animated Commit Progress View */
          <div className="save-commit-progress-view">
            <div className="save-commit-loader-anim-wrap">
              <div className="save-loader-halo"></div>
              <div className="save-loader-ring-outer"></div>
              <div className="save-loader-ring-inner"></div>
              <div className="save-loader-center-icon">
                {saveSuccess ? (
                  <Check size={28} className="save-icon-success" />
                ) : (
                  <Database size={24} className="save-icon-pulsing" />
                )}
              </div>
            </div>

            <h3 className="save-progress-title">
              {saveSuccess ? 'Batch Committed Successfully!' : 'Saving & Committing Batch...'}
            </h3>

            <p className="save-progress-subtitle">
              {saveSuccess
                ? 'Inventory updated and history record created. Redirecting...'
                : saveStep === 1
                ? 'Verifying cut layouts and material allocation...'
                : saveStep === 2
                ? 'Deducting stock bars & creating remnant inventory...'
                : 'Committing transaction to audit ledger and batch history...'}
            </p>

            <div className="save-progress-bar-track">
              <div
                className={`save-progress-bar-fill step-${saveStep} ${saveSuccess ? 'complete' : ''}`}
                style={{
                  width: saveSuccess
                    ? '100%'
                    : saveStep === 1
                    ? '30%'
                    : saveStep === 2
                    ? '65%'
                    : '90%',
                }}
              >
                <div className="save-progress-bar-shimmer"></div>
              </div>
            </div>

            <div className="save-step-badges">
              <div className={`save-step-item ${saveStep >= 1 ? 'active' : ''} ${saveStep > 1 || saveSuccess ? 'done' : ''}`}>
                <div className="step-dot">{saveStep > 1 || saveSuccess ? <Check size={11} /> : '1'}</div>
                <span>Verify</span>
              </div>
              <div className={`save-step-item ${saveStep >= 2 ? 'active' : ''} ${saveStep > 2 || saveSuccess ? 'done' : ''}`}>
                <div className="step-dot">{saveStep > 2 || saveSuccess ? <Check size={11} /> : '2'}</div>
                <span>Stock Deduct</span>
              </div>
              <div className={`save-step-item ${saveStep >= 3 ? 'active' : ''} ${saveSuccess ? 'done' : ''}`}>
                <div className="step-dot">{saveSuccess ? <Check size={11} /> : '3'}</div>
                <span>Ledger Commit</span>
              </div>
            </div>

            <div className="save-loader-note">
              <Sparkles size={13} color="#10b981" />
              <span>CraveToBuild inventory & wastage engine is synchronizing data</span>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

