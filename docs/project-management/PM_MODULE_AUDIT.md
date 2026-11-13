# Project Management (PM) Module Source Code Audit
**Project:** RebarOptima Construction Management SaaS  
**Audit Phase:** Phase 0 — Complete Source Code Audit (Read-Only)  
**Date:** November 2026  
**Auditors:** Senior Full-Stack Software Architect, Primavera P6 / MS Project Specialist, Database Architect, QA Engineer

---

## 1. Executive Summary

RebarOptima includes a full-featured **Project & Task Management** module intended to provide enterprise-grade construction planning, Critical Path Method (CPM) scheduling, interactive Gantt timelines, daily site execution tracking (DPR), quality gates, and manpower allocation.

The Phase 0 code audit examined 100% of the active Project Management source files across backend services, scheduling algorithms, database access layers, and frontend user interfaces.

### Audit Verdict
The module features a strong architectural foundation, comprehensive data models, and an intuitive modern frontend interface. However, **critical mathematical flaws in the CPM calculation engine** currently invalidate schedule calculations (notably corrupting backward pass dates and float calculations), while **multi-tenant scoping gaps** and **non-atomic update sequences** present data integrity risks in production.

This document details all verified defects, potential risks, and architectural findings without modifying any existing application code or database records.

---

## 2. Inventory of Audited Components

### 2.1 Backend Source Files (`backend/src/pm/`)

| File Path | Lines | Primary Responsibility | Audit Status |
|:---|:---:|:---|:---:|
| `backend/src/pm/pm.types.ts` | 275 | TypeScript schemas, data interfaces, enums | Audited — Complete |
| `backend/src/pm/pm.cpm.engine.ts` | 403 | Critical Path Method (CPM), forward/backward pass, calendar math, cycle detection | Audited — Critical defects identified |
| `backend/src/pm/pm.service.ts` | 878 | Business logic, MongoDB database operations, multi-tenant workflows | Audited — Multi-tenant & transaction defects identified |
| `backend/src/pm/pm.routes.ts` | 289 | Express REST API route controllers and middleware | Audited — Input validation gaps noted |
| `backend/src/pm/pm.seed.service.ts` | 231 | Demo project generator (Tower Substructure & Frame) | Audited — Functioning |

### 2.2 Frontend Source Files (`frontend/src/pages/ProjectManagementPage/`)

| File Path | Lines | Primary Responsibility | Audit Status |
|:---|:---:|:---|:---:|
| `ProjectManagementPage.jsx` | 338 | Main tab router, project selector, context provider | Audited — Complete |
| `ProjectManagementPage.css` | 1,450+ | Design styling, dark theme, responsive grid, Gantt CSS | Audited — Complete |
| `components/PmTasksView.jsx` | 976 | WBS Table, Main/Sub-activity hierarchy, task creation modal | Audited — Functional, visual hierarchy active |
| `components/PmGanttView.jsx` | 420 | SVG/HTML interactive Gantt timeline, dependency rendering | Audited — Functional, relies on backend CPM dates |
| `components/PmManpowerView.jsx` | 640 | Labor allocation, role assignment, gang balance matrix | Audited — Functional |
| `components/PmDashboardView.jsx` | 185 | Executive KPI dashboard, float cards, progress gauge | Audited — Functional |
| `components/PmDailyProgressView.jsx` | 310 | DPR submission form, daily log table, approval actions | Audited — Functional |
| `components/PmQualityView.jsx` | 240 | QA inspections, punch list, rework gates | Audited — Functional |
| `components/PmCalendarView.jsx` | 410 | Working days, shift hours, recess breaks, holiday calendar | Audited — Functional |
| `components/PmCostProductivityView.jsx` | 255 | Earned value tracking, planned vs actual cost | Audited — Functional |
| `components/PmProjectsView.jsx` | 260 | Project list, baseline locking, new project modal | Audited — Functional |
| `components/PmDelayModal.jsx` | 280 | Delay impact simulation modal (what-if analysis) | Audited — Functional |
| `components/PmRescheduleModal.jsx` | 240 | Manual rescheduling interface | Audited — Functional |

---

## 3. Critical Confirmed Defects in CPM Engine (`pm.cpm.engine.ts`)

### Defect CPM-01: `addWorkingDays` Aborts on Negative Days (Corrupts Backward Pass & FF Dependencies)
- **File:** `backend/src/pm/pm.cpm.engine.ts`
- **Exact Line:** 57
- **Code:**
  ```typescript
  public static addWorkingDays(startDateStr: string, workingDays: number, calendar: ProjectCalendar): string {
    if (!startDateStr) startDateStr = new Date().toISOString().split('T')[0];
    if (workingDays <= 0) return startDateStr; // <-- CRITICAL DEFECT
  ```
