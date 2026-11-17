# Activity & Progress Tracker — API & Permissions Specification

## 1. REST API Endpoints

All endpoints are mounted under `/api/activity-tracker` and require a valid Bearer token via `authMiddleware`.

### 1. Overview & Dashboards
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/summary?projectId=...&blockId=...` | High-level metrics (total, status counts, block progress %) | `read` |
| `GET` | `/overview?blockId=...` | Executive progress overview & work packages | `read` |

### 2. Activities CRUD & WBS
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/activities` | Query activities with hierarchy, status, floor filters | `read` |
| `GET` | `/activities/:id` | Single activity details | `read` |
| `POST` | `/activities` | Create Level 1 or Level 2 activity (strict 2-level WBS guard) | `create` |
| `PUT` | `/activities/:id` | Update activity schedule, scope, status | `update` |
| `DELETE`| `/activities/:id` | Soft-archive activity (requires zero active children) | `delete` |
| `PUT` | `/activities/:id/restore`| Restore soft-archived activity | `update` |
| `PUT` | `/activities/:id/weights`| Update child weightages with versioning & 100% validation | `weights` |

### 3. Derived Daily Planner
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/planner/today?blockId=...` | Today's scheduled activities with update status | `read` |
| `GET` | `/planner/upcoming?blockId=...&days=7`| Lookahead view (7, 14, 30 days) | `read` |
| `GET` | `/planner/history?blockId=...&date=...`| Historical scheduled view for past date | `read` |

### 4. Daily Updates & Historical Corrections
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/daily-updates` | Query daily updates log with filters | `read` |
| `POST` | `/daily-updates` | Submit daily update (canonical upsert with intra-day log) | `dailyUpdate` |
| `PUT` | `/daily-updates/:id/correct` | Authorized progress correction with mandatory audit reason | `corrections` |

### 5. Photos & Assignees
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `POST` | `/photos/upload` | Multipart photo upload (max 10MB, binary storage) | `dailyUpdate` |
| `GET` | `/photos/:photoId` | Authenticated streaming with safe cache headers | `read` |
| `GET` | `/assignees?projectId=...` | Non-admin safe assignable team members query | `read` |

### 6. Reports Engine
| Method | Endpoint | Description | Permission |
|---|---|---|---|
| `GET` | `/reports/preview` | Live preview calculation of period delta | `reports` |
| `GET` | `/reports/pdf` | Stream branded PDF report | `reports` |
| `GET` | `/reports/excel` | Stream branded Excel spreadsheet | `reports` |

---

## 2. Granular Permissions & Role Mapping

The module defines 13 granular permissions mapped across all 10 existing RebarOptima roles:

| Granular Permission Key | Description |
|---|---|
| `activityTracker.view` | View activities, planner, overview |
| `activityTracker.create` | Create new WBS activities |
| `activityTracker.edit` | Modify activity schedules & properties |
| `activityTracker.archive` | Archive activities |
| `activityTracker.dailyUpdate` | Submit daily progress logs |
| `activityTracker.weightageManage` | Adjust child activity weightages |
| `activityTracker.corrections` | Make audited changes to past daily logs |
| `activityTracker.reportsView` | View reporting engine preview |
| `activityTracker.reportsExport` | Download PDF and Excel reports |
| `activityTracker.photosUpload` | Upload site photographs |
| `activityTracker.photosView` | View site photographs |
| `activityTracker.statusChange` | Manually override execution status |
| `activityTracker.assigneesManage` | Assign team members to activities |

### Existing Roles Permission Matrix

| Role in Codebase | Target Equivalent | View / Read | Daily Update | Weights | Corrections | Reports | Archive |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `SUPER_ADMIN` | Platform Admin | Yes | Yes | Yes | Yes | Yes | Yes |
| `COMPANY_ADMIN` | Company Owner | Yes | Yes | Yes | Yes | Yes | Yes |
| `PROJECT_MANAGER` | Project Manager | Yes | Yes | Yes | Yes | Yes | Yes |
| `SITE_ENGINEER` | Site Engineer / Supervisor | Yes | Yes | No | No | View Only | No |
| `SUPERVISOR` | Field Supervisor | Yes | Yes | No | No | View Only | No |
| `FOREMAN` | Subcontractor Foreman | Scoped | Yes | No | No | No | No |
| `QA_QC_ENGINEER` | Quality Engineer | Yes | View Only | No | No | Yes | No |
| `SAFETY_OFFICER` | Safety Officer | Yes | View Only | No | No | View Only | No |
| `CLIENT_REPRESENTATIVE`| Client / Stakeholder | Read Only | No | No | No | Yes | No |
| `AUDITOR` | Compliance Auditor | Read Only | No | No | View Audits | Yes | No |

