import React, { useState } from 'react';
import { GitBranch, X, Shield, Plus } from 'lucide-react';
import './ShapeDetailsModal.css';

export default function NewVersionModal({
  isOpen,
  shape,
  onClose,
  onCreateVersion
}) {
  const [bumpType, setBumpType] = useState('minor'); // 'minor' | 'major'
  const [changeSummary, setChangeSummary] = useState('');

  if (!isOpen || !shape) return null;

  const currentVerNum = parseFloat(shape.version || '1.0') || 1.0;
  const minorNext = (currentVerNum + 0.1).toFixed(1);
  const majorNext = `${Math.floor(currentVerNum) + 1}.0`;
  const nextVer = bumpType === 'major' ? majorNext : minorNext;

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateVersion({
      bumpType,
      newVersion: nextVer,
      changeSummary: changeSummary.trim() || `Version ${nextVer} created from ${shape.version || '1.0'}`
    });
  };

  return (
    <div className="shape-details-backdrop" onClick={onClose}>
      <div
        className="shape-details-modal"
        style={{ maxWidth: '580px', height: 'auto', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <header className="shape-details-header">
          <div className="shape-header-main">
            <h2 className="shape-header-title">
              <GitBranch size={18} className="text-cyan" />
              <span>Create New Version for "{shape.name}"</span>
            </h2>
          </div>
          <button className="shape-header-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '16px', background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Current Active Version
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', marginTop: '2px' }}>
                v{shape.version || '1.0'}
              </div>
            </div>

            {/* Version Bump Type Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label className="shape-info-label" style={{ display: 'block', marginBottom: '8px' }}>
                Select Version Increment:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  onClick={() => setBumpType('minor')}
                  style={{
                    background: bumpType === 'minor' ? 'rgba(56, 189, 248, 0.12)' : '#0f172a',
                    border: `1px solid ${bumpType === 'minor' ? '#38bdf8' : '#1e293b'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                    Minor Bump: v{minorNext}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                    Refinements, parameter tweaks, or small hook revisions.
                  </div>
                </div>

                <div
                  onClick={() => setBumpType('major')}
                  style={{
                    background: bumpType === 'major' ? 'rgba(56, 189, 248, 0.12)' : '#0f172a',
                    border: `1px solid ${bumpType === 'major' ? '#38bdf8' : '#1e293b'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                    Major Bump: v{majorNext}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                    Significant topological or standard code geometry changes.
                  </div>
                </div>
              </div>
            </div>

            {/* Change Summary */}
            <div style={{ marginBottom: '10px' }}>
              <label className="shape-info-label" style={{ display: 'block', marginBottom: '4px' }}>
                Change Summary / Engineering Notes *
              </label>
              <textarea
                required
                className="shape-param-input"
                style={{ width: '100%', height: '80px', textAlign: 'left', padding: '8px 12px', fontSize: '13px', resize: 'none' }}
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g. Updated 135° hook tail formula and minimum mandrel diameter..."
              />
            </div>

            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} color="#059669" />
              <span><strong>Version Immutability:</strong> Calculations using v{shape.version || '1.0'} remain pinned and immutable.</span>
            </div>
          </div>

          <footer className="shape-details-footer">
            <button type="button" className="shape-btn shape-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="shape-btn shape-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch size={16} />
              <span>Publish Version {nextVer} (Draft)</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