- **Root Cause Analysis:**
  The CPM backward pass calculates Late Start ($LS$) from Late Finish ($LF$) by subtracting the activity duration in working days:
  $$LS = LF - (Duration - 1)$$
  In `pm.cpm.engine.ts` (line 305):
  ```typescript
  const duration = Math.max(1, task.durationDays || 1);
  const ls = this.addWorkingDays(lf, -(duration - 1), calendar);
  ```
  When `duration > 1`, `-(duration - 1)` is negative.
  Because line 57 checks `if (workingDays <= 0) return startDateStr;`, the function **immediately exits and returns `lf` without subtracting any days**.
- **Consequences:**
  1. For every task with a duration greater than 1 day, **Late Start is incorrectly set equal to Late Finish** ($LS = LF$).
  2. Successor constraint calculations in lines 293 and 295 pass negative values (`-(lag + 1)` and `-lag`), which also fail to subtract days.
  3. Total Float ($LF - EF$) and Late Dates are mathematically invalid across the entire project schedule.
  4. Non-critical tasks are misclassified as critical or vice versa.

---

### Defect CPM-02: Missing Dependency Types in Backward Pass
- **File:** `backend/src/pm/pm.cpm.engine.ts`
- **Exact Lines:** 291–296
- **Code:**
  ```typescript
  if (dep.type === 'FS') {
    // LF must be before successor's late start minus lag
    candidateLF = this.addWorkingDays(succTask.lateStart || succTask.earlyStart!, -(lag + 1), calendar);
  } else if (dep.type === 'FF') {
    candidateLF = this.addWorkingDays(succTask.lateFinish || succTask.earlyFinish!, -lag, calendar);
  }
  // SS and SF are missing!
  ```
- **Root Cause Analysis:**
  The backward pass only inspects `FS` (Finish-to-Start) and `FF` (Finish-to-Finish).
  - In a **Start-to-Start (SS)** relationship with lag $L$, the predecessor's Late Start must not exceed the successor's Late Start minus lag:
    $$LS_{pred} \le LS_{succ} - L$$
    Because `SS` is omitted in the backward pass, tasks that have successors through `SS` links are never constrained in their backward pass.
  - In a **Start-to-Finish (SF)** relationship, the predecessor's Late Start must constrain the successor's Late Finish:
    $$LS_{pred} \le LF_{succ} - L$$
- **Consequences:**
  Predecessor tasks connected via `SS` or `SF` relationships receive an artificial, unbounded Late Finish (defaulting to project end date), generating falsely inflated Total Float.

---

### Defect CPM-03: Missing Start-to-Finish (SF) Handling in Forward Pass
- **File:** `backend/src/pm/pm.cpm.engine.ts`
- **Exact Lines:** 243–257
- **Code:**
  ```typescript
  if (dep.type === 'FS') {
    // ...
  } else if (dep.type === 'SS') {
    // ...
  } else if (dep.type === 'FF') {
    // ...
  }
  // dep.type === 'SF' is completely omitted!
  ```
- **Root Cause Analysis:**
  While `SF` (Start-to-Finish) is declared as a valid dependency type in `PmDependency.type`, the forward pass does not calculate dates for `SF`. If an SF dependency is entered, the engine ignores it in forward calculation.

---

### Defect CPM-04: Negative Float Clamping to Zero
- **File:** `backend/src/pm/pm.cpm.engine.ts`
- **Exact Line:** 312
- **Code:**
  ```typescript
  // 5. Total Float: LF - EF (in working days)
  const totalFloat = this.countWorkingDays(task.earlyFinish!, task.lateFinish!, calendar) - 1;
  task.totalFloatDays = Math.max(0, totalFloat);
  ```
- **Root Cause Analysis:**
  In standard project management (Primavera P6, MS Project), **Negative Float** occurs when an activity's Early Finish is later than its Late Finish or a mandatory project contractual deadline ($EF > LF$). Negative float is the standard industry indicator of project delay requiring mitigation.
  Clamping float to zero (`Math.max(0, totalFloat)`) masks deadline overruns and treats delayed activities identically to on-time critical activities.

---

### Defect CPM-05: Main / Summary Activities Treated as Independent CPM Network Nodes
- **File:** `backend/src/pm/pm.cpm.engine.ts` & `backend/src/pm/pm.service.ts`
- **Lines:** `pm.service.ts` 287, `pm.cpm.engine.ts` 210–317
- **Root Cause Analysis:**
  Main Activities (e.g., `1.0 Raft Foundation & Substructure`) are stored in `pm_tasks` alongside executable child activities (`1.1 Excavation`, `1.2 PCC Bedding`).
  When `calculateSchedule` runs:
  - Both parent and child tasks are passed into the CPM graph as independent nodes.
  - The parent task maintains its own hardcoded `durationDays` (e.g., 24 days), instead of dynamically rolling up:
    $$Start_{parent} = \min(Start_{children}), \quad Finish_{parent} = \max(Finish_{children})$$
  - If a user changes a child task's duration from 5 to 20 days, the child activity moves out past the parent's boundary, causing the parent task and child tasks to display conflicting timeline dates.

---

## 4. Multi-Tenant Scoping & Database Defects (`pm.service.ts`)

