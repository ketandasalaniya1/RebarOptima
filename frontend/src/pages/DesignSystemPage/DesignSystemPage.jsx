import React, { useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { setView } from '../../store/slices/routingSlice';
import {
  Sun, Moon, Laptop, CheckCircle, AlertTriangle, XCircle, Info, Layers, ArrowRight, ShieldCheck, Search, Plus, Trash2, Download, Smartphone, Tablet, Monitor, Eye, Settings, Database, BarChart2, } from 'lucide-react';
import {
  Button, Drawer, Modal, Card, KpiCard, Table, Badge, Tabs, SearchInput, PageLayout, TableSkeleton, CardSkeleton, KpiSkeleton, Input, Select } from '../../components/ui';
import './DesignSystemPage.css';

// ── PROGRAMMATIC WCAG 2.1 RELATIVE LUMINANCE & CONTRAST FORMULA ──
function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrast(fgHex, bgHex) {
  const l1 = relativeLuminance(hexToRgb(fgHex));
  const l2 = relativeLuminance(hexToRgb(bgHex));
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function blendHex(fgHex, bgHex, alpha) {
  const [r1, g1, b1] = hexToRgb(fgHex);
  const [r2, g2, b2] = hexToRgb(bgHex);
  const r = Math.round(r1 * alpha + r2 * (1 - alpha));
  const g = Math.round(g1 * alpha + g2 * (1 - alpha));
  const b = Math.round(b1 * alpha + b2 * (1 - alpha));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default function DesignSystemPage() {
  const dispatch = useDispatch();
  const [activeTheme, setActiveTheme] = useState(() => {
    return document.documentElement.getAttribute('data-theme') || 'light';
  });
  const [viewportMode, setViewportMode] = useState('desktop'); // 'desktop' | 'tablet' | 'phone'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerSize, setDrawerSize] = useState('md');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchVal, setSearchVal] = useState('');
  const [buttonLoading, setButtonLoading] = useState(false);

  // Switch Theme Function
  const handleThemeChange = (newTheme) => {
    setActiveTheme(newTheme);
    if (newTheme === 'system') {
      localStorage.removeItem('themeMode');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      localStorage.setItem('themeMode', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  // ── TOKEN CONTRAST PAIRS SPECIFICATION ──
  const contrastPairs = useMemo(() => {
    const isDark = activeTheme === 'dark';
    const cardBg = isDark ? '#131c31' : '#ffffff';
    const mainBg = isDark ? '#0b1120' : '#f8fafc';
    const accentBg = '#047857';
    const sidebarBg = isDark ? '#0e1526' : '#1e293b';
    const sidebarText = 'var(--text-secondary)';

    const textColors = isDark
      ? {
        'text-primary': '#f8fafc',
        'text-secondary': '#9bb0cc',
        'text-label': '#8fa0ba',
        'success-text': '#34d399',
        'warning-text': '#fbbf24',
        'danger-text': '#f87171',
        'info-text': '#60a5fa',
        'accent-text': '#34d399',
      }
      : {
        'text-primary': '#0f172a',
        'text-secondary': '#475569',
        'text-label': '#64748b',
        'success-text': '#047857',
        'warning-text': '#b45309',
        'danger-text': '#b91c1c',
        'info-text': '#1d4ed8',
        'accent-text': '#047857',
      };

    const list = [];

    // Text on card-bg and main-bg
    Object.entries(textColors).forEach(([token, hex]) => {
      const cCard = calculateContrast(hex, cardBg);
      const cMain = calculateContrast(hex, mainBg);
      list.push({
        element: token,
        fg: hex,
        bg: cardBg,
        bgLabel: 'card-bg',
        ratio: cCard,
        pass: cCard >= 4.5,
      });
      list.push({
        element: token,
        fg: hex,
        bg: mainBg,
        bgLabel: 'main-bg',
        ratio: cMain,
        pass: cMain >= 4.5,
      });
    });

    // Button text on accent
    const cBtn = calculateContrast('#ffffff', accentBg);
    list.push({
      element: 'button-text on accent',
      fg: '#ffffff',
      bg: accentBg,
      bgLabel: 'accent (#047857)',
      ratio: cBtn,
      pass: cBtn >= 4.5,
      threshold: '4.5:1',
    });

    // Danger button text on danger bg
    const dangerBg = '#dc2626';
    const cDangerBtn = calculateContrast('#ffffff', dangerBg);
    list.push({
      element: 'danger-btn text on danger-bg',
      fg: '#ffffff',
      bg: dangerBg,
      bgLabel: 'danger (#dc2626)',
      ratio: cDangerBtn,
      pass: cDangerBtn >= 4.5,
      threshold: '4.5:1',
    });

    // Sidebar text on sidebar-bg
    const cSb = calculateContrast(sidebarText, sidebarBg);
    list.push({
      element: 'sidebar-text on sidebar-bg',
      fg: sidebarText,
      bg: sidebarBg,
      bgLabel: 'sidebar-bg',
      ratio: cSb,
      pass: cSb >= 4.5,
      threshold: '4.5:1',
    });

    // Focus ring vs background (3:1 graphical object threshold)
    const focusColor = isDark ? '#34d399' : '#047857';
    const cFocus = calculateContrast(focusColor, cardBg);
    list.push({
      element: 'focus-ring vs card-bg',
      fg: focusColor,
      bg: cardBg,
      bgLabel: 'card-bg',
      ratio: cFocus,
      pass: cFocus >= 3.0,
      threshold: '3.0:1',
    });

    // Input border vs input-bg (3:1 boundary threshold)
    const inputBorder = isDark ? '#5b6c86' : '#7c8ba1';
    const inputBg = isDark ? '#0b1120' : '#ffffff';
    const cBorder = calculateContrast(inputBorder, inputBg);
    list.push({
      element: 'input-border vs input-bg',
      fg: inputBorder,
      bg: inputBg,
      bgLabel: 'input-bg',
      ratio: cBorder,
      pass: cBorder >= 3.0,
      threshold: '3.0:1',
    });

    // Placeholder text on input-bg
    const placeholderColor = isDark ? '#8fa0ba' : '#64748b';
    const cPlaceholder = calculateContrast(placeholderColor, inputBg);
    list.push({
      element: 'placeholder-text on input-bg',
      fg: placeholderColor,
      bg: inputBg,
      bgLabel: 'input-bg',
      ratio: cPlaceholder,
      pass: cPlaceholder >= 4.5,
      threshold: '4.5:1',
    });

    // Disabled text on disabled-bg
    const disabledFg = isDark ? '#8fa0ba' : '#64748b';
    const disabledBg = isDark ? '#1e293b' : '#f1f5f9';
    const cDisabled = calculateContrast(disabledFg, disabledBg);
    list.push({
      element: 'disabled-text on disabled-bg',
      fg: disabledFg,
      bg: disabledBg,
      bgLabel: 'disabled-bg',
      ratio: cDisabled,
      pass: cDisabled >= 3.0,
      threshold: '3.0:1',
    });

    // Badge text on subtle tinted backgrounds
    const badgeDefs = isDark
      ? [
        { name: 'success', fg: '#34d399', base: '#34d399', alpha: 0.14 },
        { name: 'warning', fg: '#fbbf24', base: '#fbbf24', alpha: 0.14 },
        { name: 'danger', fg: '#f87171', base: '#f87171', alpha: 0.14 },
        { name: 'info', fg: '#60a5fa', base: '#60a5fa', alpha: 0.14 },
        { name: 'accent', fg: '#34d399', base: '#34d399', alpha: 0.14 },
      ]
      : [
        { name: 'success', fg: '#047857', base: '#10b981', alpha: 0.10 },
        { name: 'warning', fg: '#b45309', base: '#f59e0b', alpha: 0.10 },
        { name: 'danger', fg: '#b91c1c', base: '#ef4444', alpha: 0.10 },
        { name: 'info', fg: '#1d4ed8', base: '#2563eb', alpha: 0.10 },
        { name: 'accent', fg: '#047857', base: '#047857', alpha: 0.08 },
      ];

    badgeDefs.forEach((b) => {
      const blendedBg = blendHex(b.base, cardBg, b.alpha);
      const cBadge = calculateContrast(b.fg, blendedBg);
      list.push({
        element: `badge--${b.name} text on subtle-bg`,
        fg: b.fg,
        bg: blendedBg,
        bgLabel: `subtle ${b.name}`,
        ratio: cBadge,
        pass: cBadge >= 4.5,
        threshold: '4.5:1',
      });
    });

    return list;
  }, [activeTheme]);

  // Sample Table Data
  const sampleTableData = [
    {
      id: 'REC-001',
      diameter: 'Ø 16 mm',
      length: '12.0 m',
      qty: 124,
      weight: '2,348 kg',
      brand: 'Tata Tiscon',
      status: 'In Stock',
      statusVariant: 'success',
    },
    {
      id: 'REC-002',
      diameter: 'Ø 20 mm',
      length: '12.0 m',
      qty: 48,
      weight: '1,184 kg',
      brand: 'JSW Steel',
      status: 'Low Stock',
      statusVariant: 'warning',
    },
    {
      id: 'REC-003',
      diameter: 'Ø 25 mm',
      length: '12.0 m',
      qty: 0,
      weight: '0 kg',
      brand: 'Ambuja',
      status: 'Depleted',
      statusVariant: 'danger',
    },
    {
      id: 'REC-004',
      diameter: 'Ø 10 mm',
      length: '12.0 m',
      qty: 405,
      weight: '3,000 kg',
      brand: 'Jindal Panther',
      status: 'In Stock',
      statusVariant: 'success',
    },
  ];

  const tableColumns = [
    { key: 'id', header: 'Item ID', width: '100px' },
    { key: 'diameter', header: 'Diameter', width: '120px' },
    { key: 'length', header: 'Length' },
    { key: 'qty', header: 'Quantity (Bars)', align: 'right' },
    { key: 'weight', header: 'Total Weight', align: 'right' },
    { key: 'brand', header: 'Brand' },
    {
      key: 'status',
      header: 'Stock Status',
      render: (val, row) => (
        <Badge variant={row.statusVariant} dot>
          {val}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: () => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" icon={Eye}>
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageLayout
      title="Design System & Component Showcase"
      subtitle="Universal tokens, WCAG 2.1 AA verified contrast, touch-responsive primitives, and zero-jump interaction states."
      actions={
        <div className="ds-toolbar-group">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch(setView('inventory'))}
          >
            ← Back to App
          </Button>

          {/* Viewport switchers */}
          <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              type="button"
              className={`ro-btn ro-btn--sm ${viewportMode === 'desktop' ? 'ro-btn--primary' : 'ro-btn--ghost'}`}
              onClick={() => setViewportMode('desktop')}
              title="Desktop (1680px Max)"
            >
              <Monitor size={14} /> Desktop
            </button>
            <button
              type="button"
              className={`ro-btn ro-btn--sm ${viewportMode === 'tablet' ? 'ro-btn--primary' : 'ro-btn--ghost'}`}
              onClick={() => setViewportMode('tablet')}
              title="Tablet (768px)"
            >
              <Tablet size={14} /> Tablet
            </button>
            <button
              type="button"
              className={`ro-btn ro-btn--sm ${viewportMode === 'phone' ? 'ro-btn--primary' : 'ro-btn--ghost'}`}
              onClick={() => setViewportMode('phone')}
              title="Phone (360px Site Engineer)"
            >
              <Smartphone size={14} /> Phone (360px)
            </button>
          </div>

          {/* Theme switcher */}
          <div style={{ display: 'flex', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              type="button"
              className={`ro-btn ro-btn--sm ${activeTheme === 'light' ? 'ro-btn--primary' : 'ro-btn--ghost'}`}
              onClick={() => handleThemeChange('light')}
            >
              <Sun size={14} /> Light
            </button>
            <button
              type="button"
              className={`ro-btn ro-btn--sm ${activeTheme === 'dark' ? 'ro-btn--primary' : 'ro-btn--ghost'}`}
              onClick={() => handleThemeChange('dark')}
            >
              <Moon size={14} /> Dark
            </button>
            <button
              type="button"
              className={`ro-btn ro-btn--sm ${activeTheme === 'system' ? 'ro-btn--primary' : 'ro-btn--ghost'}`}
              onClick={() => handleThemeChange('system')}
            >
              <Laptop size={14} /> System
            </button>
          </div>
        </div>
      }
    >
      <div className={`ds-preview-wrapper ${viewportMode === 'phone' ? 'mode-phone' : viewportMode === 'tablet' ? 'mode-tablet' : ''}`}>
        <div className="ds-container">

          {/* ════ SECTION 1: PROGRAMMATIC WCAG 2.1 AA CONTRAST MATRIX ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <h2 className="ds-section-title">
                <ShieldCheck size={20} style={{ color: 'var(--accent-text)' }} />
                1. Programmatic WCAG 2.1 AA Contrast Verification Matrix
              </h2>
              <p className="ds-section-desc">
                Calculated in real-time in active <strong>{activeTheme.toUpperCase()}</strong> mode. Threshold: <strong>4.5:1</strong> for normal text.
              </p>
            </div>

            <div className="ro-table-container">
              <table className="ds-contrast-table">
                <thead>
                  <tr>
                    <th>Element Token</th>
                    <th>Foreground</th>
                    <th>Background</th>
                    <th>Visual Sample</th>
                    <th style={{ textAlign: 'right' }}>Calculated Ratio</th>
                    <th style={{ textAlign: 'center' }}>Target</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contrastPairs.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <code>--{item.element}</code>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.fg, display: 'inline-block', border: '1px solid rgba(0,0,0,0.2)' }} />
                          <code>{item.fg}</code>
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.bg, display: 'inline-block', border: '1px solid rgba(0,0,0,0.2)' }} />
                          <code>{item.bg} ({item.bgLabel})</code>
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: item.bg,
                            color: item.fg,
                            fontWeight: 600,
                            border: '1px solid var(--card-border)',
                          }}
                        >
                          Aa Sample Text
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {item.ratio.toFixed(2)}:1
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-label)' }}>
                        {item.threshold || '4.5:1'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {item.pass ? (
                          <Badge variant="success" dot>
                            PASS
                          </Badge>
                        ) : (
                          <Badge variant="danger" dot>
                            FAIL
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ════ SECTION 2: BUTTONS SHOWCASE ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <h2 className="ds-section-title">
                2. Buttons (Touch-friendly 44px on coarse pointer / 36px desktop)
              </h2>
              <p className="ds-section-desc">
                Primary button uses #047857 with white text (passes WCAG AA at 5.48:1).
              </p>
            </div>

            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 'var(--text-xs)', color: 'var(--text-label)', textTransform: 'uppercase' }}>
                    Variants (Medium - Default 36px / 44px Coarse)
                  </h4>
                  <div className="ds-flex-wrap">
                    <Button variant="primary" icon={Plus}>
                      Primary Action
                    </Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger" icon={Trash2}>
                      Delete
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 'var(--text-xs)', color: 'var(--text-label)', textTransform: 'uppercase' }}>
                    Sizes & States
                  </h4>
                  <div className="ds-flex-wrap">
                    <Button variant="primary" size="sm">
                      Small Button
                    </Button>
                    <Button variant="primary" size="md">
                      Medium (36px / 44px)
                    </Button>
                    <Button variant="primary" size="lg">
                      Large Button
                    </Button>
                    <Button
                      variant="primary"
                      loading={buttonLoading}
                      onClick={() => {
                        setButtonLoading(true);
                        setTimeout(() => setButtonLoading(false), 2000);
                      }}
                    >
                      {buttonLoading ? 'Saving...' : 'Click to Load'}
                    </Button>
                    <Button variant="primary" disabled>
                      Disabled
                    </Button>
                    <Button variant="secondary" disabled>
                      Disabled Secondary
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* ════ SECTION 3: DRAWERS & MODALS ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <h2 className="ds-section-title">
                3. Slide-Over Drawers & Confirmation Modals
              </h2>
              <p className="ds-section-desc">
                Right-side slide-over drawers replace intrusive popups for complex workflows. Modals reserved for short confirmations. Keyboard Escape closes both.
              </p>
            </div>

            <Card>
              <div className="ds-flex-wrap">
                <Button
                  variant="primary"
                  onClick={() => {
                    setDrawerSize('md');
                    setIsDrawerOpen(true);
                  }}
                >
                  Open Right Drawer (Medium - 640px)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDrawerSize('lg');
                    setIsDrawerOpen(true);
                  }}
                >
                  Open Wide Drawer (Large - 840px)
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setIsModalOpen(true)}
                >
                  Open Confirmation Modal
                </Button>
              </div>
            </Card>
          </section>

          {/* ════ SECTION 4: KPI CARDS & CARDS (ZERO VERTICAL JUMP) ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <h2 className="ds-section-title">
                4. Operational KPI Cards & Surface Containers
              </h2>
              <p className="ds-section-desc">
                Hover state changes border color only; strictly zero vertical jump / no glow shadow.
              </p>
            </div>

            <div className="ds-grid-4">
              <KpiCard
                title="Total Rebar Stock"
                value="42,850 kg"
                subtext="Across all 7 diameters"
                trend={{ text: '+5.4% vs last week', isPositive: true }}
                icon={Database}
              />
              <KpiCard
                title="Reusable Remnants"
                value="811 offcuts"
                subtext="691 kg cleared for reuse"
                trend={{ text: '+18 today', isPositive: true }}
                icon={Layers}
              />
              <KpiCard
                title="Active Site Pours"
                value="12 pours"
                subtext="3 in progress currently"
                icon={BarChart2}
              />
              <KpiCard
                title="Material Waste %"
                value="1.84 %"
                subtext="Well within < 3.0% threshold"
                trend={{ text: '-0.32%', isPositive: true }}
                icon={CheckCircle}
              />
            </div>
          </section>

          {/* ════ SECTION 5: FORM CONTROLS & SEARCH ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <h2 className="ds-section-title">
                5. Form Controls & Search Input
              </h2>
              <p className="ds-section-desc">
                Consistent 36px desktop / 44px coarse touch height, accessible focus ring, no up/down arrows on number inputs.
              </p>
            </div>

            <Card>
              <div className="ds-grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-label)', marginBottom: '6px' }}>
                    Unified Search Input (with Clear button)
                  </label>
                  <SearchInput
                    value={searchVal}
                    onChange={(val) => setSearchVal(val)}
                    onClear={() => setSearchVal('')}
                    placeholder="Search brand, vendor, diameter..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-label)', marginBottom: '6px' }}>
                    Number Input (No spinner arrows, tabular numbers)
                  </label>
                  <Input
                    type="number"
                    defaultValue={12000}
                    style={{
                      width: '100%',
                      height: 'var(--control-height)',
                      padding: '0 12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </Card>
          </section>

          {/* ════ SECTION 6: RESPONSIVE DATA TABLE WITH SKELETON TOGGLE ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <h2 className="ds-section-title" style={{ margin: 0 }}>
                  6. High-Density Data Table & Skeletons
                </h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSkeletons((prev) => !prev)}
                >
                  {showSkeletons ? 'Show Live Table' : 'Toggle Skeleton Loader'}
                </Button>
              </div>
              <p className="ds-section-desc">
                Sticky header with --table-header-bg, hover row highlight with --table-row-hover, and smooth shimmer skeleton.
              </p>
            </div>

            {showSkeletons ? (
              <TableSkeleton rows={4} cols={5} />
            ) : (
              <Table
                columns={tableColumns}
                data={sampleTableData}
                keyField="id"
              />
            )}
          </section>

          {/* ════ SECTION 7: BADGES & STATUS PILLS ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <h2 className="ds-section-title">
                7. Status Badges (Text-Safe Variants)
              </h2>
              <p className="ds-section-desc">
                Text colors use guaranteed 4.5:1+ variants with subtle tinted fills and 6px dot indicators.
              </p>
            </div>

            <Card>
              <div className="ds-flex-wrap">
                <Badge variant="success" dot>Approved / In Stock</Badge>
                <Badge variant="warning" dot>Pending Review</Badge>
                <Badge variant="danger" dot>Critical Deficit</Badge>
                <Badge variant="info" dot>Draft Inward</Badge>
                <Badge variant="accent" dot>Optimized Bar</Badge>
                <Badge variant="neutral">Neutral Tag</Badge>
              </div>
            </Card>
          </section>

          {/* ════ SECTION 8: NAVIGATION TABS ════ */}
          <section className="ds-section">
            <div className="ds-section-header">
              <h2 className="ds-section-title">
                8. Navigation Tabs
              </h2>
              <p className="ds-section-desc">
                Accessible tab bar with active indicator and optional badge counts.
              </p>
            </div>

            <Card>
              <Tabs
                tabs={[
                  { id: 'all', label: 'All Stock', count: 184 },
                  { id: 'standard', label: '12m Standard Prime', count: 120 },
                  { id: 'remnants', label: 'Reusable Remnants', count: 54 },
                  { id: 'scrap', label: 'Scrap & Offcuts', count: 10 },
                ]}
                activeTab={activeTab}
                onChange={(tabId) => setActiveTab(tabId)}
              />
              <div style={{ padding: '16px 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Viewing tab: <strong>{activeTab}</strong>
              </div>
            </Card>
          </section>

        </div>
      </div>

      {/* ── INTERACTIVE DRAWER DEMO ── */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        size={drawerSize}
        title="Add Material Inward Voucher"
        subtitle="Record prime steel or reusable remnant intake into yard inventory."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                alert('Voucher submitted successfully!');
                setIsDrawerOpen(false);
              }}
            >
              Submit Inward Voucher
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-label)', marginBottom: '4px' }}>
              Diameter
            </label>
            <Select
              style={{
                width: '100%',
                height: 'var(--control-height)',
                padding: '0 10px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            >
              <option>Ø 8 mm</option>
              <option>Ø 10 mm</option>
              <option>Ø 12 mm</option>
              <option>Ø 16 mm</option>
              <option>Ø 20 mm</option>
              <option>Ø 25 mm</option>
              <option>Ø 32 mm</option>
            </Select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-label)', marginBottom: '4px' }}>
              Weight (Metric Tons)
            </label>
            <Input
              type="number"
              placeholder="e.g. 5.25 MT"
              style={{
                width: '100%',
                height: 'var(--control-height)',
                padding: '0 12px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-label)', marginBottom: '4px' }}>
              Supplier / Vendor
            </label>
            <Input
              type="text"
              placeholder="e.g. Shivshakti Steel Corp"
              style={{
                width: '100%',
                height: 'var(--control-height)',
                padding: '0 12px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-label)', marginBottom: '4px' }}>
              Brand Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Tata Tiscon 550D"
              style={{
                width: '100%',
                height: 'var(--control-height)',
                padding: '0 12px',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
      </Drawer>

      {/* ── INTERACTIVE CONFIRMATION MODAL DEMO ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Delete Stock Record?"
        description="Are you sure you want to delete this stock entry? This will adjust the yard balances immediately and log an activity entry."
        confirmText="Yes, Delete Record"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          alert('Stock record deleted.');
          setIsModalOpen(false);
        }}
      />
    </PageLayout>
  );
}
