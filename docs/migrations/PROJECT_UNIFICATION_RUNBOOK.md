# Project Unification Migration Runbook

## Safety

- Never wipe the database.
- Never remap children without reviewing `project-mapping-report.json`.
- Fuzzy and unmatched rows require manual verification before inclusion.

## Steps

1. **Inventory (dry-run)**  
   `node backend/scripts/project-migration-inventory.js`  
   → writes `docs/migrations/project-mapping-report.json`

2. **Review report**  
   Confirm exact matches. Fix/verify fuzzy and orphans. Do not proceed until approved.

3. **Bridge (additive)**  
   Dry-run: `node backend/scripts/project-migration-apply-bridge.js`  
   Apply: `node backend/scripts/project-migration-apply-bridge.js --apply`  
   Sets `orgProjectId` on module project docs; writes `project_id_migrations`.

4. **Remap children (approval-gated)**  
   Dry-run: `node backend/scripts/project-migration-remap-children.js`  
   Apply: `node backend/scripts/project-migration-remap-children.js --i-approve-remap`  
   Updates child `projectId` to global IDs; stores `_migratedFromProjectId`.

5. **Rollback if needed**  
   `node backend/scripts/project-migration-rollback.js --i-approve-rollback`

Module project collections are retained for the rollback window; do not drop without separate approval.
