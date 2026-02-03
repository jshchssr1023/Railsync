# Railsync Phase 16
---

## Implementation Status

> **Last Updated:** 2026-02-03 00:45 CST by Claude Opus 4.5

### Completed ✅

| Feature | Description | Files | Commit |
|---------|-------------|-------|--------|
| **Invoice Management Module** | Invoice ingestion, BRC comparison, auto-approval workflow | `024_invoices.sql`, `invoice.*.ts` | - |
| Fleet Hierarchy Schema | Customer → Lease → Rider → Cars data model | `010_fleet_hierarchy.sql`, `011_amendment_tracking.sql` | `b1d369e` |
| Fleet Hierarchy API | REST endpoints for hierarchy navigation | `fleet.controller.ts`, `fleet.service.ts` | `b1d369e` |
| Fleet Hierarchy UI | Drill-down navigation with breadcrumbs | `fleet/page.tsx`, `fleet/*` components | `b1d369e` |
| Budget Input Screen | Running Repairs + Service Events editing | `budget/page.tsx` | `735e1c2` |
| S&OP Planning Schema | Monthly snapshots, maintenance forecast v2 | `009_sop_planning.sql` | `77360ed` |
| Amendment Tracking | Visual badges, conflict detection | `v_amendment_summary` view | `b1d369e` |
| Amendment Conflict Modal | Before/After comparison | `AmendmentModal.tsx` | `b1d369e` |
| Bulk Shop Re-assignment | Re-sync Schedule button + SQL function | `resync_rider_schedules()` | `b1d369e` |
| Car Shopping Validation | Check for outdated terms before shop | `/api/cars/:carNumber/validate-shopping` | `b1d369e` |
| Shop Validation Modal | Confirmation with Before/After diff | `fleet/page.tsx` | `a467f65` |
| Bulk Selection & Actions | Checkbox column with batch actions | `AllocationList.tsx` | `74d558d` |
| Virtual Grid Sticky Headers | Sticky months/shops in CapacityGrid | `CapacityGrid.tsx` | `74d558d` |
| Hover Details Tooltip | Car numbers on capacity cell hover | `CapacityGrid.tsx` | `74d558d` |
| Drag-and-Drop Shop Loading | Split-pane interface for assignment | `ShopLoadingTool.tsx` | `3a27ff0` |
| Proximity Filter | Haversine distance, nearby shops | `013_shop_geo_filtering.sql` | `3a27ff0` |
| Capability Match Filter | Filter by capability types | `shopFilter.service.ts` | `3a27ff0` |
| Shop Finder Page | Combined filter UI with results | `/shops` page | `3a27ff0` |
| Shopping Classification | 18 types, 59 reasons, cost allocation | `014-016_shopping_*.sql` | `3de7195` |
| Quick Shop Shopping Types | Replaced service options with shopping types, customer billing checkbox | `ServiceOptionsSelector.tsx` | - |
| Timeline/Gantt Toggle | Visual timeline with table toggle | `AllocationTimeline.tsx` | `a6fa237` |
| Fleet Health Dashboard | Stoplight cards for health metrics | `FleetHealthDashboard.tsx` | `5aaaee3` |
| Global Command Bar | Cmd+K unified search | `GlobalCommandBar.tsx` | `5aaaee3` |
| Faceted Sidebar | Collapsible filter panels | `FacetedSidebar.tsx` | `503fb4b` |
| Estimate Lines Table | Cost allocation with overrides | `EstimateLinesTable.tsx` | `5aaaee3` |
| Real-time Capacity Sync | SSE with auto-reconnect | `capacity-events.service.ts` | `6475e12` |
| UI Polish (Dark Mode) | Border/badge/contrast fixes | Multiple components | `d35a9d7` |
| Budget Nav Link | Added to header navigation | `AuthHeader.tsx` | `134c7bf` |
| Shop Event Modal | Classification + Estimate Lines flow | `ShopEventModal.tsx` | `b9ec29c` |
| Master Plan Versioning | Version control for planning scenarios | `016_master_plan_versioning.sql`, `masterPlan.service.ts` | `bfa8b0a` |
| Navigation Restructure | Operations/Planning/Assets dropdown menus | `AuthHeader.tsx` | `bfa8b0a` |
| Master Plans UI | Version history, snapshots, comparisons | `/plans` page | `1df445f` |
| Reports Dashboard | KPI cards, trends, shop performance | `/reports` page | `1df445f` |
| Audit Log Viewer | Activity history with filters | `/audit` page | `1df445f` |
| Email Notifications | Queue-based async email system | `email.service.ts`, `017_email_notifications.sql` | `abd426c` |
| Notification Preferences UI | User settings for email subscriptions | `/settings` page | `abd426c` |
| Shop Designations | Storage/Scrap shop type filtering | `018_shop_designations.sql`, `/admin/shop-designations` | `b614a00` |
| Storage Commodities | Reference table for prep commodity selection | `storage_commodities` table | `b614a00` |