### Defect DB-01: Missing `companyId` in Update Queries (Tenant Leak Risk)
- **File:** `backend/src/pm/pm.service.ts`
- **Exact Lines:** 104–105, 291–292, 324–325, 458–459, 471–472, 522–523, 527–528
- **Code Examples:**
  ```typescript
  // Line 104 in lockBaseline:
  await this.db().collection('pm_tasks').updateOne(
    { _id: new ObjectId(String(t._id)) }, // <-- companyId omitted!
    { $set: { baselineStart: t.forecastStart, baselineFinish: t.forecastFinish, updatedAt: new Date() } }
  );

  // Line 291 in recalculateProjectCPM:
  await this.db().collection('pm_tasks').updateOne(
    { _id: new ObjectId(String(t._id)) }, // <-- companyId omitted!
    { $set: { earlyStart: t.earlyStart, ... } }
  );

  // Line 458 & 471 in approveDpr:
  await this.db().collection('pm_dpr').updateOne({ _id: new ObjectId(dprId) }, ...);
  await this.db().collection('pm_tasks').updateOne({ _id: new ObjectId(dpr.taskId) }, ...);
  ```
- **Risk:**
  In a multi-tenant SaaS, any write or read operation must explicitly filter by `{ _id: ..., companyId }`. While `_id` is an ObjectId, omitting `companyId` violates tenant isolation best practices and risks accidental cross-tenant mutation if an ID is mishandled.

---

### Defect DB-02: Non-Atomic DPR Approval Sequence
- **File:** `backend/src/pm/pm.service.ts`
- **Exact Lines:** 458–487
- **Root Cause Analysis:**
  When a Daily Progress Report is approved, the service executes:
  1. Update `pm_dpr` status to `'APPROVED'`.
  2. Query `pm_tasks` for the related task.
  3. Update `pm_tasks` with new `acceptedQty`, `completedQty`, and `progressPercentage`.
  4. Call `recalculateProjectCPM`.
  These operations are performed as separate, uncoordinated network calls without a MongoDB multi-document transaction (`session.withTransaction`).
  If a failure occurs during step 3 or 4 (e.g., database timeout or process termination), the DPR is marked approved, but the task progress and project CPM are never updated, resulting in persistent data inconsistency.

---

### Defect DB-03: Irreversible Baseline Overwrite Without Historical Snapshots
- **File:** `backend/src/pm/pm.service.ts`
- **Exact Lines:** 90–114
- **Root Cause Analysis:**
  `lockBaseline` sets `isBaselineLocked: true` and overwrites `baselineStart` and `baselineFinish` on `pm_tasks`. If a baseline is re-locked or changed, the previous contractual baseline is permanently lost. Standard construction practice requires supporting at least Baseline 0 (Contract Baseline) and Baseline 1..N (Approved Revision Baselines).

---

## 5. Frontend & Workflow Observations

1. **WBS Visual Hierarchy:**
   `PmTasksView.jsx` provides an effective visual distinction between Main Activities and Sub-activities (using distinct badges, indentations, and expand/collapse accordions). However, because backend CPM dates do not roll up, summary tasks can display inaccurate durations.
2. **Interactive Gantt Chart (`PmGanttView.jsx`):**
   The Gantt chart correctly displays critical paths in red and standard tasks in blue, with dependency lines. When backend dates are corrected, the Gantt chart will immediately reflect true early/late dates.
3. **Absence of Scheduling Mode Selector:**
   In the current UI, tasks cannot be set to "Manual" vs "Automatic" scheduling. Every change forces an automatic CPM recalculation that overwrites dates.

---

## 6. Audit Summary Matrix

| ID | Category | Severity | Description | Status |
|:---|:---|:---:|:---|:---:|
| **CPM-01** | Scheduling Engine | **CRITICAL** | `addWorkingDays` returns immediately for negative numbers, corrupting backward pass and FF links | Confirmed |
| **CPM-02** | Scheduling Engine | **CRITICAL** | Missing `SS` and `SF` dependency handling in backward pass | Confirmed |
| **CPM-03** | Scheduling Engine | **HIGH** | Missing `SF` dependency handling in forward pass | Confirmed |
| **CPM-04** | Scheduling Engine | **HIGH** | Negative float clamped to 0, hiding deadline slippage | Confirmed |
| **CPM-05** | Scheduling Engine | **HIGH** | Summary tasks treated as independent nodes instead of rollup containers | Confirmed |
| **DB-01** | Multi-Tenancy | **HIGH** | Missing `companyId` in several MongoDB `updateOne` queries | Confirmed |
| **DB-02** | Data Consistency | **MEDIUM** | Non-atomic DPR approval workflow lacks transaction session | Confirmed |
| **DB-03** | Data Architecture | **MEDIUM** | Baseline locking has no version history or revision tracking | Confirmed |
| **QA-01** | Automated Testing | **CRITICAL** | Zero unit/integration tests exist for PM module or CPM engine | Confirmed |

---

*Phase 0 audit complete. Application source code and database remain untouched.*

