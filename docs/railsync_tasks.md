# Railsync Phase 16
---

## Implementation Status

> **Last Updated:** 2026-02-02 18:25 CST by Claude Opus 4.5

### Completed ✅

| Feature | Description | Files | Commit |
|---------|-------------|-------|--------|
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
| Master Plan Versioning | Version control for planning scenarios | `016_master_plan_versioning.sql`, `masterPlan.service.ts` | pending |

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
```

---

## Demo Ready

All features from Phase 16 and Fleet Overview UI Redesign are complete.

**Access Points:**
- http://localhost:3000/planning - Quick Shop, Monthly Load, Network View
- http://localhost:3000/fleet - Fleet hierarchy with health dashboard
- http://localhost:3000/shops - Shop finder with filters
- http://localhost:3000/budget - Maintenance budget input
- Cmd+K anywhere - Global search
