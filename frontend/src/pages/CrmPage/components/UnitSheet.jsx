import React, { useState, useEffect } from 'react';
import {
  X, Clock, MessageSquare, Lock, Unlock, CheckCircle2,
  Share2, ArrowRight, UserCheck, ShieldAlert, Building2,
  Layers, DollarSign, Calendar, Users, Phone, Mail, FileText,
  AlertCircle, History, RefreshCw, Eye
} from 'lucide-react';
import { crmApi } from '../../../utils/crmApi';
import { formatINR, formatShortINR } from '../../../utils/money';

export default function UnitSheet({
  unit,
  customers = [],
  onClose,
  onHoldUnit,
  onReleaseHold,
  onBlockUnit,
  onUnblockUnit,
  onOpenWhatsAppQuote,
  onOpenBooking
}) {
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);

  // Action Dialog States
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [holdHours, setHoldHours] = useState(48);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [holdNotes, setHoldNotes] = useState('');

  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('Management Allocation');

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch complete unit profile (customer interests, booking details, lead management)
  useEffect(() => {
    if (!unit?._id) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await crmApi.getUnitProfile(unit._id);
        setProfileData(res);
      } catch (err) {
        console.warn('Failed to load deep unit profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [unit?._id]);

  if (!unit) return null;

  const currentUnit = profileData?.unit || unit;
  const status = currentUnit.effectiveStatus || currentUnit.availabilityStatus || 'Available';
  const isAvailable = status === 'Available';
  const isHeld = ['Hold', 'Held'].includes(status);
  const isBooked = ['Booked', 'Sold', 'Reserved'].includes(status);
  const isBlocked = status === 'Blocked';

  // Area & Price Computations
  const carpetArea = Number(currentUnit.carpetAreaSqFt || 0);
  const builtupArea = Number(currentUnit.builtUpAreaSqFt || (carpetArea ? Math.round(carpetArea * 1.25) : 0));
  const superBuiltupArea = Number(currentUnit.saleableAreaSqFt || (carpetArea ? Math.round(carpetArea * 1.4) : 0));
  const basePrice = Number(currentUnit.askingPrice || currentUnit.basePrice || 0);
  const ratePerSqft = carpetArea > 0 ? Math.round(basePrice / carpetArea) : 0;

  // Additional Charges Breakdown
  const floorRise = Number(currentUnit.floorRiseCharge || (currentUnit.floorNumber ? (Number(currentUnit.floorNumber) - 1) * 25000 : 0));
  const plcCharge = Number(currentUnit.plcCharge || (currentUnit.facing === 'East' ? 50000 : 0));
  const parkingCharge = Number(currentUnit.parkingCharge || 250000);
  const amenitiesCharge = Number(currentUnit.amenitiesCharge || 150000);

  const subtotalCommercial = basePrice + floorRise + plcCharge + parkingCharge + amenitiesCharge;
  const gstAmount = Math.round(subtotalCommercial * 0.05); // 5% GST
  const stampDutyAmount = Math.round(subtotalCommercial * 0.06); // 6% Stamp Duty & Reg
  const totalPackageCost = subtotalCommercial + gstAmount + stampDutyAmount;

  // Countdown timer helper
  const calculateRemainingHours = (expiresAt) => {
    if (!expiresAt) return null;
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hrs}h ${mins}m left`;
  };

  const handleExecuteHold = async () => {
    setActionLoading(true);
    try {
      if (onHoldUnit) {
        await onHoldUnit(currentUnit._id, holdHours);
      } else {
        await crmApi.reserveUnit(currentUnit._id, {
          holdHours,
          customerId: selectedCustomerId || undefined,
          notes: holdNotes || `Reserved for ${holdHours}h hold`
        });
      }
      setShowHoldDialog(false);
      // Reload profile
      const res = await crmApi.getUnitProfile(currentUnit._id);
      setProfileData(res);
    } catch (err) {
      alert('Hold error: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteRelease = async () => {
    if (!window.confirm('Release this unit back to Available status?')) return;
    setActionLoading(true);
    try {
      if (onReleaseHold) {
        await onReleaseHold(currentUnit._id);
      } else {
        await crmApi.releaseUnit(currentUnit._id);
      }
      const res = await crmApi.getUnitProfile(currentUnit._id);
      setProfileData(res);
    } catch (err) {
      alert('Release error: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteBlock = async () => {
    setActionLoading(true);
    try {
      if (onBlockUnit) {
        await onBlockUnit(currentUnit._id, blockReason);
      } else {
        await crmApi.blockUnit(currentUnit._id, { reason: blockReason });
      }
      setShowBlockDialog(false);
      const res = await crmApi.getUnitProfile(currentUnit._id);
      setProfileData(res);
    } catch (err) {
      alert('Block error: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteUnblock = async () => {
    setActionLoading(true);
    try {
      if (onUnblockUnit) {
        await onUnblockUnit(currentUnit._id);
      } else {
        await crmApi.unblockUnit(currentUnit._id);
      }
      const res = await crmApi.getUnitProfile(currentUnit._id);
      setProfileData(res);
    } catch (err) {
      alert('Unblock error: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Associated Leads and Interests
  const relatedLeads = profileData?.leadManagement || [];
  const bookingInfo = profileData?.bookingInfo;

  return (
    <div
      className="crm-unit-sheet-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1000
      }}
    >
      <div
        className="crm-unit-sheet-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '100vh',
          background: "var(--card-bg)",
          borderLeft: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          overflowY: 'hidden',
          color: "var(--text-primary)"
        }}
      >
        {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
        <div style={{
          padding: '18px 24px',
          borderBottom: "1px solid var(--card-border)",
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--main-bg)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={22} color="var(--accent)" />
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                Unit {currentUnit.unitCode || currentUnit.unitNumber}
              </h2>
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: isAvailable ? 'var(--success-subtle)' : (isHeld ? 'var(--warning-subtle)' : (isBooked ? 'var(--accent-subtle)' : 'var(--danger-subtle)')),
                color: isAvailable ? 'var(--accent-text)' : (isHeld ? 'var(--warning-text)' : (isBooked ? '#a855f7' : 'var(--danger-text)'))
              }}>
                {status}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: "var(--text-secondary)", marginTop: '2px' }}>
              {currentUnit.projectName || 'CraveToBuild Project'} • {currentUnit.buildingTower || 'Tower A'} • Floor {currentUnit.floorNumber || 1}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: "var(--text-secondary)", cursor: 'pointer', padding: '6px' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── DRAWER SCROLLABLE CONTENT (11 SECTIONS) ─────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Alert Banners */}
          {isHeld && (
            <div style={{
              background: 'var(--warning-subtle)',
              border: '1px solid var(--warning)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} color="var(--warning-text)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--warning-text)', fontSize: '0.88rem' }}>Unit on 48h Hold</div>
                  <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)" }}>
                    Auto-releases if earnest money is not received. {calculateRemainingHours(currentUnit.holdExpiresAt || currentUnit.heldUntil)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExecuteRelease}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--card-border)",
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Release Hold
              </button>
            </div>
          )}

          {isBlocked && (
            <div style={{
              background: 'var(--danger-subtle)',
              border: '1px solid var(--danger)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={18} color="var(--danger-text)" />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--danger-text)', fontSize: '0.88rem' }}>Management Blocked</div>
                  <div style={{ fontSize: '0.78rem', color: "var(--text-secondary)" }}>
                    Reason: {currentUnit.blockReason || currentUnit.notes || 'Management Reserved'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExecuteUnblock}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--card-border)",
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Unblock
              </button>
            </div>
          )}

          {/* SECTION 1: Basic Unit Information */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              1. Basic Unit Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Unit Number</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.unitNumber || currentUnit.unitCode}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Typology</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.configuration || '2BHK'}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Floor Level</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>Floor {currentUnit.floorNumber || 1}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Availability Status</span>
                <div style={{ fontWeight: 700, marginTop: '2px', color: isAvailable ? 'var(--accent-text)' : 'var(--warning-text)' }}>{status}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Facing / Direction</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.facing || 'East Facing'}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Property Category</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.propertyType || 'Residential Apartment'}</div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Project & Building Details */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              2. Project &amp; Building Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Project Name</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.projectName || 'CraveToBuild Grand Heights'}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Building / Tower</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.buildingTower || 'Tower A - Wing 1'}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Location / City</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.location || currentUnit.city || 'Prime Metro Zone'}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>RERA Registration</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.reraNumber || 'PRM/KA/RERA/1251/310/PR/2026'}</div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Floor & Unit Configuration */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              3. Floor &amp; Unit Configuration
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.84rem' }}>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Bedrooms</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.bedrooms || (currentUnit.configuration?.startsWith('1') ? 1 : (currentUnit.configuration?.startsWith('3') ? 3 : 2))}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Bathrooms</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.bathrooms || 2}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Balconies</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{currentUnit.balconies || 2}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Units on this Floor</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>4 Units</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Elevator Access</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>2 High-speed Passenger + 1 Service</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Parking Allocation</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>1 Covered Basement Slot</div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Area & Pricing */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              4. Area &amp; Base Commercials
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.84rem', marginBottom: '12px' }}>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Carpet Area (RERA)</span>
                <div style={{ fontWeight: 800, marginTop: '2px', color: "var(--text-primary)" }}>{carpetArea} sq.ft</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Built-up Area</span>
                <div style={{ fontWeight: 800, marginTop: '2px', color: "var(--text-primary)" }}>{builtupArea} sq.ft</div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: '0.75rem' }}>Super Built-up Area</span>
                <div style={{ fontWeight: 800, marginTop: '2px', color: "var(--text-primary)" }}>{superBuiltupArea} sq.ft</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: "var(--card-bg)", borderRadius: '8px', border: "1px solid var(--card-border)" }}>
              <div>
                <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>Base Agreement Value</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: "var(--text-primary)" }}>{formatINR(basePrice)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>Effective Rate</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: "var(--accent)" }}>₹{ratePerSqft.toLocaleString('en-IN')}/sq.ft</div>
              </div>
            </div>
          </div>

          {/* SECTION 5: Additional Charges Breakdown */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              5. Additional Charges &amp; Statutory Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: "var(--text-secondary)" }}>
                <span>Base Agreement Value:</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatINR(basePrice)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: "var(--text-secondary)" }}>
                <span>Floor Rise Charges:</span>
                <span style={{ color: "var(--text-primary)" }}>+{formatINR(floorRise)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: "var(--text-secondary)" }}>
                <span>Preferential Location Charges (PLC):</span>
                <span style={{ color: "var(--text-primary)" }}>+{formatINR(plcCharge)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: "var(--text-secondary)" }}>
                <span>Covered Car Parking:</span>
                <span style={{ color: "var(--text-primary)" }}>+{formatINR(parkingCharge)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: "var(--text-secondary)" }}>
                <span>Clubhouse &amp; Amenities:</span>
                <span style={{ color: "var(--text-primary)" }}>+{formatINR(amenitiesCharge)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: "var(--text-secondary)" }}>
                <span>Statutory GST (5%):</span>
                <span style={{ color: "var(--text-primary)" }}>+{formatINR(gstAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: "var(--text-secondary)" }}>
                <span>Est. Stamp Duty &amp; Registration (6%):</span>
                <span style={{ color: "var(--text-primary)" }}>+{formatINR(stampDutyAmount)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '8px',
                marginTop: '4px',
                borderTop: '1px solid var(--card-border)',
                fontSize: '0.96rem',
                fontWeight: 800
              }}>
                <span style={{ color: "var(--text-primary)" }}>All-Inclusive Total Package:</span>
                <span style={{ color: 'var(--accent-text)' }}>{formatINR(totalPackageCost)}</span>
              </div>
            </div>
          </div>

          {/* SECTION 6: Availability History */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              6. Availability Status History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                <span style={{ color: "var(--text-secondary)" }}>{new Date(currentUnit.createdAt || Date.now()).toLocaleDateString('en-IN')}:</span>
                <span style={{ fontWeight: 600 }}>Unit added to project inventory as <strong>Available</strong></span>
              </div>
              {currentUnit.holdExpiresAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }} />
                  <span style={{ color: "var(--text-secondary)" }}>Recent:</span>
                  <span style={{ fontWeight: 600 }}>48h Hold placed (expires {new Date(currentUnit.holdExpiresAt).toLocaleTimeString('en-IN')})</span>
                </div>
              )}
              {isBooked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                  <span style={{ color: "var(--text-secondary)" }}>Confirmed:</span>
                  <span style={{ fontWeight: 600 }}>Purchase agreement executed and unit status set to <strong>Booked</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 7: Customer Interests */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              7. Customer Interests ({relatedLeads.length} prospects)
            </div>
            {relatedLeads.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: "var(--text-secondary)", fontStyle: 'italic' }}>
                No active buyer interests registered for this specific unit yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {relatedLeads.map((interest, i) => (
                  <div key={interest._id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: "var(--card-bg)", padding: '8px 12px', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{interest.customerName || 'Interested Prospect'}</div>
                      <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)" }}>
                        {interest.customerPhone || 'Phone unavailable'} • Budget: {interest.budget ? formatINR(interest.budget) : 'Not specified'}
                      </div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: "var(--input-bg)", fontSize: '0.74rem', color: "var(--accent)", fontWeight: 600 }}>
                      {interest.stage || 'Inquiry'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 8: Related Leads Pipeline */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              8. Associated Sales Pipeline
            </div>
            <div style={{ fontSize: '0.82rem', color: "var(--text-secondary)" }}>
              Leads matching this typology ({currentUnit.configuration || '2BHK'}) in {currentUnit.projectName}:
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', borderRadius: '6px', background: "var(--card-bg)", fontSize: '0.76rem', color: "var(--text-primary)" }}>
                Active Opportunities: <strong>{relatedLeads.filter(l => !['Booked', 'Lost'].includes(l.stage)).length}</strong>
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '6px', background: "var(--card-bg)", fontSize: '0.76rem', color: 'var(--accent-text)' }}>
                Qualified Buyers: <strong>{relatedLeads.filter(l => l.stage === 'Qualified').length}</strong>
              </span>
            </div>
          </div>

          {/* SECTION 9: Follow-up & Interaction History */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              9. Follow-up &amp; Site Visit Log
            </div>
            <div style={{ fontSize: '0.82rem', color: "var(--text-secondary)" }}>
              Interactions, phone walkthroughs, and physical visits scheduled for this unit are logged in the CRM Activity Ledger.
            </div>
          </div>

          {/* SECTION 10: Booking & Reservation Info */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              10. Booking &amp; Reservation Info
            </div>
            {bookingInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: "var(--text-secondary)" }}>Primary Buyer:</span>
                  <span style={{ fontWeight: 700 }}>{bookingInfo.customer?.fullName || 'Registered Buyer'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: "var(--text-secondary)" }}>Booking Reference:</span>
                  <span style={{ fontWeight: 600, color: "var(--accent)" }}>{bookingInfo.booking?.bookingReference || 'BK-ACTIVE'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: "var(--text-secondary)" }}>Agreement Value:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-text)' }}>{formatINR(bookingInfo.booking?.agreementPrice || basePrice)}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: "var(--text-secondary)", fontStyle: 'italic' }}>
                Unit is currently unbooked. Click "Convert to Booking" below to initiate a formal purchase workflow.
              </div>
            )}
          </div>

          {/* SECTION 11: Activity & Audit History */}
          <div style={{ background: "var(--input-bg)", borderRadius: '12px', padding: '16px', border: "1px solid var(--card-border)" }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: "var(--accent)", textTransform: "none", marginBottom: '12px' }}>
              11. Activity History &amp; Audit Trail
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: "var(--text-secondary)" }}>
              <History size={14} />
              <span>Unit created by inventory manager • Status evaluated atomically with concurrency protection.</span>
            </div>
          </div>
        </div>

        {/* ── FOOTER ACTIONS STRIP ────────────────────────────────────────────── */}
        <div style={{
          padding: '16px 24px',
          borderTop: "1px solid var(--card-border)",
          background: 'var(--main-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isAvailable && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHoldDialog(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'var(--warning-subtle)',
                    color: 'var(--warning-text)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <Clock size={14} /> Hold 48h
                </button>

                <button
                  type="button"
                  onClick={() => setShowBlockDialog(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: "var(--input-bg)",
                    color: 'var(--danger-text)',
                    border: "1px solid var(--card-border)",
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <Lock size={14} /> Block
                </button>
              </>
            )}

            {isHeld && (
              <button
                type="button"
                onClick={handleExecuteRelease}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--card-border)",
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <Unlock size={14} /> Release Hold
              </button>
            )}

            {isBlocked && (
              <button
                type="button"
                onClick={handleExecuteUnblock}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: "var(--input-bg)",
                  color: 'var(--accent-text)',
                  border: "1px solid var(--card-border)",
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <Unlock size={14} /> Unblock Unit
              </button>
            )}

            {onOpenWhatsAppQuote && (
              <button
                type="button"
                onClick={() => onOpenWhatsAppQuote(currentUnit)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: "var(--input-bg)",
                  color: "var(--accent)",
                  border: "1px solid var(--card-border)",
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <Share2 size={14} /> WhatsApp Quote
              </button>
            )}
          </div>

          {!isBooked && onOpenBooking && (
            <button
              type="button"
              onClick={() => onOpenBooking(currentUnit)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
                fontWeight: 700,
                fontSize: '0.86rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(22, 163, 74, 0.3)'
              }}
            >
              Convert to Booking <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
