# RebarOptima — UI/UX Design System & Experience Architecture

This document provides a comprehensive, end-to-end specification of the User Interface (UI) and User Experience (UX) across the entire **RebarOptima** application. It serves as the definitive reference for product designers, frontend engineers, and stakeholders.

---

## 1. Executive Product & UX Overview

### 1.1 Purpose & Value Proposition
**RebarOptima** is an enterprise-grade web platform solving the **One-Dimensional Cutting Stock Problem (1D-CSP)** for construction rebars, structural steel sections, and linear materials. Its mission is to minimize material wastage (scrap), track reusable off-cuts (remnants), automate bar bending schedules (BBS), and manage site casting cycles.

### 1.2 Target Audience & Behavioral Context
RebarOptima is designed for:
- **Civil & Structural Site Engineers**: Need rapid verification of cut plans and accurate bar bending shapes.
- **Shop-floor Fabricators & Machine Operators**: Need unambiguous, high-contrast cutting tickets, printouts, and segment measurements.
- **Quantity Surveyors & Cost Estimators**: Require accurate tonnage calculations, scrap percentages, and financial loss metrics.
- **Inventory & Yard Managers**: Track incoming standard deliveries, off-cut remnant stacks, and scrap sales.

### 1.3 Core Human-Centered Design Philosophy
1. **Tool, Not Toy**: Replaces generic AI templates, decorative gradients, and floating canvas artifacts with a calm, high-density industrial tool aesthetic inspired by professional engineering software.
2. **Speed & Ergonomics**: Optimizes high-volume numeric entry (lengths in millimeters, quantities, diameters) with keyboard shortcuts, auto-row appending, and tabular numerals.
3. **Legibility in Harsh Environments**: High-contrast typography and clear borders provide comfortable visibility in both bright site offices and low-light field conditions.
4. **Theme Cohesion**: Cleanly unifies light and dark modes with customizable color themes (`Slate Emerald`, `Steel Blue`, and `Classic Purple`), avoiding uncoordinated hardcoded colors.

---

## 2. Design System Tokens & Global Styling

### 2.1 Color Palette Architecture
All application components reference centralized CSS variables defined in [index.css](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/index.css):

| Token Name | Light Theme | Dark Theme | Purpose |
| :--- | :--- | :--- | :--- |
| `--main-bg` | `#f8fafc` (Slate 50) | `#0b1120` (Deep Slate) | Global viewport backdrop |
| `--card-bg` | `#ffffff` (Pure White) | `#131c31` (Card Surface) | Form cards, panels, modals |
| `--card-border` | `#e2e8f0` (Slate 200) | `#23314d` (Subtle Navy) | Structural dividers & borders |
| `--text-primary` | `#0f172a` (Slate 900) | `#f8fafc` (Slate 50) | Headings, inputs, primary values |
| `--text-secondary`| `#475569` (Slate 600) | `#94a3b8` (Slate 400) | Labels, subheadings, hints |
| `--text-label` | `#64748b` (Slate 500) | `#64748b` (Slate 500) | Micro table headers, unit labels |
| `--accent` | Theme-dependent | Theme-dependent | Primary buttons, active tabs, focus rings |
| `--accent-subtle` | `rgba(accent, 0.08)` | `rgba(accent, 0.16)` | Selected navigation rows, pills |
| `--danger` | `#ef4444` (Crimson) | `#ef4444` (Crimson) | Delete actions, destructive alerts |
| `--success` | `#10b981` (Emerald) | `#10b981` (Emerald) | High utilization, confirmations |
| `--warning` | `#f59e0b` (Amber) | `#f59e0b` (Amber) | Remnant alerts, pending approvals |

#### Theme Color Mappings
- **Slate Emerald** (Default): Primary accent `#059669` / `#10b981`. Industrial, clean, ecological efficiency.
- **Steel Blue**: Primary accent `#2563eb` / `#3b82f6`. Engineering precision, architectural tone.
- **Classic Purple**: Primary accent `#7016d2` / `#8b5cf6`. Modern executive contrast.

