# Railsync Implementation Status
---

## Implementation Status

> **Last Updated:** 2026-02-05 by Claude Opus 4.6

### Completed ✅

| Feature | Description | Files | Commit |
|---------|-------------|-------|--------|
| **UMLER Engineering Attributes** | 1:1 `car_umler_attributes` table with ~130 typed columns (20 categories), version tracking trigger, CSV import service with header mapping, lazy-loaded UMLER Specifications section in car detail drawer | `044_car_umler_attributes.sql`, `carUmler.service.ts`, `UmlerSpecSection.tsx` | `cd0de76` |
| **SSOT Asset Migration** | `cars.id UUID` immutable surrogate key, column renames (`car_id` → `car_mark_number` on allocations/car_assignments), UUID FKs, append-only `asset_events` ledger, `car_identifiers` multi-ID resolution, data health gates + `v_data_health` view | `037-042_*.sql`, `assetEvent.service.ts`, 12 backend/frontend files | `02afcf9` |
| **Master Plan Builder** | Tabbed plan UI (Overview/Cars & Allocations/Versions), typeahead car search, plan-specific allocations via `plan_id` FK, inline allocation management | `036_master_plan_allocations.sql`, `masterPlan.service.ts`, `/plans` page | `02afcf9` |
| **Shopping Requests** | Shopping request creation, attachments, status workflow | `043_shopping_requests.sql`, `shopping-request.service.ts`, `/shopping` page | `02afcf9` |
| **Vertical Sidebar Navigation** | Collapsible sidebar with categories, breadcrumbs, keyboard shortcuts help, AppShell layout replacing top banner nav | `Sidebar.tsx`, `Breadcrumbs.tsx`, `AppShell.tsx`, `KeyboardShortcutsHelp.tsx` | `4df338b` |
| **Cars Browse Page** | Car type hierarchy, server-side pagination, detail drawer, URL param filters, mobile responsiveness | `/cars` page, `CarDetailDrawer.tsx` | `2ab1b32` |
| **CCM Hierarchy Instructions** | Per-level instructions editor for Care & Compliance Manuals, redesigned Shop page | `030_ccm_hierarchy_instructions.sql`, `CCMInstructionEditor.tsx` | `2583953` |
| **Project Planning Integration** | Lock/relock workflow, demand linking, bundling, auto-detection, project number generation | `033-035_*.sql`, `project.service.ts` | `861cdb0` |
| **Demand-Linked Planning** | Path 2 planning UI for large projects with demand forecasting | `DemandImportModal.tsx`, `planning.service.ts` | `989a069` |
| **Calculation Integrity Fixes** | ~35 bug fixes across analytics, budget, contracts, and dashboard calculations | Multiple services and components | `995950e` |
| **Configurable Dashboard** | Widget-based dashboard with drag-and-drop, fleet readiness, performance, and financial widgets | `ConfigurableDashboard.tsx`, `WidgetCard.tsx` | `643cecd` |
| **Test Seed Data** | Comprehensive seed data covering all 16 feature areas | `database/seed/` | `fb52400` |
| **User Management** | Roles, permissions, groups, customer portal support | `026_user_management.sql`, `userManagement.*.ts`, `/admin/users` | `d97f1c4` |
| **Analytics & BI Dashboard** | Capacity forecasting, cost analytics, operations KPIs, demand forecasting | `analytics.service.ts`, `/analytics` page | `d97f1c4` |
| **Shop Details Drawer** | Slide-out drawer with shop info, backlog, capabilities | `ShopInfoDrawer.tsx`, `/shops` page | `d97f1c4` |
| **Invoice Management Module** | Invoice ingestion, BRC comparison, auto-approval workflow | `024_invoices.sql`, `invoice.*.ts` | `235b26e` |
| **Invoice Processing Workflow** | InvoiceCase state machine, validation engine, attachments, audit events | `031_invoice_processing_workflow.sql`, `invoice-case.service.ts`, `invoice-validation.service.ts` | `84d1369` |
| **Invoice Case Queue UI** | Full case creation modal (SHOP/MRU), edit mode, auto-validation, type-specific info cards, validation context display, server-side attachment validation, audit trail filtering with expandable context | `invoice-cases/page.tsx`, `invoice-cases/[id]/page.tsx` | `6416c12` |
| **UI/UX Polish** | Security (sanitized errors, hidden creds), dark mode retrofit, accessibility (ARIA dialogs, keyboard nav, screen reader labels), native dialog replacement (alert/confirm -> Toast/ConfirmDialog), mobile responsiveness (responsive grids, touch targets) | 24 files across components and pages | `efe9602` |
| Contracts Hierarchy Schema | Customer → Lease → Rider → Cars data model | `010_fleet_hierarchy.sql`, `011_amendment_tracking.sql` | `b1d369e` |
| Contracts Hierarchy API | REST endpoints for hierarchy navigation | `contracts.controller.ts`, `contracts.service.ts` | `b1d369e` |
| Contracts Hierarchy UI | Drill-down navigation with breadcrumbs | `contracts/page.tsx`, `contracts/*` components | `b1d369e` |
| Budget Input Screen | Running Repairs + Service Events editing | `budget/page.tsx` | `735e1c2` |
| S&OP Planning Schema | Monthly snapshots, maintenance forecast v2 | `009_sop_planning.sql` | `77360ed` |
| Amendment Tracking | Visual badges, conflict detection | `v_amendment_summary` view | `b1d369e` |
| Amendment Conflict Modal | Before/After comparison | `AmendmentModal.tsx` | `b1d369e` |
| Bulk Shop Re-assignment | Re-sync Schedule button + SQL function | `resync_rider_schedules()` | `b1d369e` |
| Car Shopping Validation | Check for outdated terms before shop | `/api/cars/:carNumber/validate-shopping` | `b1d369e` |
| Bulk Selection & Actions | Checkbox column with batch actions | `AllocationList.tsx` | `74d558d` |
| Virtual Grid Sticky Headers | Sticky months/shops in CapacityGrid | `CapacityGrid.tsx` | `74d558d` |
| Hover Details Tooltip | Car numbers on capacity cell hover | `CapacityGrid.tsx` | `74d558d` |
| Drag-and-Drop Shop Loading | Split-pane interface for assignment | `ShopLoadingTool.tsx` | `3a27ff0` |
| Proximity Filter | Haversine distance, nearby shops | `013_shop_geo_filtering.sql` | `3a27ff0` |
| Capability Match Filter | Filter by capability types | `shopFilter.service.ts` | `3a27ff0` |
| Shop Finder Page | Combined filter UI with results | `/shops` page | `3a27ff0` |
| Shopping Classification | 18 types, 59 reasons, cost allocation | `014-016_shopping_*.sql` | `3de7195` |
| Quick Shop Shopping Types | Replaced service options with shopping types, customer billing checkbox | `ServiceOptionsSelector.tsx` | `c6f9e43` |
| Timeline/Gantt Toggle | Visual timeline with table toggle | `AllocationTimeline.tsx` | `a6fa237` |
| Contracts Health Dashboard | Stoplight cards for health metrics | `ContractsHealthDashboard.tsx` | `5aaaee3` |
| Global Command Bar | Cmd+K unified search | `GlobalCommandBar.tsx` | `5aaaee3` |
| Faceted Sidebar | Collapsible filter panels | `FacetedSidebar.tsx` | `503fb4b` |
| Estimate Lines Table | Cost allocation with overrides | `EstimateLinesTable.tsx` | `5aaaee3` |
| Real-time Capacity Sync | SSE with auto-reconnect | `capacity-events.service.ts` | `6475e12` |
| Shop Event Modal | Classification + Estimate Lines flow | `ShopEventModal.tsx` | `b9ec29c` |
| Master Plan Versioning | Version control for planning scenarios | `016_master_plan_versioning.sql`, `masterPlan.service.ts` | `bfa8b0a` |
| Master Plans UI | Version history, snapshots, comparisons | `/plans` page | `1df445f` |
| Reports Dashboard | KPI cards, trends, shop performance | `/reports` page | `1df445f` |
| Audit Log Viewer | Activity history with filters | `/audit` page | `1df445f` |
| Email Notifications | Queue-based async email system | `email.service.ts`, `017_email_notifications.sql` | `abd426c` |
| Notification Preferences UI | User settings for email subscriptions | `/settings` page | `abd426c` |
| Shop Designations | Storage/Scrap shop type filtering | `018_shop_designations.sql`, `/admin/shop-designations` | `b614a00` |
| Storage Commodities | Reference table for prep commodity selection | `storage_commodities` table | `b614a00` |
| Bad Orders Page | Report unplanned repair needs, severity tracking, resolution workflow | `/bad-orders` page | `c6f9e43` |
| SOW Library | Scope of work template library | `/scope-library` page | `c6f9e43` |
| Shopping Workflow | Full shopping event flow with estimate approval | `027_shopping_workflow.sql` | `c6f9e43` |

