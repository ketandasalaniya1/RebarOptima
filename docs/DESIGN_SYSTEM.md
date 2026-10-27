# RebarOptima Design System

Industrial premium SaaS tokens for construction workflows. Source of truth: `frontend/src/index.css` + `frontend/src/components/ui/`.

## Brand & semantic color

| Token | Role |
|-------|------|
| `--accent` / `--accent-hover` / `--accent-subtle` | Primary actions, focus, active nav |
| `--main-bg`, `--card-bg`, `--card-border` | Surfaces |
| `--text-primary`, `--text-secondary`, `--text-label` | Hierarchy |
| `--success`, `--warning`, `--danger` (+ `-subtle`) | Status |
| Themes | `slate-emerald`, `steel-blue`, `classic-purple` × light/dark |

Aliases: `--bg-primary` → `--main-bg`, `--text-muted` → `--text-label`, `--bg-tertiary` → `--input-bg`.

## Typography

- Font: Inter (400–700), base 14px
- Page title: 1.35–1.5rem / 650
- Section: 1rem / 600
- Body: 0.875–0.9375rem
- Meta/labels: 0.75–0.8125rem, `--text-label`
- Numbers: `tabular-nums` on tables, KPIs, quantities

## Spacing & radius

- Scale: 4 / 8 / 12 / 16 / 24 / 32 (`--space-*`)
- Radius: `--radius-sm` 6, `--radius-md` 10, `--radius-lg` 14
- Touch target min: `--touch-min` 40px

## Components (`components/ui`)

| Component | Use |
|-----------|-----|
| `Button` | primary, secondary, danger, ghost |
| `PageHeader` | Title, subtitle, actions, project context |
| `EmptyState` | No data + optional CTA |
| `AppModal` | Dialog shell |
| `StatusBadge` | status tones |
| `DataToolbar` | Search + filters + count |

## Patterns

- One primary action per page header.
- Confirm destructive / financial actions.
- Loading / empty / error / success on every data view.
- Do not invent metrics; use live APIs only.