### 2.2 Typography System
- **Typeface**: Inter, sans-serif (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`).
- **Base Size**: Fixed `14px` (avoids unpredictable layout shifts caused by fluid viewport clamps).
- **Tabular Numerals**: `font-variant-numeric: tabular-nums lining-nums` applied globally across tables, inputs, cut layouts, and KPI values. Numbers align vertically without jitter.
- **Hierarchy**:
  - `Page Title`: 22px–24px, 700 Weight, `-0.4px` tracking.
  - `Section / Card Header`: 13.5px–14px, 700 Weight, uppercase, `+0.6px` tracking.
  - `Form Labels`: 12.5px, 600 Weight.
  - `Table Headers`: 11px–11.5px, 600 Weight, uppercase, `+0.4px` tracking.
  - `Table Inputs / Body`: 13.5px, 500 Weight.
  - `Micro Annotations / Units`: 9.5px–11px, 600 Weight.

### 2.3 Surface, Elevation & Depth
- **Solid Surfaces**: The previous artificial dot-matrix grid (`radial-gradient`) was eliminated in favor of clean, solid surfaces with crisp `1px solid var(--card-border)`.
- **Restrained Shadows**: Soft, subtle elevation (`--card-shadow`: `0 1px 3px rgba(15, 23, 42, 0.05)`) without murky drop shadows or visual noise.
- **Clean Accessible Scrollbars**: Thin 6px scrollbars with rounded muted thumbs that provide visual feedback on scrollable containers without cluttering the UI.
- **Keyboard Focus Rings**: Standardized `:focus-visible` with `2px solid var(--accent)` and `1px outline-offset`.
- **Accessibility & Motion**: Fully respects `@media (prefers-reduced-motion: reduce)` by disabling transition and animation delays for users who prefer reduced motion.

---

## 3. Global Layout & Navigation Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP MOBILE HEADER (Mobile Viewports ≤ 900px only)                      │
├─────────────────┬──────────────────────────────────────────────────────┤
│                 │ MAIN WORKSPACE VIEWPORT                              │
│  SIDENAVBAR     │                                                      │
│  • Brand Logo   │  [Active Page Header + Actions]                      │
│  • Overview     │                                                      │
│  • Steel Group  │  [Core Form / Tables / Interactive Canvas]            │
│    - Inventory  │                                                      │
│    - Optimizer  │  [Metrics / Analysis Cards]                          │
│    - History    │                                                      │
│  • BBS Module   │  [Recent Activity / Ledger / Export Tools]           │
│  • Casting Mgmt │                                                      │
│  • Ledger       │                                                      │
│  • Settings     │                                                      │
│  • Users/Roles  │                                                      │
│  ─────────────  │                                                      │
│  • Theme Switch │                                                      │
│  • User Profile │                                                      │
│  • Logout       │                                                      │
└─────────────────┴──────────────────────────────────────────────────────┘
```

### 3.1 Side Navbar ([SideNavbar.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/components/SideNavbar/SideNavbar.jsx))
- **Brand Mark**: Clean industrial branding with bold sans-serif lettering: **Rebar** (700 weight, primary slate) + **Optima** (800 weight, theme accent).
- **Grouped Disclosures**: The `Steel` section features an accordion disclosure grouping *Inventory*, *Run Optimizer*, and *Batch History*.
- **Role-Based Visibility (RBAC)**: Menus automatically filter depending on the user's effective permissions (`ADMIN`, `OWNER`, `ENGINEER`, `OPERATOR`, `VIEWER`).
- **Footer Profile & Controls**:
  - Direct theme mode toggle (Dark / Light).
  - User profile badge displaying initials or avatar, full name, role, and current active company/project.
  - Safe session logout button with destructive hover feedback.

---

## 4. Screen-by-Screen UI/UX Specification

### 4.1 Authentication Screens ([SignInPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/SignInPage/SignInPage.jsx), [SignUpPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/SignUpPage/SignUpPage.jsx))
- **Layout**: Two-column split card (1000px max width).
- **Left Column**: Architectural construction hero graphic with branded gradient overlay, brand logo, and feature value propositions (*Track Projects*, *Manage Tasks*, *Build Better*).
- **Right Column**: High-contrast credential entry form.
  - Auto-focused email and password fields with input icons and password reveal toggle.
  - Instant client validation and server error callouts with error icons.
  - Clean `Remember me` checkbox and `Forgot Password` link.
  - Hidden developer shortcut: 5 clicks on logo or `Cmd+Shift+D` / `Ctrl+Shift+D` opens superadmin debugging console.

---

### 4.2 Dashboard Overview ([OverviewPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/OverviewPage/OverviewPage.jsx))
- **Header**:
  - Welcome title and active organization/project tag.
  - **Live Sync Indicator**: Interactive pulse pill displaying relative sync time (e.g. `Synced 5s ago`). Clicking triggers an immediate background refresh with spinner feedback.
  - Direct Primary Action: `Run Optimization` button with arrow icon.
- **6 Equal KPI Cards**:
  1. **Live Stock**: Standard 12m stock weight vs Reusable Remnant weight (Kg).
  2. **Scrap Stock**: Live scrap vs Total historical scrap generated (Kg).
  3. **Scrap Percentage**: Wastage percentage with dynamic yield pill (e.g. `98.2% Rebar Yield`).
  4. **Total Steel Purchased**: Cumulative procurement investment (INR / Rs) with tonnage inward badge.
  5. **Total Scrap Sold**: Scrap weight offloaded and revenue recovered.
  6. **Lost Material Value**: Net unrecovered financial scrap loss.
- **Visual Analytics Section**:
  - **Diawise Live Stock Panel**: Stacked horizontal distribution bars comparing Standard vs Remnant inventory per rebar diameter (8mm, 10mm, 12mm, 16mm, 20mm, 25mm, 32mm).
  - **30-Day Scrap Generation SVG Chart**: Interactive daily line chart tracking waste spikes with peak headroom and date tickers.

---

### 4.3 Run Optimizer — New Batch ([NewBatchPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/NewBatchPage/NewBatchPage.jsx))
The primary workhorse screen for estimators and cutting schedulers.

- **Batch Identification & Parameters Card**:
  - Batch Name / Job reference input (auto-generated timestamp default).
  - **Inline Cutting Margins Drawer**: Toggles **Kerf Loss** (saw blade width in mm deducted per cut) and **End Trim Margin** (length trimmed off mill-damaged bar ends).
- **Manual Stock Inventory Override Card**:
  - Collapsible table for simulating outside stock lengths or custom stock bars.
  - When collapsed: clearly informs the user that available stock is pre-loaded from live MongoDB warehouse counts.
  - When expanded: tabular input for Diameter, Available Length (mm), and Quantity.
- **Required Cut Parts Card**:
  - High-density table: `#`, `Diameter (mm)`, `Required Cut Length (mm)`, `Quantity (pcs)`, `Member / Part Label (Optional)`.
  - **Ergonomic Keyboard Navigation**: Pressing `Tab` or `Enter` in the last field automatically appends a new row and moves focus to the first cell of the new row.
  - Inline CSV Import: Modal allowing users to paste tab-separated or comma-separated rows copied from Excel or fabrication sheets.
- **Primary CTA**: Prominent `Calculate Cutting Plan` button with loading state (`Calculating Cutting Plan...`).
- **Recent Optimizations Grid**: Quick restore cards showing previous runs, average utilization %, bars used, and timestamp. Clicking immediately reloads that batch's parameters.

---

### 4.4 Results & Cutting Visualization ([ResultsPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/ResultsPage/ResultsPage.jsx))
Renders the solution to the cutting stock optimization problem.

- **Action Bar**:
  - `Edit Parameters` (returns to input sheet while preserving data).
  - `Save Batch to Database` (commits transactions, deducts stock, registers remnants).
  - `Export CSV / Excel` spreadsheet download.
  - `Print / PDF Report` dropdown menu:
    - **Workshop Cutting Ticket**: Minimalist cutting list optimized for shop-floor operators.
    - **Foreman View**: Detailed segment breakdown with remnant collection tags.
    - **Executive Summary**: High-level financial and scrap analysis.
- **Top Summary Metric Grid**:
  - Material Utilization % (e.g. `98.75%`).
  - Total Stock Bars Consumed.
  - Total Required Cut Weight (Kg).
  - Remnants Weight Saved (Kg) vs Pure Scrap Lost (Kg).
- **Interactive Cutting Layouts**:
  - Each distinct cutting pattern is displayed as a dedicated layout card:
    - **Pattern ID Avatar** (A, B, C...) + **Repetition Counter** (`12x`).
    - **Physical Stock Information**: Diameter, Stock length, whether it is a virgin standard bar, a reused remnant, or an unavailable virtual bar.
    - **Visual Bar Segment Ruler**: Proportional horizontal bar where each cut part is rendered as a distinct color block with length annotation in millimeters.
    - **Remnant / Scrap Segment**: Distinct hatched/dashed segment showing offcuts. If the offcut meets the diameter's reuse threshold, it is labeled as a **Reusable Remnant**; otherwise, it is labeled as **Scrap**.
    - **Pattern Utilization Score**: Utilization % and scrap mm for that specific bar configuration.

---

### 4.5 Inventory Management ([InventoryPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/InventoryPage/InventoryPage.jsx))
- **Hero Stats**: Standard Stock Kg, Remnants Stock Kg, Total Scrap Kg, Monthly Scrap Revenue.
- **Tabbed Interface**:
  1. **Stock List**: Dual view of Standard Stock bars and Remnant Offcuts. Supports filtering by diameter, searching by length ranges (`<1m`, `1-3m`, `>3m`), and inline quantity adjustments.
  2. **Inward Stock Voucher**: Multi-diameter procurement entry sheet for recording incoming deliveries with vendor name, brand, weight in metric tons, price per ton, and automated GST calculations.
  3. **Scrap Rules**: Configurable minimum length thresholds per diameter (e.g., a 16mm off-cut ≥ 1500mm is categorized as a reusable remnant; anything shorter is logged as scrap).
  4. **Scrap Sales Portal**: Log of scrap buyer transactions, date, weighbridge weights, price per kg, and total revenue.
  5. **Batch Scrap Ledger**: Historical scrap generated per cutting batch.

---

### 4.6 Bar Bending Schedule — BBS Module ([BBSPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/BBSPage/BBSPage.jsx))
- **Project Structure**: Projects -> Structural Elements (Beams, Columns, Slabs, Footings) -> Members -> Bar Schedules.
- **Shape Library Integration**:
  - Standard IS / BS rebar shape codes (Straight, L-Bend, Cranked, Stirrups, Links, Spirals).
  - SVG Shape Renderer illustrating dimension points (`a`, `b`, `c`, `d`, `e`) and hook deductions.
- **Seamless Optimizer Handoff**: A dedicated `Push to Optimizer` action exports BBS schedule rows directly into `NewBatchPage` with diameters, lengths, and bar counts pre-filled.

---

### 4.7 Casting Management & Ledger ([CastingPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/CastingPage/CastingPage.jsx), [LedgerPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/LedgerPage/LedgerPage.jsx))
- **Casting Cycles**: Tracks planned pours, pre-pour rebar cage inspections, concrete pouring timestamps, and cube testing milestones.
- **Inventory Ledger**: Complete audit trail of every stock modification (`INWARD`, `OUTWARD`, `REMNANT`, `SCRAP_SALE`) with timestamp, user ID, reference batch ID, and running warehouse balance.

---

### 4.8 Settings, Roles & Administration ([SettingsPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/SettingsPage/SettingsPage.jsx), [RolesPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/RolesPage/RolesPage.jsx), [UsersPage.jsx](file:///Users/darshanpatel/Desktop/RebarOptima/frontend/src/pages/UsersPage/UsersPage.jsx))
- **Theme & Brand Preferences**: Real-time switching between Light/Dark mode and Color Theme profiles.
- **Cutting Defaults**: Set company-wide defaults for Kerf Loss (mm), End Trim Margin (mm), and Standard Bar Length (12,000mm).
- **Role-Based Access Control**: Matrix grid enabling or disabling module access (*Overview*, *Optimizer*, *Inventory*, *BBS*, *Casting*, *Ledger*, *Settings*, *Activity Logs*) per role.

---

## 5. UI/UX Guidelines for Future Features

To ensure that future features feel crafted by a senior human designer rather than a generic generator, all new modules must adhere to the following principles:

1. **Reuse Existing Design Tokens**: Never hardcode colors (e.g. `#10b981`, `#7016d2`, `#3b82f6`). Always use `var(--accent)`, `var(--accent-subtle)`, `var(--card-bg)`, `var(--card-border)`, and `var(--text-primary)`.
2. **Numeric Precision**: Every element displaying weight, currency, lengths, or quantities must use tabular figures (`tabular-nums`) and standard unit abbreviations (`mm`, `Kg`, `T`, `pcs`, `Rs.`).
3. **Ergonomic Data Entry**: Long input tables must implement keyboard navigation (`Tab` or `Enter` to create a row).
4. **Meaningful States**: Every screen and table must provide:
   - **Loading State**: Centered spinner with descriptive context message (`<LoadingSpinner message="..." />`).
   - **Empty State**: Friendly, dashed-border empty placeholder with clear instructions on how to add data.
   - **Error State**: Non-blocking alert banners with retry actions.
   - **Interactive Feedback**: Hover, focus-visible, and active button scaling.
5. **Print & PDF Integrity**: Always verify that print media styles (`@media print`) force white backgrounds, remove sidebars, and maintain page break boundaries (`page-break-inside: avoid`).
