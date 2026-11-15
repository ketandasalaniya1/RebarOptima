# Test report

Local API on 127.0.0.1:3100, database `rebaroptima_e2e`. Commands run on 15 Nov 2026. This is not a go-live pass.

## Design QA

`npm run design-qa` (Playwright + axe, light and dark, 39 routes).

Previous page-background check: page errors 0, axe serious 85, axe critical 50, wrong-theme pages 0, horizontal scroll 0. Touch targets were not counted.

Latest full run of the per-element gate:

- page errors: 0
- axe serious: 58
- axe critical: 0
- wrong-theme elements: 11
- horizontal scroll hits: 0
- small touch targets: 61

The gate still fails. Axe serious is mostly color-contrast on page-specific chips and CRM controls. Wrong-theme is 11 elements. Small targets include store pills, a drawings filter, and a few selects. Two CSS edits after this run (active tab color, select min-height) were not in this measurement.

Screenshots: `design-qa/screenshots` (40 files, 10 routes, 1440 and 390, light and dark). No screenshot baselines.

Data lists that used a full-screen spinner now use the shared skeletons. The project-setup splash in `App.jsx` still uses the spinner.

## Flows

`npx playwright test flows.spec.mjs delete-restore.spec.mjs` — 8 passed, 3 failed, 0 skipped (28.1s).

Passed: delete both modes, inline Yes/No delete, ledger tabs and ledger PDF, order request approve/reject, site inventory issue/return/transfer/stocktake, users, system roles, six-role permissions.

Failed:

1. Steel inward response still has a cost/price/rate/gst field. Quantity was a finite number. Severity: medium.
2. Zero-stock blocker was not reached. Calculate Cutting Plan stayed disabled after the first row was filled. Severity: unconfirmed.
3. Foreman, Executive, and Summary prints had no currency symbol and zero sign-off lines (the ledger report has three). Severity: medium. The PDF byte check did not run.

## Not run

Real iPhone, real Android, a real printer, and a soft keyboard.
