import React, { useState, useMemo } from 'react';
import {
  Building2, Filter, Clock, Plus, Layers, Grid, List, Search,
  CheckCircle2, AlertCircle, ShieldAlert, ChevronDown, Eye, ArrowRight,
  TrendingUp, Sparkles, Building, Lock, Unlock, DollarSign, Trash2, ExternalLink
} from 'lucide-react';
import { formatINR, formatShortINR } from '../../../utils/money';
import { crmApi } from '../../../utils/crmApi';
import { Input, Select } from '../../../components/ui';

export default function InventoryGrid({
  units = [],
  projects = [],
  blocks = [],
  floors = [],
  selectedProjectId,
  onSelectProject,
  onSelectUnit,
  onHoldUnit,
  onReleaseHold,
  onBlockUnit,
  onUnblockUnit,
  onOpenBooking,
  onRefreshData
}) {
  // View Mode: 'matrix' (Visual Floor Grid) vs 'table' (Detailed Listing Table)
  const [viewMode, setViewMode] = useState('matrix');

  // Filter States
  const [selectedTower, setSelectedTower] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [configFilter, setConfigFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Clear Seed Data States
  const [showClearSeedModal, setShowClearSeedModal] = useState(false);
  const [clearingSeed, setClearingSeed] = useState(false);
  const [clearSeedFeedback, setClearSeedFeedback] = useState(null);

  // Filter units for the selected project
  const projectUnits = useMemo(() => {
    return units.filter(u => {
      if (!selectedProjectId) return true;
      return String(u.projectId) === String(selectedProjectId);
    });
  }, [units, selectedProjectId]);

  // Canonical blocks/towers from Projects module (falling back to units)
  const towers = useMemo(() => {
    if (blocks && blocks.length > 0) {
      return blocks.map(b => b.name || b.blockName).filter(Boolean);
    }
    return Array.from(new Set(projectUnits.map(u => u.buildingTower || 'Tower A'))).filter(Boolean);
  }, [blocks, projectUnits]);

  // Canonical floors from Projects module for the selected tower (or all towers)
  const canonicalFloors = useMemo(() => {
    if (!floors || floors.length === 0) return [];
    let list = floors;
    if (selectedTower !== 'ALL') {
      const targetUpper = selectedTower.toUpperCase();
      list = list.filter(f => (f.blockName || '').toUpperCase() === targetUpper);
    }
    // Sort descending by floorNumber (architectural top-down stack), then by displayOrder
    return list.slice().sort((a, b) => (Number(b.floorNumber) || 0) - (Number(a.floorNumber) || 0) || (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [floors, selectedTower]);

  const configurations = useMemo(() => {
    return Array.from(new Set(projectUnits.map(u => u.configuration || '2BHK'))).filter(Boolean);
  }, [projectUnits]);

  // Available floors for dropdown filter
  const availableFloors = useMemo(() => {
    if (canonicalFloors.length > 0) {
      return canonicalFloors.map(f => ({
        floorNumber: f.floorNumber,
        name: f.name || `Floor ${f.floorNumber}`,
        blockName: f.blockName || ''
      }));
    }
    const distinctNumbers = Array.from(new Set(projectUnits.map(u => Number(u.floorNumber) || 0))).sort((a, b) => b - a);
    return distinctNumbers.map(n => ({ floorNumber: n, name: `Floor ${n}`, blockName: '' }));
  }, [canonicalFloors, projectUnits]);

  // Count unlinked seed units for this project
  const seedUnitsCount = useMemo(() => {
    return projectUnits.filter(u => !u.floorId || (u.notes && /luxury apartment with premium vitrified tiles/i.test(u.notes))).length;
  }, [projectUnits]);

  const handleClearSeedUnits = async () => {
    if (!selectedProjectId) return;
    setClearingSeed(true);
    setClearSeedFeedback(null);
    try {
      const res = await crmApi.clearSeedUnits(selectedProjectId);
      setClearSeedFeedback({ success: true, message: res.message || 'Demo units removed successfully.' });
      if (onRefreshData) onRefreshData();
      setTimeout(() => {
        setShowClearSeedModal(false);
        setClearSeedFeedback(null);
      }, 1400);
    } catch (err) {
      setClearSeedFeedback({ success: false, message: err.message || 'Failed to clear seed units.' });
    } finally {
      setClearingSeed(false);
    }
  };

  // Apply all filter controls
  const filteredUnits = useMemo(() => {
    return projectUnits.filter(u => {
      // Tower Filter
      if (selectedTower !== 'ALL') {
        const uTower = (u.buildingTower || u.blockName || 'Tower A').toUpperCase();
        if (uTower !== selectedTower.toUpperCase()) return false;
      }

      // Availability Status Filter
      const currentStatus = u.effectiveStatus || u.availabilityStatus || 'Available';
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'Hold' && currentStatus !== 'Hold' && currentStatus !== 'Held') return false;
        else if (statusFilter === 'Booked' && !['Booked', 'Sold'].includes(currentStatus)) return false;
        else if (statusFilter !== 'Hold' && statusFilter !== 'Booked' && currentStatus !== statusFilter) return false;
      }

      // Configuration Filter
      if (configFilter !== 'ALL' && (u.configuration || '2BHK') !== configFilter) {
        return false;
      }

      // Floor Filter
      if (floorFilter !== 'ALL' && Number(u.floorNumber) !== Number(floorFilter)) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = String(u.unitNumber || u.unitCode || '').toLowerCase();
        const tower = String(u.buildingTower || u.blockName || '').toLowerCase();
        const proj = String(u.projectName || '').toLowerCase();
        const flName = String(u.floorName || '').toLowerCase();
        if (!code.includes(q) && !tower.includes(q) && !proj.includes(q) && !flName.includes(q)) {
          return false;
        }
      }

      // Price Range Filter
      const price = Number(u.askingPrice || u.basePrice || 0);
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;

      // Area Range Filter
      const area = Number(u.carpetAreaSqFt || u.saleableAreaSqFt || 0);
      if (minArea && area < Number(minArea)) return false;
      if (maxArea && area > Number(maxArea)) return false;

      return true;
    });
  }, [projectUnits, selectedTower, statusFilter, configFilter, floorFilter, searchQuery, minPrice, maxPrice, minArea, maxArea]);

  // Group units into Matrix rows based on canonical floors or floor numbers
  const matrixRows = useMemo(() => {
    if (canonicalFloors.length > 0) {
      const matchedUnitIds = new Set();
      const rows = canonicalFloors.map(f => {
        const fId = String(f._id || f.id);
        const fFloorNum = Number(f.floorNumber);
        const fBlockName = (f.blockName || '').toUpperCase();

        const floorUnits = filteredUnits.filter(u => {
          if (u.floorId && String(u.floorId) === fId) return true;
          if (Number(u.floorNumber) === fFloorNum) {
            if (!u.buildingTower || !fBlockName) return true;
            return String(u.buildingTower).toUpperCase() === fBlockName;
          }
          return false;
        });

        floorUnits.forEach(u => matchedUnitIds.add(String(u._id)));
        floorUnits.sort((a, b) => String(a.unitNumber || a.unitCode).localeCompare(String(b.unitNumber || b.unitCode)));

        return {
          key: `floor-${fId}`,
          floorId: fId,
          floorNumber: fFloorNum,
          name: f.name || `Floor ${fFloorNum}`,
          blockName: f.blockName || '',
          units: floorUnits,
          isCanonical: true
        };
      });

      // Any remaining units not matched to a canonical floor
      const unassigned = filteredUnits.filter(u => !matchedUnitIds.has(String(u._id)));
      if (unassigned.length > 0) {
        const unassignedMap = new Map();
        unassigned.forEach(u => {
          const fn = Number(u.floorNumber) || 0;
          if (!unassignedMap.has(fn)) unassignedMap.set(fn, []);
          unassignedMap.get(fn).push(u);
        });
        const unassignedFloorNums = Array.from(unassignedMap.keys()).sort((a, b) => b - a);
        unassignedFloorNums.forEach(fn => {
          const uUnits = unassignedMap.get(fn);
          uUnits.sort((a, b) => String(a.unitNumber || a.unitCode).localeCompare(String(b.unitNumber || b.unitCode)));
          rows.push({
            key: `unassigned-floor-${fn}`,
            floorNumber: fn,
            name: `Level ${fn}`,
            blockName: uUnits[0]?.buildingTower || '',
            units: uUnits,
            isCanonical: false
          });
        });
      }

      return rows;
    }

    // Fallback if no canonical floors exist yet: group by floorNumber descending
    const map = new Map();
    filteredUnits.forEach(u => {
      const floor = Number(u.floorNumber) || 1;
      if (!map.has(floor)) map.set(floor, []);
      map.get(floor).push(u);
    });
    const sorted = Array.from(map.keys()).sort((a, b) => b - a);
    return sorted.map(floorNum => {
      const uUnits = map.get(floorNum) || [];
      uUnits.sort((a, b) => String(a.unitNumber || a.unitCode).localeCompare(String(b.unitNumber || b.unitCode)));
      return {
        key: `legacy-floor-${floorNum}`,
        floorNumber: floorNum,
        name: `Floor ${floorNum}`,
        blockName: uUnits[0]?.buildingTower || '',
        units: uUnits,
        isCanonical: false
      };
    });
  }, [canonicalFloors, filteredUnits]);

  // Overall Inventory Stats
  const stats = useMemo(() => {
    const total = projectUnits.length;
    const available = projectUnits.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Available').length;
    const held = projectUnits.filter(u => ['Hold', 'Held'].includes(u.effectiveStatus || u.availabilityStatus)).length;
    const reserved = projectUnits.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Reserved').length;
    const booked = projectUnits.filter(u => ['Booked', 'Sold'].includes(u.effectiveStatus || u.availabilityStatus)).length;
    const blocked = projectUnits.filter(u => (u.effectiveStatus || u.availabilityStatus) === 'Blocked').length;
    const totalValue = projectUnits.reduce((acc, u) => acc + Number(u.askingPrice || u.basePrice || 0), 0);

    return { total, available, held, reserved, booked, blocked, totalValue };
  }, [projectUnits]);

  const calculateHoursRemaining = (heldExpiresAt) => {
    if (!heldExpiresAt) return null;
    const diffMs = new Date(heldExpiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    return `${hours}h left`;
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Available':
        return { background: 'var(--success-subtle)', color: 'var(--accent-text)', border: '1px solid rgba(34, 197, 94, 0.3)' };
      case 'Hold':
      case 'Held':
        return { background: 'var(--warning-subtle)', color: 'var(--warning-text)', border: '1px solid rgba(245, 158, 11, 0.3)' };
      case 'Reserved':
        return { background: 'var(--info-subtle)', color: "var(--accent)", border: '1px solid rgba(56, 189, 248, 0.3)' };
      case 'Booked':
      case 'Sold':
        return { background: 'var(--accent-subtle)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' };
      case 'Blocked':
        return { background: 'var(--danger-subtle)', color: 'var(--danger-text)', border: '1px solid rgba(239, 68, 68, 0.3)' };
      default:
        return { background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--card-border)" };
    }
  };

  return (
    <div className="crm-inventory-screen" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: "var(--text-primary)" }}>
      {/* ── TOP KPI SUMMARY CARDS ───────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)", fontWeight: 600, textTransform: "none" }}>Total Units</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: "var(--text-primary)", marginTop: '2px' }}>
            {stats.total}
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--accent-text)', fontWeight: 600, textTransform: "none" }}>Available</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-text)', marginTop: '2px' }}>
            {stats.available}
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--warning-text)', fontWeight: 600, textTransform: "none" }}>On 48h Hold</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning-text)', marginTop: '2px' }}>
            {stats.held}
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid #a855f7' }}>
          <div style={{ fontSize: '0.74rem', color: '#a855f7', fontWeight: 600, textTransform: "none" }}>Booked / Sold</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7', marginTop: '2px' }}>
            {stats.booked}
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--danger-text)', fontWeight: 600, textTransform: "none" }}>Blocked</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger-text)', marginTop: '2px' }}>
            {stats.blocked}
          </div>
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '12px', padding: '14px 16px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ fontSize: '0.74rem', color: "var(--accent)", fontWeight: 600, textTransform: "none" }}>Inventory Value</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: "var(--accent)", marginTop: '4px' }}>
            {formatShortINR(stats.totalValue)}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR: SEARCH, FILTERS & VIEW MODE SWITCHER ──────────────────── */}
      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Left: Search & Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
              <Input
                type="text"
                placeholder="Search unit #, tower..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 30px',
                  borderRadius: '8px',
                  background: "var(--input-bg)",
                  border: "1px solid var(--card-border)",
                  color: "var(--text-primary)",
                  fontSize: '0.84rem'
                }}
              />
            </div>

            {/* Tower / Block Filter */}
            <Select
              value={selectedTower}
              onChange={(e) => setSelectedTower(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Blocks / Towers ({towers.length})</option>
              {towers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Hold">On 48h Hold</option>
              <option value="Reserved">Reserved</option>
              <option value="Booked">Booked / Sold</option>
              <option value="Blocked">Management Blocked</option>
            </Select>

            {/* Typology / Configuration Filter */}
            <Select
              value={configFilter}
              onChange={(e) => setConfigFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Typologies</option>
              {configurations.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>

            {/* Floor / Level Filter */}
            <Select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Floors / Levels</option>
              {availableFloors.map(f => (
                <option key={f.id || `${f.blockName}-${f.floorNumber}`} value={f.floorNumber}>
                  {f.name} {f.blockName && selectedTower === 'ALL' ? `(${f.blockName})` : `(L${f.floorNumber})`}
                </option>
              ))}
            </Select>

            {/* Toggle Advanced Filters Button */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 12px',
                borderRadius: '8px',
                background: showAdvancedFilters ? 'var(--accent)' : 'var(--input-bg)',
                color: showAdvancedFilters ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                border: "1px solid var(--card-border)",
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Filter size={13} /> Price &amp; Area
            </button>

            {/* Link to Projects Module Blocks & Floors */}
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/projects';
                window.location.reload();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '8px',
                background: 'var(--info-subtle)',
                color: "var(--accent)",
                border: '1px solid rgba(56, 189, 248, 0.35)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Manage Construction Blocks, Floors and Units in Projects"
            >
              <Building2 size={13} /> Blocks &amp; Floors <ExternalLink size={11} />
            </button>

            {/* Clear Demo Units Action */}
            {seedUnitsCount > 0 && (
              <button
                type="button"
                onClick={() => setShowClearSeedModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  background: 'var(--danger-subtle)',
                  color: 'var(--danger-text)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Remove unlinked demo seed units"
              >
                <Trash2 size={13} /> Clear Demo Units ({seedUnitsCount})
              </button>
            )}
          </div>

          {/* Right: View Mode Toggle (Matrix vs Table) */}
          <div style={{ display: 'flex', background: "var(--input-bg)", borderRadius: '8px', padding: '3px', border: "1px solid var(--card-border)" }}>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'matrix' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'matrix' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Grid size={15} /> Matrix View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'table' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <List size={15} /> Table Listing
            </button>
          </div>
        </div>

        {/* Advanced Filters Expandable Strip (Min/Max Price, Min/Max Area) */}
        {showAdvancedFilters && (
          <div style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: "1px solid var(--card-border)",
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: "var(--text-secondary)" }}>Price Range (₹):</span>
              <Input
                type="number"
                placeholder="Min Price"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                style={{ width: '110px', padding: '5px 8px', borderRadius: '6px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.8rem' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>-</span>
              <Input
                type="number"
                placeholder="Max Price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                style={{ width: '110px', padding: '5px 8px', borderRadius: '6px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: "var(--text-secondary)" }}>Carpet Area (sq.ft):</span>
              <Input
                type="number"
                placeholder="Min sqft"
                value={minArea}
                onChange={(e) => setMinArea(e.target.value)}
                style={{ width: '90px', padding: '5px 8px', borderRadius: '6px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.8rem' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>-</span>
              <Input
                type="number"
                placeholder="Max sqft"
                value={maxArea}
                onChange={(e) => setMaxArea(e.target.value)}
                style={{ width: '90px', padding: '5px 8px', borderRadius: '6px', background: "var(--input-bg)", border: "1px solid var(--card-border)", color: "var(--text-primary)", fontSize: '0.8rem' }}
              />
            </div>

            {(minPrice || maxPrice || minArea || maxArea) && (
              <button
                type="button"
                onClick={() => { setMinPrice(''); setMaxPrice(''); setMinArea(''); setMaxArea(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--danger-text)', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── VIEW 1: INTERACTIVE FLOOR MATRIX VIEW ────────────────────────────── */}
      {viewMode === 'matrix' && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', padding: '20px', overflowX: 'auto' }}>
          {matrixRows.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: "var(--text-secondary)" }}>
              <Building2 size={48} color="var(--text-secondary)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: "var(--text-primary)" }}>No matching floors or units found</div>
              <div style={{ fontSize: '0.84rem', marginTop: '4px' }}>Try adjusting your filters above or configure blocks and floors in the Projects module.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {matrixRows.map(row => {
                const { key, floorNumber, name, blockName, units: floorUnits } = row;

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      background: 'var(--main-bg)',
                      border: "1px solid var(--card-border)",
                      borderRadius: '12px',
                      padding: '10px 14px'
                    }}
                  >
                    {/* Floor Label Badge with Canonical Info */}
                    <div style={{
                      minWidth: '110px',
                      height: '56px',
                      borderRadius: '8px',
                      background: "var(--input-bg)",
                      border: "1px solid var(--card-border)",
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      padding: '4px 8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.66rem', color: "var(--accent)", fontWeight: 700, textTransform: "none" }}>
                          L{floorNumber}
                        </span>
                        {blockName && selectedTower === 'ALL' && (
                          <span style={{ fontSize: '0.60rem', color: "var(--text-secondary)", background: "var(--card-bg)", padding: '1px 4px', borderRadius: '4px' }}>
                            {blockName}
                          </span>
                        )}
                      </div>
                      <strong style={{ fontSize: '0.82rem', color: "var(--text-primary)", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }} title={name}>
                        {name}
                      </strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        {floorUnits.length} {floorUnits.length === 1 ? 'unit' : 'units'}
                      </span>
                    </div>

                    {/* Floor Units Horizontal Rail */}
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', flex: 1, padding: '4px 0', alignItems: 'center' }}>
                      {floorUnits.length === 0 ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 14px',
                          background: 'var(--hover-bg)',
                          borderRadius: '8px',
                          border: '1px dashed var(--card-border)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.8rem'
                        }}>
                          <span>No units assigned to {name} yet.</span>
                        </div>
                      ) : (
                        floorUnits.map(unit => {
                          const status = unit.effectiveStatus || unit.availabilityStatus || 'Available';
                          const badgeStyle = getStatusBadgeStyle(status);
                          const hoursLeft = ['Hold', 'Held'].includes(status) ? calculateHoursRemaining(unit.holdExpiresAt || unit.heldUntil) : null;

                          return (
                            <div
                              key={unit._id}
                              onClick={() => onSelectUnit(unit)}
                              style={{
                                minWidth: '135px',
                                background: "var(--input-bg)",
                                border: badgeStyle.border,
                                borderRadius: '10px',
                                padding: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                flexShrink: 0
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <strong style={{ fontSize: '0.92rem', color: "var(--text-primary)" }}>
                                  {unit.unitCode || unit.unitNumber}
                                </strong>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', ...badgeStyle }}>
                                  {unit.configuration || '2BHK'}
                                </span>
                              </div>

                              <div style={{ fontSize: '0.74rem', color: "var(--text-secondary)", marginBottom: '6px' }}>
                                {unit.carpetAreaSqFt ? `${unit.carpetAreaSqFt} ${unit.areaUnit || 'sq.ft'}` : (unit.saleableAreaSqFt ? `${unit.saleableAreaSqFt} ${unit.areaUnit || 'sq.ft'}` : '')}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '0.82rem', color: "var(--accent)" }}>
                                  {formatShortINR(unit.askingPrice || unit.basePrice || 0)}
                                </strong>

                                {hoursLeft && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.68rem', color: 'var(--warning-text)', fontWeight: 700 }}>
                                    <Clock size={10} /> {hoursLeft}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: DETAILED TABLE LISTING VIEW ──────────────────────────────── */}
      {viewMode === 'table' && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: "var(--input-bg)", borderBottom: '1px solid var(--card-border)', color: "var(--text-secondary)" }}>
                  <th style={{ padding: '12px 16px' }}>Unit #</th>
                  <th style={{ padding: '12px 16px' }}>Project</th>
                  <th style={{ padding: '12px 16px' }}>Tower / Block</th>
                  <th style={{ padding: '12px 16px' }}>Floor / Level</th>
                  <th style={{ padding: '12px 16px' }}>Typology</th>
                  <th style={{ padding: '12px 16px' }}>Area (Carpet)</th>
                  <th style={{ padding: '12px 16px' }}>Base Price</th>
                  <th style={{ padding: '12px 16px' }}>Rate / sq.ft</th>
                  <th style={{ padding: '12px 16px' }}>Availability</th>
                  <th style={{ padding: '12px 16px' }}>Interest Count</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: "var(--text-secondary)" }}>
                      No inventory units matching the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((unit, idx) => {
                    const status = unit.effectiveStatus || unit.availabilityStatus || 'Available';
                    const badgeStyle = getStatusBadgeStyle(status);
                    const price = Number(unit.askingPrice || unit.basePrice || 0);
                    const carpet = Number(unit.carpetAreaSqFt || 0);
                    const ratePerSqft = carpet > 0 ? Math.round(price / carpet) : null;
                    const hoursLeft = ['Hold', 'Held'].includes(status) ? calculateHoursRemaining(unit.holdExpiresAt || unit.heldUntil) : null;

                    return (
                      <tr
                        key={unit._id || idx}
                        style={{ borderBottom: "1px solid var(--card-border)", background: idx % 2 === 0 ? 'var(--main-bg)' : 'var(--card-bg)' }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: "var(--text-primary)" }}>
                          {unit.unitCode || unit.unitNumber}
                        </td>
                        <td style={{ padding: '12px 16px', color: "var(--text-primary)" }}>
                          {unit.projectName || 'RebarOptima Project'}
                        </td>
                        <td style={{ padding: '12px 16px', color: "var(--text-secondary)" }}>
                          {unit.buildingTower || unit.blockName || 'Tower A'}
                        </td>
                        <td style={{ padding: '12px 16px', color: "var(--text-primary)" }}>
                          {unit.floorName ? `${unit.floorName} (L${unit.floorNumber})` : `Floor ${unit.floorNumber || 1}`}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: "var(--input-bg)", padding: '2px 8px', borderRadius: '4px', fontWeight: 600, color: "var(--accent)" }}>
                            {unit.configuration || '2BHK'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: "var(--text-primary)" }}>
                          {carpet ? `${carpet} ${unit.areaUnit || 'sq.ft'}` : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: "var(--text-primary)" }}>
                          {formatINR(price)}
                        </td>
                        <td style={{ padding: '12px 16px', color: "var(--text-secondary)" }}>
                          {ratePerSqft ? `₹${ratePerSqft.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            ...badgeStyle
                          }}>
                            {status}
                            {hoursLeft && ` (${hoursLeft})`}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: "var(--text-primary)" }}>
                          {unit.interestCount !== undefined ? unit.interestCount : (unit.customerInterests?.length || 0)} prospects
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => onSelectUnit(unit)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: "var(--input-bg)",
                                color: "var(--accent)",
                                border: "1px solid var(--card-border)",
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="View complete 11-section unit details"
                            >
                              <Eye size={12} /> Details
                            </button>

                            {status === 'Available' && onHoldUnit && (
                              <button
                                type="button"
                                onClick={() => onHoldUnit(unit._id, 48)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  background: 'var(--warning-subtle)',
                                  color: 'var(--warning-text)',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                title="Hold unit for 48 hours"
                              >
                                <Clock size={12} /> Hold
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: CLEAR SEED / DEMO UNITS CONFIRMATION ──────────────────────── */}
      {showClearSeedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger-text)', marginBottom: '12px' }}>
              <AlertCircle size={24} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: "var(--text-primary)", fontWeight: 700 }}>
                Remove Demo / Seed Units
              </h3>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 16px' }}>
              This action will safely remove <strong style={{ color: "var(--text-primary)" }}>{seedUnitsCount}</strong> legacy unlinked sample units for this project.
              <br /><br />
              <span style={{ color: 'var(--accent-text)' }}>✓ Legitimate units created under Blocks &amp; Floors are completely protected and will NOT be touched.</span>
            </p>

            {clearSeedFeedback && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                background: clearSeedFeedback.success ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                color: clearSeedFeedback.success ? 'var(--accent-text)' : 'var(--danger-text)',
                fontSize: '0.84rem'
              }}>
                {clearSeedFeedback.message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowClearSeedModal(false)}
                disabled={clearingSeed}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: "var(--input-bg)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--card-border)",
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearSeedUnits}
                disabled={clearingSeed}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: 'var(--danger)',
                  color: 'var(--accent-contrast)',
                  border: 'none',
                  cursor: clearingSeed ? 'not-allowed' : 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  opacity: clearingSeed ? 0.7 : 1
                }}
              >
                {clearingSeed ? 'Clearing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