### In Progress 🔄

| Feature | Owner | Notes |
|---------|-------|-------|
| *None* | - | All current features complete |

### Pending 📋

| Feature | Priority | Notes |
|---------|----------|-------|
| *None* | - | Ready for demo |

---

## Contracts Overview UI Redesign Checklist

From `# Contracts Overview UI Redesign & Shop.md`:

| Section | Feature | Status |
|---------|---------|--------|
| §2.1 | Top-Level Analytics (Snapshot) | ✅ ContractsHealthDashboard |
| §3 | Navigation Hierarchy | ✅ Customer → Lease → Rider → Cars |
| §4 | Faceted Sidebar Filters | ✅ FacetedSidebar integrated |
| §5 | Global Command Bar | ✅ Cmd+K search |
| §6 | Timeline/Gantt Toggle | ✅ AllocationTimeline |
| §7 | Shopping Type definitions | ✅ 18 types in DB |
| §8 | Shopping Reason definitions | ✅ 59 reasons in DB |
| §9 | UI Behavior (dropdowns + estimates) | ✅ ShopEventModal |
| §10 | Data Model Renames | ✅ shopping_types/reasons tables |
| §11 | Prisma Schema | N/A - using raw SQL |

---

## SSOT Asset Migration Summary

**Migrations 037-042** establish `cars` as the authoritative identity table.

