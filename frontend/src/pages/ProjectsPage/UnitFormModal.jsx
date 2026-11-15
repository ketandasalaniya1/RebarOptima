import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Layers,
  Home,
  DollarSign,
  Maximize2,
  Compass,
  Check,
  AlertCircle,
  Loader2,
  Tag,
} from 'lucide-react';
import './UnitFormModal.css';

export default function UnitFormModal({
  isOpen,
  onClose,
  onSave,
  unit = null,
  block = null,
  floor = null,
  masterData = null,
}) {
  const isEditing = Boolean(unit?._id || unit?.id);

  // Form states
  const [unitNumber, setUnitNumber] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [configuration, setConfiguration] = useState('2 BHK');
  const [carpetAreaSqFt, setCarpetAreaSqFt] = useState('');
  const [builtUpAreaSqFt, setBuiltUpAreaSqFt] = useState('');
  const [saleableAreaSqFt, setSaleableAreaSqFt] = useState('');
  const [balconyAreaSqFt, setBalconyAreaSqFt] = useState('');
  const [areaUnit, setAreaUnit] = useState('sq.ft');
  const [facing, setFacing] = useState('East');
  const [basePrice, setBasePrice] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('Available');
  const [selectedSpecs, setSelectedSpecs] = useState([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Options from global master data
  const unitTypes = masterData?.unitTypes || [
    'Apartment',
    'Commercial Office',
    'Retail Shop',
    'Penthouse',
    'Villa',
    'Duplex',
    'Studio',
  ];
  const unitConfigurations = masterData?.unitConfigurations || [
    '1 BHK',
    '2 BHK',
    '3 BHK',
    '4 BHK',
    'Penthouse',
    'Studio',
    'Commercial Office',
    'Retail Shop',
  ];
  const unitSpecifications = masterData?.unitSpecifications || [
    'Modular Kitchen',
    'Vitrified Flooring',
    'Balcony Deck',
    'Covered Parking',
    'Video Door Phone',
    'Piped Gas Connection',
    'Fire Sprinklers',
  ];
  const areaUnits = masterData?.areaMeasurementOptions || ['sq.ft', 'sq.m', 'sq.yd'];
  const facingOptions = masterData?.facingOptions || [
    'East',
    'West',
    'North',
    'South',
    'North-East',
    'North-West',
    'South-East',
    'South-West',
  ];
  const statusOptions = masterData?.availabilityStatuses || [
    'Available',
    'Held',
    'Reserved',
    'Booked',
    'Blocked',
    'Sold',
  ];

  // Populate form on edit or open
  useEffect(() => {
    if (unit) {
      setUnitNumber(unit.unitNumber || '');
      setPropertyType(unit.propertyType || unitTypes[0] || 'Apartment');
      setConfiguration(unit.configuration || unitConfigurations[0] || '2 BHK');
      setCarpetAreaSqFt(unit.carpetAreaSqFt ? String(unit.carpetAreaSqFt) : '');
      setBuiltUpAreaSqFt(unit.builtUpAreaSqFt ? String(unit.builtUpAreaSqFt) : '');
      setSaleableAreaSqFt(unit.saleableAreaSqFt ? String(unit.saleableAreaSqFt) : '');
      setBalconyAreaSqFt(unit.balconyAreaSqFt ? String(unit.balconyAreaSqFt) : '');
      setAreaUnit(unit.areaUnit || 'sq.ft');
      setFacing(unit.facing || 'East');
      setBasePrice(unit.basePrice ? String(unit.basePrice) : '');
      setAskingPrice(unit.askingPrice ? String(unit.askingPrice) : '');
      setAvailabilityStatus(unit.availabilityStatus || 'Available');
      setSelectedSpecs(
        Array.isArray(unit.specifications)
          ? unit.specifications
          : Array.isArray(unit.features)
            ? unit.features
            : [],
      );
      setNotes(unit.notes || unit.description || '');
    } else {
      setUnitNumber('');
      setPropertyType(unitTypes[0] || 'Apartment');
      setConfiguration(unitConfigurations[1] || '2 BHK');
      setCarpetAreaSqFt('');
      setBuiltUpAreaSqFt('');
      setSaleableAreaSqFt('');
      setBalconyAreaSqFt('');
      setAreaUnit('sq.ft');
      setFacing('East');
      setBasePrice('');
      setAskingPrice('');
      setAvailabilityStatus('Available');
      setSelectedSpecs(['Modular Kitchen', 'Vitrified Flooring']);
      setNotes('');
    }
    setError('');
  }, [unit, isOpen]);

  // Auto-calculate suggested built-up and saleable area when carpet area changes
  const handleCarpetAreaChange = (val) => {
    setCarpetAreaSqFt(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (!builtUpAreaSqFt || !isEditing) {
        setBuiltUpAreaSqFt(String(Math.round(num * 1.2)));
      }
      if (!saleableAreaSqFt || !isEditing) {
        setSaleableAreaSqFt(String(Math.round(num * 1.35)));
      }
    }
  };

  const toggleSpec = (spec) => {
    setSelectedSpecs((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedNum = unitNumber.trim();
    if (!trimmedNum) {
      setError('Unit number is required (e.g. 101, 102)');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const payload = {
      unitNumber: trimmedNum,
      propertyType,
      configuration,
      carpetAreaSqFt: Number(carpetAreaSqFt) || 0,
      builtUpAreaSqFt: Number(builtUpAreaSqFt) || 0,
      saleableAreaSqFt: Number(saleableAreaSqFt) || 0,
      balconyAreaSqFt: Number(balconyAreaSqFt) || 0,
      areaUnit,
      facing,
      basePrice: Number(basePrice) || 0,
      askingPrice: Number(askingPrice) || Number(basePrice) || 0,
      availabilityStatus,
      specifications: selectedSpecs,
      features: selectedSpecs,
      notes: notes.trim(),
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save unit');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ufm-backdrop" onClick={onClose}>
      <div className="ufm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ufm-header">
          <div className="ufm-header-info">
            <Building2 size={20} className="ufm-header-icon" />
            <div>
              <h3 className="ufm-title">{isEditing ? 'Edit Unit Details' : 'Add New Unit'}</h3>
              <p className="ufm-subtitle">
                {block?.name} • {floor?.name} ({floor?.floorNumber !== undefined ? `Level ${floor.floorNumber}` : ''})
              </p>
            </div>
          </div>
          <button type="button" className="ufm-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="ufm-error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="ufm-form">
          <div className="ufm-scroll-content">
            {/* Section 1: Basic Unit Identification */}
            <div className="ufm-section">
              <h4 className="ufm-section-title">
                <Home size={14} /> Basic Unit Details
              </h4>
              <div className="ufm-grid-3">
                <div className="ufm-field">
                  <label className="ufm-label">
                    Unit Number / Flat No. <span className="ufm-req">*</span>
                  </label>
                  <input
                    type="text"
                    className="ufm-input"
                    placeholder="e.g. 101, A-101"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="ufm-field">
                  <label className="ufm-label">Unit Type (Global)</label>
                  <select
                    className="ufm-select"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                  >
                    {unitTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ufm-field">
                  <label className="ufm-label">Configuration</label>
                  <select
                    className="ufm-select"
                    value={configuration}
                    onChange={(e) => setConfiguration(e.target.value)}
                  >
                    {unitConfigurations.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ufm-grid-2" style={{ marginTop: '12px' }}>
                <div className="ufm-field">
                  <label className="ufm-label">Facing / Direction</label>
                  <select
                    className="ufm-select"
                    value={facing}
                    onChange={(e) => setFacing(e.target.value)}
                  >
                    {facingOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ufm-field">
                  <label className="ufm-label">Availability / Booking Status</label>
                  <select
                    className="ufm-select"
                    value={availabilityStatus}
                    onChange={(e) => setAvailabilityStatus(e.target.value)}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Area Measurements */}
            <div className="ufm-section">
              <h4 className="ufm-section-title">
                <Maximize2 size={14} /> Area Measurements
              </h4>
              <div className="ufm-grid-4">
                <div className="ufm-field">
                  <label className="ufm-label">Carpet Area (RERA)</label>
                  <div className="ufm-input-addon">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ufm-input"
                      placeholder="e.g. 950"
                      value={carpetAreaSqFt}
                      onChange={(e) => handleCarpetAreaChange(e.target.value)}
                    />
                    <span className="ufm-addon-text">{areaUnit}</span>
                  </div>
                </div>

                <div className="ufm-field">
                  <label className="ufm-label">Built-up Area</label>
                  <div className="ufm-input-addon">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ufm-input"
                      placeholder="e.g. 1150"
                      value={builtUpAreaSqFt}
                      onChange={(e) => setBuiltUpAreaSqFt(e.target.value)}
                    />
                    <span className="ufm-addon-text">{areaUnit}</span>
                  </div>
                </div>

                <div className="ufm-field">
                  <label className="ufm-label">Super Built-up Area</label>
                  <div className="ufm-input-addon">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ufm-input"
                      placeholder="e.g. 1320"
                      value={saleableAreaSqFt}
                      onChange={(e) => setSaleableAreaSqFt(e.target.value)}
                    />
                    <span className="ufm-addon-text">{areaUnit}</span>
                  </div>
                </div>

                <div className="ufm-field">
                  <label className="ufm-label">Balcony Area</label>
                  <div className="ufm-input-addon">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="ufm-input"
                      placeholder="e.g. 80"
                      value={balconyAreaSqFt}
                      onChange={(e) => setBalconyAreaSqFt(e.target.value)}
                    />
                    <span className="ufm-addon-text">{areaUnit}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>
                  Measurement Standard:{' '}
                </span>
                {areaUnits.map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`ufm-chip-btn ${areaUnit === u ? 'active' : ''}`}
                    onClick={() => setAreaUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 3: Commercials & Pricing */}
            <div className="ufm-section">
              <h4 className="ufm-section-title">
                <DollarSign size={14} /> Commercials &amp; Base Price
              </h4>
              <div className="ufm-grid-2">
                <div className="ufm-field">
                  <label className="ufm-label">Base Agreement Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="ufm-input"
                    placeholder="e.g. 6500000"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                  />
                  {basePrice && Number(basePrice) > 0 && (
                    <span className="ufm-hint">
                      ₹{Number(basePrice).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                <div className="ufm-field">
                  <label className="ufm-label">Asking / Listing Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="ufm-input"
                    placeholder="e.g. 7200000"
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                  />
                  {askingPrice && Number(askingPrice) > 0 && (
                    <span className="ufm-hint">
                      ₹{Number(askingPrice).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Specifications (Reusing Global Master Data) */}
            <div className="ufm-section">
              <h4 className="ufm-section-title">
                <Tag size={14} /> Unit Specifications (Global Single Source of Truth)
              </h4>
              <p style={{ margin: '0 0 10px', fontSize: '0.76rem', color: 'var(--text-muted, #94a3b8)' }}>
                Select standard specifications shared with Unit Inventory and Real Estate CRM:
              </p>
              <div className="ufm-specs-grid">
                {unitSpecifications.map((spec) => {
                  const isChecked = selectedSpecs.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      className={`ufm-spec-pill ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleSpec(spec)}
                    >
                      <span className="ufm-spec-check">
                        {isChecked && <Check size={12} />}
                      </span>
                      <span>{spec}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 5: Description & Notes */}
            <div className="ufm-section">
              <label className="ufm-label">Description &amp; Additional Details</label>
              <textarea
                className="ufm-textarea"
                rows={2}
                placeholder="e.g. North-facing garden view apartment with cross ventilation, Italian marble in living room, premium fixtures..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="ufm-footer">
            <button
              type="button"
              className="ufm-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ufm-save-btn"
              disabled={isSubmitting || !unitNumber.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="ufm-spin" />
                  <span>Saving Unit…</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>{isEditing ? 'Save Changes' : 'Create Unit'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

