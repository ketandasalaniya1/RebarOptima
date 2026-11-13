# Project Management Database Architecture & Migration Plan
**Project:** RebarOptima Construction Management SaaS  
**Scope:** MongoDB Collections, Schema Versioning, Tenant Isolation & Safe Migrations  
**Safety Status:** Read-Only Audit (No Migrations Executed in Phase 0)

---

## 1. Absolute Database Safety Principles

Under the **Antigravity Workspace Rules** and SaaS Production Safety standards:
1. **Never delete collections or existing fields.**
2. **Never overwrite production records without explicit human authorization.**
3. **All schema updates must be strictly additive and 100% backward-compatible.**
4. Any new field added to a document must have a safe, non-breaking default so existing code continues to operate seamlessly without errors.

---

## 2. Existing PM MongoDB Collections & Schemas

The PM module uses the following collections in MongoDB:

| Collection Name | Current Documents Scope | Primary Keys & References | Current Indexes |
|:---|:---|:---|:---|
| `pm_projects` | One record per project | `_id`, `companyId`, `code` | Default `_id` |
| `pm_tasks` | Activities & WBS items | `_id`, `companyId`, `projectId`, `parentId` | Default `_id` |
| `pm_dependencies` | Logic links (FS, SS, FF, SF) | `_id`, `companyId`, `projectId`, `taskId`, `predecessorTaskId` | Default `_id` |
| `pm_manpower` | Labor role allocations | `_id`, `companyId`, `projectId`, `taskId` | Default `_id` |
| `pm_dpr` | Daily site shift logs | `_id`, `companyId`, `projectId`, `taskId` | Default `_id` |
| `pm_inspections` | Quality checklist gates | `_id`, `companyId`, `projectId`, `taskId` | Default `_id` |
| `pm_costs` | Cost entries & actual spend | `_id`, `companyId`, `projectId`, `taskId` | Default `_id` |
| `pm_productivity`| Yield & productivity stats | `_id`, `companyId`, `projectId` | Default `_id` |

---

## 3. Proposed Schema Additions (Additive & Backward-Compatible)

To support **Hybrid Scheduling**, **Free Float**, and **Multi-Baseline History**, the following non-breaking fields are proposed for future phases:

### 3.1 Enhancements to `pm_tasks`

| Field Name | Type | Default | Description | Impact on Existing Records |
|:---|:---:|:---:|:---|:---|
| `schedulingMode` | String | `'AUTO'` | `'AUTO'` (CPM driven) or `'MANUAL'` (user locked) | Fully backward-compatible; existing tasks behave as AUTO |
| `manualStart` | String | `null` | User-assigned manual start date (YYYY-MM-DD) | Defaults to null, unused when AUTO |
| `manualFinish` | String | `null` | User-assigned manual finish date (YYYY-MM-DD) | Defaults to null, unused when AUTO |
| `freeFloatDays` | Number | `0` | Working days task can delay without affecting any successor | Added to CPM calculation output |
| `isSummary` | Boolean | `false` | True if task is a WBS Parent / Work Package | Helps backend bypass CPM network calculations for parent rollups |

### 3.2 Enhancements to `pm_projects`

| Field Name | Type | Default | Description | Impact on Existing Records |
|:---|:---:|:---:|:---|:---|
| `baselineHistory` | Array | `[]` | Array of historical baseline snapshots (`{ version, lockedAt, lockedBy, forecastFinish, tasksSnapshot }`) | Preserves contract history without overwriting previous baselines |
| `contractualFinish`| String | `null` | Contractual milestone deadline (allows true negative float calculation) | Optional deadline override |

---

## 4. Recommended Multi-Tenant Performance Indexes

Currently, database collections rely heavily on default `_id` indexes. As a project grows to thousands of tasks and DPR entries, querying by `companyId` and `projectId` will require full collection scans.

The following non-blocking, non-destructive compound indexes are recommended for creation in Phase 2:

```javascript
// 1. pm_tasks
db.collection('pm_tasks').createIndex(
  { companyId: 1, projectId: 1, sortOrder: 1 },
  { name: 'idx_pm_tasks_tenant_project_sort', background: true }
);

// 2. pm_dependencies
db.collection('pm_dependencies').createIndex(
  { companyId: 1, projectId: 1, taskId: 1 },
  { name: 'idx_pm_deps_tenant_project_task', background: true }
);

// 3. pm_dpr
db.collection('pm_dpr').createIndex(
  { companyId: 1, projectId: 1, reportDate: -1 },
  { name: 'idx_pm_dpr_tenant_project_date', background: true }
);

// 4. pm_inspections
db.collection('pm_inspections').createIndex(
  { companyId: 1, projectId: 1, status: 1 },
  { name: 'idx_pm_inspections_tenant_project_status', background: true }
);
```

---

## 5. Migration Plan & Zero-Downtime Rollback Strategy

When authorized to implement in Phase 1/2:

### Step 1: Pre-Migration Backup Verification
Execute a read-only count and dump of all `pm_*` collections to a timestamped backup directory.

### Step 2: Backward-Compatible Data Patching Script
A non-destructive script will add default values to any tasks missing the new fields:
```javascript
// Safe update using $set with $exists: false
db.collection('pm_tasks').updateMany(
  { schedulingMode: { $exists: false } },
  { $set: { schedulingMode: 'AUTO', freeFloatDays: 0, isSummary: false } }
);
```
No existing fields are deleted or renamed.

### Step 3: Rollback Strategy
If any issues arise, the added fields can simply be ignored by the backend code or removed with:
```javascript
db.collection('pm_tasks').updateMany(
  { schedulingMode: 'AUTO' },
  { $unset: { schedulingMode: "", freeFloatDays: "", isSummary: "" } }
);
```
No data is lost because previous fields (`plannedStart`, `forecastStart`, `durationDays`, etc.) remain completely untouched.

---

## 6. Non-Technical Founder Safety Checklist

Before ANY future database migration is executed, the following must be verified:
- [x] Zero destructive operations (`DROP`, `DELETE`, `TRUNCATE`) are scheduled.
- [x] All new fields are purely additive with backward-compatible defaults.
- [x] All database operations run inside standard multi-tenant boundaries (`companyId`).
- [x] Verified rollback script is prepared and documented.
- [x] Explicit human approval requested and received prior to execution.