| Migration | Purpose |
|-----------|---------|
| 037 | `cars.id UUID` + immutability trigger |
| 038 | Rename conflicting `car_id` columns → `car_mark_number`, add UUID FKs on allocations + car_assignments, recreate 4 views |
| 039 | `asset_events` append-only lifecycle ledger |
| 040 | `car_identifiers` multi-ID resolution table (1,518 rows seeded) |
| 041 | `car_id UUID` FK on shopping_events, shopping_packets, project_assignments, bad_order_reports, invoice_line_items |
| 042 | Data health gate triggers + `v_data_health` monitoring view |

**Key rules:**
- `cars.id` is immutable (trigger-enforced)
- `allocations.car_id` = UUID FK to `cars(id)`; `allocations.car_mark_number` = old composed string
- `car_assignments.car_id` = UUID FK to `cars(id)`; `car_assignments.car_mark_number` = old random UUID
- INSERT into allocations: use `car_mark_number` for composed string, `car_id` via subquery `(SELECT id FROM cars WHERE car_number = $1)`
- `v_data_health` should always show 0 violations

---

## API Endpoints

```
# Contracts & Hierarchy
GET  /api/customers                    - List customers with totals
GET  /api/customers/:id/leases         - Customer's master leases
GET  /api/leases/:id/riders            - Lease's riders/schedules
GET  /api/riders/:id/cars              - Cars assigned to rider
GET  /api/riders/:id/amendments        - Rider's amendments
POST /api/riders/:id/resync-schedule   - Bulk resync car schedules
GET  /api/amendments/:id               - Amendment details
POST /api/amendments/:id/detect-conflicts

# Cars & Asset Identity
GET  /api/cars/:carNumber/validate-shopping
GET  /api/cars/:carNumber/history      - Asset event timeline (SSOT)
GET  /api/cars/:carNumber/umler        - UMLER engineering attributes (lazy-loaded)
PUT  /api/cars/:carNumber/umler        - Create/update UMLER attributes (admin)
POST /api/cars/umler/import            - Bulk CSV import of UMLER data (admin)

# Planning & Allocations
POST /api/allocations/:id/assign       - Drag-and-drop assignment
GET  /api/capacity/:shopCode/:month/cars
GET  /api/shopping-types               - Classification types
GET  /api/shopping-reasons             - Classification reasons

# Shops
GET  /api/shops/nearby                 - Proximity filter
GET  /api/shops/filter                 - Combined filter
GET  /api/shops/capability-types
GET  /api/shops/by-designation/:type    - Filter shops by designation
GET  /api/shops/designation-summary     - Shop counts by designation
PUT  /api/shops/:shopCode/designation   - Update shop designation (admin)
PUT  /api/shops/bulk-designation        - Bulk update designations (admin)
GET  /api/shops/for-shopping-type/:id   - Shops filtered by shopping type
GET  /api/storage-commodities           - List storage prep commodities

# Real-time
GET  /api/events/capacity              - SSE endpoint

# Budget
GET  /api/budget/summary
GET  /api/budget/running-repairs
GET  /api/budget/service-events

# Master Plans
GET  /api/master-plans              - List master plans
POST /api/master-plans              - Create master plan
GET  /api/master-plans/:id          - Get master plan details
PUT  /api/master-plans/:id          - Update master plan
DELETE /api/master-plans/:id        - Delete master plan
GET  /api/master-plans/:id/versions - List plan versions
POST /api/master-plans/:id/versions - Create version snapshot
POST /api/master-plans/versions/compare - Compare two versions
GET  /api/master-plans/:id/allocations  - Plan allocations
POST /api/master-plans/:id/allocations  - Add cars to plan
DELETE /api/master-plans/:id/allocations/:allocId - Remove allocation

# Notifications
GET  /api/notifications/preferences     - Get user notification preferences
PUT  /api/notifications/preferences     - Update notification preferences
GET  /api/notifications/queue/status    - Email queue status (admin)
POST /api/notifications/queue/process   - Process email queue (admin)

# Invoice Management
GET  /api/invoices                      - List invoices with filters
POST /api/invoices                      - Create invoice (manual entry)
POST /api/invoices/upload               - Upload & parse invoice (PDF/EDI)
GET  /api/invoices/approval-queue       - Approval queue statistics
GET  /api/invoices/pending-review       - Invoices pending manual review
GET  /api/invoices/:id                  - Get invoice details
PUT  /api/invoices/:id/status           - Update invoice status
GET  /api/invoices/:id/comparison       - Side-by-side BRC comparison
POST /api/invoices/:id/rematch          - Re-run matching after corrections
GET  /api/invoices/:id/line-items       - Get invoice line items
PUT  /api/invoices/:id/line-items/:lineId/match   - Manual line item matching
POST /api/invoices/:id/line-items/:lineId/verify  - Mark line as verified
POST /api/invoices/:id/approve          - Approve and queue for SAP
POST /api/invoices/:id/reject           - Reject with reason

# Invoice Cases
GET  /api/invoice-cases                 - List invoice cases
POST /api/invoice-cases                 - Create invoice case
GET  /api/invoice-cases/:id             - Get case details
PUT  /api/invoice-cases/:id             - Update case
PUT  /api/invoice-cases/:id/status      - Transition case status

# Shopping Requests
GET  /api/shopping-requests             - List shopping requests
POST /api/shopping-requests             - Create shopping request
GET  /api/shopping-requests/:id         - Get request details
PUT  /api/shopping-requests/:id         - Update request
PUT  /api/shopping-requests/:id/status  - Update request status

# Analytics & BI
GET  /api/analytics/capacity/forecast     - Capacity forecast by shop/month
GET  /api/analytics/capacity/trends       - Historical capacity utilization
GET  /api/analytics/capacity/bottlenecks  - Shops with highest utilization
GET  /api/analytics/cost/trends           - Cost trends over time
GET  /api/analytics/cost/budget-comparison - Budget vs actual by category
GET  /api/analytics/cost/by-shop          - Cost comparison across shops
GET  /api/analytics/operations/kpis       - Operations KPI metrics
GET  /api/analytics/operations/dwell-time - Dwell time by shop
GET  /api/analytics/operations/throughput - Cars in/out throughput
GET  /api/analytics/demand/forecast       - Demand forecast with confidence
GET  /api/analytics/demand/by-region      - Demand by geographic region
GET  /api/analytics/demand/by-customer    - Demand by customer

# User Management
GET  /api/admin/users                     - List users with filters
POST /api/admin/users                     - Create new user
GET  /api/admin/users/:id                 - Get user details with permissions
PUT  /api/admin/users/:id                 - Update user
PUT  /api/admin/users/:id/password        - Update user password
POST /api/admin/users/:id/activate        - Activate user
POST /api/admin/users/:id/deactivate      - Deactivate user
GET  /api/admin/users/:id/permissions     - Get user permissions
PUT  /api/admin/users/:id/permissions     - Update user permissions (grant/revoke/deny)
POST /api/admin/users/:id/customer        - Assign user to customer
GET  /api/admin/permissions               - List all permissions grouped by category
GET  /api/admin/groups                    - List user groups
POST /api/admin/groups                    - Create user group
GET  /api/admin/groups/:id                - Get group with members and permissions
PUT  /api/admin/groups/:id                - Update group
DELETE /api/admin/groups/:id              - Delete group
PUT  /api/admin/groups/:id/members        - Update group members (add/remove)
PUT  /api/admin/groups/:id/permissions    - Update group permissions
GET  /api/admin/customers/:id/users       - Get customer's users

# Projects
GET  /api/projects                        - List projects
POST /api/projects                        - Create project
GET  /api/projects/:id                    - Get project details
PUT  /api/projects/:id                    - Update project
GET  /api/projects/:id/planning-summary   - Project planning summary

# Bad Orders
GET  /api/bad-orders                      - List bad order reports
POST /api/bad-orders                      - Create bad order report
PUT  /api/bad-orders/:id/resolve          - Resolve bad order
```

