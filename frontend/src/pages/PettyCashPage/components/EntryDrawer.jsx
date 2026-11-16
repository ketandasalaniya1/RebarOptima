import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Calendar,
  Users,
  Tag,
  Check,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import PhotoPicker from './PhotoPicker';
import { formatINR } from '../../../utils/money';
import { Input, Select, Textarea } from '../../../components/ui';

const EXPENSE_SUGGESTIONS = [
  'Tea & snacks for workers',
  'Tempo / auto carriage',
  'Diesel for generator',
  'Binding wire & nails',
  'Material unloading wages',
  'Drinking water cans',
  'Emergency hardware purchase'
];

export default function EntryDrawer({
  isOpen,
  mode = 'DEBIT', // 'DEBIT' | 'CREDIT'
  siteName,
  currentBalance = 0,
  categories = [],
  persons = [],
  currentUser = null,
  onClose,
  onSubmit, // (payload, saveAndAddAnother) => Promise<boolean>
  onAddPersonInline
}) {
  const isCredit = mode === 'CREDIT';

  // Logged in user display name
  const defaultUserName = useMemo(() => {
    if (currentUser?.name) return currentUser.name;
    if (currentUser?.email) return currentUser.email.split('@')[0];
    return 'Site Supervisor';
  }, [currentUser]);

  // Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [personName, setPersonName] = useState('');
  const [isCustomPerson, setIsCustomPerson] = useState(false);
  const [customPersonName, setCustomPersonName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountInputRef = useRef(null);
  const drawerRef = useRef(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Initialize defaults on drawer open or mode switch
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setPhotos([]);
      setShowAdvanced(false);

      if (isCredit) {
        setCategory('Opening Balance');
        setSubcategory('');
        setDescription('');
        // Set first person from persons list if available
        if (persons.length > 0) {
          setPersonName(persons[0].name);
          setIsCustomPerson(false);
        } else {
          setIsCustomPerson(true);
          setCustomPersonName('');
        }
      } else {
        // Debit: choose default non-opening category
        const defaultCat = categories.find(c => c.name !== 'Opening Balance') || categories[0];
        setCategory(defaultCat?.name || 'Site Materials & Supplies');
        setSubcategory('');
        setDescription('');
        setPersonName(defaultUserName);
        setIsCustomPerson(false);
      }

      // Auto-focus amount field
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 120);
    }
  }, [isOpen, mode, categories, persons, isCredit, defaultUserName]);

  // Mobile VisualViewport handling: adjust footer offset above software keyboard
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      const vh = window.innerHeight;
      const vvHeight = window.visualViewport.height;
      const diff = vh - vvHeight;
      setKeyboardOffset(diff > 60 ? diff : 0);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
      window.visualViewport.removeEventListener('scroll', handleResize);
    };
  }, [isOpen]);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Subcategories for current category
  const activeCategoryDoc = useMemo(() => {
    return categories.find(c => c.name === category);
  }, [categories, category]);

  const subcategoriesList = useMemo(() => {
    return activeCategoryDoc?.subcategories || [];
  }, [activeCategoryDoc]);

  // Live Balance After calculation
  const numAmount = Number(amount) || 0;
  const balanceAfter = isCredit ? currentBalance + numAmount : currentBalance - numAmount;
  const isNegative = !isCredit && numAmount > 0 && balanceAfter < 0;

  if (!isOpen) return null;

  const handleFormSubmit = async (e, saveAndAddAnother = false) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid amount.');
      amountInputRef.current?.focus();
      return;
    }

    const finalPerson = isCredit
      ? (isCustomPerson ? customPersonName.trim() : personName.trim())
      : (personName.trim() || defaultUserName);

    if (!finalPerson) {
      alert(isCredit ? 'Please select or enter the person who provided the money.' : 'Please enter the spender name.');
      return;
    }

    // Fast-path description: if user didn't type one, generate a clear default
    const finalDescription = description.trim() || (
      isCredit
        ? `Received cash from ${finalPerson}`
        : (subcategory ? `${category} - ${subcategory}` : `${category}`)
    );

    const payload = {
      siteName,
      type: mode,
      date,
      amount: numAmount,
      personName: finalPerson,
      category: category || (isCredit ? 'Opening Balance' : 'General Expense'),
      subcategory: subcategory || '',
      description: finalDescription,
      photos
    };

    setIsSubmitting(true);
    try {
      const success = await onSubmit(payload, saveAndAddAnother);
      if (success && saveAndAddAnother) {
        // Reset amount & photos for fast next entry
        setAmount('');
        setDescription('');
        setSubcategory('');
        setPhotos([]);
        setTimeout(() => amountInputRef.current?.focus(), 80);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pc-drawer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`pc-entry-drawer ${isCredit ? 'pc-drawer-credit-theme' : 'pc-drawer-debit-theme'}`}
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: keyboardOffset ? `${keyboardOffset}px` : undefined }}
      >
        {/* Drawer Header */}
        <div className="pc-entry-drawer-header">
          <div className="pc-entry-hdr-title-row">
            <div className={`pc-entry-type-pill ${isCredit ? 'pc-pill-credit' : 'pc-pill-debit'}`}>
              {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              <span>{isCredit ? 'Money Received (Credit)' : 'Record Expense (Debit)'}</span>
            </div>
            <span className="pc-entry-site-tag">📍 {siteName}</span>
          </div>

          <button
            type="button"
            className="pc-drawer-close-btn"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form
          className="pc-entry-drawer-body"
          onSubmit={(e) => handleFormSubmit(e, false)}
        >
          {/* 1. Large Hero Amount Input */}
          <div className="pc-entry-amount-block">
            <label className="pc-amount-label">Enter Amount (₹)</label>
            <div className="pc-amount-input-wrap">
              <span className="pc-amount-currency-sym">₹</span>
              <Input
                ref={amountInputRef}
                type="number"
                step="any"
                min="1"
                inputMode="decimal"
                required
                placeholder="0"
                className="pc-amount-big-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Live Balance After calculation */}
            <div className="pc-balance-after-pill">
              <span>Balance After:</span>
              <strong className={isNegative ? 'pc-text-danger' : 'pc-text-success'}>
                {formatINR(balanceAfter)}
              </strong>
            </div>

            {isNegative && (
              <div className="pc-negative-warn-banner">
                <AlertTriangle size={15} />
                <span>Warning: Expense exceeds current site cash balance!</span>
              </div>
            )}
          </div>

          {/* 2. Provider Selection (Credit) OR Category Selection (Debit) */}
          {isCredit ? (
            <div className="pc-form-block">
              <div className="pc-block-hdr">
                <label className="pc-block-title">
                  <Users size={14} /> Who Provided The Money? <span className="pc-req">*</span>
                </label>
                <button
                  type="button"
                  className="pc-link-btn"
                  onClick={() => setIsCustomPerson(prev => !prev)}
                >
                  {isCustomPerson ? '← Choose from list' : '+ New person'}
                </button>
              </div>

              {isCustomPerson ? (
                <Input
                  type="text"
                  required
                  placeholder="Enter full name (e.g. Ketan Dasalaniya)"
                  className="pc-input"
                  value={customPersonName}
                  onChange={(e) => setCustomPersonName(e.target.value)}
                  autoFocus
                />
              ) : (
                <div className="pc-chips-flow">
                  {persons.map((p) => (
                    <button
                      key={p.id || p.name}
                      type="button"
                      className={`pc-choice-chip ${personName === p.name ? 'selected' : ''}`}
                      onClick={() => setPersonName(p.name)}
                    >
                      <span>{p.name}</span>
                      {p.roleOrTitle && <span className="pc-chip-sub">({p.roleOrTitle})</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="pc-choice-chip pc-chip-add-new"
                    onClick={() => {
                      setIsCustomPerson(true);
                      setCustomPersonName('');
                    }}
                  >
                    <Plus size={13} />
                    <span>Other</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pc-form-block">
              <label className="pc-block-title">
                <Tag size={14} /> Select Category <span className="pc-req">*</span>
              </label>

              {/* Large Category Chips */}
              <div className="pc-chips-flow pc-cat-chips-flow">
                {categories
                  .filter(c => c.name !== 'Opening Balance')
                  .map((c) => (
                    <button
                      key={c.id || c.name}
                      type="button"
                      className={`pc-cat-choice-chip ${category === c.name ? 'selected' : ''}`}
                      onClick={() => {
                        setCategory(c.name);
                        setSubcategory('');
                      }}
                    >
                      {category === c.name && <Check size={14} className="pc-check-icon" />}
                      <span>{c.name}</span>
                    </button>
                  ))}
              </div>

              {/* Subcategories (Appears if category has child tags) */}
              {subcategoriesList.length > 0 && (
                <div className="pc-subcat-flow-wrap">
                  <span className="pc-subcat-label">Subcategory (Optional):</span>
                  <div className="pc-chips-flow">
                    {subcategoriesList.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        className={`pc-subcat-chip-btn ${subcategory === sub ? 'selected' : ''}`}
                        onClick={() => setSubcategory(prev => (prev === sub ? '' : sub))}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Photo & Bill Capture (The Fast Camera Option) */}
          <div className="pc-form-block">
            <label className="pc-block-title">
              <Camera size={14} /> Receipt / Bill Photographs
            </label>
            <PhotoPicker
              photos={photos}
              onChange={setPhotos}
              disabled={isSubmitting}
            />
          </div>

          {/* 4. Tap-to-Fill Suggestions for Description (Debit) */}
          {!isCredit && (
            <div className="pc-form-block">
              <div className="pc-suggestions-row">
                <span className="pc-suggestions-label">
                  <Sparkles size={13} /> Quick Suggestions:
                </span>
                <div className="pc-suggestions-chips">
                  {EXPENSE_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      className="pc-suggestion-chip"
                      onClick={() => setDescription(sug)}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pc-form-group">
                <label className="pc-input-label">Description / Remarks (Optional)</label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Purchased 2 rolls binding wire from hardware shop"
                  className="pc-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {isCredit && (
            <div className="pc-form-block">
              <div className="pc-form-group">
                <label className="pc-input-label">Remarks / Note (Optional)</label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Cash handed over for weekly site expenses"
                  className="pc-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* 5. Collapsible "Change Date / Spender" */}
          <div className="pc-advanced-collapse-block">
            <button
              type="button"
              className="pc-collapse-toggle-btn"
              onClick={() => setShowAdvanced(prev => !prev)}
            >
              <Calendar size={14} />
              <span>
                {showAdvanced ? 'Hide date & person details' : `Date: ${date} • ${isCredit ? 'Category' : 'Spent by'}: ${isCredit ? category : personName || defaultUserName}`}
              </span>
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAdvanced && (
              <div className="pc-advanced-fields-box">
                <div className="pc-form-grid-2">
                  <div className="pc-form-group">
                    <label>Date <span className="pc-req">*</span></label>
                    <Input
                      type="date"
                      required
                      className="pc-input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  {!isCredit && (
                    <div className="pc-form-group">
                      <label>Spent By Employee <span className="pc-req">*</span></label>
                      <Input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Supervisor"
                        className="pc-input"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                      />
                    </div>
                  )}

                  {isCredit && (
                    <div className="pc-form-group">
                      <label>Category</label>
                      <Select
                        className="pc-input"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.id || c.name} value={c.name}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Drawer Footer Actions (Fixed above keyboard on mobile) */}
        <div className="pc-entry-drawer-footer">
          <button
            type="button"
            className="pc-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="pc-btn-secondary pc-btn-add-another"
            onClick={(e) => handleFormSubmit(e, true)}
            disabled={isSubmitting || !amount || Number(amount) <= 0}
          >
            Save & Add Another
          </button>

          <button
            type="button"
            className={`pc-btn-primary ${isCredit ? 'pc-btn-save-credit' : 'pc-btn-save-debit'}`}
            onClick={(e) => handleFormSubmit(e, false)}
            disabled={isSubmitting || !amount || Number(amount) <= 0}
          >
            {isSubmitting ? 'Saving...' : isCredit ? 'Save Money In' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}

