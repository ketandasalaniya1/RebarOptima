import React, { useState } from 'react';

const DEFAULT_INGREDIENTS_M25 = [
  {
    ingredientId: 'ing_cem_1',
    materialIdentifier: 'MAT-CEM-OPC53-UT',
    specificationStandard: 'IS 269:2015',
    name: 'OPC 53 Grade Cement',
    category: 'CEMENT',
    quantityPerM3: 350,
    baseUnit: 'KG',
    displayUnit: 'BAGS_50KG',
    wastageAllowancePercent: 1.5
  },
  {
    ingredientId: 'ing_sand_1',
    materialIdentifier: 'MAT-SAND-MSAND-Z2',
    specificationStandard: 'IS 383:2016 Zone II',
    name: 'M-Sand (Zone II)',
    category: 'FINE_AGGREGATE',
    quantityPerM3: 750,
    baseUnit: 'KG',
    displayUnit: 'METRIC_TONNE',
    aggregateBasis: 'SSD',
    waterAbsorptionPercent: 1.5,
    moistureCorrectionPercent: 0,
    wastageAllowancePercent: 2.0
  },
  {
    ingredientId: 'ing_agg10_1',
    materialIdentifier: 'MAT-AGG-10MM-GRANITE',
    specificationStandard: 'IS 383:2016',
    name: '10mm Coarse Aggregate',
    category: 'COARSE_AGGREGATE',
    quantityPerM3: 450,
    baseUnit: 'KG',
    displayUnit: 'METRIC_TONNE',
    aggregateBasis: 'SSD',
    waterAbsorptionPercent: 0.8,
    moistureCorrectionPercent: 0,
    wastageAllowancePercent: 1.5
  },
  {
    ingredientId: 'ing_agg20_1',
    materialIdentifier: 'MAT-AGG-20MM-GRANITE',
    specificationStandard: 'IS 383:2016',
    name: '20mm Coarse Aggregate',
    category: 'COARSE_AGGREGATE',
    quantityPerM3: 680,
    baseUnit: 'KG',
    displayUnit: 'METRIC_TONNE',
    aggregateBasis: 'SSD',
    waterAbsorptionPercent: 0.5,
    moistureCorrectionPercent: 0,
    wastageAllowancePercent: 1.5
  },
  {
    ingredientId: 'ing_water_1',
    materialIdentifier: 'MAT-WATER-POTABLE',
    specificationStandard: 'IS 456 Cl. 5.4',
    name: 'Potable Mixing Water',
    category: 'WATER',
    quantityPerM3: 155,
    baseUnit: 'LITERS',
    displayUnit: 'LITERS',
    wastageAllowancePercent: 0
  },
  {
    ingredientId: 'ing_admix_1',
    materialIdentifier: 'MAT-ADMIX-CHRYSO-OPT100',
    specificationStandard: 'ASTM C494 Type F',
    name: 'Superplasticizer Admixture',
    category: 'CHEMICAL_ADMIXTURE',
    quantityPerM3: 2.8,
    baseUnit: 'KG',
    displayUnit: 'KG',
    specificGravity: 1.15,
    wastageAllowancePercent: 0
  }
];

