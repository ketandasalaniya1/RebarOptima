# RebarOptima — Enterprise System Manual & Complete Feature Guide
> **Comprehensive Operational Reference**: Architecture, Attendance & Workforce Management, All Analytical Reports, CAD/Drawings Engine, BBS Optimization, Project Execution, CRM, Inventory, and Financial Controls.

---

## 📑 Table of Contents
1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Tenant Isolation & Project-First Data Architecture](#2-tenant-isolation--project-first-data-architecture)
3. [Site Attendance & Workforce Management](#3-site-attendance--workforce-management)
4. [Enterprise Reports & Analytics Suite](#4-enterprise-reports--analytics-suite)
   - 4.1 [BBS & Rebar Scrap Optimization Reports](#41-bbs--rebar-scrap-optimization-reports)
   - 4.2 [Daily Progress & Labour Attendance Reports (DPR)](#42-daily-progress--labour-attendance-reports-dpr)
   - 4.3 [Material Inventory, Stock Balances & Scrap Sales](#43-material-inventory-stock-balances--scrap-sales)
   - 4.4 [Concrete Quality, Slump & Cube Strength Reports](#44-concrete-quality-slump--cube-strength-reports)
   - 4.5 [CRM Sales, Receivables & Milestone Aging](#45-crm-sales-receivables--milestone-aging)
   - 4.6 [Site Petty Cash & Vouchers Reconciliation](#46-site-petty-cash--vouchers-reconciliation)
   - 4.7 [Drawings Matrix, Transmittal Slips & Audit Logs](#47-drawings-matrix-transmittal-slips--audit-logs)
5. [Drawings & Document Management Module (Screens 1–8)](#5-drawings--document-management-module)
   - 5.1 [All Drawings Register & Dynamic Filtering](#51-all-drawings-register--dynamic-filtering)
   - 5.2 [Drawing Viewer (DWG, DXF & PDF Linework Engine)](#52-drawing-viewer-dwg-dxf--pdf-linework-engine)
   - 5.3 [Version Control & Revision Upload](#53-version-control--revision-upload)
   - 5.4 [Multi-Tier Approval Workflow & Maker-Checker Gate](#54-multi-tier-approval-workflow--maker-checker-gate)
   - 5.5 [Drawing Matrix (Block vs Level Quick Access)](#55-drawing-matrix-block-vs-level-quick-access)
   - 5.6 [Transmittals & External Share Packages](#56-transmittals--external-share-packages)
   - 5.7 [Plan Pass & Statutory Clearances](#57-plan-pass--statutory-clearances)
   - 5.8 [Activity Audit & Compliance Trail](#58-activity-audit--compliance-trail)
6. [Bar Bending Schedule (BBS) & 1D Cutting Stock Optimization](#6-bar-bending-schedule-bbs--1d-cutting-stock-optimization)
7. [Concrete Casting, Precast Yard & Quality Curing](#7-concrete-casting-precast-yard--quality-curing)
8. [General Site Inventory & Material Procurement](#8-general-site-inventory--material-procurement)
9. [Project Management & CPM Critical Path Scheduling](#9-project-management--cpm-critical-path-scheduling)
10. [Site Petty Cash & Imprest Fund Vouchers](#10-site-petty-cash--imprest-fund-vouchers)
11. [Real Estate CRM, Unit Inventory & Sales Lifecycle](#11-real-estate-crm-unit-inventory--sales-lifecycle)
12. [Role-Based Access Control (RBAC) & Governance Matrix](#12-role-based-access-control-rbac--governance-matrix)
13. [Glossary of Engineering & Construction Terminology](#13-glossary-of-engineering--construction-terminology)

---

# 1. Executive Summary & Core Philosophy

**RebarOptima** is an enterprise-grade cloud ERP and civil engineering automation platform engineered specifically for civil infrastructure contractors, precast yard operators, structural consultants, and real estate developers.

### The Core Problem in Civil Construction
Civil construction projects routinely suffer from:
1. **Steel Scrap Bleed**: Industry standard rebar scrap rates range between **8% and 15%** due to ad-hoc manual cutting on site, costing millions in wasted steel.
2. **Workforce & Labor Leakage**: Inaccurate contractor headcount reporting, unverified overtime, and lack of correlation between daily labor deployment and physical task completion.
3. **Outdated Drawing Hazards**: Workers constructing structural elements from superseded drawing revisions, leading to catastrophic demolition and rework orders.
4. **Scattered Reports & Paper Vouchers**: Delayed reporting between site supervisors and head office decision makers, causing blind procurement and cashflow crunches.

### The RebarOptima Solution
RebarOptima bridges the site-to-office gap by enforcing:
* **Mathematical 1D-CSP Optimization**: Reduces steel scrap below **2.5%** by calculating optimal cutting combinations and cataloging reusable remnants.
* **Integrated Daily Attendance & DPR**: Directly correlates daily laborer headcounts with physical concrete, steel, and shuttering quantities delivered.
* **Strict Versioning & Maker-Checker Governance**: Ensures only **Current & Approved** drawings reach the job site, with immediate watermarking of superseded sheets.
* **Live Automated Reports**: Single-click generation of Diameter-wise Steel Takeoffs (MTO), Transmittal Slips, Expense Ledgers, and Cash Flow Audits.

---

# 2. Tenant Isolation & Project-First Data Architecture

RebarOptima enforces a strict multi-tenant, project-first isolation hierarchy to prevent cross-company data leakage and cross-project contamination:

```
[System SuperAdmin]
       │
       ▼
 [Company / Tenant Organization]  (Strict isolation boundary)
       │
       ▼
   [Project]  (Primary context: skyline Residency, Metro Tower B)
       │
  ┌────┴───────────────────────────┬────────────────────────────┐
  ▼                                ▼                            ▼
[Blocks & Disciplines]    [BBS & Optimization]         [Drawings Register]
  │                                │                            │
  ▼                                ▼                            ▼
[CPM WBS & Tasks]        [Inventory & Remnants]       [Revisions & Approvals]
  │                                │                            │
  ▼                                ▼                            ▼
[Daily Attendance / DPR]  [Cube Strength Tests]       [Transmittal Slips]
```

### Invariants & Rules:
1. **Project-First Guard**: No user can create or view drawings, log attendance, approve casting pours, or edit BBS records without selecting an **Active Project**.
2. **Tenant ID Immutability**: Every database record (`doc_drawings`, `doc_revisions`, `pm_dprs`, `bbs_runs`, `inventory_items`) strictly carries a `companyId` foreign key. Queries enforce this context at the database gateway level.
3. **Audit Trail**: Every state transition (upload, approve, reject, print, export, delete) logs the User ID, Full Name, Role, Timestamp, and IP address.

---

# 3. Site Attendance & Workforce Management

Site productivity and cost control depend on accurate manpower deployment. The Workforce Management sub-system within RebarOptima integrates directly with **Daily Progress Reports (DPR)** and **Project Management (PM)** tasks.

### 3.1 Daily Attendance Workflow
```
[Site Contractor Gang] ──► [Morning Check-in / Shift Assignment]
                                     │
                                     ▼
                [Activity Deployment: Task / Block / Level]
                                     │
                                     ▼
[Supervisor Evening DPR Entry: Headcount + Actual Man-Hours]
                                     │
                                     ▼
[PM Verification & Quantity Cross-Check: Work Delivered vs Hours]
                                     │
                                     ▼
               [Approved Labor Ledger & Contractor Billing]
```

### 3.2 Key Data Points Logged Per Shift
1. **Activity / Task Association**: Links attendance directly to a WBS task (e.g., *Level 3 Slab Shuttering*, *Raft Rebar Tying*, *Beam Bottom Concreting*).
2. **Date & Shift**: `DAY`, `NIGHT`, or `OVERTIME` shifts.
3. **Trade Classification**:
   * **Bar Benders (Fitter / Steel Fixer)**: Tying reinforcement cages, cutting and bending bars.
   * **Carpenters / Formwork Gang**: Erecting aluminum/plywood shuttering, staging, prop alignment.
   * **Masons & Concrete Gang**: Pouring, vibrator compaction, screeding, curing.
   * **Helpers / Riggers**: Shifting raw steel, crane banksman, housekeeping.
4. **Headcount & Cumulative Man-Hours**:
   * `labourCount`: Total workers present in the gang.
   * `actualLabourHours`: Calculated as $\text{labourCount} \times \text{shift hours} + \text{approved overtime}$.
5. **Supervisor Verification**: Name and signature of the field engineer submitting the muster sheet.

### 3.3 Output Productivity Metrics
The system automatically calculates standard engineering productivity ratios:
* **Steel Tying Productivity**: $\text{Hours per Metric Ton (MT)} = \frac{\text{Actual Labour Hours}}{\text{Steel Tied (MT)}}$ (Benchmark: 28–36 hours/MT).
* **Concrete Pour Rate**: $\text{Cubic Meters per Man-Hour} = \frac{\text{Volume Poured (m}^3\text{)}}{\text{Actual Labour Hours}}$.
* **Formwork Cycle Time**: Man-hours invested per square meter ($m^2$) of shuttering fixed and dismantled.

### 3.4 Verification & Maker-Checker Gate
* **No Blind Approvals**: The Project Manager (PM) reviews the daily attendance alongside the **Accepted Quantity** of work. If a gang of 20 workers reports 160 man-hours but zero physical output due to a breakdown or rain, the supervisor must record delay categories (*Rain*, *Ready-Mix Concrete Delay*, *Crane Breakdown*), preventing fraudulent contractor billing.

---

# 4. Enterprise Reports & Analytics Suite

RebarOptima features an automated reporting engine providing clear executive dashboards, audit-ready PDF slips, and Excel/CSV data exports.

---

## 4.1 BBS & Rebar Scrap Optimization Reports
* **Material Take-Off (MTO) Report**:
  * Breakdown of steel requirements grouped by bar diameter ($\Phi 8, 10, 12, 16, 20, 25, 32$ mm).
  * Metrics: Number of cut pieces, total running length (meters), and nominal unit weight (kg/m based on $W = \frac{D^2}{162}$).
  * Total structural steel tonnage required per element, floor, or complete building.
* **Bar Mark & Cutting Schedule Report**:
  * Individual bar mark identifiers, bending shape sketches, leg dimensions ($A, B, C, D, E$), hook allowances, and deducted bend lengths.
* **1D-CSP Optimization & Scrap Scoreboard**:
  * **Stock Bar Consumption**: Total commercial 12m stock bars utilized.
  * **Scrap / Wastage %**: Overall scrap percentage achieved vs. standard allowance:
    $$\text{Scrap \%} = \frac{\text{Total Scrap Weight}}{\text{Total Input Stock Weight}} \times 100$$
  * **Remnant Inventory Report**: Reusable off-cuts ($> 1.2$ meters) cataloged with unique barcode/rack tags to prevent selling usable lengths as junk.

---

## 4.2 Daily Progress & Labour Attendance Reports (DPR)
* **Daily Site Performance Summary**:
  * Tabulated breakdown of planned vs. actual progress across all active work fronts.
  * Labor deployment by trade, total supervisor sign-offs, and weather/delay impact logs.
* **Cumulative Quantity Variance Report**:
  * Tracks cumulative completed quantities against baseline tender quantities, highlighting slippages before they cause milestone penalties.
* **Equipment & Machinery Hours**:
  * Operating vs. idle hours for heavy plant (Tower Cranes, Concrete Pumps, Bar Bending Machines, Generators).

---

## 4.3 Material Inventory, Stock Balances & Scrap Sales
* **Stock Inward & Delivery Challan (DC) Register**:
  * Mill test certificate (MTC) numbers, heat numbers, vehicle numbers, weighbridge net weights, and physical tolerance variances.
* **Material Consumption vs. Theoretical Estimate**:
  * Compares actual steel and cement consumed against theoretical design quantities to immediately detect site pilferage or excessive foundation over-pours.
* **Scrap Sales Invoicing & Ledger**:
  * Commercial ledger tracking off-cuts $< 1.0$ meter sold to scrap recyclers, recording gate pass numbers, weighbridge slips, price per kg, and cash/bank receipt reconciliation.

---

## 4.4 Concrete Quality, Slump & Cube Strength Reports
* **Pour Card & Pour Slip Records**:
  * Element ID, batching plant ticket number, design mix (e.g., M25, M30, M40, M50), target slump, water-cement ratio, and pour start/end timestamps.
* **Cube Compressive Strength Trend Report**:
  * 7-day early indicative strength vs. 28-day statutory design compliance.
  * Standard deviation analysis and characteristic strength curves ($f_{ck}$) complying with IS 456 / ACI 318.
  * Early warning trigger if 7-day strength falls below $65\%$ of target design strength.

---

## 4.5 CRM Sales, Receivables & Milestone Aging
* **Unit Inventory Status Matrix**:
  * Visual color-coded grid: *Available (Green)*, *Booked (Amber)*, *Sold (Blue)*, *Blocked / Management Reserved (Gray)*.
* **Construction-Linked Payment Schedule (CLP) Report**:
  * Automated payment trigger reports linked to structural completion (e.g., *Casting of Level 5 Slab triggers Demand Note for 10%*).
* **Outstanding Receivables & Aging Buckets**:
  * Customer payment aging: $0–30$ days, $31–60$ days, $61–90$ days, and $>90$ days, including interest calculation on late dues.
* **Salesperson Performance & Conversion Velocity**:
  * Site visits logged, lead-to-booking conversion rates, and accrued sales commissions.

---

## 4.6 Site Petty Cash & Vouchers Reconciliation
* **Imprest Balance & Cash Burn Ledger**:
  * Opening balance, cash disbursed for emergency site expenses, and real-time closing balances.
* **Expense Category Breakdown**:
  * Visual distribution of micro-spends: *Safety Consumables (PPE)*, *Equipment Fuel & Grease*, *Machine Repair / Spares*, *Site Tea & Welfare*, *Hardware & Fasteners*.
* **Voucher Receipt & Tax Audit Report**:
  * Scanned bill attachments, GST invoices, supervisor signatures, and approval stamps by the Project Director.

---

## 4.7 Drawings Matrix, Transmittal Slips & Audit Logs
* **Comprehensive Drawing Matrix Report**:
  * Multi-dimensional grid displaying Discipline (Architectural, Structural, MEPF) across Building Levels ($B2, B1, G, L1 \dots Ln, Terrace$).
  * Visual indicators: Has Drawing (Green Check), Under Review (Amber Dot), Rejected (Red Dot), No Drawing (Dash).
* **Formal Transmittal Slips (Exportable PDF)**:
  * Industry-standard distribution document detailing Transmittal Number (e.g., `TR-2026-0042`), Project Name, Date, Purpose (*For Construction*, *For Review*), Drawing Numbers, Version Tags, and Recipient Acknowledgment Blocks.
* **Activity Compliance Trail**:
  * Comprehensive audit log showing who viewed, uploaded, approved, distributed, or voided any drawing revision.

---

# 5. Drawings & Document Management Module

The Drawings Module provides single-source-of-truth document governance for site engineers, architects, and project leaders.

```
       [Discipline Consultant] (Architect, Structural Engineer)
                                  │
                                  ▼
                  [Screen 3: Upload New Version]
                     - SHA-256 Checksum check
                     - DWG / DXF / PDF / Image
                                  │
                                  ▼
                  [Screen 4: Review Approval Flow]
                     - Maker-Checker gate
                     - Side-by-side verification
                     - Approve or Reject with notes
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
             [REJECTED]                      [APPROVED]
      (Rejection note logged)            (Promoted to CURRENT)
                                                  │
                                                  ▼
                                       [SUPERSEDES Old Version]
                                    (Old tagged: DO NOT BUILD)
                                                  │
                                                  ▼
                                    [Screen 8: Transmittal Slip]
                                (Distributed to Site Team & Vendors)
```

### 5.1 All Drawings Register (Screen 1)
* **Global Filters**: Scoped by Active Project, Block Selector (*Block A, Block B, Podium*), Discipline (10 values including *Architectural, Structural, MEPF, Fire, Landscape*), and Level/Floor.
* **Quick Access Tabs**: Seamless switching between `Drawings`, `Plan Pass`, and `Drawing Matrix`.
* **Table Columns**:
  * Checkbox for bulk actions (*Create Transmittal*, *Download Zip*).
  * Drawing Number & Title.
  * Current Version Badge ($v1, v2, v3$).
  * Status Pill: `CURRENT` (Emerald Green), `IN_REVIEW` (Warm Amber), `REJECTED` (Crimson Red), `DRAFT` (Slate Gray), `SUPERSEDED` (Gray-Blue), `VOID` (Dark Charcoal).
  * Last Updated Date & Authorized Author Name.
  * Row Actions: View Drawing, Upload New Version, Version History, Transmittal, Void.

---

### 5.2 Drawing Viewer & Linework Engine (Screen 2)
The viewer dynamically routes and renders files according to format:
1. **DWG & DXF CAD Files**:
   * **Vector Linework Stream**: High-performance WebGL canvas powered by Three.js and custom CAD linework geometry.
   * **Auto-Conversion Pipeline**: DWG files are converted server-side into lightweight compressed vector streams using LibreDWG.
   * **Font Safety**: Renders linework with zero external font crashes, avoiding opentype font signature parsing issues.
   * **Interactive Controls**: Left-click pan, mouse wheel zoom at cursor, fit-to-view, rotate $90^\circ$, and full-screen inspection.
2. **PDF Documents**:
   * High-resolution canvas rendering with lazy page virtualization, thumbnail strip navigation, and jump-to-page input.
3. **Superseded Warning Banner**:
   * If a user opens an obsolete revision, an unmistakable persistent red alert banner spans the canvas:
     $$\mathbf{\text{⚠️ SUPERSEDED REVISION — DO NOT BUILD — STRICTLY FOR AUDIT ARCHIVE}}$$
4. **Current Version Metadata Panel**:
   * Displays Version number, status pill, uploader identity, upload timestamp, file size, change description, revision reason, and purpose (*For Review, For Approval, For Construction*).
   * Immediate "Download Original" action for local CAD workstation inspection.

---

### 5.3 Version Control & Revision Upload (Screen 3)
* **Drag-and-Drop Dropzone**: Supports PDF, DWG, DXF, JPG, and PNG up to 500 MB.
* **Client-Side SHA-256 Worker**: Computes cryptographic checksum in a background Web Worker prior to transmission.
* **Duplicate Detection**: Queries the server with the checksum. If an identical file already exists on the current drawing, it presents an amber confirmation prompt: *"Identical file contents detected. Do you want to proceed?"*
* **Required Revision Metadata**:
  * Change Description (minimum 5 characters, live counter).
  * Revision Reason: `DESIGN_REVISION`, `CLIENT_REQUEST`, `SITE_ISSUE`, `AUTHORITY_COMMENT`.
  * Purpose of Issue: `FOR_REVIEW`, `FOR_APPROVAL`, `FOR_CONSTRUCTION`.
  * Submit for Approval toggle (default locked checked when organizational compliance is enforced).

---

### 5.4 Multi-Tier Approval Workflow (Screen 4)
* **Maker-Checker Rule (Four-Eyes Principle)**:
  * The user who uploaded a revision **cannot** approve their own upload. The system disables decision buttons and displays: *"You cannot approve your own upload. An independent lead engineer or document controller must verify."*
* **Eligible Approver Roles**: `Admin`, `SuperAdmin`, `Lead Engineer`, `Project Manager`, or roles holding explicit `drawing:approve` permission.
* **Decision Options**:
  * **Approve**: Marks the revision as `Approved` and promotes it to the single `CURRENT` revision. Automatically marks all prior versions as `SUPERSEDED`.
  * **Reject**: Marks the revision as `Rejected`, records mandatory rejection remarks, and returns the sheet to Draft status.

---

### 5.5 Drawing Matrix (Screen 7)
* A high-density project grid mapping **Drawings vs. Building Levels** ($B2, B1, G, L1 \dots L20, Terrace$).
* Enables site directors to instantly verify whether structural drawings have been issued for an upcoming concrete pour without searching through file folders.

---

### 5.6 Transmittals & External Share Packages (Screen 8)
* Formal communication vehicle to issue drawings to general contractors, subcontractors, structural consultants, and client representatives.
* **Features**:
  * Selection of multiple approved drawings.
  * Purpose tags (*For Construction, For Information, Tender Submission*).
  * System-generated secure download token for external parties (valid with expiration).
  * Recipient tracking table logging: *Sent At*, *Viewed At*, and *Acknowledged At*.
  * Professional PDF Transmittal Slip ready for statutory records.

---

### 5.7 Plan Pass & Statutory Clearances (Screen 6)
* Dedicated module for non-floor-specific statutory approvals:
  * Sanctioned Architectural Plans.
  * Commencement Certificate (CC).
  * Fire Department NOC.
  * Environmental Clearance (EC).
  * Structural Stability Certificate.
  * Occupancy Certificate (OC / Completion).

---

### 5.8 Activity Audit & Compliance Trail (Screen 5 & Log Page)
* Complete chronological audit logging capturing:
  * `VIEWED`: Logged when an engineer views a drawing canvas.
  * `UPLOADED`: New revision introduced.
  * `APPROVED` / `REJECTED`: Decision recorded with notes.
  * `TRANSMITTED`: Distributed to external recipient.
  * `SUPERSEDED`: Obsoleted by newer issue.
* Filterable by date, action type, and user, with single-click CSV export for ISO compliance audits.

---

# 6. Bar Bending Schedule (BBS) & 1D Cutting Stock Optimization

The BBS engine combines structural drafting rules with linear optimization algorithms to maximize raw steel efficiency.

### 6.1 The Mathematical Cutting Stock Problem
Standard commercial steel bars are supplied in fixed 12.0-meter lengths ($L_{stock} = 12000$ mm). Structural designs call for pieces of varying lengths ($l_1, l_2, \dots, l_n$).
The 1D-CSP solver minimizes the total number of stock bars used and minimizes the resulting scrap:
$$\text{Minimize } Z = \sum_{j=1}^{m} c_j x_j \quad \text{subject to} \quad \sum_{j=1}^{m} a_{ij} x_j \ge d_i, \quad x_j \ge 0 \text{ and integer}$$
Where:
* $x_j$ is the number of 12m stock bars cut according to pattern $j$.
* $a_{ij}$ is the number of pieces of cut length $i$ obtained from pattern $j$.
* $d_i$ is the demand quantity for cut length $i$.

### 6.2 Standard Bend Deduction Engine
When rebar is bent, outer fibers stretch and the bar elongates. Failure to deduct elongation leads to rebar protruding outside concrete cover. RebarOptima automatically applies deductions according to **IS 2502 / BS 8666**:
* $45^\circ$ Bend: Deduct $1 \times d$
* $90^\circ$ Standard Bend: Deduct $2 \times d$
* $135^\circ$ Seismic Hook (Stirrups/Ties): Deduct $3 \times d$
* $180^\circ$ U-Hook: Deduct $4 \times d$
*(Where $d$ is nominal bar diameter).*

### 6.3 Remnant Reclamation Loop
Any off-cut length greater than **1200 mm** is automatically recorded in the Remnant Store rather than being categorized as scrap. The optimization solver checks existing remnant stock *before* allocating new 12m commercial bars.

---

# 7. Concrete Casting, Precast Yard & Quality Curing

For structural pours (slabs, columns, footings) and precast yard manufacturing (precast beams, wall panels, hollow-core slabs):

1. **Pour Planning & Pour Card Issue**:
   * Verified against active approved drawings and rebar inspection sign-offs before concrete batching.
2. **Fresh Concrete Quality Testing**:
   * Slump test verification at truck discharge (Acceptance criteria: e.g., $120 \pm 25$ mm).
   * Temperature and batching plant ticket inspection.
3. **Specimen Cube Casting**:
   * 6 standard $150 \times 150 \times 150$ mm concrete cubes cast per $50 \text{ m}^3$ pour (3 cubes for 7-day test, 3 cubes for 28-day statutory test).
4. **Curing & Demoulding Controls**:
   * Minimum curing day tracking with automated alerts.
   * Compressive test results recorded directly in the ledger, with automated calculation of average strength and standard deviation.

---

# 8. General Site Inventory & Material Procurement

Manages physical materials entering and leaving the construction site gate:
* **Goods Receipt Note (GRN) & Weighbridge Intake**:
  * Records supplier invoice, vehicle number, gross weight, tare weight, and net weight.
* **Diameter-wise Steel Stock Balances**:
  * Live tracking of raw stock bundles by diameter and grade (Fe 500D, Fe 550D).
* **Consumables & Hardware Tracking**:
  * Binding wire, cover blocks, shuttering oil, nails, curing compounds, and safety PPE.
* **Scrap Sales Register**:
  * Tracks disposal of unrecoverable steel remnants with weighbridge integration and financial receipts.

---

# 9. Project Management & CPM Critical Path Scheduling

Provides a full civil engineering scheduling suite:
* **Work Breakdown Structure (WBS)**:
  * Hierarchical organization: *Substructure $\to$ Foundation $\to$ Raft $\to$ Superstructure $\to$ Typical Floors $\to$ Finishing*.
* **Critical Path Method (CPM) Engine**:
  * Calculates Early Start (ES), Early Finish (EF), Late Start (LS), Late Finish (LF), and Total Float (TF).
  * Tasks on the Critical Path ($\text{TF} = 0$) are highlighted in red on interactive Gantt views.
* **Daily Progress Linkage**:
  * When supervisors record progress in daily DPRs, task percentage completion updates automatically, recalibrating expected milestone completion dates.

---

# 10. Site Petty Cash & Imprest Fund Vouchers

Maintains rigorous site financial controls without slowing down urgent daily procurement:
* **Imprest Fund Allocation**:
  * Fixed replenishable cash pool allocated to the Site In-Charge (e.g., ₹50,000 / $5,000).
* **Digital Voucher Creation**:
  * Date, payee, expense category (*Fuel, Safety, Machine Repair, Unskilled Emergency Labor, Site Welfare*), bill number, amount, and receipt photo upload.
* **Multi-Level Approval Rules**:
  * Spends under threshold: Approved by Resident Site Engineer.
  * Spends above threshold: Requires Project Director / Finance Controller sign-off.
* **Replenishment Cycle**:
  * When balance reaches $20\%$ minimum threshold, system generates an automated reconciliation summary requesting replenishment.

---

# 11. Real Estate CRM, Unit Inventory & Sales Lifecycle

For developer-led projects, RebarOptima bridges site construction with commercial sales:
* **Interactive Unit Matrix**:
  * Floor-by-floor unit map showing unit configurations (1BHK, 2BHK, 3BHK, Penthouse, Retail, Office), carpet areas, super built-up areas, and current status.
* **Lead & Customer Relationship Journey**:
  * Lead capture $\to$ Site visit logged $\to$ Quotation issued $\to$ Unit booking with token deposit $\to$ Allotment Letter $\to$ Agreement for Sale.
* **Construction-Linked Demand Notes**:
  * Direct synchronization with PM milestones: when a floor slab is marked $100\%$ completed, the CRM automatically generates statutory installment payment notices for all buyers on that tier.

---

# 12. Role-Based Access Control (RBAC) & Governance Matrix

| Role | Drawings Read | Drawings Upload | Drawings Approve | Attendance / DPR Log | DPR Verify | BBS & Optimize | Inventory Inward | Petty Cash Spend | Petty Cash Approve | CRM Sales | User Management |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SuperAdmin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin / Director** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Project Manager** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ Read | ❌ |
| **Lead Engineer** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ Read | 👁️ Read | ❌ | ❌ | ❌ |
| **Document Controller**| ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Site Supervisor** | ✅ | ❌ | ❌ | ✅ | ❌ | 👁️ Read | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Quality / Lab Tech** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ Read | ❌ | ❌ | ❌ | ❌ |
| **Sales Agent (CRM)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Auditor / Client Rep**| 👁️ Read | ❌ | ❌ | 👁️ Read | ❌ | 👁️ Read | 👁️ Read | 👁️ Read | ❌ | 👁️ Read | ❌ |

---

# 13. Glossary of Engineering & Construction Terminology

* **1D-CSP (One-Dimensional Cutting Stock Problem)**: The mathematical optimization problem of cutting standard lengths of steel bars into required pieces with minimum trim waste.
* **Bar Mark**: A unique code assigned to an individual bar type within a structural element, designating its diameter, shape code, and dimensions.
* **BBS (Bar Bending Schedule)**: A structured list specifying bar marks, shapes, diameters, cutting lengths, quantities, and bending details for reinforced concrete.
* **Bend Elongation**: The physical elongation rebar experiences when bent around a mandrel, requiring numerical deduction from total cut length.
* **CLP (Construction Linked Plan)**: A real estate sales installment payment structure where buyer disbursements are tied to physical site milestones.
* **CPM (Critical Path Method)**: Project scheduling algorithm that calculates the sequence of dependent activities having zero float, defining minimum project duration.
* **Cube Test**: Compressive test on $150\text{ mm}$ cured concrete cubes at 7 and 28 days to verify design characteristic strength ($f_{ck}$).
* **Current Version**: The official, approved revision of a drawing authorized for active construction on the job site.
* **DPR (Daily Progress Report)**: Detailed daily record of work quantities completed, trade labor deployed, equipment usage, and weather conditions.
* **Fe 500D / Fe 550D**: High-yield strength thermo-mechanically treated (TMT) steel reinforcement bars with guaranteed minimum elongation of $12\%$ or $14.5\%$ for seismic performance.
* **Four-Eyes Principle (Maker-Checker)**: Quality control rule requiring that the creator of a document or transaction cannot approve their own submission.
* **MTO (Material Take-Off)**: Comprehensive estimation of the total weight and lengths of steel bars required for structural execution.
* **Remnant**: An off-cut piece of rebar ($> 1.2$ meters) that is preserved in inventory for reuse in shorter elements rather than discarded as scrap.
* **Slump Test**: Workability test measuring the subsidence of freshly mixed concrete to verify consistency and water-cement ratio compliance.
* **Superseded**: A drawing version made obsolete by a newer approved issue, strictly barred from site construction.
* **Transmittal Slip**: Official document accompanying drawing packages issued to contractors, consultants, and clients recording formal delivery and receipt.
* **WBS (Work Breakdown Structure)**: Hierarchical decomposition of the total project scope into manageable, trackable work packages.

---
*RebarOptima System Documentation — Authoritative Production Guide*