---

## Database Views

```
# Contracts
v_customer_summary         - Customer totals
v_master_lease_summary     - Lease with rider/car counts
v_rider_summary            - Rider details
v_amendment_summary        - Amendment details
v_cars_on_lease            - Cars on lease riders

# Planning
v_maintenance_forecast_v2  - Maintenance forecast
v_sop_budget_impact        - S&OP budget impact
v_master_plan_summary      - Plan with version count and totals
v_plan_version_comparison  - Version diff with allocation/cost deltas
v_shopping_reasons         - Type + reason joined

# Shops & Capacity
v_shop_capabilities_summary - Shop capability rollup
v_backlog_cars             - Cars in backlog status
v_pipeline_cars            - Cars in pipeline
v_active_cars              - Cars actively in shop
v_healthy_cars             - Cars in good health

# Invoices
v_invoice_summary          - Invoice with line count and reviewer info
v_invoice_line_comparison  - Line items with BRC comparison data
v_invoices_pending_review  - Invoices awaiting manual review
v_invoice_approval_queue   - Queue stats by status

# Email
v_email_stats              - Email queue statistics by date

# Users
v_user_permissions         - Effective user permissions (role + group + overrides)
v_user_summary             - User details with customer and group counts
v_user_groups_summary      - Groups with member and permission counts

# SSOT Data Health
v_data_health              - Orphaned/unresolved car references (should always be 0)
```

