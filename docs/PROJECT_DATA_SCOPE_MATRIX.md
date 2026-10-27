# Project Data-Scope Matrix

Canonical scope for RebarOptima entities under the project-first model.
Global `/api/projects` IDs are the single project source of truth.

Scopes: **project** | **company** | **shared** | **out_of_scope**

| Entity / Collection | Scope | Notes |
|---------------------|--------|--------|
| `projects` (global metadata, geofence, partner assignment) | project | Canonical catalog |
| `users.assignedProjects` | project ACL | Company user record; ACL is project-scoped |
| Steel stock items (`stockitems` / inventory) | project | Require active `projectId`; legacy null until backfilled |
| Steel batches | project | Require active `projectId` |
| `bbs_projects` | deprecated → project | Migrated via `orgProjectId` / remap to global ID |
| `bbs_blocks`, `bbs_levels`, `bbs_members`, MTO/matrix | project | Child of global project ID after migration |
| `casting_projects` | deprecated → project | Same migration pattern |
| Casting blocks/levels/members/events/stock/consumption/quality | project | |
| Casting recipes | company | Shared company recipe library |
| `gi_projects` | deprecated → project | |
| GI stores, materials, balances, transactions, inward/outward/returns/transfers | project | |
| `crm_projects` | deprecated → project | |
| CRM units, leads, site visits, bookings | project | |
| CRM customers | company | Interests/bookings remain project-linked |
| CRM settings / master data | company | |
| `doc_projects` | deprecated → project | |
| `doc_drawings`, `doc_transmittals` | project | |
| Drawing disciplines / module settings | company | |
| `doc_memberships` | company | RBAC; not per-drawing project gate |
| Scrap rules, storage quotas | company | Settings |
| Theme / UI preferences | company / client | Not project-scoped |
| Roles & permission definitions | company | `dataScope` drives enforcement |
| Users (account records) | company | List UI may filter by active project assignment |
| Activity / audit logs | project when `projectId` set; else company | Writers must stamp `projectId` for project actions |
| Attendance | out_of_scope | Do not implement |

## Enforcement rules

1. Project-scoped list/create/update/delete must receive a validated project context (`X-Project-Id` and/or path/query/body).
2. Backend verifies: auth → company → project ∈ company → user authorized for project → record ∈ project → permission.
3. Company-scoped entities ignore active project for data isolation but remain behind the post-login project gate unless explicitly allowed in no-project state (logout, account preferences).
4. Do not use frontend-only filtering as a substitute for backend isolation.
