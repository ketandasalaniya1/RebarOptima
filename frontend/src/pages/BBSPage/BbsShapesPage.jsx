import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Shapes, Cuboid, ChevronLeft } from 'lucide-react';
import { bbsApi } from '../../utils/api';
import { setShapes, setTemplates, setLoading, setError } from '../../store/slices/bbsSlice';
import { setView } from '../../store/slices/routingSlice';
import ShapeRenderer from '../../components/ShapeRenderer/ShapeRenderer';
import './BbsShapesPage.css';

export default function BbsShapesPage() {
  const dispatch = useDispatch();
  const { shapes, templates, loading } = useSelector(s => s.bbs);
  
  const [activeTab, setActiveTab] = useState('shapes'); // 'shapes', 'templates', 'build-shape', 'build-template'
  
  // Custom Form States
  const [newShape, setNewShape] = useState({ shape_code: '', bend_count: 0, bend_45_count: 0, hook_count: 0, bend_180_count: 0 });
  const [newTemplate, setNewTemplate] = useState({ name: '', category: 'Custom Element', description: '' });

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      dispatch(setLoading(true));
      const [sData, tData] = await Promise.all([
        bbsApi.getShapes(),
        bbsApi.getTemplates()
      ]);
      dispatch(setShapes(sData));
      dispatch(setTemplates(tData));
    } catch (err) {
      dispatch(setError(err.message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleCreateShape = async () => {
    try {
      if (!newShape.shape_code) return;
      await bbsApi.createShape({
        ...newShape,
        bend_count: newShape.bend_count || 0,
        bend_45_count: newShape.bend_45_count || 0,
        hook_count: newShape.hook_count || 0,
        bend_180_count: newShape.bend_180_count || 0,
        is_custom: true,
        deduction_logic: { rule: 'standard' }
      });
      setNewShape({ shape_code: '', bend_count: 0, bend_45_count: 0, hook_count: 0, bend_180_count: 0 });
      setActiveTab('shapes');
      loadLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      if (!newTemplate.name) return;
      await bbsApi.createTemplate({
        ...newTemplate,
        is_custom: true,
        default_rebars: []
      });
      setNewTemplate({ name: '', category: 'Custom Element', description: '' });
      setActiveTab('templates');
      loadLibrary();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bbs-shapes-page">
      <div className="bbs-shapes-header">
        <div className="bbs-shapes-title">
          <button className="bbs-shapes-back-btn" style={{ border:'none', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', padding:0, marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.25rem' }} onClick={() => dispatch(setView('bbs-projects'))}>
            <ChevronLeft size={16} /> Back
          </button>
          <h1>BBS — Shape Library & Builder</h1>
          <p>Manage IS standard shapes and create custom geometry templates.</p>
        </div>
        <div className="bbs-shapes-toolbar">
          <button className="bbs-action-btn" onClick={() => setActiveTab('build-shape')}>
            <Plus size={16} /> New Shape
          </button>
          <button className="bbs-action-btn primary" onClick={() => setActiveTab('build-template')}>
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      <div className="bbs-shapes-tabs">
        <button className={`bbs-shapes-tab ${activeTab === 'shapes' ? 'active' : ''}`} onClick={() => setActiveTab('shapes')}>
          <Shapes size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Rebar Shapes
        </button>
        <button className={`bbs-shapes-tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
          <Cuboid size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Element Templates
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading library...</div>
      ) : activeTab === 'shapes' ? (
        <div className="bbs-shapes-grid">
          {shapes.map(s => (
            <div key={s._id} className="bbs-shape-card">
              <span className={`bbs-shape-card-badge ${s.is_custom ? 'custom' : 'is-code'}`}>
                {s.is_custom ? 'Custom' : 'IS Code'}
              </span>
              <div className="bbs-shape-code">{s.shape_code}</div>
              <div className="bbs-shape-meta">
                <span>Bends (90°): {s.bend_count}</span>
                <span>Bends (45°): {s.bend_45_count || 0}</span>
                <span>Hooks (135°): {s.hook_count}</span>
                <span>Hooks (180°): {s.bend_180_count || 0}</span>
              </div>
              <ShapeRenderer shapeCode={s.shape_code} />
            </div>
          ))}
          {shapes.length === 0 && <div style={{ color:'var(--text-secondary)' }}>No shapes found. Database may be empty.</div>}
        </div>
      ) : activeTab === 'templates' ? (
        <div className="bbs-shapes-grid">
          {templates.map(t => (
            <div key={t._id} className="bbs-shape-card">
              <span className={`bbs-shape-card-badge ${t.is_custom ? 'custom' : 'is-code'}`}>
                {t.is_custom ? 'Custom' : 'Standard'}
              </span>
              <div className="bbs-shape-code">{t.name}</div>
              <div className="bbs-shape-meta">
                <span>Category: {t.category}</span>
                <span style={{ marginTop: '0.25rem', opacity: 0.8 }}>{t.description}</span>
              </div>
            </div>
          ))}
          {templates.length === 0 && <div style={{ color:'var(--text-secondary)' }}>No templates found.</div>}
        </div>
      ) : activeTab === 'build-shape' ? (
        <div className="bbs-builder-form">
          <h2>Create Custom Shape</h2>
          <div className="bbs-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bbs-form-group">
              <label>Shape Code (Name)</label>
              <input className="bbs-input" value={newShape.shape_code} onChange={e => setNewShape({ ...newShape, shape_code: e.target.value })} />
            </div>
            <div className="bbs-form-group">
              <label>Bend Count (45° equivalents)</label>
              <input type="number" className="bbs-input" value={newShape.bend_45_count} onChange={e => setNewShape({ ...newShape, bend_45_count: e.target.value === '' ? '' : parseInt(e.target.value, 10) })} />
            </div>
            <div className="bbs-form-group">
              <label>Bend Count (90° equivalents)</label>
              <input type="number" className="bbs-input" value={newShape.bend_count} onChange={e => setNewShape({ ...newShape, bend_count: e.target.value === '' ? '' : parseInt(e.target.value, 10) })} />
            </div>
            <div className="bbs-form-group">
              <label>Hook Count (135° equivalents)</label>
              <input type="number" className="bbs-input" value={newShape.hook_count} onChange={e => setNewShape({ ...newShape, hook_count: e.target.value === '' ? '' : parseInt(e.target.value, 10) })} />
            </div>
            <div className="bbs-form-group">
              <label>Angle Count (180° equivalents)</label>
              <input type="number" className="bbs-input" value={newShape.bend_180_count} onChange={e => setNewShape({ ...newShape, bend_180_count: e.target.value === '' ? '' : parseInt(e.target.value, 10) })} />
            </div>
          </div>
          <div className="bbs-builder-actions">
            <button className="bbs-btn-primary" onClick={handleCreateShape}>Save Custom Shape</button>
            <button className="bbs-btn-secondary" onClick={() => setActiveTab('shapes')}>Cancel</button>
          </div>
        </div>
      ) : activeTab === 'build-template' ? (
        <div className="bbs-builder-form">
          <h2>Create Custom Element Template</h2>
          <div className="bbs-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bbs-form-group">
              <label>Template Name</label>
              <input className="bbs-input" value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} />
            </div>
            <div className="bbs-form-group">
              <label>Category</label>
              <input className="bbs-input" value={newTemplate.category} onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value })} />
            </div>
            <div className="bbs-form-group">
              <label>Description</label>
              <input className="bbs-input" value={newTemplate.description} onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })} />
            </div>
          </div>
          <div className="bbs-builder-actions">
            <button className="bbs-btn-primary" onClick={handleCreateTemplate}>Save Template</button>
            <button className="bbs-btn-secondary" onClick={() => setActiveTab('templates')}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
