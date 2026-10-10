import React, { useState } from 'react';
import { X, Calculator, Edit2, Zap, AlertCircle } from 'lucide-react';
import { castingApi } from '../castingApi';

export default function CreateMemberModal({
  isOpen,
  onClose,
  selectedProject,
  selectedBlock,
  selectedLevel,
  memberTypes,
  onMemberCreated
}) {
  if (!isOpen) return null;

  const [mode, setMode] = useState('single'); // 'single' | 'batch'
  const [memberType, setMemberType] = useState('Slab');
  const [displayId, setDisplayId] = useState('');
  const [description, setDescription] = useState('');
  const [volumeEntryMethod, setVolumeEntryMethod] = useState('DIMENSIONAL_CALC'); // 'DIMENSIONAL_CALC' | 'DIRECT_ENGINEER_ENTRY'

  // Dimensions in mm
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [depthMm, setDepthMm] = useState('');

  // Direct entry
  const [directVolumeM3, setDirectVolumeM3] = useState('');
  const [basisOfCalculation, setBasisOfCalculation] = useState('');

  // Batch Generation State
  const [batchPrefix, setBatchPrefix] = useState('C');
  const [batchStartNum, setBatchStartNum] = useState(1);
  const [batchEndNum, setBatchEndNum] = useState(10);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Calculated preview volume for dimensional calculation
  const calcPreview = () => {
    if (volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY') {
      const val = parseFloat(directVolumeM3);
      return !isNaN(val) && val > 0 ? val.toFixed(3) : '0.000';
    }
    const L = parseFloat(lengthMm);
    const W = parseFloat(widthMm);
    const D = parseFloat(depthMm);
    if (!isNaN(L) && !isNaN(W) && !isNaN(D) && L > 0 && W > 0 && D > 0) {
      return ((L * W * D) / 1e9).toFixed(3);
    }
    return '0.000';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedLevel) {
      setErrorMsg('No active level selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const levelId = selectedLevel.id || selectedLevel._id;
      const projectId = selectedProject?.id || selectedProject?._id;
      const blockId = selectedBlock?.id || selectedBlock?._id;

      if (mode === 'single') {
        if (!displayId.trim()) {
          setErrorMsg('Member mark ID is required (e.g. C1, B2)');
          setIsSubmitting(false);
          return;
        }

        const payload = {
          projectId,
          blockId,
          memberType,
          displayId: displayId.trim().toUpperCase(),
          description: description.trim(),
          volumeEntryMethod
        };

        if (volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY') {
          payload.totalRequiredVolumeM3 = parseFloat(directVolumeM3);
          payload.basisOfCalculation = basisOfCalculation.trim();
        } else {
          payload.dimensions = {
            lengthMm: parseFloat(lengthMm),
            widthMm: parseFloat(widthMm),
            depthMm: parseFloat(depthMm)
          };
        }

        await castingApi.createMember(levelId, payload);
      } else {
        // Batch Mode
        const start = parseInt(batchStartNum, 10);
        const end = parseInt(batchEndNum, 10);
        if (isNaN(start) || isNaN(end) || start > end || end - start > 100) {
          setErrorMsg('Invalid range. Maximum 100 members can be generated in one batch.');
          setIsSubmitting(false);
          return;
        }

        const displayIds = [];
        for (let i = start; i <= end; i++) {
          displayIds.push(`${batchPrefix.trim().toUpperCase()}${i}`);
        }

        const payload = {
          projectId,
          blockId,
          memberType,
          displayIds,
          description: description.trim(),
          volumeEntryMethod
        };

        if (volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY') {
          payload.totalRequiredVolumeM3 = parseFloat(directVolumeM3);
          payload.basisOfCalculation = basisOfCalculation.trim();
        } else {
          payload.dimensions = {
            lengthMm: parseFloat(lengthMm),
            widthMm: parseFloat(widthMm),
            depthMm: parseFloat(depthMm)
          };
        }

        await castingApi.createMembersBatch(levelId, payload);
      }

      onMemberCreated();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="casting-modal-backdrop">
      <div className="casting-modal">
        <div className="casting-modal-header">
          <div>
            <h3 className="casting-modal-title">
              {mode === 'single' ? 'Add Structural Member' : 'Batch Generate Members'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Target: {selectedBlock?.name || 'Block'} • {selectedLevel?.name || 'Level'}
            </span>
          </div>
          <button className="casting-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem 0 1.5rem' }}>
          <button
            type="button"
            className={`casting-tab-btn ${mode === 'single' ? 'active' : ''}`}
            onClick={() => setMode('single')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}
          >
            <Edit2 size={13} /> Single Member
          </button>
          <button
            type="button"
            className={`casting-tab-btn ${mode === 'batch' ? 'active' : ''}`}
            onClick={() => setMode('batch')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}
          >
            <Zap size={13} /> Batch Series Generator
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="casting-modal-body">
            {errorMsg && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={15} />
                {errorMsg}
              </div>
            )}

            {/* Member Type & ID / Range */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Member Element Type *</label>
                <select
                  className="casting-select"
                  value={memberType}
                  onChange={(e) => {
                    setMemberType(e.target.value);
                    if (mode === 'batch') {
                      const prefixMap = { Slab: 'SL', Beam: 'B', Column: 'C', Footing: 'F', Pedestal: 'P', 'Retaining Wall': 'RW', Staircase: 'ST' };
                      setBatchPrefix(prefixMap[e.target.value] || 'M');
                    }
                  }}
                >
                  {memberTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {mode === 'single' ? (
                <div className="form-group">
                  <label className="form-label">Mark / Display ID *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. C1, B-102, SL-1"
                    value={displayId}
                    onChange={(e) => setDisplayId(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Series Prefix *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. C, B, F"
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {mode === 'batch' && (
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Start Number</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchStartNum}
                    onChange={(e) => setBatchStartNum(e.target.value)}
                    min={1}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Number</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchEndNum}
                    onChange={(e) => setBatchEndNum(e.target.value)}
                    min={1}
                    required
                  />
                </div>
              </div>
            )}

            {/* Calculation Method Switcher */}
            <div className="form-group" style={{ marginTop: '0.25rem' }}>
              <label className="form-label">Volume Specification Method</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn-secondary-dark ${volumeEntryMethod === 'DIMENSIONAL_CALC' ? 'border-teal-500 text-teal-300' : ''}`}
                  style={{
                    background: volumeEntryMethod === 'DIMENSIONAL_CALC' ? 'rgba(20, 184, 166, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                    borderColor: volumeEntryMethod === 'DIMENSIONAL_CALC' ? '#2dd4bf' : 'rgba(255, 255, 255, 0.12)',
                    justifyContent: 'center',
                    padding: '0.65rem'
                  }}
                  onClick={() => setVolumeEntryMethod('DIMENSIONAL_CALC')}
                >
                  <Calculator size={14} /> Prismatic (L × W × D)
                </button>
                <button
                  type="button"
                  className={`btn-secondary-dark ${volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY' ? 'border-teal-500 text-teal-300' : ''}`}
                  style={{
                    background: volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY' ? 'rgba(20, 184, 166, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                    borderColor: volumeEntryMethod === 'DIRECT_ENGINEER_ENTRY' ? '#2dd4bf' : 'rgba(255, 255, 255, 0.12)',
                    justifyContent: 'center',
                    padding: '0.65rem'
                  }}
                  onClick={() => setVolumeEntryMethod('DIRECT_ENGINEER_ENTRY')}
                >
                  <Edit2 size={14} /> Complex / Direct Volume
                </button>
              </div>
            </div>

            {/* Dimensional Calculation Inputs */}
            {volumeEntryMethod === 'DIMENSIONAL_CALC' ? (
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Length (mm) *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 6000"
                    value={lengthMm}
                    onChange={(e) => setLengthMm(e.target.value)}
                    min={1}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Width (mm) *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 450"
                    value={widthMm}
                    onChange={(e) => setWidthMm(e.target.value)}
                    min={1}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Depth / Thick (mm) *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 600"
                    value={depthMm}
                    onChange={(e) => setDepthMm(e.target.value)}
                    min={1}
                    required
                  />
                </div>
              </div>
            ) : (
              /* Direct Entry with Mandatory Basis */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Required Concrete Volume (m³) *</label>
                  <input
                    type="number"
                    step="0.001"
                    className="form-input"
                    placeholder="e.g. 4.250"
                    value={directVolumeM3}
                    onChange={(e) => setDirectVolumeM3(e.target.value)}
                    min={0.001}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Basis / Calculation Notes *</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="e.g. Circular Column (Dia: 600mm, H: 3.5m) -> π × r² × h = 0.989 m³"
                    value={basisOfCalculation}
                    onChange={(e) => setBasisOfCalculation(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Live Volume Preview Card */}
            <div className="calc-preview-box">
              <span className="calc-preview-lbl">
                Calculated Target Volume {mode === 'batch' ? '(Per Member)' : ''}:
              </span>
              <span className="calc-preview-val">{calcPreview()} m³</span>
            </div>

            <div className="form-group">
              <label className="form-label">Description / Grid Location (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Grid A1-A4 Main Frame Beam"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="casting-modal-footer">
            <button type="button" className="btn-secondary-dark" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-teal" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : mode === 'single' ? 'Add Member' : 'Generate Series'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