### In Progress 🔄

| Feature | Owner | Notes |
|---------|-------|-------|
| *None* | - | All Phase 16 features complete |

### Pending 📋

| Feature | Priority | Notes |
|---------|----------|-------|
| *None* | - | Phase 16 complete - ready for demo |

---

## Fleet Overview UI Redesign Checklist

From `# Fleet Overview UI Redesign & Shop.md`:

| Section | Feature | Status |
|---------|---------|--------|
| §2.1 | Top-Level Analytics (Snapshot) | ✅ FleetHealthDashboard |
| §3 | Navigation Hierarchy | ✅ Customer → Lease → Rider → Cars |
| §4 | Faceted Sidebar Filters | ✅ FacetedSidebar integrated |
| §5 | Global Command Bar | ✅ Cmd+K search |
| §6 | Timeline/Gantt Toggle | ✅ AllocationTimeline |
| §7 | Shopping Type definitions | ✅ 12 types in DB |
| §8 | Shopping Reason definitions | ✅ 30+ reasons in DB |
| §9 | UI Behavior (dropdowns + estimates) | ✅ ShopEventModal |
| §10 | Data Model Renames | ✅ shopping_types/reasons tables |
| §11 | Prisma Schema | N/A - using raw SQL |

---

## API Endpoints

```
GET  /api/customers                    - List customers with totals
GET  /api/customers/:id/leases         - Customer's master leases
GET  /api/leases/:id/riders            - Lease's riders/schedules
GET  /api/riders/:id/cars              - Cars assigned to rider
GET  /api/riders/:id/amendments        - Rider's amendments
POST /api/riders/:id/resync-schedule   - Bulk resync car schedules
GET  /api/amendments/:id               - Amendment details
POST /api/amendments/:id/detect-conflicts
GET  /api/cars/:carNumber/validate-shopping
POST /api/allocations/:id/assign       - Drag-and-drop assignment
GET  /api/capacity/:shopCode/:month/cars
GET  /api/shopping-types               - Classification types
GET  /api/shopping-reasons             - Classification reasons
GET  /api/shops/nearby                 - Proximity filter
GET  /api/shops/filter                 - Combined filter
GET  /api/shops/capability-types
GET  /api/events/capacity              - SSE endpoint
GET  /api/budget/summary
GET  /api/budget/running-repairs
GET  /api/budget/service-events
GET  /api/master-plans              - List master plans
POST /api/master-plans              - Create master plan
GET  /api/master-plans/:id          - Get master plan details
PUT  /api/master-plans/:id          - Update master plan
DELETE /api/master-plans/:id        - Delete master plan
GET  /api/master-plans/:id/versions - List plan versions
POST /api/master-plans/:id/versions - Create version snapshot
POST /api/master-plans/versions/compare - Compare two versions
GET  /api/notifications/preferences     - Get user notification preferences
PUT  /api/notifications/preferences     - Update notification preferences
GET  /api/notifications/queue/status    - Email queue status (admin)
POST /api/notifications/queue/process   - Process email queue (admin)
GET  /api/shops/by-designation/:type    - Filter shops by designation
GET  /api/shops/designation-summary     - Shop counts by designation
PUT  /api/shops/:shopCode/designation   - Update shop designation (admin)
PUT  /api/shops/bulk-designation        - Bulk update designations (admin)
GET  /api/storage-commodities           - List storage prep commodities
GET  /api/shops/for-shopping-type/:id   - Shops filtered by shopping type

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
```

---

## Database Views

```
v_customer_summary      - Customer totals
v_master_lease_summary  - Lease with rider/car counts
v_rider_summary         - Rider details
v_amendment_summary     - Amendment details
v_cars_on_lease         - Cars on lease riders
v_maintenance_forecast_v2
v_sop_budget_impact
v_shopping_reasons      - Type + reason joined
v_shop_capabilities_summary
v_master_plan_summary       - Plan with version count and totals
v_plan_version_comparison   - Version diff with allocation/cost deltas
v_email_stats               - Email queue statistics by date
v_invoice_summary           - Invoice with line count and reviewer info
v_invoice_line_comparison   - Line items with BRC comparison data
v_invoices_pending_review   - Invoices awaiting manual review
v_invoice_approval_queue    - Queue stats by status
```

---

## Demo Ready

All features from Phase 16 and Fleet Overview UI Redesign are complete.

**Access Points:**
- http://localhost:3000/planning - Quick Shop, Monthly Load, Network View
- http://localhost:3000/fleet - Fleet hierarchy with health dashboard
- http://localhost:3000/shops - Shop finder with filters
- http://localhost:3000/budget - Maintenance budget input
- http://localhost:3000/plans - Master plan versioning
- http://localhost:3000/reports - KPI dashboard and reports
- http://localhost:3000/audit - Audit log viewer (admin)
- http://localhost:3000/invoices - Invoice management (Phase 17)
- http://localhost:3000/settings - Notification preferences
- Cmd+K anywhere - Global search
