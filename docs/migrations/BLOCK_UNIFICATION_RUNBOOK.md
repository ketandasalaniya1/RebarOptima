# Block Unification Migration Runbook

Companion to [PROJECT_UNIFICATION_RUNBOOK.md](./PROJECT_UNIFICATION_RUNBOOK.md).  
Canonical construction blocks live in MongoDB collection **`project_blocks`**, scoped by global `projects` IDs.

## Phase 0 verification notes (2026-03-28)

| Assumption | Verified reality |
|------------|------------------|
| Live projects API | Express [`backend/src/projects/projects.routes.ts`](../../backend/src/projects/projects.routes.ts) mounted at `/api/projects` in `main.ts` — **not** Nest `ProjectsService` for runtime |
| Nest `project.schema.ts` | Present for Nest module; Express writes raw Mongo documents. Optional `blockCount` is denormalized on `projects` docs from Express |
| Database | MongoDB (Atlas via `MONGODB_URI`). Startup runs `verifyMultiDocumentTransactionRollback`; multi-doc transactions are expected on Atlas replica set. In-memory fallback (`client === null`) has **no** transactions → compensating delete on create failure |
| Module create UIs | BBS/Casting/GI still expose create in places; module POST often returns `USE_GLOBAL_PROJECTS`. Casting block create still parent-checks `casting_projects` |
| Frontend tests | No project/block Jest suite in frontend `package.json`; backend: `cd backend && npm test` |
| Uncommitted local work | Do not overwrite unrelated dirty files (e.g. `App.jsx`, `SignInPage.jsx`) during this program |

## Safety

- Never wipe the database.
- Never auto-merge fuzzy / ambiguous block or CRM tower names.
- Never run remap/apply scripts against production without explicit approval.
- Inventory scripts are **read-only** (no writes except report JSON under `docs/migrations/`).

## Backup before any write migration

1. Atlas: take a cluster snapshot / point-in-time restore window note.
2. Or `mongodump` the relevant collections:
   - `projects`, `project_blocks`
   - `bbs_blocks`, `bbs_levels`, `bbs_members`
   - `casting_blocks`, `casting_levels`, `casting_members`
   - `crm_units` (tower strings / future `blockId`)
3. Keep dump path and timestamp with the mapping report.

## Steps

1. **Project inventory (if not current)**  
   `node backend/scripts/project-migration-inventory.js`  
   → `docs/migrations/project-mapping-report.json`

2. **Block inventory (dry-run, read-only)**  
   `node backend/scripts/block-migration-inventory.js`  
   → `docs/migrations/block-mapping-report.json`  
   Reports: orphan blocks, duplicate names within a source, cross-module same-name candidates, CRM towers, already-bridged `orgBlockId`.

3. **Review report**  
   Approve only exact `(canonicalProjectId, nameLower)` rows for create/bridge. Leave ambiguous rows in reconciliation.

4. **Create `project_blocks` (API or approved seed)**  
   Prefer central `POST /api/projects` with `blocks[]` and nested block CRUD. Do not drop `bbs_blocks` / `casting_blocks`.

5. **Bridge (additive, future script — approval-gated)**  
   Set `orgBlockId` on module block docs pointing at `project_blocks._id`. No child ID rewrite.

6. **Remap children (destructive, future — approval-gated)**  
   Only after bridge verification. Rewrite child `blockId` to canonical IDs; store `_migratedFromBlockId`. **Do not run without explicit approval.**

7. **CRM**  
   Report-only mapping of `buildingTower` → optional `blockId`. Preserve tower text.

8. **Rollback**  
   - Bridge-only: unset `orgBlockId` / delete unused `project_blocks` created by migration (keep module trees).  
   - After child remap: restore from `_migratedFromBlockId` (parallel to project rollback pattern).  
   - API create failure: Mongo transaction abort, or compensating delete of project + blocks when transactions unavailable.

## Destructive / irreversible steps (approval required)

| Step | Why destructive | Gate |
|------|-----------------|------|
| Child `blockId` remap | Rewrites FKs on levels/members | Explicit flag + approval |
| Hard-delete `project_blocks` with children | Orphans or cascade | Prefer soft-archive |
| Dropping `bbs_blocks` / `casting_blocks` | Removes legacy catalogs | Separate program approval |
| Project child remap (`--i-approve-remap`) | Existing project unification | Existing runbook |
| Production dump restore | Overwrites live data | Ops + approval |

## Automated tests

```bash
cd backend && npm test
```

Relevant specs: `project-access.spec.ts`, `projects.service.spec.ts`, `project-blocks.service.spec.ts` (added with Phase 2).
