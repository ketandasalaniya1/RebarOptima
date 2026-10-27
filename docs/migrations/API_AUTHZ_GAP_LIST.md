# API Authorization Gap List (Phase 0 Audit)

Baseline before project-first enforcement. Status updates as phases land.

| Surface | Project filter? | Membership (`assignedProjects` / `dataScope`)? | Gap |
|---------|-----------------|------------------------------------------------|-----|
| `GET/POST /api/projects` | company | Partner Admin only (brittle role string) | Need shared helper + `dataScope` + create permission |
| BBS nested routes | projectId path | company only | No assignment check; separate catalog |
| Casting routes | projectId | company only | No assignment check; separate catalog |
| Steel inventory / batches | optional unused | no | Must require project + membership |
| General Inventory | yes | yes (local helper) | Align to shared helper; use global IDs |
| CRM | optional query | company only | Empty projectId → company-wide leak |
| Drawings | optional; UI client-filters | company only | `doc_memberships` unused for gate |
| Activity logs | no | n/a | Add `projectId` filter + stamp on write |
| Users / Roles | n/a (company) | n/a | Scope UI where appropriate |

## Role-string bug

Seeded role name `"Project Partner Admin"` uppercases to `"PROJECT PARTNER ADMIN"`, while code checks `=== 'PROJECT_PARTNER_ADMIN'`. Isolation may never apply. Fix in shared helper (normalize spaces/underscores).
