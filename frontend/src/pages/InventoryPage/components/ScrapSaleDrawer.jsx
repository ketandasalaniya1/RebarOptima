import React from 'react';
import { DollarSign, Scale, Save, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import { SHOW_FINANCIALS } from '../../../utils/steelFinancials';
import './ScrapSaleDrawer.css';

/**
 * Slide-over Drawer for Recording or Editing Scrap Sales
 */
export default function ScrapSaleDrawer({
  isOpen,
  onClose,
  isEditing = false,
  formState,
  onFormChange,
  onSubmit,
  actionLoading = false,
  error = '',
  success = '',
}) {
  const weight = parseFloat(formState.weight) || 0;
  const rate = parseFloat(formState.pricePerKg) || 0;
  const estimatedRevenue = weight * rate;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Scrap Sale Entry' : 'Record Scrap Sale'}
      subtitle={
        isEditing
          ? SHOW_FINANCIALS ? 'Update transaction parameters and revenue calculations for this sale' : 'Update transaction parameters for this scrap clearing'
          : SHOW_FINANCIALS ? 'Log commercial scrap cleared from site and revenue retrieved' : 'Log commercial scrap cleared from site'
      }
      icon={SHOW_FINANCIALS ? <DollarSign size={20} className="text-emerald" /> : <Scale size={20} className="text-emerald" />}
      width="480px"
      ariaLabel="Scrap Sale Drawer"
      footer={
        <div className="drawer-footer-row">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={actionLoading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onSubmit}
            disabled={actionLoading || !formState.buyer || weight <= 0 || (SHOW_FINANCIALS && rate <= 0)}
          >
            {actionLoading ? (
              'Saving...'
            ) : isEditing ? (
              <>
                <Save size={15} /> Save Changes
              </>
            ) : (
              'Record Scrap Transaction'
            )}
          </button>
        </div>
      }
    >
      <div className="scrap-drawer-form">
        {error && (
          <div className="drawer-alert error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="drawer-alert success">
            <CheckCircle2 size={15} />
            <span>{success}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Transaction Date *</label>
          <input
            type="date"
            required
            value={formState.date}
            onChange={(e) => onFormChange('date', e.target.value)}
            className="ro-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Scrap Buyer / Factory Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Mittal Steel Scrap Buyers"
            value={formState.buyer}
            onChange={(e) => onFormChange('buyer', e.target.value)}
            className="ro-input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Weight Sold (Kgs) *</label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            required
            placeholder="e.g. 500"
            value={formState.weight}
            onChange={(e) => onFormChange('weight', e.target.value)}
            className="ro-input"
          />
        </div>

        {SHOW_FINANCIALS && (
          <div className="form-group">
            <label className="form-label">Selling Price per Kg (₹) *</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              placeholder="e.g. 24.50"
              value={formState.pricePerKg}
              onChange={(e) => onFormChange('pricePerKg', e.target.value)}
              className="ro-input"
            />
          </div>
        )}

        {SHOW_FINANCIALS && weight > 0 && rate > 0 && (
          <div className="revenue-preview-card">
            <span className="revenue-preview-label">Estimated Recovered Revenue:</span>
            <span className="revenue-preview-value">₹{Math.round(estimatedRevenue).toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>
    </Drawer>
  );
}

