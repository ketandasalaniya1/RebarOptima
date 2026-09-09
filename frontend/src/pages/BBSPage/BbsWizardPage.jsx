import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ChevronLeft, Plus, Save, Trash2, Calculator, Info } from 'lucide-react';
import { bbsApi } from '../../utils/api';
import { setView } from '../../store/slices/routingSlice';
import { setLoading, setError } from '../../store/slices/bbsSlice';
import './BbsWizardPage.css';

const CONCRETE_GRADES = ['M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'];
const STEEL_GRADES = ['Fe250', 'Fe415', 'Fe500', 'Fe500D', 'Fe550'];
const DIAMETERS = [8, 10, 12, 16, 20, 25, 32, 40];

export default function BbsWizardPage() {
  const dispatch = useDispatch();
  
  // Context from SessionStorage (passed from Dashboard)
  const [context, setContext] = useState(null);
  
  // Master Member State
  const [member, setMember] = useState({
    member_id: '',
    template_id: '',
    concrete_grade: 'M25',
    steel_grade: 'Fe500',
    clear_cover: 25,
    dimensions: { length: 0, width: 0, depth: 0 },
    concrete_volume: 0,
    total_steel_weight: 0,
  });

  // Rebar Items State
  const [rebars, setRebars] = useState([]);

  // Reference Data
  const [templates, setTemplates] = useState([]);
  const [shapes, setShapes] = useState([]);

  useEffect(() => {
    const rawContext = sessionStorage.getItem('bbs_wizard_context');
    if (rawContext) {
      const parsed = JSON.parse(rawContext);
      setContext(parsed);
      setMember(prev => ({
        ...prev,
        concrete_grade: parsed.concreteGrade || prev.concrete_grade,
        steel_grade: parsed.steelGrade || prev.steel_grade,
      }));
      if (parsed.memberId) {
        loadExistingMember(parsed.memberId);
      }
    }
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    try {
      const [tData, sData] = await Promise.all([
        bbsApi.getTemplates(),
        bbsApi.getShapes()
      ]);
      // If templates/shapes aren't seeded yet, add dummy fallback
      setTemplates(tData.length ? tData : [{ _id: 'dummy', category: 'Custom Element', is_custom: true }]);
      setShapes(sData.length ? sData : [{ _id: 'dummy-straight', shape_code: 'Straight', is_custom: false }]);
    } catch (err) {
      console.error(err);
    }
  };

  const loadExistingMember = async (memberId) => {
    try {
      dispatch(setLoading(true));
      const mData = await bbsApi.getMember(memberId);
      setMember(mData);
      const rData = await bbsApi.getRebarItems(memberId);
      setRebars(rData);
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  // ── Auto Calculate Concrete Volume ──
  useEffect(() => {
    const l = parseFloat(member.dimensions.length) || 0;
    const w = parseFloat(member.dimensions.width) || 0;
    const d = parseFloat(member.dimensions.depth) || 0;
    const vol = (l * w * d) / 1000000000; // mm3 to m3
    setMember(prev => ({ ...prev, concrete_volume: vol }));
  }, [member.dimensions]);

  // ── Auto Calculate Steel Weight ──
  useEffect(() => {
    const totalW = rebars.reduce((sum, r) => {
      const dia = parseFloat(r.diameter) || 0;
      const count = parseFloat(r.bar_count) || 0;
      const cut = parseFloat(r.cut_length) || 0;
      const unitW = Math.pow(dia, 2) / 162.27; // kg/m
      const w = (cut * count / 1000) * unitW;
      return sum + w;
    }, 0);
    setMember(prev => ({ ...prev, total_steel_weight: totalW }));
  }, [rebars]);

  const handleAddRebar = () => {
    setRebars([...rebars, {
      _id: `temp_${Date.now()}`,
      description: 'Main Bar',
      diameter: 12,
      shape_id: shapes[0]?._id || '',
      spacing: 150,
      bar_count: 1,
      cut_length: 1000,
    }]);
  };

  const handleRebarChange = (id, field, value) => {
    setRebars(rebars.map(r => r._id === id ? { ...r, [field]: value } : r));
  };

  const handleRemoveRebar = (id) => {
    setRebars(rebars.filter(r => r._id !== id));
  };

  const handleSave = async () => {
    try {
      dispatch(setLoading(true));
      let savedMemberId = member._id;

      // 1. Save Member
      const memberPayload = {
        member_id: member.member_id || 'M-New',
        project_id: context.projectId,
        block_id: context.blockId,
        level_id: context.levelId,
        template_id: member.template_id || templates[0]?._id,
        concrete_grade: member.concrete_grade,
        steel_grade: member.steel_grade,
        clear_cover: member.clear_cover,
        dimensions: member.dimensions,
      };

      if (savedMemberId) {
        await bbsApi.updateMember(savedMemberId, memberPayload);
      } else {
        const res = await bbsApi.createMember(memberPayload);
        savedMemberId = res._id;
      }

      // 2. Save Rebars (simplistic replace strategy for this iteration)
      // First, get existing rebars to delete them (dirty but works for sync)
      const existingRebars = await bbsApi.getRebarItems(savedMemberId);
      for (let er of existingRebars) {
        await bbsApi.deleteRebarItem(er._id);
      }

      // Re-insert current state
      for (let r of rebars) {
        await bbsApi.addRebarItem({
          member_id: savedMemberId,
          shape_id: r.shape_id || shapes[0]?._id,
          description: r.description,
          diameter: parseInt(r.diameter),
          spacing: parseInt(r.spacing) || 0,
          bar_count: parseInt(r.bar_count) || 1,
          part_dimensions: {}, // omitted for simplicity in this view
          cut_length: parseInt(r.cut_length) || 0,
        });
      }

      dispatch(setView('bbs-dashboard'));
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  if (!context) return null;

  return (
    <div className="bbs-wizard-page">
      <div className="bbs-wizard-header">
        <div className="bbs-wizard-title">
          <button className="bbs-wizard-back-btn" onClick={() => dispatch(setView('bbs-dashboard'))}>
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <h1>Member Calculation Wizard</h1>
          <p className="bbs-wizard-subtitle">Design element geometry and define rebar cutting rules.</p>
        </div>
      </div>

      <div className="bbs-wizard-content">
        {/* Main Content Area */}
        <div className="bbs-wizard-main">
          
          {/* Section 1: Header Profile */}
          <div className="bbs-wizard-section">
            <div className="bbs-section-header">
              <h2><Info size={18} /> Element Identification</h2>
            </div>
            <div className="bbs-form-grid">
              <div className="bbs-form-group">
                <label>Element Type (Template)</label>
                <select
                  className="bbs-input"
                  value={member.template_id}
                  onChange={e => {
                    const selectedTemplate = templates.find(t => t._id === e.target.value);
                    let newConcreteGrade = member.concrete_grade;
                    
                    if (selectedTemplate && context && context.concreteGrades) {
                      const cat = selectedTemplate.category?.toLowerCase();
                      if (cat && context.concreteGrades[cat]) {
                        newConcreteGrade = context.concreteGrades[cat];
                      }
                    }
                    
                    setMember({ 
                      ...member, 
                      template_id: e.target.value,
                      concrete_grade: newConcreteGrade
                    });
                  }}
                >
                  <option value="">Select Template...</option>
                  {templates.map(t => <option key={t._id} value={t._id}>{t.category} {t.is_custom ? '(Custom)' : ''}</option>)}
                </select>
              </div>
              <div className="bbs-form-group">
                <label>Tracking ID (e.g., C1, B2)</label>
                <input
                  type="text"
                  className="bbs-input"
                  value={member.member_id}
                  onChange={e => setMember({ ...member, member_id: e.target.value })}
                  placeholder="Member ID"
                />
              </div>
              <div className="bbs-form-group">
                <label>Concrete Grade (Ld driver)</label>
                <select
                  className="bbs-input"
                  value={member.concrete_grade}
                  onChange={e => setMember({ ...member, concrete_grade: e.target.value })}
                >
                  {CONCRETE_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="bbs-form-group">
                <label>Steel Grade</label>
                <select
                  className="bbs-input"
                  value={member.steel_grade}
                  onChange={e => setMember({ ...member, steel_grade: e.target.value })}
                >
                  {STEEL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="bbs-form-group">
                <label>Clear Cover (mm)</label>
                <input
                  type="number"
                  className="bbs-input"
                  value={member.clear_cover}
                  onChange={e => setMember({ ...member, clear_cover: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Geometry */}
          <div className="bbs-wizard-section">
            <div className="bbs-section-header">
              <h2><Calculator size={18} /> Geometric Inputs (mm)</h2>
            </div>
            <div className="bbs-form-grid">
              <div className="bbs-form-group">
                <label>Gross Length</label>
                <input
                  type="number"
                  className="bbs-input"
                  value={member.dimensions.length}
                  onChange={e => setMember({ ...member, dimensions: { ...member.dimensions, length: e.target.value } })}
                />
              </div>
              <div className="bbs-form-group">
                <label>Gross Width</label>
                <input
                  type="number"
                  className="bbs-input"
                  value={member.dimensions.width}
                  onChange={e => setMember({ ...member, dimensions: { ...member.dimensions, width: e.target.value } })}
                />
              </div>
              <div className="bbs-form-group">
                <label>Gross Depth</label>
                <input
                  type="number"
                  className="bbs-input"
                  value={member.dimensions.depth}
                  onChange={e => setMember({ ...member, dimensions: { ...member.dimensions, depth: e.target.value } })}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Rebar Table */}
          <div className="bbs-wizard-section" style={{ flex: 1 }}>
            <div className="bbs-section-header">
              <h2><Calculator size={18} /> Reinforcement Line Items</h2>
            </div>
            
            <div className="bbs-rebar-table-wrapper">
              <table className="bbs-rebar-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Dia (mm)</th>
                    <th>Shape</th>
                    <th>Spacing</th>
                    <th>Qty</th>
                    <th>Cut Len (mm)</th>
                    <th width="40"></th>
                  </tr>
                </thead>
                <tbody>
                  {rebars.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                        No rebar items added. Click below to add.
                      </td>
                    </tr>
                  ) : rebars.map(r => (
                    <tr key={r._id}>
                      <td>
                        <input className="bbs-table-input" value={r.description} onChange={e => handleRebarChange(r._id, 'description', e.target.value)} />
                      </td>
                      <td>
                        <select className="bbs-table-input" value={r.diameter} onChange={e => handleRebarChange(r._id, 'diameter', e.target.value)}>
                          {DIAMETERS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="bbs-table-input" value={r.shape_id} onChange={e => handleRebarChange(r._id, 'shape_id', e.target.value)}>
                          {shapes.map(s => <option key={s._id} value={s._id}>{s.shape_code}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="number" className="bbs-table-input" value={r.spacing} onChange={e => handleRebarChange(r._id, 'spacing', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" className="bbs-table-input" value={r.bar_count} onChange={e => handleRebarChange(r._id, 'bar_count', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" className="bbs-table-input" value={r.cut_length} onChange={e => handleRebarChange(r._id, 'cut_length', e.target.value)} />
                      </td>
                      <td>
                        <button className="bbs-icon-btn" onClick={() => handleRemoveRebar(r._id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="bbs-add-row-btn" onClick={handleAddRebar}>
              <Plus size={16} /> Add Rebar Line
            </button>
          </div>

        </div>

        {/* Sidebar Summary */}
        <div className="bbs-wizard-sidebar">
          <div className="bbs-summary-panel">
            <h3>Live Calculation</h3>
            
            <div className="bbs-summary-item">
              <span className="bbs-summary-label">Gross Dimensions</span>
              <span className="bbs-summary-value">
                {member.dimensions.length} × {member.dimensions.width} × {member.dimensions.depth}
              </span>
            </div>
            
            <div className="bbs-summary-item">
              <span className="bbs-summary-label">Concrete Volume</span>
              <span className="bbs-summary-value highlight">
                {member.concrete_volume.toFixed(3)} m³
              </span>
            </div>

            <div className="bbs-summary-item">
              <span className="bbs-summary-label">Line Items</span>
              <span className="bbs-summary-value">{rebars.length}</span>
            </div>

            <div className="bbs-summary-item">
              <span className="bbs-summary-label">Total Steel Weight</span>
              <span className="bbs-summary-value highlight" style={{ color: '#ec4899' }}>
                {member.total_steel_weight.toFixed(2)} kg
              </span>
            </div>

            <button className="bbs-save-member-btn" onClick={handleSave}>
              <Save size={18} /> Save & Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
