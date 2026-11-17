import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Phone,
  MessageCircle,
  Building2,
  Lock,
  Globe,
  MapPin,
  AlertTriangle,
  Check,
  User,
  Tag,
  Briefcase,
} from 'lucide-react';
import { contactsApi } from '../../../utils/contactsApi';

const PHONE_LABELS = ['Mobile', 'Work', 'WhatsApp', 'Site', 'Office', 'Home', 'Other'];

export default function ContactFormModal({
  isOpen,
  onClose,
  initialContact = null,
  categories = [],
  projects = [],
  onSaved,
  onOpenDuplicateContact,
}) {
  const isEditing = Boolean(initialContact?.id || initialContact?._id);

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [visibility, setVisibility] = useState('shared');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Phones repeater
  const [phones, setPhones] = useState([
    { number: '', label: 'Mobile', isPrimary: true, hasWhatsApp: true },
  ]);

  // Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [country, setCountry] = useState('India');
  const [pincode, setPincode] = useState('');

  // Project Associations (array of string IDs)
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);

  // Duplicate warning state
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // New category inline creation
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (initialContact) {
      setName(initialContact.name || '');
      setDesignation(initialContact.designation || '');
      setCompanyName(initialContact.companyName || '');
      setCategoryId(initialContact.categoryId || '');
      setCategoryName(initialContact.categoryName || '');
      setEmail(initialContact.email || '');
      setWebsite(initialContact.website || '');
      setVisibility(initialContact.visibility || 'shared');
      setNotes(initialContact.notes || '');
      setTagsInput(Array.isArray(initialContact.tags) ? initialContact.tags.join(', ') : '');

      if (Array.isArray(initialContact.phones) && initialContact.phones.length > 0) {
        setPhones(initialContact.phones.map((p) => ({ ...p })));
      } else if (initialContact.primaryPhone) {
        setPhones([{ number: initialContact.primaryPhone, label: 'Mobile', isPrimary: true, hasWhatsApp: true }]);
      } else {
        setPhones([{ number: '', label: 'Mobile', isPrimary: true, hasWhatsApp: true }]);
      }

      setStreet(initialContact.address?.street || '');
      setCity(initialContact.address?.city || '');
      setStateVal(initialContact.address?.state || '');
      setCountry(initialContact.address?.country || 'India');
      setPincode(initialContact.address?.pincode || '');

      setSelectedProjectIds((initialContact.projectIds || []).map((p) => String(p)));
    } else {
      // Reset form
      setName('');
      setDesignation('');
      setCompanyName('');
      setCategoryId(categories[0]?.id || categories[0]?._id || '');
      setCategoryName(categories[0]?.name || '');
      setEmail('');
      setWebsite('');
      setVisibility('shared');
      setNotes('');
      setTagsInput('');
      setPhones([{ number: '', label: 'Mobile', isPrimary: true, hasWhatsApp: true }]);
      setStreet('');
      setCity('');
      setStateVal('');
      setCountry('India');
      setPincode('');
      setSelectedProjectIds([]);
    }

    setDuplicateWarning(null);
    setErrorMsg('');
    setIsAddingNewCat(false);
    setNewCatName('');
  }, [isOpen, initialContact, categories]);

  // Check duplicate on blur / change
  const handleCheckPhoneDuplicate = async (phoneNumber, idx) => {
    if (!phoneNumber || phoneNumber.trim().length < 8) return;
    try {
      const excludeId = isEditing ? (initialContact.id || initialContact._id) : null;
      const res = await contactsApi.checkDuplicatePhone(phoneNumber, excludeId);
      if (res?.exists && res.contact) {
        setDuplicateWarning({
          phone: phoneNumber,
          contact: res.contact,
        });
      } else {
        setDuplicateWarning(null);
      }
    } catch (_) {}
  };

  const handleAddPhone = () => {
    setPhones((prev) => [
      ...prev,
      { number: '', label: 'Work', isPrimary: prev.length === 0, hasWhatsApp: false },
    ]);
  };

  const handleRemovePhone = (index) => {
    if (phones.length <= 1) return;
    setPhones((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!next.some((p) => p.isPrimary) && next.length > 0) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  const handlePhoneChange = (index, field, value) => {
    setPhones((prev) => {
      const next = [...prev];
      if (field === 'isPrimary' && value === true) {
        next.forEach((p, i) => {
          p.isPrimary = i === index;
        });
      } else {
        next[index] = { ...next[index], [field]: value };
      }
      return next;
    });
  };

  const toggleProject = (projectId) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  const handleCreateNewCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await contactsApi.createCategory(newCatName.trim());
      setCategoryId(created.id || created._id);
      setCategoryName(created.name);
      setIsAddingNewCat(false);
      setNewCatName('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create category');
    }
  };

  const handleSubmit = async (e, forceDuplicate = false) => {
    if (e) e.preventDefault();

    if (!name.trim()) {
      setErrorMsg('Full Name is required');
      return;
    }

    const validPhones = phones
      .map((p) => ({ ...p, number: p.number.trim() }))
      .filter((p) => p.number.length > 0);

    const payload = {
      name: name.trim(),
      designation: designation.trim(),
      companyName: companyName.trim(),
      categoryId: categoryId || null,
      categoryName: categoryName || 'Other',
      email: email.trim().toLowerCase(),
      website: website.trim(),
      phones: validPhones,
      address: {
        street: street.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        country: country.trim(),
        pincode: pincode.trim(),
      },
      projectIds: selectedProjectIds,
      visibility,
      notes: notes.trim(),
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      forceDuplicate,
    };

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      if (isEditing) {
        await contactsApi.updateContact(initialContact.id || initialContact._id, payload);
      } else {
        await contactsApi.createContact(payload);
      }

      onSaved?.();
      onClose();
    } catch (err) {
      if (err.status === 409 || err.code === 'DUPLICATE_PHONE_DETECTED') {
        setDuplicateWarning({
          phone: validPhones[0]?.number || '',
          contact: err.duplicateContact || { name: 'Existing contact' },
        });
      } else {
        setErrorMsg(err.message || 'Failed to save contact. Please check your entries.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ro-modal-backdrop" onClick={onClose}>
      <div className="ro-modal-container ro-contact-form-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ro-modal-header">
          <div className="ro-modal-title-group">
            <User size={18} className="ro-modal-icon" />
            <div>
              <h3 className="ro-modal-title">{isEditing ? 'Edit Contact' : 'Add New Contact'}</h3>
              <p className="ro-modal-subtitle">
                Centralized across organization • Reusable across all sites & projects
              </p>
            </div>
          </div>
          <button type="button" className="ro-modal-btn-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="ro-contact-form">
          <div className="ro-modal-body">
            {errorMsg && (
              <div className="ro-form-error-alert">
                <AlertTriangle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Live Duplicate Phone Warning Alert */}
            {duplicateWarning && (
              <div className="ro-form-duplicate-alert">
                <div className="ro-dup-alert-top">
                  <AlertTriangle size={16} className="text-warning" />
                  <div className="ro-dup-alert-text">
                    <strong>Phone Number Already Registered:</strong> A contact with this number already belongs to{' '}
                    <strong>{duplicateWarning.contact?.name}</strong>{' '}
                    {duplicateWarning.contact?.companyName && `(${duplicateWarning.contact.companyName})`}.
                  </div>
                </div>
                <div className="ro-dup-alert-actions">
                  {onOpenDuplicateContact && duplicateWarning.contact?.id && (
                    <button
                      type="button"
                      className="ro-btn-dup-action"
                      onClick={() => {
                        onClose();
                        onOpenDuplicateContact(duplicateWarning.contact.id);
                      }}
                    >
                      View Existing Contact
                    </button>
                  )}
                  <button
                    type="button"
                    className="ro-btn-dup-proceed"
                    onClick={() => handleSubmit(null, true)}
                    disabled={isSubmitting}
                  >
                    Save Anyway as Separate Contact
                  </button>
                </div>
              </div>
            )}

            {/* 1. Basic Details */}
            <div className="ro-form-section">
              <h4 className="ro-form-section-title">1. Basic Information</h4>
              <div className="ro-form-grid-2">
                <div className="ro-form-field">
                  <label className="ro-field-label">
                    Full Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Patel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">Category</label>
                  {!isAddingNewCat ? (
                    <div className="ro-cat-select-row">
                      <select
                        value={categoryId}
                        onChange={(e) => {
                          setCategoryId(e.target.value);
                          const matched = categories.find((c) => (c.id || c._id) === e.target.value);
                          if (matched) setCategoryName(matched.name);
                        }}
                        className="ro-select"
                      >
                        {categories.map((c) => (
                          <option key={c.id || c._id} value={c.id || c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ro-btn-add-cat-inline"
                        onClick={() => setIsAddingNewCat(true)}
                        title="Add custom category"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="ro-new-cat-inline-row">
                      <input
                        type="text"
                        placeholder="New category name"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="ro-input"
                      />
                      <button
                        type="button"
                        className="ro-btn-save-cat"
                        onClick={handleCreateNewCategory}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="ro-btn-cancel-cat"
                        onClick={() => setIsAddingNewCat(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">Designation / Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Project Architect"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">Company / Business Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Patel Infrastructure Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="ro-input"
                  />
                </div>
              </div>
            </div>

            {/* 2. Phone Numbers Repeater */}
            <div className="ro-form-section">
              <div className="ro-section-header-flex">
                <h4 className="ro-form-section-title">2. Phone Numbers</h4>
                <button type="button" className="ro-btn-add-phone" onClick={handleAddPhone}>
                  <Plus size={13} />
                  <span>Add Another Number</span>
                </button>
              </div>

              <div className="ro-phones-repeater-list">
                {phones.map((phoneItem, idx) => (
                  <div key={idx} className="ro-phone-repeater-row">
                    <div className="ro-phone-num-input-wrap">
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210 or +91 98765-43210"
                        value={phoneItem.number}
                        onChange={(e) => handlePhoneChange(idx, 'number', e.target.value)}
                        onBlur={() => handleCheckPhoneDuplicate(phoneItem.number, idx)}
                        className="ro-input"
                      />
                    </div>

                    <div className="ro-phone-label-wrap">
                      <select
                        value={phoneItem.label}
                        onChange={(e) => handlePhoneChange(idx, 'label', e.target.value)}
                        className="ro-select"
                      >
                        {PHONE_LABELS.map((lbl) => (
                          <option key={lbl} value={lbl}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="ro-phone-primary-radio" title="Mark as primary phone">
                      <input
                        type="radio"
                        name="primaryPhoneSelector"
                        checked={phoneItem.isPrimary}
                        onChange={() => handlePhoneChange(idx, 'isPrimary', true)}
                      />
                      <span>Primary</span>
                    </label>

                    <label className="ro-phone-wa-check" title="Available on WhatsApp">
                      <input
                        type="checkbox"
                        checked={phoneItem.hasWhatsApp}
                        onChange={(e) => handlePhoneChange(idx, 'hasWhatsApp', e.target.checked)}
                      />
                      <MessageCircle size={13} />
                      <span>WhatsApp</span>
                    </label>

                    {phones.length > 1 && (
                      <button
                        type="button"
                        className="ro-btn-remove-phone"
                        onClick={() => handleRemovePhone(idx)}
                        title="Remove number"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Associated Projects */}
            <div className="ro-form-section">
              <h4 className="ro-form-section-title">3. Associated Projects / Sites</h4>
              <p className="ro-field-hint">
                Select the projects where this contact is actively engaged. The contact record remains centralized.
              </p>

              <div className="ro-project-checkboxes-grid">
                {projects.map((proj) => {
                  const pId = String(proj.id || proj._id);
                  const isChecked = selectedProjectIds.includes(pId);
                  return (
                    <label key={pId} className={`ro-project-select-card ${isChecked ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleProject(pId)}
                      />
                      <Building2 size={14} className="ro-proj-check-icon" />
                      <span className="ro-proj-check-name">{proj.name || proj.projectName}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. Visibility & Access */}
            <div className="ro-form-section">
              <h4 className="ro-form-section-title">4. Visibility</h4>
              <div className="ro-visibility-options">
                <label className={`ro-vis-card ${visibility === 'shared' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="visibility"
                    value="shared"
                    checked={visibility === 'shared'}
                    onChange={() => setVisibility('shared')}
                  />
                  <div>
                    <strong className="ro-vis-title">Company Shared</strong>
                    <p className="ro-vis-desc">
                      Visible to authorized engineers, managers, and team members across your organization.
                    </p>
                  </div>
                </label>

                <label className={`ro-vis-card ${visibility === 'private' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                  />
                  <div>
                    <strong className="ro-vis-title">
                      <Lock size={12} />
                      <span>Private to Me</span>
                    </strong>
                    <p className="ro-vis-desc">
                      Visible only to you and organization administrators.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 5. Digital, Address & Notes */}
            <div className="ro-form-section">
              <h4 className="ro-form-section-title">5. Address & Additional Details</h4>
              <div className="ro-form-grid-2">
                <div className="ro-form-field">
                  <label className="ro-field-label">Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">Website</label>
                  <input
                    type="text"
                    placeholder="www.company.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field full-width">
                  <label className="ro-field-label">Street Address</label>
                  <input
                    type="text"
                    placeholder="Office / Site / Workshop Address"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Surat, Ahmedabad"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">State / Province</label>
                  <input
                    type="text"
                    placeholder="e.g. Gujarat"
                    value={stateVal}
                    onChange={(e) => setStateVal(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">PIN / Postal Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 395007"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field">
                  <label className="ro-field-label">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Supplier, RMC, Steel, Priority"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="ro-input"
                  />
                </div>

                <div className="ro-form-field full-width">
                  <label className="ro-field-label">Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Additional details, rates, working hours, or site notes…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="ro-input ro-textarea"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="ro-modal-footer">
            <button type="button" className="ro-btn ro-btn--secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="ro-btn ro-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Update Contact' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