export default function CreateRecipeModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null
}) {
  const [recipeCode, setRecipeCode] = useState(initialData?.recipeCode || '');
  const [grade, setGrade] = useState(initialData?.grade || 'M25');
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [mixType, setMixType] = useState(initialData?.mixType || 'SITE_BATCHING');
  
  const [rmcVendorName, setRmcVendorName] = useState(initialData?.rmcVendorName || '');
  const [rmcMixCode, setRmcMixCode] = useState(initialData?.rmcMixCode || '');
  
  // Engineering Limits
  const [minCement, setMinCement] = useState(initialData?.engineeringLimits?.minCementContentKgPerM3 || 300);
  const [maxTotalBinder, setMaxTotalBinder] = useState(initialData?.engineeringLimits?.maxTotalCementitiousKgPerM3 || 450);
  const [maxWC, setMaxWC] = useState(initialData?.engineeringLimits?.maxWaterCementRatio || 0.45);
  const [maxWCM, setMaxWCM] = useState(initialData?.engineeringLimits?.maxWaterCementitiousRatio || 0.45);
  const [slumpMin, setSlumpMin] = useState(initialData?.engineeringLimits?.targetSlumpMinMm || 120);
  const [slumpMax, setSlumpMax] = useState(initialData?.engineeringLimits?.targetSlumpMaxMm || 150);

  const [ingredients, setIngredients] = useState(initialData?.ingredients || DEFAULT_INGREDIENTS_M25);
  const [submitForReview, setSubmitForReview] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  // Live ratio calculation
  const pureCement = ingredients
    .filter(i => i.category === 'CEMENT')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const scmTotal = ingredients
    .filter(i => i.category === 'SUPPLEMENTARY_CEMENTITIOUS')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const freeWater = ingredients
    .filter(i => i.category === 'WATER')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const totalBinder = pureCement + scmTotal;
  const liveWC = pureCement > 0 && freeWater > 0 ? (freeWater / pureCement) : null;
  const liveWCM = totalBinder > 0 && freeWater > 0 ? (freeWater / totalBinder) : null;

  const handleAddIngredient = () => {
    const newId = `ing_${Date.now()}`;
    setIngredients([
      ...ingredients,
      {
        ingredientId: newId,
        materialIdentifier: `MAT-CUSTOM-${newId}`,
        specificationStandard: 'IS Standard',
        name: 'New Raw Material',
        category: 'FINE_AGGREGATE',
        quantityPerM3: 0,
        baseUnit: 'KG',
        displayUnit: 'KG',
        wastageAllowancePercent: 0
      }
    ]);
  };

  const handleRemoveIngredient = (index) => {
    setIngredients(ingredients.filter((_, idx) => idx !== index));
  };

  const handleIngredientChange = (index, field, value) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!recipeCode.trim() || !displayName.trim()) {
      setErrorMsg('Recipe Code and Display Name are mandatory');
      return;
    }

    if (mixType === 'SITE_BATCHING' && ingredients.length === 0) {
      setErrorMsg('At least one ingredient must be specified for Site Batching');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        recipeCode: recipeCode.trim(),
        grade,
        displayName: displayName.trim(),
        description: description.trim(),
        mixType,
        rmcVendorName: rmcVendorName.trim() || undefined,
        rmcMixCode: rmcMixCode.trim() || undefined,
        engineeringLimits: {
          minCementContentKgPerM3: Number(minCement) || undefined,
          maxTotalCementitiousKgPerM3: Number(maxTotalBinder) || undefined,
          maxWaterCementRatio: Number(maxWC) || undefined,
          maxWaterCementitiousRatio: Number(maxWCM) || undefined,
          targetSlumpMinMm: Number(slumpMin) || undefined,
          targetSlumpMaxMm: Number(slumpMax) || undefined
        },
        ingredients: ingredients.map(ing => ({
          ...ing,
          quantityPerM3: Number(ing.quantityPerM3) || 0,
          specificGravity: ing.specificGravity ? Number(ing.specificGravity) : undefined,
          waterAbsorptionPercent: ing.waterAbsorptionPercent !== undefined ? Number(ing.waterAbsorptionPercent) : undefined,
          moistureCorrectionPercent: ing.moistureCorrectionPercent !== undefined ? Number(ing.moistureCorrectionPercent) : undefined,
          wastageAllowancePercent: ing.wastageAllowancePercent !== undefined ? Number(ing.wastageAllowancePercent) : 0
        })),
        submitForReview
      };

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save mix recipe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="casting-modal-overlay">
      <div className="casting-modal" style={{ maxWidth: '950px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="casting-modal-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Create Concrete Mix Design Recipe</h2>
          <button className="casting-modal-close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', margin: '1rem 1.5rem 0', borderRadius: '6px', fontSize: '0.9rem' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Section 1: Basic Identifiers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label className="casting-label">Recipe Code *</label>
              <input
                type="text"
                className="casting-input"
                placeholder="e.g. REC-M25-PUMP-01"
                value={recipeCode}
                onChange={e => setRecipeCode(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div>
              <label className="casting-label">Concrete Grade *</label>
              <select className="casting-select" value={grade} onChange={e => setGrade(e.target.value)}>
                {['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M60', 'CUSTOM'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="casting-label">Mix Type *</label>
              <select className="casting-select" value={mixType} onChange={e => setMixType(e.target.value)}>
                <option value="SITE_BATCHING">🏗️ Site Batching Plant</option>
                <option value="RMC_PROCUREMENT">🚚 Ready-Mix Concrete (RMC)</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="casting-label">Display Name *</label>
              <input
                type="text"
                className="casting-input"
                placeholder="e.g. M25 Standard Slab & Beam Concrete"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 2: Live Engineering Limits & Ratios Bar */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#334155' }}>⚙️ Engineering Parameters & Limits</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Min Cement (kg/m³)</label>
                <input type="number" className="casting-input" value={minCement} onChange={e => setMinCement(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Max Total Binder (kg/m³)</label>
                <input type="number" className="casting-input" value={maxTotalBinder} onChange={e => setMaxTotalBinder(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Max w/c Ratio</label>
                <input type="number" step="0.01" className="casting-input" value={maxWC} onChange={e => setMaxWC(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Max w/cm Ratio</label>
                <input type="number" step="0.01" className="casting-input" value={maxWCM} onChange={e => setMaxWCM(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Slump Min (mm)</label>
                <input type="number" className="casting-input" value={slumpMin} onChange={e => setSlumpMin(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Slump Max (mm)</label>
                <input type="number" className="casting-input" value={slumpMax} onChange={e => setSlumpMax(e.target.value)} />
              </div>
            </div>

            {/* Live Indicator Badges */}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Pure Cement: </span>
                <strong>{pureCement} kg/m³</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Total Binder: </span>
                <strong>{totalBinder} kg/m³</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Free Water: </span>
                <strong>{freeWater} L/m³</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Live w/c Ratio: </span>
                <strong style={{ color: liveWC && liveWC > maxWC ? '#dc2626' : '#16a34a' }}>
                  {liveWC ? liveWC.toFixed(3) : 'N/A'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Live w/cm Ratio: </span>
                <strong style={{ color: liveWCM && liveWCM > maxWCM ? '#dc2626' : '#16a34a' }}>
                  {liveWCM ? liveWCM.toFixed(3) : 'N/A'}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 3: Ingredients Proportions Table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>🧪 Mix Proportions per 1.0 m³ Concrete</h4>
              <button type="button" className="casting-btn casting-btn-secondary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }} onClick={handleAddIngredient}>
                ➕ Add Ingredient
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <table className="casting-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Material Code / SKU</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Qty / m³</th>
                    <th>Base Unit</th>
                    <th>Display Unit</th>
                    <th>Wastage %</th>
                    <th>Specific Gravity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, idx) => (
                    <tr key={ing.ingredientId || idx}>
                      <td>
                        <input
                          type="text"
                          className="casting-input"
                          style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                          value={ing.materialIdentifier}
                          onChange={e => handleIngredientChange(idx, 'materialIdentifier', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="casting-input"
                          style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                          value={ing.name}
                          onChange={e => handleIngredientChange(idx, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="casting-select"
                          style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                          value={ing.category}
                          onChange={e => handleIngredientChange(idx, 'category', e.target.value)}
                        >
                          <option value="CEMENT">Cement</option>
                          <option value="SUPPLEMENTARY_CEMENTITIOUS">SCM (Fly Ash/GGBS)</option>
                          <option value="FINE_AGGREGATE">Fine Aggregate</option>
                          <option value="COARSE_AGGREGATE">Coarse Aggregate</option>
                          <option value="WATER">Water</option>
                          <option value="CHEMICAL_ADMIXTURE">Chemical Admixture</option>
                          <option value="READY_MIX_CONCRETE">RMC Bulk</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          className="casting-input"
                          style={{ width: '80px', fontSize: '0.8rem', padding: '0.3rem' }}
                          value={ing.quantityPerM3}
                          onChange={e => handleIngredientChange(idx, 'quantityPerM3', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="casting-select"
                          style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                          value={ing.baseUnit}
                          onChange={e => handleIngredientChange(idx, 'baseUnit', e.target.value)}
                        >
                          <option value="KG">KG</option>
                          <option value="LITERS">LITERS</option>
                          <option value="M3">M3</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="casting-select"
                          style={{ fontSize: '0.8rem', padding: '0.3rem' }}
                          value={ing.displayUnit}
                          onChange={e => handleIngredientChange(idx, 'displayUnit', e.target.value)}
                        >
                          <option value="KG">KG</option>
                          <option value="BAGS_50KG">BAGS_50KG</option>
                          <option value="METRIC_TONNE">METRIC_TONNE</option>
                          <option value="LITERS">LITERS</option>
                          <option value="M3">M3</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          className="casting-input"
                          style={{ width: '60px', fontSize: '0.8rem', padding: '0.3rem' }}
                          value={ing.wastageAllowancePercent || 0}
                          onChange={e => handleIngredientChange(idx, 'wastageAllowancePercent', e.target.value)}
                        />
                      </td>
                      <td>
                        {ing.category === 'CHEMICAL_ADMIXTURE' ? (
                          <input
                            type="number"
                            step="0.01"
                            className="casting-input"
                            placeholder="e.g. 1.15"
                            style={{ width: '70px', fontSize: '0.8rem', padding: '0.3rem' }}
                            value={ing.specificGravity || ''}
                            onChange={e => handleIngredientChange(idx, 'specificGravity', e.target.value)}
                          />
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="casting-btn casting-btn-danger"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() => handleRemoveIngredient(idx)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Modal Actions */}
          <div className="casting-modal-footer" style={{ padding: 0, marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={submitForReview}
                onChange={e => setSubmitForReview(e.target.checked)}
              />
              <span>Submit for Technical Review immediately</span>
            </label>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="casting-btn casting-btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="casting-btn casting-btn-primary" disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Recipe'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
