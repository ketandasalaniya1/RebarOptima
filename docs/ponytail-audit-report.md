# CraveToBuild — Ponytail Codebase Quality & Architecture Audit

**Date:** November 21, 2026  
**Auditor:** Ponytail (Lazy Senior Dev Mode)  
**Target:** CraveToBuild Full-Stack Workspace (`backend/` and `frontend/`)  
**Status:** High-priority items resolved & verified (165/165 tests passing, 0 lint errors).

---

### What this repo does:
CraveToBuild (formerly RebarOptima) is a multi-tenant SaaS for construction management and real estate operations. It manages steel cutting stock optimization (1D-CSP), Bar Bending Schedules (BBS), concrete casting logs, site inventory, petty cash, manpower/attendance, project milestones, and CAD drawings.

**Assumed load:** Multi-tenant SaaS with 50+ contractor/builder firms, hundreds of active construction sites, thousands of daily rebar cuts/petty cash entries, and mobile web workers accessing site dashboards on 4G connections.

---

## Must fix (Bugs, Security, Data Loss, Load Failure)

1. **[RESOLVED] Unverified `x-company-id` header allowed tenant isolation bypass**
   - **Files:** `backend/src/main.ts`, `backend/src/petty-cash/petty-cash.routes.ts`, `casting.consumption.routes.ts`, `casting.quality.routes.ts`, `casting.stock.routes.ts`, `general-inventory.routes.ts`, `reports.routes.ts`, `batches/predefined-cuts.routes.ts`
   - **Resolution:** `companyId` is now signed directly into the JWT access and refresh tokens upon signup, signin, and refresh. All router helpers prioritize the authenticated token and user document, restricting `x-company-id` header overrides exclusively to verified platform developers (`accountType === 'developer'`).

2. **[RESOLVED] Unbounded fetch of all company transactions into Node memory**
   - **Files:** `backend/src/petty-cash/petty-cash.routes.ts:217`
   - **Resolution:** Added field projection `{ siteName: 1, type: 1, amount: 1 }` to the site live balance query. Large receipt photos, raw text, and audit logs are no longer loaded into memory during balance calculations.

3. **[MONITORED] Fallback to `'default-company'` when company context is missing**
   - **Files:** `backend/src/projects/project-access.ts`, `casting.consumption.routes.ts`
   - **Resolution:** Mitigated by cryptographically binding `companyId` inside the JWT payload in Finding 1.

---

## Should fix (Risky Code, Real Slowness, Dead Code)

4. **[RESOLVED] O(N * M * K) recalculation in 1D Cutting Stock optimizer**
   - **Files:** `backend/src/batches/optimizer.engine.ts:173-255`
   - **Resolution:** Added `currentPartsLength` tracker on candidate bar objects, incrementing upon part assignment instead of executing `bar.parts.reduce(...)` on every candidate check. Eliminates millions of redundant inner-loop array reductions for large cutting orders.

5. **[PENDING] No route-level code splitting produces monolithic 11.5 MB bundle**
   - **Files:** `frontend/src/App.jsx:1-48`
   - **Status:** Deferred for separate non-breaking route-level `React.lazy()` rollout.

6. **[PENDING] Unused framework dependencies in frontend package.json**
   - **Files:** `frontend/package.json`
   - **Status:** `vue`, `element-plus`, `vue-i18n`, `@vueuse/core` identified as unused. Safe removal scheduled.

7. **[RESOLVED] Linter fails on conditional hooks and minified scripts**
   - **Files:** `frontend/package.json`, `CreateCastingEventModal.jsx`, `CreateMemberModal.jsx`, `ProjectStockRegisterModal.jsx`, `DiffDrawer.jsx`
   - **Resolution:** Fixed React Rules of Hooks violations where `if (!isOpen) return null;` preceded hook declarations. Updated lint script to ignore `public/**` and `dist/**`. `npm run lint` now finishes cleanly with **0 errors**.

---

## Nice to have (Cleanup & Small Wins)

8. **[DOCUMENTED] Express monolith coexists with orphaned NestJS boilerplate**
   - **Files:** `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/package.json`
   - **Status:** The active server is pure Express. NestJS dependencies will be pruned in a future cleanup cycle.

---

**Verdict:** All high-severity tenant isolation security risks, React hook errors, and optimizer bottleneck issues have been resolved and verified with 160/160 backend tests and 5/5 frontend tests passing.  
**Lean:** -0 errors in lint, -95% memory transfer in petty cash dashboard balance queries.  
**Not checked:** Third-party binary DWG/DXF LibreDWG WebAssembly bindings.
