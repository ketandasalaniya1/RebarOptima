import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  ShieldCheck,
  Building2,
  Truck,
  Droplets,
  Scale,
  SlidersHorizontal,
  Info,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  ChevronRight,
  Save,
  X
} from 'lucide-react';

const PRESETS = {
  M15: {
    grade: 'M15',
    codePrefix: 'REC-M15-PCC',
    displayName: 'M15 Plain Cement Concrete (PCC / Blinding)',
    description: 'IS 456 / IS 10262 standard mix for leveling course and mass concrete foundations.',
    mixType: 'SITE_BATCHING',
    minCement: 240,
    maxTotalBinder: 450,
    maxWC: 0.60,
    maxWCM: 0.60,
    slumpMin: 50,
    slumpMax: 75,
    ingredients: [
      {
        ingredientId: 'ing_cem_m15',
        materialIdentifier: 'MAT-CEM-OPC43',
        specificationStandard: 'IS 8112:2013',
        name: 'OPC 43 Grade Cement',
        category: 'CEMENT',
        quantityPerM3: 240,
        baseUnit: 'KG',
        displayUnit: 'BAGS_50KG',
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_sand_m15',
        materialIdentifier: 'MAT-SAND-MSAND-Z2',
        specificationStandard: 'IS 383 Zone II',
        name: 'M-Sand (Zone II)',
        category: 'FINE_AGGREGATE',
        quantityPerM3: 860,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 1.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 2.0
      },
      {
        ingredientId: 'ing_agg20_m15',
        materialIdentifier: 'MAT-AGG-20MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '20mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 1140,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_wtr_m15',
        materialIdentifier: 'MAT-WATER-POTABLE',
        specificationStandard: 'IS 456 Cl. 5.4',
        name: 'Potable Mixing Water',
        category: 'WATER',
        quantityPerM3: 144,
        baseUnit: 'LITERS',
        displayUnit: 'LITERS',
        wastageAllowancePercent: 0
      }
    ]
  },
  M20: {
    grade: 'M20',
    codePrefix: 'REC-M20-STD',
    displayName: 'M20 Standard Structural Concrete',
    description: 'IS 10262 standard design for residential footings, plinth beams, and lintels.',
    mixType: 'SITE_BATCHING',
    minCement: 300,
    maxTotalBinder: 450,
    maxWC: 0.50,
    maxWCM: 0.50,
    slumpMin: 100,
    slumpMax: 125,
    ingredients: [
      {
        ingredientId: 'ing_cem_m20',
        materialIdentifier: 'MAT-CEM-OPC53',
        specificationStandard: 'IS 269:2015',
        name: 'OPC 53 Grade Cement',
        category: 'CEMENT',
        quantityPerM3: 320,
        baseUnit: 'KG',
        displayUnit: 'BAGS_50KG',
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_sand_m20',
        materialIdentifier: 'MAT-SAND-MSAND-Z2',
        specificationStandard: 'IS 383 Zone II',
        name: 'M-Sand (Zone II)',
        category: 'FINE_AGGREGATE',
        quantityPerM3: 780,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 1.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 2.0
      },
      {
        ingredientId: 'ing_agg10_m20',
        materialIdentifier: 'MAT-AGG-10MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '10mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 460,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.8,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_agg20_m20',
        materialIdentifier: 'MAT-AGG-20MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '20mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 690,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_wtr_m20',
        materialIdentifier: 'MAT-WATER-POTABLE',
        specificationStandard: 'IS 456 Cl. 5.4',
        name: 'Potable Mixing Water',
        category: 'WATER',
        quantityPerM3: 160,
        baseUnit: 'LITERS',
        displayUnit: 'LITERS',
        wastageAllowancePercent: 0
      },
      {
        ingredientId: 'ing_admix_m20',
        materialIdentifier: 'MAT-ADMIX-PLAST-01',
        specificationStandard: 'IS 9103:1999',
        name: 'Water Reducing Plasticizer',
        category: 'CHEMICAL_ADMIXTURE',
        quantityPerM3: 2.2,
        baseUnit: 'KG',
        displayUnit: 'KG',
        specificGravity: 1.15,
        wastageAllowancePercent: 0
      }
    ]
  },
  M25: {
    grade: 'M25',
    codePrefix: 'REC-M25-PUMP',
    displayName: 'M25 Pumpable RCC (Slabs, Beams & Columns)',
    description: 'High-workability pumpable mix with PCE superplasticizer for medium-rise structural frame.',
    mixType: 'SITE_BATCHING',
    minCement: 320,
    maxTotalBinder: 450,
    maxWC: 0.44,
    maxWCM: 0.44,
    slumpMin: 120,
    slumpMax: 150,
    ingredients: [
      {
        ingredientId: 'ing_cem_m25',
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
        ingredientId: 'ing_sand_m25',
        materialIdentifier: 'MAT-SAND-MSAND-Z2',
        specificationStandard: 'IS 383:2016 Zone II',
        name: 'M-Sand (Zone II)',
        category: 'FINE_AGGREGATE',
        quantityPerM3: 750,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 1.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 2.0
      },
      {
        ingredientId: 'ing_agg10_m25',
        materialIdentifier: 'MAT-AGG-10MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '10mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 450,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.8,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_agg20_m25',
        materialIdentifier: 'MAT-AGG-20MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '20mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 680,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_wtr_m25',
        materialIdentifier: 'MAT-WATER-POTABLE',
        specificationStandard: 'IS 456 Cl. 5.4',
        name: 'Potable Mixing Water',
        category: 'WATER',
        quantityPerM3: 154,
        baseUnit: 'LITERS',
        displayUnit: 'LITERS',
        wastageAllowancePercent: 0
      },
      {
        ingredientId: 'ing_admix_m25',
        materialIdentifier: 'MAT-ADMIX-CHRYSO-OPT100',
        specificationStandard: 'ASTM C494 Type F',
        name: 'PCE Superplasticizer Admixture',
        category: 'CHEMICAL_ADMIXTURE',
        quantityPerM3: 2.8,
        baseUnit: 'KG',
        displayUnit: 'KG',
        specificGravity: 1.15,
        wastageAllowancePercent: 0
      }
    ]
  },
  M30: {
    grade: 'M30',
    codePrefix: 'REC-M30-FA-PUMP',
    displayName: 'M30 Fly Ash Blended Structural Mix',
    description: 'Eco-efficient blended cement mix with 20% Class F Fly Ash for high durability & reduced heat.',
    mixType: 'SITE_BATCHING',
    minCement: 300,
    maxTotalBinder: 450,
    maxWC: 0.45,
    maxWCM: 0.38,
    slumpMin: 130,
    slumpMax: 160,
    ingredients: [
      {
        ingredientId: 'ing_cem_m30',
        materialIdentifier: 'MAT-CEM-OPC53',
        specificationStandard: 'IS 269:2015',
        name: 'OPC 53 Grade Cement',
        category: 'CEMENT',
        quantityPerM3: 330,
        baseUnit: 'KG',
        displayUnit: 'BAGS_50KG',
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_fa_m30',
        materialIdentifier: 'MAT-SCM-FLYASH-F',
        specificationStandard: 'IS 3812 Part 1',
        name: 'Fly Ash (Class F)',
        category: 'SUPPLEMENTARY_CEMENTITIOUS',
        quantityPerM3: 70,
        baseUnit: 'KG',
        displayUnit: 'BAGS_50KG',
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_sand_m30',
        materialIdentifier: 'MAT-SAND-MSAND-Z2',
        specificationStandard: 'IS 383 Zone II',
        name: 'M-Sand (Zone II)',
        category: 'FINE_AGGREGATE',
        quantityPerM3: 740,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 1.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 2.0
      },
      {
        ingredientId: 'ing_agg10_m30',
        materialIdentifier: 'MAT-AGG-10MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '10mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 440,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.8,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_agg20_m30',
        materialIdentifier: 'MAT-AGG-20MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '20mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 670,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_wtr_m30',
        materialIdentifier: 'MAT-WATER-POTABLE',
        specificationStandard: 'IS 456 Cl. 5.4',
        name: 'Potable Mixing Water',
        category: 'WATER',
        quantityPerM3: 152,
        baseUnit: 'LITERS',
        displayUnit: 'LITERS',
        wastageAllowancePercent: 0
      },
      {
        ingredientId: 'ing_admix_m30',
        materialIdentifier: 'MAT-ADMIX-PCE-HIGHPERF',
        specificationStandard: 'IS 9103 / ASTM C494',
        name: 'High-Range Water Reducer (PCE)',
        category: 'CHEMICAL_ADMIXTURE',
        quantityPerM3: 3.2,
        baseUnit: 'KG',
        displayUnit: 'KG',
        specificGravity: 1.12,
        wastageAllowancePercent: 0
      }
    ]
  },
  M40: {
    grade: 'M40',
    codePrefix: 'REC-M40-HIGH-STRENGTH',
    displayName: 'M40 High Strength Structural Concrete',
    description: 'High performance structural mix for heavy columns, shear walls, and post-tensioned transfer slabs.',
    mixType: 'SITE_BATCHING',
    minCement: 340,
    maxTotalBinder: 450,
    maxWC: 0.40,
    maxWCM: 0.33,
    slumpMin: 140,
    slumpMax: 170,
    ingredients: [
      {
        ingredientId: 'ing_cem_m40',
        materialIdentifier: 'MAT-CEM-OPC53-PREM',
        specificationStandard: 'IS 269:2015',
        name: 'OPC 53 Grade Cement',
        category: 'CEMENT',
        quantityPerM3: 370,
        baseUnit: 'KG',
        displayUnit: 'BAGS_50KG',
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_fa_m40',
        materialIdentifier: 'MAT-SCM-MICRO-SILICA',
        specificationStandard: 'ASTM C1240 / IS 15388',
        name: 'Micro Silica / Silica Fume',
        category: 'SUPPLEMENTARY_CEMENTITIOUS',
        quantityPerM3: 30,
        baseUnit: 'KG',
        displayUnit: 'BAGS_50KG',
        wastageAllowancePercent: 1.0
      },
      {
        ingredientId: 'ing_sand_m40',
        materialIdentifier: 'MAT-SAND-MSAND-Z2',
        specificationStandard: 'IS 383 Zone II',
        name: 'M-Sand (Zone II)',
        category: 'FINE_AGGREGATE',
        quantityPerM3: 710,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 1.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 2.0
      },
      {
        ingredientId: 'ing_agg10_m40',
        materialIdentifier: 'MAT-AGG-10MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '10mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 470,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.8,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_agg20_m40',
        materialIdentifier: 'MAT-AGG-20MM-GRANITE',
        specificationStandard: 'IS 383:2016',
        name: '20mm Coarse Aggregate',
        category: 'COARSE_AGGREGATE',
        quantityPerM3: 650,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        waterAbsorptionPercent: 0.5,
        moistureCorrectionPercent: 0,
        wastageAllowancePercent: 1.5
      },
      {
        ingredientId: 'ing_wtr_m40',
        materialIdentifier: 'MAT-WATER-POTABLE',
        specificationStandard: 'IS 456 Cl. 5.4',
        name: 'Potable Mixing Water',
        category: 'WATER',
        quantityPerM3: 140,
        baseUnit: 'LITERS',
        displayUnit: 'LITERS',
        wastageAllowancePercent: 0
      },
      {
        ingredientId: 'ing_admix_m40',
        materialIdentifier: 'MAT-ADMIX-HYPERPLAST',
        specificationStandard: 'ASTM C494 Type F',
        name: 'Hyperplasticizer (PCE 5th Gen)',
        category: 'CHEMICAL_ADMIXTURE',
        quantityPerM3: 4.0,
        baseUnit: 'KG',
        displayUnit: 'KG',
        specificGravity: 1.10,
        wastageAllowancePercent: 0
      }
    ]
  }
};