---

## Database Migrations (44 total)

| Range | Area |
|-------|------|
| 001-008 | Core: auth, planning, capacity, alerts, fleet, automation, car assignments, service plans |
| 009-012 | S&OP planning, lease hierarchy, amendments, allocation versioning |
| 013-016 | Shop geo filtering, shopping classification, master plan versioning |
| 017-020 | Email, shop designations, budget line items, qualification reports |
| 021-025 | Capacity reservations, CCM, shopping packets, invoices/projects, seed data |
| 026-028 | User management, shopping workflow, CCM forms |
| 029-032 | Shop tiers, CCM hierarchy instructions, invoice processing, fix invoice views |
| 033-036 | Project planning integration, car project history, fix project numbers, master plan allocations |
| 037-042 | **SSOT**: cars.id UUID, car_id FK renames, asset_events, car_identifiers, denormalized FKs, data health |
| 043 | Shopping requests |
| 044 | **UMLER**: car_umler_attributes (130 typed columns, version trigger, CSV import) |

---

## Demo Ready

All features are complete.

**Access Points:**
- http://localhost:3000/dashboard - Configurable widget dashboard
- http://localhost:3000/planning - Quick Shop, Monthly Load, Network View
- http://localhost:3000/contracts - Contracts hierarchy with health dashboard
- http://localhost:3000/shops - Shop finder with filters
- http://localhost:3000/cars - Car browse with type hierarchy, detail drawer, and UMLER specifications
- http://localhost:3000/budget - Maintenance budget input
- http://localhost:3000/plans - Master plan builder with allocations and versioning
- http://localhost:3000/pipeline - Shopping pipeline
- http://localhost:3000/projects - Project management with planning integration
- http://localhost:3000/reports - KPI dashboard and reports
- http://localhost:3000/audit - Audit log viewer (admin)
- http://localhost:3000/invoices - Invoice management (legacy BRC matching)
- http://localhost:3000/invoice-cases - Invoice Case Queue (state machine workflow)
- http://localhost:3000/shopping - Shopping events and requests
- http://localhost:3000/analytics - Analytics & BI dashboard
- http://localhost:3000/ccm - Care & Compliance Manuals with hierarchy instructions
- http://localhost:3000/scope-library - SOW Library
- http://localhost:3000/bad-orders - Bad order reporting and resolution
- http://localhost:3000/admin - Admin panel (users, rules, shop designations)
- http://localhost:3000/settings - Notification preferences
- Cmd+K anywhere - Global search
