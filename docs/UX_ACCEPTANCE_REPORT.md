# Premium Construction UX — Acceptance Report

**Date:** 2026-10-27  
**Plan:** Premium Construction SaaS UX Transformation (no greenfield rewrite)

---

## Summary

Stages 1–6 completed against the existing Vite + React 19 shell. Shared UI primitives shipped under `frontend/src/components/ui/`, nav IA fixed (Site Inventory vs Steel Inventory), Overview KPIs are actionable, and primary modules adopted `PageHeader` / `EmptyState` / `Button` / `StatusBadge` / `DataToolbar` without API or RBAC changes.

---

## Audit snapshot (Stage 1)

See [`docs/UX_AUDIT_REBAROPTIMA.md`](./UX_AUDIT_REBAROPTIMA.md).

| Sev | Addressed |
|-----|-----------|
| P0 Dual Inventory labels | **Fixed** — GI renamed **Site Inventory** in nav + breadcrumbs + page title |
| P0 Project switch sync | Verified pattern retained (`projectEpoch` / `X-Project-Id`); no regression introduced |
| P1 Shared primitives | **Shipped** + adopted across shell/modules |
| P1 Overview KPIs | **Fixed** — clickable → inventory / ledger / history |
| P1 Dense tables | Helper `.ro-table-scroll` + tabular-nums; gradual adoption |
| P2 Token drift | Aliases in `index.css`; documented in `DESIGN_SYSTEM.md` |
| P2 Dead BBS accordion | **Removed** from SideNavbar |
| P2 Partner allowlist | **Documented**; API auth unchanged |
| P2 Drawings Vue island | Chrome only; CAD untouched |

---

## Files / areas changed

### Design system
- `frontend/src/index.css` — semantic aliases, spacing/radius/touch tokens, a11y helpers
- `docs/DESIGN_SYSTEM.md`
- `frontend/src/components/ui/*` — Button, PageHeader, EmptyState, AppModal, StatusBadge, DataToolbar, `ui.css`, barrel `index.js`

### Shell / Overview
- `SideNavbar.jsx` / `.css` — Site Inventory, unique icons, Partner allowlist comment, touch targets, dead BBS group removed
- `Breadcrumbs.jsx` — Site Inventory label
- `OverviewPage.jsx` / `.css` — PageHeader, Button, EmptyState, actionable KPI cards

### Modules (PageHeader / EmptyState / Button / StatusBadge / DataToolbar)
- Projects, NoProject, Inventory, Ledger, NewBatch, BatchHistory
- Casting, General Inventory (Site Inventory), BBS, CRM, Drawings (chrome)
- Users, Roles, Settings, Activity Logs

### Docs
- `docs/UX_AUDIT_REBAROPTIMA.md` (updated checklist + Partner note)
- `docs/UX_ACCEPTANCE_REPORT.md` (this file)

---

## Tests run (actual)

| Check | Result |
|-------|--------|
| `npm run lint` (frontend `oxlint`) | **Fails** — pre-existing Casting modal conditional-hooks + bundled worker noise; **not introduced** by this UX work |
| `npm run build` (`vite build`) | **Pass** — `✓ built in 45.10s` |
| Browser / Playwright smoke | **Not run** — document as manual verification needed |

### Recommended manual smoke
1. Login → project gate → Overview  
2. Click each Overview KPI → Inventory / Ledger / History  
3. Switch project → confirm Overview/Inventory refresh  
4. Confirm nav shows **Site Inventory** (not duplicate “Inventory”)  
5. Projects create/select + StatusBadge  
6. Casting / Site Inventory / BBS / CRM / Drawings open without layout break  
7. Mobile ≤900px drawer open/close; primary actions ≥40px  

---

## Remaining issues / next steps

1. **Pre-existing oxlint failures** in Casting modals (hooks after early return) — fix separately.  
2. **AppModal** available but most domain modals still page-local (safe gradual migration).  
3. **`.ro-table-scroll`** not yet wrapped around every dense table — adopt per module when touching tables.  
4. **Partner Admin allowlist** vs backend grants — product decision if nav should widen.  
5. **Drawings CAD / Vue island** visual dual-language remains by design.  
6. Optional: code-split large frontend chunks (build size warning).  
7. Run Playwright or manual checklist above before release.

---

## Explicit non-goals (unchanged)

No new modules, Attendance, mock KPIs, backend schema redesign, or React Router migration.