export default function CreateRecipeModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null
}) {
  const [modalTab, setModalTab] = useState('proportions'); // 'info' | 'proportions' | 'limits'
  
  const [recipeCode, setRecipeCode] = useState('');
  const [grade, setGrade] = useState('M25');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [mixType, setMixType] = useState('SITE_BATCHING');
  
  const [rmcVendorName, setRmcVendorName] = useState('');
  const [rmcMixCode, setRmcMixCode] = useState('');
  const [rmcPlantLocation, setRmcPlantLocation] = useState('');

  // Engineering Limits
  const [minCement, setMinCement] = useState(320);
  const [maxTotalBinder, setMaxTotalBinder] = useState(450);
  const [maxWC, setMaxWC] = useState(0.44);
  const [maxWCM, setMaxWCM] = useState(0.44);
  const [slumpMin, setSlumpMin] = useState(120);
  const [slumpMax, setSlumpMax] = useState(150);

  const [ingredients, setIngredients] = useState(PRESETS.M25.ingredients);
  const [submitForReview, setSubmitForReview] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const applyPreset = (key) => {
    const p = PRESETS[key];
    if (!p) return;
    setGrade(p.grade);
    setRecipeCode(`${p.codePrefix}-${Math.floor(10 + Math.random() * 90)}`);
    setDisplayName(p.displayName);
    setDescription(p.description);
    setMixType(p.mixType);
    setMinCement(p.minCement);
    setMaxTotalBinder(p.maxTotalBinder);
    setMaxWC(p.maxWC);
    setMaxWCM(p.maxWCM);
    setSlumpMin(p.slumpMin);
    setSlumpMax(p.slumpMax);
    setIngredients(JSON.parse(JSON.stringify(p.ingredients)));
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setRecipeCode(initialData.recipeCode || '');
      setGrade(initialData.grade || 'M25');
      setDisplayName(initialData.displayName || '');
      setDescription(initialData.description || '');
      
      const activeVer = initialData.activeVersionDetails || (initialData.versions && initialData.versions[0]) || {};
      setMixType(activeVer.mixType || initialData.mixType || 'SITE_BATCHING');
      setRmcVendorName(activeVer.rmcVendorName || initialData.rmcVendorName || '');
      setRmcMixCode(activeVer.rmcMixCode || initialData.rmcMixCode || '');
      setRmcPlantLocation(activeVer.rmcPlantLocation || initialData.rmcPlantLocation || '');

      const limits = activeVer.engineeringLimits || initialData.engineeringLimits || {};
      setMinCement(limits.minCementContentKgPerM3 || 320);
      setMaxTotalBinder(limits.maxTotalCementitiousKgPerM3 || 450);
      setMaxWC(limits.maxWaterCementRatio || 0.44);
      setMaxWCM(limits.maxWaterCementitiousRatio || 0.44);
      setSlumpMin(limits.targetSlumpMinMm || 120);
      setSlumpMax(limits.targetSlumpMaxMm || 150);

      if (activeVer.ingredients && activeVer.ingredients.length > 0) {
        setIngredients(activeVer.ingredients);
      } else if (initialData.ingredients && initialData.ingredients.length > 0) {
        setIngredients(initialData.ingredients);
      }
    } else {
      // Default to M25 preset
      applyPreset('M25');
    }
  }, [initialData, isOpen]);

  // Live Calculations
  const pureCement = ingredients
    .filter(i => i.category === 'CEMENT')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const scmTotal = ingredients
    .filter(i => i.category === 'SUPPLEMENTARY_CEMENTITIOUS')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const fineAgg = ingredients
    .filter(i => i.category === 'FINE_AGGREGATE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const coarseAgg = ingredients
    .filter(i => i.category === 'COARSE_AGGREGATE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const freeWater = ingredients
    .filter(i => i.category === 'WATER')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const admixtures = ingredients
    .filter(i => i.category === 'CHEMICAL_ADMIXTURE')
    .reduce((s, i) => s + (Number(i.quantityPerM3) || 0), 0);

  const totalBinder = pureCement + scmTotal;
  const totalAggregates = fineAgg + coarseAgg;
  const totalTheoreticalDensity = totalBinder + totalAggregates + freeWater + admixtures;

  const liveWC = pureCement > 0 && freeWater > 0 ? freeWater / pureCement : null;
  const liveWCM = totalBinder > 0 && freeWater > 0 ? freeWater / totalBinder : null;

  const coarseSplit = totalAggregates > 0 ? Math.round((coarseAgg / totalAggregates) * 100) : 0;
  const fineSplit = totalAggregates > 0 ? 100 - coarseSplit : 0;

  const isWcViolated = liveWC !== null && liveWC > maxWC;
  const isBinderViolated = totalBinder > maxTotalBinder;
  const isMinCementViolated = pureCement < minCement;

  const handleAddIngredient = () => {
    const newId = `ing_${Date.now()}`;
    setIngredients([
      ...ingredients,
      {
        ingredientId: newId,
        materialIdentifier: `MAT-CUSTOM-${newId.slice(-4)}`,
        specificationStandard: 'IS Standard',
        name: 'New Mix Material',
        category: 'FINE_AGGREGATE',
        quantityPerM3: 0,
        baseUnit: 'KG',
        displayUnit: 'METRIC_TONNE',
        wastageAllowancePercent: 1.5
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
      setErrorMsg('Recipe Code and Display Name are mandatory.');
      setModalTab('info');
      return;
    }

    if (ingredients.length === 0) {
      setErrorMsg('At least one ingredient is required in the mix design.');
      setModalTab('proportions');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        recipeCode: recipeCode.trim().toUpperCase(),
        grade,
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        mixType,
        rmcVendorName: mixType === 'RMC_PROCUREMENT' ? rmcVendorName.trim() : undefined,
        rmcMixCode: mixType === 'RMC_PROCUREMENT' ? rmcMixCode.trim() : undefined,
        rmcPlantLocation: mixType === 'RMC_PROCUREMENT' ? rmcPlantLocation.trim() : undefined,
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
      setErrorMsg(err.message || 'Failed to save concrete mix recipe');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="casting-modal-backdrop" onClick={onClose}>
      <div
        className="casting-modal large recipe-designer-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '1020px' }}
      >
        {/* Header */}
        <div className="recipe-designer-header">
          <div className="recipe-designer-title-group">
            <div className="recipe-header-icon-wrap">
              <FlaskConical size={22} />
            </div>
            <div>
              <h2 className="recipe-designer-title">
                {initialData ? 'Edit Concrete Mix Design' : 'Design Concrete Mix Recipe (IS 10262)'}
              </h2>
              <p className="recipe-designer-sub">
                Configure ingredient batching proportions per 1.0 m³ and enforce IS 456 durability limits
              </p>
            </div>
          </div>
          <button className="casting-modal-close" onClick={onClose} title="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* IS 10262 Quick Presets Bar */}
        <div className="preset-quick-bar">
          <div className="preset-label">
            <Sparkles size={14} color="#2dd4bf" />
            <span>Load IS 10262 Presets:</span>
          </div>
          <div className="preset-chips">
            {Object.keys(PRESETS).map((k) => (
              <button
                key={k}
                type="button"
                className={`preset-chip ${grade === k ? 'active' : ''}`}
                onClick={() => applyPreset(k)}
              >
                {k} Standard
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="recipe-error-banner">
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Live Calculation & Compliance HUD Ribbon */}
        <div className="recipe-live-hud">
          <div className="hud-metric">
            <span className="hud-lbl">Pure Cement</span>
            <strong className="hud-val">{pureCement} <small>kg/m³</small></strong>
            <span className={`hud-sub ${isMinCementViolated ? 'danger' : 'good'}`}>
              {isMinCementViolated ? `Min ${minCement}kg (Deficit)` : `Min ${minCement}kg (Compliant)`}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-lbl">Total Binder</span>
            <strong className="hud-val">{totalBinder} <small>kg/m³</small></strong>
            <span className={`hud-sub ${isBinderViolated ? 'danger' : 'good'}`}>
              {isBinderViolated ? `Max ${maxTotalBinder}kg (Exceeded)` : `Max ${maxTotalBinder}kg (Compliant)`}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-lbl">Free Water</span>
            <strong className="hud-val">{freeWater} <small>L/m³</small></strong>
            <span className="hud-sub">Mixing Water</span>
          </div>

          <div className="hud-metric">
            <span className="hud-lbl">Live w/c Ratio</span>
            <strong className={`hud-val ${isWcViolated ? 'danger' : 'good'}`}>
              {liveWC ? liveWC.toFixed(3) : 'N/A'}
            </strong>
            <span className={`hud-sub ${isWcViolated ? 'danger' : 'good'}`}>
              {isWcViolated ? `Exceeds ${maxWC} Limit` : `Limit ≤ ${maxWC} (Compliant)`}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-lbl">Live w/cm Ratio</span>
            <strong className="hud-val">
              {liveWCM ? liveWCM.toFixed(3) : 'N/A'}
            </strong>
            <span className="hud-sub">Binder Ratio</span>
          </div>

          <div className="hud-metric">
            <span className="hud-lbl">Density & Split</span>
            <strong className="hud-val">≈ {totalTheoreticalDensity.toFixed(0)} <small>kg</small></strong>
            <span className="hud-sub">C:F = {coarseSplit}:{fineSplit}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="recipe-detail-tabs">
          <button
            type="button"
            className={`recipe-nav-tab ${modalTab === 'proportions' ? 'active' : ''}`}
            onClick={() => setModalTab('proportions')}
          >
            <Layers size={15} /> Mix Proportions per 1.0 m³ ({ingredients.length})
          </button>
          <button
            type="button"
            className={`recipe-nav-tab ${modalTab === 'info' ? 'active' : ''}`}
            onClick={() => setModalTab('info')}
          >
            <FlaskConical size={15} /> General & Identification
          </button>
          <button
            type="button"
            className={`recipe-nav-tab ${modalTab === 'limits' ? 'active' : ''}`}
            onClick={() => setModalTab('limits')}
          >
            <ShieldCheck size={15} /> Engineering Limits & Durability
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tab 1: Mix Proportions Table */}
          {modalTab === 'proportions' && (
            <div className="recipe-designer-content">
              <div className="proportions-table-header-row">
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary, #f8fafc)' }}>
                    Raw Materials & Batching Rates (SSD Condition)
                  </h4>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                    Specify exact quantities per 1.0 m³ concrete. Real-time w/c ratios update automatically.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary-dark"
                  onClick={handleAddIngredient}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                >
                  <Plus size={14} /> Add Material Row
                </button>
              </div>

              <div className="casting-table-container">
                <table className="casting-table proportions-edit-table">
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>SKU / Identifier</th>
                      <th style={{ width: '200px' }}>Material Name</th>
                      <th style={{ width: '160px' }}>Category</th>
                      <th style={{ width: '100px' }}>Qty / m³</th>
                      <th style={{ width: '80px' }}>Base Unit</th>
                      <th style={{ width: '90px' }}>Display Unit</th>
                      <th style={{ width: '80px' }}>Wastage %</th>
                      <th style={{ width: '80px' }}>Sp. Gravity</th>
                      <th style={{ width: '50px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((ing, idx) => (
                      <tr key={ing.ingredientId || idx}>
                        <td>
                          <input
                            type="text"
                            className="casting-input input-compact monospace"
                            value={ing.materialIdentifier}
                            onChange={(e) => handleIngredientChange(idx, 'materialIdentifier', e.target.value)}
                            placeholder="MAT-CODE"
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="casting-input input-compact"
                            value={ing.name}
                            onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                            placeholder="Material name"
                            required
                          />
                        </td>
                        <td>
                          <select
                            className="casting-select input-compact"
                            value={ing.category}
                            onChange={(e) => handleIngredientChange(idx, 'category', e.target.value)}
                          >
                            <option value="CEMENT">Cement</option>
                            <option value="SUPPLEMENTARY_CEMENTITIOUS">SCM (Fly Ash/GGBS)</option>
                            <option value="FINE_AGGREGATE">Fine Agg (Sand)</option>
                            <option value="COARSE_AGGREGATE">Coarse Aggregate</option>
                            <option value="WATER">Water</option>
                            <option value="CHEMICAL_ADMIXTURE">Admixture</option>
                            <option value="READY_MIX_CONCRETE">RMC Bulk</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="casting-input input-compact highlight-input"
                            value={ing.quantityPerM3}
                            onChange={(e) => handleIngredientChange(idx, 'quantityPerM3', e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <select
                            className="casting-select input-compact"
                            value={ing.baseUnit}
                            onChange={(e) => handleIngredientChange(idx, 'baseUnit', e.target.value)}
                          >
                            <option value="KG">KG</option>
                            <option value="LITERS">LITERS</option>
                            <option value="M3">M3</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="casting-select input-compact"
                            value={ing.displayUnit}
                            onChange={(e) => handleIngredientChange(idx, 'displayUnit', e.target.value)}
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
                            min="0"
                            max="50"
                            className="casting-input input-compact"
                            value={ing.wastageAllowancePercent || 0}
                            onChange={(e) => handleIngredientChange(idx, 'wastageAllowancePercent', e.target.value)}
                          />
                        </td>
                        <td>
                          {ing.category === 'CHEMICAL_ADMIXTURE' ? (
                            <input
                              type="number"
                              step="0.01"
                              className="casting-input input-compact"
                              placeholder="1.15"
                              value={ing.specificGravity || ''}
                              onChange={(e) => handleIngredientChange(idx, 'specificGravity', e.target.value)}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.8rem', textAlign: 'center', display: 'block' }}>—</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-icon-danger"
                            onClick={() => handleRemoveIngredient(idx)}
                            title="Delete Material Row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: General & Identification */}
          {modalTab === 'info' && (
            <div className="recipe-designer-content">
              <div className="form-grid-3" style={{ marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Recipe Code *</label>
                  <input
                    type="text"
                    className="form-input monospace"
                    placeholder="e.g. REC-M25-PUMP-01"
                    value={recipeCode}
                    onChange={(e) => setRecipeCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Concrete Grade *</label>
                  <select
                    className="casting-select"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  >
                    {['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M60', 'CUSTOM'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Mix Supply Method *</label>
                  <select
                    className="casting-select"
                    value={mixType}
                    onChange={(e) => setMixType(e.target.value)}
                  >
                    <option value="SITE_BATCHING">Site Batching Plant</option>
                    <option value="RMC_PROCUREMENT">Ready-Mix Concrete (RMC)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Display Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. M25 Standard Slab & Beam Concrete"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Description & Application Scope</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Structural frame mix with slump 140mm, designed for severe exposure per IS 456 Table 5."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {mixType === 'RMC_PROCUREMENT' && (
                <div className="rmc-details-card">
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Truck size={16} /> RMC Vendor & Dispatch Details
                  </h4>
                  <div className="form-grid-3">
                    <div className="form-group">
                      <label className="form-label">RMC Supplier Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. UltraTech Concrete / ACC RMC"
                        value={rmcVendorName}
                        onChange={(e) => setRmcVendorName(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Vendor Mix Code</label>
                      <input
                        type="text"
                        className="form-input monospace"
                        placeholder="e.g. UTC-M25-P-09"
                        value={rmcMixCode}
                        onChange={(e) => setRmcMixCode(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Batch Plant Location</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Peenya Industrial Area Plant 2"
                        value={rmcPlantLocation}
                        onChange={(e) => setRmcPlantLocation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Engineering Limits & Durability */}
          {modalTab === 'limits' && (
            <div className="recipe-designer-content">
              <div className="limits-guide-banner">
                <Info size={16} color="#2dd4bf" />
                <span>
                  These parameters represent threshold criteria evaluated during technical sign-off per IS 456:2000 Table 5.
                </span>
              </div>

              <div className="form-grid-3" style={{ marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Min Pure Cement (kg/m³)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={minCement}
                    onChange={(e) => setMinCement(e.target.value)}
                  />
                  <span className="form-hint">IS 456 Cl. 8.2.4 durability min</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Max Total Binder (kg/m³)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={maxTotalBinder}
                    onChange={(e) => setMaxTotalBinder(e.target.value)}
                  />
                  <span className="form-hint">IS 456 Cl. 8.2.4.2 upper limit 450kg</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Max Permissible w/c Ratio</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={maxWC}
                    onChange={(e) => setMaxWC(e.target.value)}
                  />
                  <span className="form-hint">Target durability envelope</span>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Max Permissible w/cm Ratio</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={maxWCM}
                    onChange={(e) => setMaxWCM(e.target.value)}
                  />
                  <span className="form-hint">Water-to-total-binder ratio</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Slump Min (mm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={slumpMin}
                    onChange={(e) => setSlumpMin(e.target.value)}
                  />
                  <span className="form-hint">Pumping workability floor</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Slump Max (mm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={slumpMax}
                    onChange={(e) => setSlumpMax(e.target.value)}
                  />
                  <span className="form-hint">Segregation safety ceiling</span>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="recipe-designer-footer">
            <label className="recipe-review-checkbox-lbl">
              <input
                type="checkbox"
                checked={submitForReview}
                onChange={(e) => setSubmitForReview(e.target.checked)}
              />
              <span>Submit for Technical Review & QA Sign-off immediately</span>
            </label>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary-dark"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary-teal"
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Save size={16} />
                <span>{saving ? 'Saving Recipe...' : 'Save Mix Recipe'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
