import React from 'react';
import { RotateCcw, Sparkles, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import Drawer from '../../../components/Shared/Drawer';
import { SHOW_FINANCIALS } from '../../../utils/steelFinancials';
import './InwardVoucherDrawer.css';

/**
 * Slide-over Inward Delivery Voucher Drawer
 * Preserves all 7 diameter rows, GST preview, brand/vendor autocomplete, and bulk copy actions.
 */
export default function InwardVoucherDrawer({
  isOpen,
  onClose,
  voucherRows,
  handleVoucherRowChange,
  handleAddVoucherRow,
  handleDeleteVoucherRow,
  handleResetAllDiameters,
  handleApplyBrandVendorToAll,
  handleVoucherSubmit,
  actionLoading,
  error,
  success,
  openDropdown,
  closeDropdownDelayed,
  focusedDropdown,
  highlightedIndex,
  setHighlightedIndex,
  handleSelectSuggestion,
  handleDropdownKeyDown,
  getFilteredBrands,
  getFilteredVendors,
  blurTimeoutRef,
}) {
  const totalWeightTons = voucherRows.reduce((acc, row) => acc + (parseFloat(row.weightInTons) || 0), 0);
  const totalCostWithGst = voucherRows.reduce((acc, row) => acc + (row.totalPriceWithGst || 0), 0);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Inward Delivery Voucher"
      subtitle={SHOW_FINANCIALS ? "Enter received reinforcement steel bundles, tonnage, rates, and suppliers" : "Enter received reinforcement steel bundles, tonnage, and suppliers"}
      width={SHOW_FINANCIALS ? "840px" : "740px"}
      ariaLabel="Inward Delivery Voucher Drawer"
      footer={
        <div className="voucher-drawer-footer">
          <div className="voucher-footer-summary">
            <span className="summary-lbl">Total Weight:</span>
            <span className="summary-val">{totalWeightTons.toFixed(2)} MT ({(totalWeightTons * 1000).toLocaleString('en-IN')} kg)</span>
            {SHOW_FINANCIALS && (
              <>
                <span className="summary-sep">•</span>
                <span className="summary-lbl">Estimated Total (incl. GST):</span>
                <span className="summary-val text-emerald">₹{Math.round(totalCostWithGst).toLocaleString('en-IN')}</span>
              </>
            )}
          </div>
          <div className="voucher-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={actionLoading}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleVoucherSubmit}
              disabled={actionLoading || totalWeightTons <= 0}
            >
              {actionLoading ? 'Recording Inward...' : 'Submit Inward Voucher'}
            </button>
          </div>
        </div>
      }
    >
      <div className="inward-drawer-content">
        {/* Quick Toolbar */}
        <div className="voucher-drawer-toolbar">
          <div className="toolbar-info">
            <span className="toolbar-count">{voucherRows.length} Diameter Entries</span>
            <span className="toolbar-hint">(1 Ton = 1,000 kg)</span>
          </div>
          <div className="toolbar-btns">
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleResetAllDiameters}
              title="Reset to 7 standard diameters (8mm - 32mm)"
            >
              <RotateCcw size={13} />
              <span>All Diameters (8–32mm)</span>
            </button>
            <button
              type="button"
              className="toolbar-btn"
              onClick={handleApplyBrandVendorToAll}
              title="Copy row 1 Brand and Vendor to all rows"
            >
              <Sparkles size={13} />
              <span>Apply Brand/Vendor to All</span>
            </button>
            <button
              type="button"
              className="toolbar-btn primary"
              onClick={handleAddVoucherRow}
              title="Add another diameter row"
            >
              <Plus size={13} />
              <span>Add Row</span>
            </button>
          </div>
        </div>

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

        {/* Voucher Table Form */}
        <div className="voucher-table-wrapper">
          <table className="voucher-entry-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Diameter</th>
                <th style={{ width: '130px' }}>Weight (Tons)</th>
                {SHOW_FINANCIALS && (
                  <>
                    <th style={{ width: '130px' }}>Rate/Ton (₹)</th>
                    <th style={{ width: '100px' }}>GST (18%)</th>
                    <th style={{ width: '110px' }}>Total (₹)</th>
                  </>
                )}
                <th>Brand Name</th>
                <th>Vendor Name</th>
                <th style={{ width: '44px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {voucherRows.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <select
                      value={row.diameter}
                      onChange={(e) => handleVoucherRowChange(row.id, 'diameter', Number(e.target.value))}
                      className="voucher-select"
                    >
                      {[8, 10, 12, 16, 20, 25, 32].map((d) => (
                        <option key={d} value={d}>
                          Ø {d} mm
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 2.5"
                      value={row.weightInTons}
                      onChange={(e) => handleVoucherRowChange(row.id, 'weightInTons', e.target.value)}
                      className="voucher-input"
                    />
                  </td>
                  {SHOW_FINANCIALS && (
                    <>
                      <td>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="e.g. 52000"
                          value={row.pricePerTonWithoutGst}
                          onChange={(e) => handleVoucherRowChange(row.id, 'pricePerTonWithoutGst', e.target.value)}
                          className="voucher-input"
                        />
                      </td>
                      <td>
                        <span className="gst-preview">₹{row.gstAmount.toLocaleString('en-IN')}</span>
                      </td>
                      <td>
                        <span className="total-preview font-bold">₹{row.totalPriceWithGst.toLocaleString('en-IN')}</span>
                      </td>
                    </>
                  )}
                  <td style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Brand name"
                      value={row.brandName}
                      onChange={(e) => {
                        handleVoucherRowChange(row.id, 'brandName', e.target.value);
                        openDropdown(row.id, 'brandName');
                      }}
                      onFocus={() => openDropdown(row.id, 'brandName')}
                      onClick={() => openDropdown(row.id, 'brandName')}
                      onMouseDown={() => {
                        if (blurTimeoutRef.current) {
                          clearTimeout(blurTimeoutRef.current);
                          blurTimeoutRef.current = null;
                        }
                      }}
                      onBlur={closeDropdownDelayed}
                      onKeyDown={(e) => handleDropdownKeyDown(e, row.id, 'brandName', getFilteredBrands(row.brandName))}
                      className="voucher-input"
                      autoComplete="off"
                    />
                    {focusedDropdown?.id === row.id && focusedDropdown?.field === 'brandName' && (
                      <div className={`custom-dropdown-menu ${voucherRows.length >= 4 && idx >= voucherRows.length - 2 ? 'open-upward' : ''}`}>
                        {getFilteredBrands(row.brandName).length > 0 ? (
                          getFilteredBrands(row.brandName).map((brand, bIdx) => (
                            <div
                              key={brand}
                              className={`custom-dropdown-item ${highlightedIndex === bIdx ? 'is-highlighted' : ''}`}
                              onMouseEnter={() => setHighlightedIndex(bIdx)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(row.id, 'brandName', brand);
                              }}
                            >
                              {brand}
                            </div>
                          ))
                        ) : (
                          <div className="custom-dropdown-no-item">
                            {row.brandName ? 'No matching company brand' : 'Type to add brand'}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Vendor name"
                      value={row.vendorName}
                      onChange={(e) => {
                        handleVoucherRowChange(row.id, 'vendorName', e.target.value);
                        openDropdown(row.id, 'vendorName');
                      }}
                      onFocus={() => openDropdown(row.id, 'vendorName')}
                      onClick={() => openDropdown(row.id, 'vendorName')}
                      onMouseDown={() => {
                        if (blurTimeoutRef.current) {
                          clearTimeout(blurTimeoutRef.current);
                          blurTimeoutRef.current = null;
                        }
                      }}
                      onBlur={closeDropdownDelayed}
                      onKeyDown={(e) => handleDropdownKeyDown(e, row.id, 'vendorName', getFilteredVendors(row.vendorName))}
                      className="voucher-input"
                      autoComplete="off"
                    />
                    {focusedDropdown?.id === row.id && focusedDropdown?.field === 'vendorName' && (
                      <div className={`custom-dropdown-menu ${voucherRows.length >= 4 && idx >= voucherRows.length - 2 ? 'open-upward' : ''}`}>
                        {getFilteredVendors(row.vendorName).length > 0 ? (
                          getFilteredVendors(row.vendorName).map((vendor, vIdx) => (
                            <div
                              key={vendor}
                              className={`custom-dropdown-item ${highlightedIndex === vIdx ? 'is-highlighted' : ''}`}
                              onMouseEnter={() => setHighlightedIndex(vIdx)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestion(row.id, 'vendorName', vendor);
                              }}
                            >
                              {vendor}
                            </div>
                          ))
                        ) : (
                          <div className="custom-dropdown-no-item">
                            {row.vendorName ? 'No matching company vendor' : 'Type to add vendor'}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="delete-row-btn"
                      onClick={() => handleDeleteVoucherRow(row.id)}
                      disabled={voucherRows.length === 1}
                      title={voucherRows.length === 1 ? 'At least one row required' : 'Delete row'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Drawer>
  );
}

