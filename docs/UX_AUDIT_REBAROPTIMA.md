# RebarOptima UX Audit

**Date:** 2026-10-27  
**Scope:** Existing Vite + React 19 frontend (no greenfield rewrite)  
**Rules:** `docs/REBAROPTIMA_UI_UX_SPECIFICATION.md`, `backend/.cursor/ruls/construction-product-ux.mdc`  
**Out of scope:** Attendance; inventing modules/APIs/mock KPIs

---

## 1. Product inventory

### App shell
| Piece | Path | Notes |
|-------|------|--------|
| View router | `frontend/src/App.jsx` | Redux `routing.view`, not React Router |
| Side nav | `components/SideNavbar/` | RBAC + Partner allowlist; mobile drawer ≤900px |
| Project selector | `components/ProjectSelector/` | Active project + `X-Project-Id` |
| Breadcrumbs | `components/Breadcrumbs/` | Org vs project trail |
| Theme | `index.css` + ThemeToggle | `data-theme`, `data-color-theme` |

### Workspace modules (verified pages)
| Module | View id(s) | Page |
|--------|------------|------|
| Overview | `overview` | OverviewPage |
| Projects | `projects`, `no-project` | ProjectsPage, NoProjectPage |
| Steel Inventory | `inventory` | InventoryPage |
| Ledger | `ledger` | LedgerPage |
| Optimizer | `inputs`, `results` | NewBatchPage, ResultsPage |
| Batch History | `history` | BatchHistoryPage |
| BBS | `bbs`, `bbs-*` | BBSPage + siblings |
| Casting | `casting` | CastingPage |
| Site / General Inventory | `general-inventory` | GeneralInventoryPage |
| CRM | `crm` | CrmPage |
| Drawings | `drawings` | DrawingsPage |
| Users / Roles / Settings / Logs | `users`, `roles`, `settings`, `activity-logs` | respective pages |
| Profile | `profile` | ProfilePage |

### Roles / permissions (UX-relevant)
- Admin/Owner/developer: full nav.
- Project Partner Admin: hardcoded allowlist in SideNavbar (excludes GI, CRM, users, roles, activityLogs, settings) — may diverge from backend role grants.
- Other roles: `permissions.modules[moduleKey] !== false`.

### Shared UI blast radius
Changing shared chrome affects **all** workspace pages. Proposed primitives under `components/ui/` are **additive** until pages opt in.

High-risk shared areas if refactored aggressively:
- SideNavbar, Breadcrumbs, ProjectSelector, ProjectModals
- LoadingSpinner
- Page-local modal CSS classes (do not mass-rename without migration)

---

## 2. Findings (prioritized)

| ID | Sev | Location | Problem | User impact | Recommendation | Verification |
|----|-----|----------|---------|-------------|----------------|--------------|
| A1 | P0 | SideNavbar | Two items labeled “Inventory” (steel vs GI) | Wrong module / wasted site time | Rename GI to **Site Inventory**; Steel child stays **Steel Inventory** or **Inventory** under Steel | Visual nav check |
| A2 | P0 | Multi-module | Project switch must refresh data | Stale KPIs/lists after switch | Keep `projectEpoch` + header sync; fix remaining pages | Switch project on Overview/Inventory |
| A3 | P1 | Global | No shared Modal / EmptyState / PageHeader | Inconsistent workflows, harder learning | Add `components/ui/*` primitives; adopt gradually | Pilot Overview + Projects |
| A4 | P1 | OverviewPage | KPIs decorative / weak actions | No path from insight → work | Clickable KPIs → inventory/ledger/history | Click each KPI |
| A5 | P1 | Tables (Inventory, Ledger, Casting, CRM) | Dense tables, weak hierarchy, inconsistent units | Slow scanning, errors | tabular-nums, StatusBadge, DataToolbar; horizontal scroll | Desktop + 375px |
| A6 | P1 | Forms/modals | Many bespoke backdrops; uneven validation UX | Mistakes, abandon flows | AppModal + Button patterns; keep business fields | Create project / casting event |
| A7 | P2 | `index.css` vs pages | Token drift (`--bg-primary`, `--text-muted`) | Broken theme / contrast | Alias tokens to canonical vars | Toggle light/dark |
| A8 | P2 | SideNavbar | BBS uses Building2 (same as Projects/CRM); dead `isBbsOpen` group logic | Weak IA | Unique icons; remove dead accordion code | Nav visual |
| A9 | P2 | Partner Admin | Frontend allowlist vs backend permissions | Hidden features or confusion | Document mismatch; align nav to product intent without weakening API auth | Partner login |
| A10 | P2 | Drawings | Vue/Element Plus CAD island | Dual visual language | Chrome only; don’t rewrite CAD | Open drawing viewer |
| A11 | P3 | Various | Inline styles, emoji-free but uneven spacing | Polish | Prefer tokens + shared classes | Spot check |
| A12 | P3 | Auth pages | Duplicated SignIn/SignUp chrome | Maintainability | Optional later unify | — |

---

## 3. Design direction (for Stages 2–3)

- Industrial premium: Inter, restrained radius/shadow, high density where pros need it.
- Keep themes: slate-emerald, steel-blue, classic-purple.
- Primary action obvious; progressive disclosure for advanced options.
- Never remove financial/technical fields for aesthetics.
- Never invent metrics or mock production data.

---

## 4. Partner Admin nav vs backend (documented mismatch)

Frontend `SideNavbar` keeps a product allowlist for Project Partner Admin (Overview, Projects, Steel cluster, BBS, Casting, Drawings). Site Inventory, CRM, Users, Roles, Settings, and Activity Logs stay hidden in nav even if a backend role grant is broader. **API authorization is not weakened** — this is UX intent only. Widen the allowlist only with explicit product approval.

## 5. Stage completion checklist

- [x] Stage 1 audit (this doc)
- [x] Stage 2 design system + primitives
- [x] Stage 3 shell + Overview
- [x] Stage 4 module groups
- [x] Stage 5 mobile/a11y
- [x] Stage 6 verify + report — see `docs/UX_ACCEPTANCE_REPORT.md`
