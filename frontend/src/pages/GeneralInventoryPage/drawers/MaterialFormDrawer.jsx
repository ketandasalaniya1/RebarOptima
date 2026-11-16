import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import InventoryDrawer from './InventoryDrawer';
import { Input, Select, Textarea } from '../../../components/ui';

const DEFAULT_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'Chemicals',
  'Fire Safety',
  'Tools & Hardware',
  'Stationery',
  'Finishing & Paints',
  'Safety & PPE',
  'Mechanical & Machinery',
  'Other'
];

const COMMON_UOMS = [
  'Nos',
  'Bags',
  'Mtr',
  'Kg',
  'Ltr',
  'Box',
  'Bundle',
  'Roll',
  'Set',
  'Sq.Mtr',
  'Pair'
];

export default function MaterialFormDrawer({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  editingMaterial = null,
  duplicateWarning = null,
  categoryOptions = DEFAULT_CATEGORIES,
  uomOptions = COMMON_UOMS
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electrical');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [uom, setUom] = useState('Nos');
  const [isCustomUom, setIsCustomUom] = useState(false);
  const [customUom, setCustomUom] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [materialCode, setMaterialCode] = useState('');
  const [brandOrModel, setBrandOrModel] = useState('');
  const [sizeOrSpec, setSizeOrSpec] = useState('');
  const [description, setDescription] = useState('');
  const [preferredVendor, setPreferredVendor] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (editingMaterial) {
        setName(editingMaterial.name || '');
        const isCustomCat = editingMaterial.category && !DEFAULT_CATEGORIES.filter(c => c !== 'Other').includes(editingMaterial.category);
        const isCustUom = editingMaterial.uom && !COMMON_UOMS.includes(editingMaterial.uom);

        setIsCustomCategory(Boolean(isCustomCat));
        setCustomCategory(isCustomCat ? editingMaterial.category : '');
        setCategory(isCustomCat ? 'Other' : (editingMaterial.category || 'Electrical'));

        setIsCustomUom(Boolean(isCustUom));
        setCustomUom(isCustUom ? editingMaterial.uom : '');
        setUom(isCustUom ? 'Other' : (editingMaterial.uom || 'Nos'));

        setSubcategory(editingMaterial.subcategory || '');
        setLowStockThreshold(editingMaterial.lowStockThreshold ?? 5);
        setMaterialCode(editingMaterial.materialCode || '');
        setBrandOrModel(editingMaterial.brandOrModel || '');
        setSizeOrSpec(editingMaterial.sizeOrSpec || '');
        setDescription(editingMaterial.description || '');
        setPreferredVendor(editingMaterial.preferredVendor || '');
        setRemarks(editingMaterial.remarks || '');
      } else {
        setName('');
        setCategory('Electrical');
        setIsCustomCategory(false);
        setCustomCategory('');
        setSubcategory('');
        setUom('Nos');
        setIsCustomUom(false);
        setCustomUom('');
        setLowStockThreshold(5);
        setMaterialCode('');
        setBrandOrModel('');
        setSizeOrSpec('');
        setDescription('');
        setPreferredVendor('');
        setRemarks('');
      }
      setShowOptionalFields(false);
      setFormErrors({});
    }
  }, [isOpen, editingMaterial]);

  const handleCategoryChange = (e) => {
    const val = e.target.value;
    setCategory(val);
    if (val === 'Other') {
      setIsCustomCategory(true);
    } else {
      setIsCustomCategory(false);
      setCustomCategory('');
    }
  };

  const handleUomChange = (e) => {
    const val = e.target.value;
    setUom(val);
    if (val === 'Other') {
      setIsCustomUom(true);
    } else {
      setIsCustomUom(false);
      setCustomUom('');
    }
  };

  const handleFormSubmit = (e, forceDuplicate = false) => {
    if (e) e.preventDefault();
    const errors = {};

    if (!name.trim()) errors.name = 'Material name is required';

    const finalCat = (isCustomCategory || category === 'Other') ? customCategory.trim() : (category || '').trim();
    if (!finalCat) errors.category = 'Category is required';

    const finalUom = (isCustomUom || uom === 'Other') ? customUom.trim() : (uom || '').trim();
    if (!finalUom) errors.uom = 'UOM is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: name.trim(),
      category: finalCat,
      subcategory: subcategory.trim(),
      uom: finalUom,
      lowStockThreshold: Number(lowStockThreshold) >= 0 ? Number(lowStockThreshold) : 5,
      materialCode: materialCode.trim(),
      brandOrModel: brandOrModel.trim(),
      sizeOrSpec: sizeOrSpec.trim(),
      description: description.trim(),
      preferredVendor: preferredVendor.trim(),
      remarks: remarks.trim(),
      forceDuplicateConfirmed: forceDuplicate
    };

    onSubmit(payload, forceDuplicate);
  };

  return (
    <InventoryDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingMaterial ? 'Edit Material Specifications' : 'Register New Material Item'}
      subtitle={editingMaterial ? `Update details for "${editingMaterial.name}"` : 'Add an item to the master construction inventory register'}
      icon={editingMaterial ? Edit2 : Tag}
      width="540px"
      footer={
        <div className="gi-drawer-footer-actions">
          <button
            type="button"
            className="gi-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="gi-btn-primary"
            onClick={(e) => handleFormSubmit(e, false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : editingMaterial ? 'Save Changes' : 'Register Material'}
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => handleFormSubmit(e, false)} className="gi-drawer-form">
        {/* Duplicate warning notification */}
        {duplicateWarning && (
          <div className="gi-alert-banner warning">
            <AlertTriangle size={20} />
            <div>
              <strong>Duplicate Material Name Warning:</strong> {duplicateWarning.message || 'A material with this name already exists.'}
              <div style={{ marginTop: '0.4rem' }}>
                <button
                  type="button"
                  className="gi-btn-sm"
                  style={{ background: '#f59e0b', color: '#fff', border: 'none' }}
                  onClick={(e) => handleFormSubmit(e, true)}
                >
                  Confirm & Create Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Material Name */}
        <div className="gi-form-group">
          <label className="gi-form-label">
            Material Name <span className="gi-required">*</span>
          </label>
          <Input
            type="text"
            className={`gi-input-field ${formErrors.name ? 'has-error' : ''}`}
            placeholder="e.g. PVC Conduit Pipe 25mm, Bosch GSB 500W Drill..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {formErrors.name && <div className="gi-field-error-msg">{formErrors.name}</div>}
        </div>

        {/* Category & UOM */}
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Category <span className="gi-required">*</span>
            </label>
            <Select
              className={`gi-input-field ${formErrors.category ? 'has-error' : ''}`}
              value={category}
              onChange={handleCategoryChange}
            >
              {categoryOptions.filter(c => c !== 'Other').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Other">+ Other (Custom Category)</option>
            </Select>
            {isCustomCategory && (
              <Input
                type="text"
                className="gi-input-field"
                style={{ marginTop: '0.4rem' }}
                placeholder="Type custom category name..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            )}
            {formErrors.category && <div className="gi-field-error-msg">{formErrors.category}</div>}
          </div>

          <div className="gi-form-group">
            <label className="gi-form-label">
              Unit of Measurement (UOM) <span className="gi-required">*</span>
            </label>
            <Select
              className={`gi-input-field ${formErrors.uom ? 'has-error' : ''}`}
              value={uom}
              onChange={handleUomChange}
            >
              {uomOptions.filter(u => u !== 'Other').map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value="Other">+ Other (Custom UOM)</option>
            </Select>
            {isCustomUom && (
              <Input
                type="text"
                className="gi-input-field"
                style={{ marginTop: '0.4rem' }}
                placeholder="Type custom unit (e.g. Drum)..."
                value={customUom}
                onChange={(e) => setCustomUom(e.target.value)}
              />
            )}
            {formErrors.uom && <div className="gi-field-error-msg">{formErrors.uom}</div>}
          </div>
        </div>

        {/* Low Stock Alert Threshold */}
        <div className="gi-form-row two-col">
          <div className="gi-form-group">
            <label className="gi-form-label">
              Low Stock Alert Threshold
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              className="gi-input-field"
              placeholder="e.g. 5"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
            />
            <span className="gi-field-hint">Triggers yellow warning badge when stock drops below this.</span>
          </div>

          <div className="gi-form-group">
            <label className="gi-form-label">Item / Material Code</label>
            <Input
              type="text"
              className="gi-input-field"
              placeholder="e.g. ELEC-042"
              value={materialCode}
              onChange={(e) => setMaterialCode(e.target.value)}
            />
          </div>
        </div>

        {/* Optional Collapsible Details */}
        <div className="gi-optional-accordion">
          <button
            type="button"
            className="gi-accordion-toggle"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
          >
            <span>{showOptionalFields ? '− Hide' : '+ Show'} Optional Specifications (Brand, Size, Vendor)</span>
            {showOptionalFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showOptionalFields && (
            <div className="gi-accordion-content">
              <div className="gi-form-row two-col">
                <div className="gi-form-group">
                  <label className="gi-form-label">Brand / Manufacturer</label>
                  <Input
                    type="text"
                    className="gi-input-field"
                    placeholder="e.g. Bosch, Finolex, UltraTech"
                    value={brandOrModel}
                    onChange={(e) => setBrandOrModel(e.target.value)}
                  />
                </div>

                <div className="gi-form-group">
                  <label className="gi-form-label">Size / Specification</label>
                  <Input
                    type="text"
                    className="gi-input-field"
                    placeholder="e.g. 25mm Heavy Duty 3-core"
                    value={sizeOrSpec}
                    onChange={(e) => setSizeOrSpec(e.target.value)}
                  />
                </div>
              </div>

              <div className="gi-form-row two-col">
                <div className="gi-form-group">
                  <label className="gi-form-label">Subcategory</label>
                  <Input
                    type="text"
                    className="gi-input-field"
                    placeholder="e.g. Power Tools, Cables"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                  />
                </div>

                <div className="gi-form-group">
                  <label className="gi-form-label">Preferred Vendor</label>
                  <Input
                    type="text"
                    className="gi-input-field"
                    placeholder="e.g. National Hardware"
                    value={preferredVendor}
                    onChange={(e) => setPreferredVendor(e.target.value)}
                  />
                </div>
              </div>

              <div className="gi-form-group">
                <label className="gi-form-label">Description / Remarks</label>
                <Textarea
                  className="gi-textarea-field"
                  rows={2}
                  placeholder="Storage guidelines, safety precautions, maintenance notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </InventoryDrawer>
  );
}

