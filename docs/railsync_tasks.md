# Railsync Phase 16
---

## Implementation Status

> **Last Updated:** 2026-02-02 13:35 CST by Claude Opus 4.5

### Completed ✅

| Feature | Description | Files | Commit |
|---------|-------------|-------|--------|
| Fleet Hierarchy Schema | Customer → Lease → Rider → Cars data model | `database/migrations/010_fleet_hierarchy.sql`, `011_amendment_tracking.sql` | `b1d369e` |
| Fleet Hierarchy API | REST endpoints for hierarchy navigation | `backend/src/controllers/fleet.controller.ts`, `backend/src/services/fleet.service.ts` | `b1d369e` |
| Fleet Hierarchy UI | Drill-down navigation with breadcrumbs | `frontend/src/app/fleet/page.tsx`, `frontend/src/components/fleet/*` | `b1d369e` |
| Budget Input Screen | Running Repairs + Service Events editing | `frontend/src/app/budget/page.tsx` | `735e1c2` |
| S&OP Planning Schema | Monthly snapshots, maintenance forecast v2 | `database/migrations/009_sop_planning.sql` | `77360ed` |
| Amendment Tracking | Visual badges, conflict detection | `v_amendment_summary` view, `lease_amendments` table | `b1d369e` |
| Auth Token Fix | Fixed localStorage key mismatch for API auth | `frontend/src/lib/api.ts` | `19a17ff` |
| Amendment Conflict Modal | Before/After comparison in AmendmentModal | `frontend/src/components/fleet/AmendmentModal.tsx` | `b1d369e` |
| Bulk Shop Re-assignment | "Re-sync Schedule" button + SQL function | `resync_rider_schedules()`, `/api/riders/:id/resync-schedule` | `b1d369e` |
| Car Shopping Validation | Check for outdated terms before shop | `/api/cars/:carNumber/validate-shopping` | `b1d369e` |
| Shop Validation Modal | Confirmation modal with Before/After when shopping car with outdated terms | `frontend/src/app/fleet/page.tsx` | `a467f65` |
| Bulk Selection & Actions | Checkbox column in AllocationList with batch actions | `AllocationList.tsx` | `74d558d` |
| Virtual Grid Sticky Headers | Sticky top (months) and left (shops) in CapacityGrid | `CapacityGrid.tsx` | `74d558d` |
| Hover Details Tooltip | Tooltip showing car numbers on capacity cell hover | `CapacityGrid.tsx`, `GET /capacity/:shop/:month/cars` | `74d558d` |
| Drag-and-Drop Shop Loading | Split-pane interface for shop assignment | `ShopLoadingTool.tsx`, `POST /allocations/:id/assign` | pending |
| Proximity Filter | Haversine distance calculation, nearby shops search | `013_shop_geo_filtering.sql`, `shopFilter.service.ts` | pending |
| Capability Match Filter | Filter shops by capability types | `shopFilter.controller.ts`, `ShopFilterPanel.tsx` | pending |
| Shop Finder Page | Combined filter UI with results table | `/shops` page, navigation links | pending |
| Shopping Classification | 12 types, 30+ reasons, dependent dropdowns | `014_shopping_classification.sql`, `AllocationList.tsx` | `3de7195` |
| Timeline/Gantt Toggle | Visual timeline view with table toggle | `AllocationTimeline.tsx`, `planning/page.tsx` | `39a3e45` |

### In Progress 🔄

| Feature | Owner | Notes |
|---------|-------|-------|
| *None currently* | - | - |

### Pending 📋

| Feature | Priority | Current % | Spec Reference |
|---------|----------|-----------|----------------|
| Real-time Capacity Sync | High | 40% | WebSocket/SSE for live updates |

---

## Detailed Gap Analysis

> **Last Analyzed:** 2026-02-02 by Claude Opus 4.5

### 1. Drag-and-Drop Shop Loading (100% Complete) ✅

**What Exists:**
- ShopLoadingTool component with native HTML5 drag-and-drop
- Split-pane interface: left=unassigned cars, right=capacity grid
- Multi-select with Ctrl/Cmd+Click and bulk drag
- `POST /allocations/:id/assign` endpoint with optimistic locking
- Capacity auto-updates on assignment
- Color-coded utilization (green→yellow→red)
- Hover tooltips showing assigned cars

**Files Created/Modified:**
- `frontend/src/components/ShopLoadingTool.tsx` - Main drag-and-drop component
- `backend/src/services/planning.service.ts` - `assignAllocation()` function
- `backend/src/controllers/planning.controller.ts` - `assignAllocation()` handler
- `backend/src/routes/index.ts` - `POST /allocations/:id/assign` route
- `database/migrations/012_allocation_versioning.sql` - Version column for optimistic locking

---

### 2. Real-time Capacity Sync (40% Complete)

**What Exists:**
- Allocation → Capacity atomic transaction (`allocation.service.ts:61-150`)
- Row-level locking with `FOR UPDATE` prevents race conditions
- 10% overcommit buffer validation
- Status management: proposed → planned → confirmed → complete

**What's Missing:**
| Gap | Files Affected | Effort |
|-----|----------------|--------|
| No WebSocket/SSE for live updates | New service + frontend hook | L |
| No optimistic UI updates | `CapacityGrid.tsx` | M |
| No pending confirmation state before deducting | `allocation.service.ts` | M |
| No conflict retry/reconciliation | `planning/page.tsx` | S |

---

### 3. Bulk Selection & Actions (100% Complete) ✅

**What Exists:**
- Checkbox column in AllocationList for shoppable allocations
- Select all / deselect all with indeterminate state
- Batch action bar (Shop Selected, Reassign, Clear buttons)
- Shop comparison multi-select (max 3 shops) in `ResultsGrid.tsx`

**Files Modified:**
- `frontend/src/components/AllocationList.tsx` - Bulk selection UI

---

### 4. Proximity Filter (100% Complete) ✅

**What Exists:**
- Lat/lon fields in shops table with geo index
- Haversine formula `calculate_distance_miles()` PostgreSQL function
- `find_shops_within_radius()` database function
- `GET /api/shops/nearby` API endpoint
- `GET /api/shops/filter` combined filter endpoint
- Shop Finder page with proximity controls
- Preset city locations (Houston, Chicago, LA, etc.)
- Custom coordinate input with radius slider

**Files Created/Modified:**
- `database/migrations/013_shop_geo_filtering.sql` - Schema, functions, seed data
- `backend/src/services/shopFilter.service.ts` - Filter service functions
- `backend/src/controllers/shopFilter.controller.ts` - API handlers
- `backend/src/routes/index.ts` - Filter routes
- `frontend/src/components/ShopFilterPanel.tsx` - Filter UI component
- `frontend/src/app/shops/page.tsx` - Shop Finder page

---

### 5. Capability Match Filter (100% Complete) ✅

**What Exists:**
- `capability_types` lookup table with display names and descriptions
- `v_shop_capabilities_summary` view with aggregated capabilities per shop
- `GET /api/shops/capability-types` - List all capability types
- `GET /api/shops/capability-values/:type` - Get values for a capability type
- `GET /api/shops/by-capabilities` - Filter shops by capability types
- `GET /api/shops/filter` - Combined filter with capabilities
- Capability type toggle buttons in ShopFilterPanel
- "Shops must have ALL selected capabilities" logic

**Files Created/Modified:**
- `database/migrations/013_shop_geo_filtering.sql` - capability_types table, view
- `backend/src/services/shopFilter.service.ts` - Capability filter functions
- `backend/src/controllers/shopFilter.controller.ts` - Capability API handlers
- `frontend/src/components/ShopFilterPanel.tsx` - Capability toggle UI

---

### 6. Virtual Grid Sticky Headers (100% Complete) ✅

**What Exists:**
- `CapacityGrid.tsx` with basic table headers

**What's Missing:**
| Gap | Files Affected | Effort |
|-----|----------------|--------|
| No sticky position on shop column | CSS + `CapacityGrid.tsx` | S |
| No sticky month headers | CSS + `CapacityGrid.tsx` | S |
| No intersection observer for large grids | `CapacityGrid.tsx` | M |

---

### 7. Hover Details Tooltip (100% Complete) ✅

**What Exists:**
- Capacity cells show `allocated/total` format

**What's Missing:**
| Gap | Files Affected | Effort |
|-----|----------------|--------|
| No tooltip component on capacity cells | `CapacityGrid.tsx` | S |
| No API to fetch car numbers per shop/month | `planning.controller.ts` | S |
| No hover state management | `CapacityGrid.tsx` | S |

---

## Recommended Implementation Order

```
Phase A (Foundation): ✅ COMPLETE
  1. Bulk Selection (100%) - Checkbox column, select all, batch actions
  2. Hover Details Tooltip (100%) - Car numbers on capacity cell hover
  3. Virtual Grid Sticky Headers (100%) - Sticky months/shop columns

Phase B (Filtering): ✅ COMPLETE
  4. Proximity Filter (100%) - Haversine formula, nearby shops search
  5. Capability Match Filter (100%) - Multi-select capability filtering

Phase C (Advanced):
  6. Real-time Capacity Sync (40%) - Requires WebSocket infrastructure
  7. Drag-and-Drop Shop Loading (100%) - Split-pane interface complete
```

---

## Technical Debt Notes

1. ~~**Shop location data**: Currently no geographic coordinates in `shops` table~~ ✅ RESOLVED - Added lat/lon with migration 013
2. **Region as string**: `shop.region` should be FK to lookup table (low priority)
3. **No WebSocket infrastructure**: All updates require manual refresh
4. **Allocation batch API missing**: Cannot process multiple allocations atomically

### Database Views Created

```
v_customer_summary      - Customer totals (leases, riders, cars, revenue)
v_master_lease_summary  - Lease summary with rider/car counts
v_rider_summary         - Rider details with actual cars on lease
v_amendment_summary     - Amendment details with related entities
v_cars_on_lease         - Cars assigned to lease riders
v_maintenance_forecast_v2 - Combined RR + SE budget forecast
v_sop_budget_impact     - S&OP projection budget calculations
```

### API Endpoints Added

```
GET  /api/customers                    - List customers with totals
GET  /api/customers/:id/leases         - Customer's master leases
GET  /api/leases/:id/riders            - Lease's riders/schedules
GET  /api/riders/:id/cars              - Cars assigned to rider
GET  /api/riders/:id/amendments        - Rider's amendments
POST /api/riders/:id/resync-schedule   - Bulk resync car schedules
GET  /api/amendments/:id               - Amendment details with comparison
POST /api/amendments/:id/detect-conflicts - Find scheduling conflicts
GET  /api/fleet/cars-with-amendments   - Cars with amendment status
GET  /api/cars/:carNumber/validate-shopping - Check for outdated terms
POST /api/allocations/:id/assign       - Drag-and-drop shop assignment
GET  /api/capacity/:shopCode/:month/cars - Cars in capacity cell (tooltip)
```

### Demo Data Seeded

- 9 customers (DuPont, Dow, BASF, Exxon, Shell, Cargill, ADM, Bunge, Mosaic)
- Multiple master leases with riders
- 72+ car assignments to lease riders
- S&OP monthly snapshots for 2026
- Running repairs and service event budgets for FY2026

---

## Implementation Directives

> **For Claude:** Follow these rules when implementing this specification.

### Execution Rules

1. **Work incrementally.** Complete one task group (e.g., 9.1, 9.2) before moving to the next.
2. **Create all files.** Don't describe what you would create — actually create the files.
3. **Run tests after each task group.** Use `npm run verify` or equivalent.
4. **Don't ask for confirmation.** If the spec says to do it, do it.
5. **Report concisely.** After each task group, report: ✅ Done, ⚠️ Issue (with fix), or ❌ Blocked (with reason).

### File Creation Rules

1. **Migrations:** Create in `/api/src/migrations/` with sequential numbering (013, 014, etc.)
2. **Services:** Create in `/api/src/services/`
3. **Routes:** Create in `/api/src/routes/`
4. **Components:** Create in `/web/src/components/`
5. **Always include:** Types, Zod validation, basic error handling

### Testing Rules

1. **Unit tests required** for: Services, parsers, calculation functions
2. **Minimum 3 tests per function:** Happy path, edge case, error case
3. **Run tests before reporting task complete**

### Code Style

1. Use existing patterns from Phase 1-6 code
2. Match existing naming conventions
3. Reuse existing utilities (don't recreate)

### Token Efficiency

1. **Don't repeat the spec back.** Just implement it.
2. **Don't explain what you're about to do.** Just do it.
3. **Batch related files** in a single response when possible.
4. **Use comments in code** instead of prose explanations.

### When Stuck

1. Check existing codebase for patterns
2. Make a reasonable assumption and document it in code comment
3. Only ask if truly blocked (missing dependency, conflicting requirement)

---

You are a **Senior Staff Software Engineer & Quality Gatekeeper**.

Your responsibility is to **verify**, not extend, the existing system.  
You must assume the build *claims* to be complete — your job is to **prove or disprove that claim**.

You will operate using the **Railph Loop**, executed rigorously and in order.
. Visual Amendment Triggers
Indicator: Any car associated with a Rider that has an active or pending Amendment must display an "Updated Terms" badge in the Fleet Overview.

Highlighting: If an Amendment changes the "Required Shop Date" or "Service Interval," the affected car rows must be highlighted to signal a scheduling conflict.

2. Conflict Resolution Workflow
Validation: If a user attempts to shop a car ([Shop] button) under old Rider terms that have been superseded by an Amendment, the system must trigger a confirmation modal.

Modal Content: The modal should display a "Before vs. After" comparison of the shopping requirements (e.g., "Previous: General Service every 10 years" vs. "Amended: General Service every 8 years").

3. Historical Transparency
Audit Trail: Within the Fleet Overview, users should be able to click an Amendment badge to see a timeline of when the change was executed and who approved it.

Impact Summary: Provide a summary view showing how many cars within a specific Lease or Rider were affected by a specific Amendment.

4. Bulk Shop Re-assignment
Automation: Provide a "Re-sync Schedule" button for Managers. When clicked, the system should automatically move "Planned" or "Scheduled" shop dates to align with the new Amendment dates for all cars under that Rider.

Technical Notes for Developers
Data Relationship: Ensure the Amendment table has a many-to-one relationship with Rider, and that any Car query joins these tables to check for the is_latest_version flag.

Performance: Since we are scaling to 100k+ cars, the "Amendment Impact" check should be calculated asynchronously or cached to avoid slowing down the main Fleet table load.

Revised Budget Structure
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAINTENANCE BUDGET MODEL                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RUNNING REPAIRS (Pool-Based)                                               │
│  ─────────────────────────────                                              │
│  Budget = Monthly Allocation × Cars on Lease × 12 months                    │
│                                                                             │
│  Example:                                                                   │
│    $150/car/month × 45,000 cars on lease = $6,750,000/month                │
│    Annual Running Repairs Budget = $81,000,000                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SERVICE EVENTS (Event-Based)                                               │
│  ─────────────────────────────                                              │
│  Budget = Σ (Estimated Cost per Car for Known Events)                       │
│                                                                             │
│    Qualifications:  2,500 cars × $35,000 avg = $87,500,000                 │
│    Assignments:     3,600 cars × $28,000 avg = $100,800,000                │
│    Returns:         4,000 cars × $22,000 avg = $88,000,000                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TOTAL ANNUAL BUDGET = Running Repairs + Service Events                     │
│                      = $81M + $276.3M = $357.3M                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Revised Schema
Running Repairs Budget
sql-- Monthly running repairs allocation (pool-based)
CREATE TABLE running_repairs_budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    month VARCHAR(7) NOT NULL,                    -- "2026-01"
    
    -- Input
    cars_on_lease INTEGER NOT NULL,               -- Active lease count for this month
    allocation_per_car DECIMAL(10,2) NOT NULL,    -- $/car/month (e.g., $150)
    
    -- Calculated
    monthly_budget DECIMAL(14,2) GENERATED ALWAYS AS (
        cars_on_lease * allocation_per_car
    ) STORED,
    
    -- Tracking
    actual_spend DECIMAL(14,2) DEFAULT 0,         -- Running repairs actually incurred
    remaining DECIMAL(14,2) GENERATED ALWAYS AS (
        (cars_on_lease * allocation_per_car) - actual_spend
    ) STORED,
    
    -- Audit
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(fiscal_year, month)
);

-- Index for fast lookups
CREATE INDEX idx_running_repairs_year_month ON running_repairs_budget(fiscal_year, month);
Service Event Budget
sql-- Service event budget (event-based: qualifications, assignments, returns)
CREATE TABLE service_event_budget (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    
    -- Event type
    event_type VARCHAR(50) NOT NULL,              -- 'Qualification', 'Assignment', 'Return'
    
    -- Volume
    budgeted_car_count INTEGER NOT NULL,
    
    -- Cost assumptions
    avg_cost_per_car DECIMAL(10,2) NOT NULL,      -- Planning estimate
    
    -- Calculated
    total_budget DECIMAL(14,2) GENERATED ALWAYS AS (
        budgeted_car_count * avg_cost_per_car
    ) STORED,
    
    -- Optional segmentation
    customer_code VARCHAR(20),                    -- NULL = all customers
    fleet_segment VARCHAR(50),                    -- NULL = all fleets
    car_type VARCHAR(50),                         -- NULL = all car types
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(fiscal_year, event_type, customer_code, fleet_segment, car_type)
);
S&OP Monthly Snapshot
Since on/off lease planning changes monthly, we need to track the S&OP view:
sql-- S&OP monthly planning snapshot
-- Captures the "as of this month" view of expected leases
CREATE TABLE sop_monthly_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- When this snapshot was taken
    snapshot_month VARCHAR(7) NOT NULL,           -- "2026-01" = January 2026 S&OP meeting
    fiscal_year INTEGER NOT NULL,
    
    -- Target month being planned
    target_month VARCHAR(7) NOT NULL,             -- "2026-04" = what we expect in April
    
    -- Lease counts (as projected in this S&OP cycle)
    projected_cars_on_lease INTEGER NOT NULL,
    projected_new_leases INTEGER DEFAULT 0,       -- Assignments expected
    projected_lease_expirations INTEGER DEFAULT 0, -- Returns expected
    projected_qualifications INTEGER DEFAULT 0,   -- TQs due
    
    -- Resulting budget impact
    projected_running_repairs DECIMAL(14,2),
    projected_service_events DECIMAL(14,2),
    
    -- Notes from S&OP meeting
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(snapshot_month, target_month)
);

-- This lets you track how the plan changed over time:
-- "In January S&OP, we expected 150 returns in April"
-- "In February S&OP, we revised to 180 returns in April"

Revised Maintenance Forecast
sql-- Updated forecast view combining both budget types
CREATE OR REPLACE VIEW maintenance_forecast_v2 AS

-- Running Repairs Summary
SELECT 
    rrb.fiscal_year,
    'Running Repairs' AS budget_type,
    NULL AS event_type,
    SUM(rrb.monthly_budget) AS total_budget,
    SUM(rrb.actual_spend) AS actual_cost,
    
    -- Planned = running repairs on cars currently in shop (from allocations)
    COALESCE(rr_planned.planned_cost, 0) AS planned_cost,
    
    SUM(rrb.monthly_budget) - COALESCE(rr_planned.planned_cost, 0) - SUM(rrb.actual_spend) AS remaining_budget

FROM running_repairs_budget rrb
LEFT JOIN (
    SELECT 
        EXTRACT(YEAR FROM a.created_at) AS fiscal_year,
        SUM(a.estimated_cost) AS planned_cost
    FROM allocations a
    JOIN demands d ON a.demand_id = d.id
    WHERE d.work_type = 'Running Repair'
      AND a.status IN ('Planned', 'InTransit', 'InShop')
    GROUP BY EXTRACT(YEAR FROM a.created_at)
) rr_planned ON rrb.fiscal_year = rr_planned.fiscal_year
GROUP BY rrb.fiscal_year, rr_planned.planned_cost

UNION ALL

-- Service Event Summary (by event type)
SELECT 
    seb.fiscal_year,
    'Service Event' AS budget_type,
    seb.event_type,
    SUM(seb.total_budget) AS total_budget,
    COALESCE(actual.actual_cost, 0) AS actual_cost,
    COALESCE(planned.planned_cost, 0) AS planned_cost,
    SUM(seb.total_budget) - COALESCE(planned.planned_cost, 0) - COALESCE(actual.actual_cost, 0) AS remaining_budget

FROM service_event_budget seb

-- Planned costs
LEFT JOIN (
    SELECT 
        d.fiscal_year,
        d.work_type AS event_type,
        SUM(a.estimated_cost) AS planned_cost
    FROM allocations a
    JOIN demands d ON a.demand_id = d.id
    WHERE a.status IN ('Planned', 'InTransit', 'InShop')
    GROUP BY d.fiscal_year, d.work_type
) planned ON seb.fiscal_year = planned.fiscal_year AND seb.event_type = planned.event_type

-- Actual costs
LEFT JOIN (
    SELECT 
        d.fiscal_year,
        d.work_type AS event_type,
        SUM(a.actual_cost) AS actual_cost
    FROM allocations a
    JOIN demands d ON a.demand_id = d.id
    WHERE a.status = 'Complete' AND a.actual_cost IS NOT NULL
    GROUP BY d.fiscal_year, d.work_type
) actual ON seb.fiscal_year = actual.fiscal_year AND seb.event_type = actual.event_type

GROUP BY seb.fiscal_year, seb.event_type, planned.planned_cost, actual.actual_cost;
```

---

## **Updated UI: Budget Input Screen**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAINTENANCE BUDGET - FY2026                                          [Edit] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RUNNING REPAIRS                                                            │
│  ────────────────                                                           │
│  Allocation per Car/Month: [$150.00    ]                                   │
│                                                                             │
│  │ Month    │ Cars on Lease │ Monthly Budget │ Actual │ Remaining │        │
│  ├──────────┼───────────────┼────────────────┼────────┼───────────┤        │
│  │ Jan 2026 │    45,000     │   $6,750,000   │ $5.2M  │   $1.55M  │        │
│  │ Feb 2026 │    45,200     │   $6,780,000   │ $4.8M  │   $1.98M  │        │
│  │ Mar 2026 │    45,500     │   $6,825,000   │   —    │   $6.83M  │        │
│  │ ...      │               │                │        │           │        │
│  ├──────────┼───────────────┼────────────────┼────────┼───────────┤        │
│  │ TOTAL    │               │  $81,000,000   │ $10.0M │  $71.0M   │        │
│  └──────────┴───────────────┴────────────────┴────────┴───────────┘        │
│                                                                             │
│  SERVICE EVENTS                                                             │
│  ──────────────                                                             │
│                                                                             │
│  │ Event Type    │ Cars │ Avg $/Car │ Total Budget │ Planned │ Actual │ Remaining │
│  ├───────────────┼──────┼───────────┼──────────────┼─────────┼────────┼───────────┤
│  │ Qualification │ 2,500│  $35,000  │  $87,500,000 │  $42M   │  $18M  │   $27.5M  │
│  │ Assignment    │ 3,600│  $28,000  │ $100,800,000 │  $65M   │  $22M  │   $13.8M  │
│  │ Return        │ 4,000│  $22,000  │  $88,000,000 │  $38M   │  $15M  │   $35.0M  │
│  ├───────────────┼──────┼───────────┼──────────────┼─────────┼────────┼───────────┤
│  │ TOTAL         │10,100│           │ $276,300,000 │ $145M   │  $55M  │   $76.3M  │
│  └───────────────┴──────┴───────────┴──────────────┴─────────┴────────┴───────────┘
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════    │
│  TOTAL MAINTENANCE BUDGET:     $357,300,000                                 │
│  TOTAL COMMITTED (Plan+Actual): $210,000,000                                │
│  REMAINING:                     $147,300,000  (41% available)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## **How S&OP Changes Flow Through**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         S&OP → BUDGET FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. MONTHLY S&OP MEETING                                                    │
│     ─────────────────────                                                   │
│     Portfolio team provides:                                                │
│     • Updated lease count projections (by month)                            │
│     • New deals closing (assignments)                                       │
│     • Lease expirations (returns)                                           │
│                                                                             │
│                    ↓                                                        │
│                                                                             │
│  2. S&OP SNAPSHOT SAVED                                                     │
│     ─────────────────────                                                   │
│     System records "as of February 2026 S&OP":                              │
│     • April expected cars on lease: 46,200                                  │
│     • April expected assignments: 320                                       │
│     • April expected returns: 280                                           │
│                                                                             │
│                    ↓                                                        │
│                                                                             │
│  3. BUDGET AUTO-UPDATES                                                     │
│     ─────────────────────                                                   │
│     Running Repairs budget recalculates:                                    │
│     • April = 46,200 × $150 = $6,930,000 (was $6,750,000)                  │
│                                                                             │
│     Service Event counts update:                                            │
│     • Assignment forecast: +320 cars for April                              │
│     • Return forecast: +280 cars for April                                  │
│                                                                             │
│                    ↓                                                        │
│                                                                             │
│  4. DEMAND FORECASTS CREATED/UPDATED                                        │
│     ─────────────────────────────────                                       │
│     System creates demands:                                                 │
│     • "April 2026 Assignments" - 320 cars                                   │
│     • "April 2026 Returns" - 280 cars                                       │
│                                                                             │
│                    ↓                                                        │
│                                                                             │
│  5. PLANNING GRID REFLECTS NEW DEMAND                                       │
│     ─────────────────────────────────                                       │
│     Planner sees 600 more cars to allocate in April                         │
│     Runs allocation scenarios                                               │
│     Commits allocations to shops                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

flowchart TD
    %% Main Hierarchy
    Customer[Customer<br>(Company / Entity)] -->|Signs| MasterLease[Master Lease Agreement<br>(Lease ID, Start/End Date, Terms, Rates, General Conditions)]

    MasterLease -->|Can Have Multiple| Rider[Rider / Schedule<br>(Specific Cars or Groups Attached)<br>(Rider ID, Car List, Rider-Specific Terms)]

    Rider -->|Can Be Modified| Amendment[Lease Amendment<br>(Changes to Rider or Master: Add/Remove Cars, Rate Changes, Extension, etc.)<br>(Amendment ID, Effective Date, Changes)]

    Amendment -->|Applies To| Cars[Cars / Railcars<br>(Individual or Batched Cars)<br>(Car Mark/Number, VIN, DOT Spec, Qual Dates, Current Status)]

    %% Navigation Flow (Clickable Cards on Fleet Page)
    subgraph "Fleet Page Card Navigation Flow"
        FleetPage[Fleet Dashboard / Pipeline View] --> CustomerCard[Customer Card<br>(Name, Fleet Size, Active Leases, Total Cars)]
        CustomerCard -->|Click| MasterLeaseCards[Master Lease Cards<br>(List of Master Leases for Customer)<br>(Lease ID, Status, Start/End, Total Riders)]
        MasterLeaseCards -->|Click| RiderCards[Rider Cards<br>(List of Riders under Lease)<br>(Rider ID, Attached Cars, Rider Terms)]
        RiderCards -->|Click| AmendmentCards[Amendment Cards<br>(List of Amendments for Rider/Lease)<br>(Amendment ID, Effective Date, Changes Summary)]
        AmendmentCards -->|Click| CarCards[Individual Car Cards<br>(Car Details, Current Status, Qual Due, Shop History, Actions)]
    end

    %% Relationships Back to Hierarchy
    CustomerCard -.-> Customer
    MasterLeaseCards -.-> MasterLease
    RiderCards -.-> Rider
    AmendmentCards -.-> Amendment
    CarCards -.-> Cars

    %% Styling
    classDef customer fill:#d1e7ff,stroke:#007bff,stroke-width:2px
    classDef lease fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    classDef rider fill:#d4edda,stroke:#28a745,stroke-width:2px
    classDef amendment fill:#f8d7da,stroke:#dc3545,stroke-width:2px
    classDef cars fill:#e2e3e5,stroke:#6c757d,stroke-width:2px
    classDef nav fill:#f0f4ff,stroke:#4d7cff,dasharray: 5 5

    class Customer customer
    class MasterLease lease
    class Rider rider
    class Amendment amendment
    class Cars cars
    class FleetPage,CustomerCard,MasterLeaseCards,RiderCards,AmendmentCards,CarCards nav
. The "Integrated Allocation" Layout
Instead of two separate tables, the goal is to show how Car Allocations consume Shop Capacity in real-time.

The "Split-Pane" Interface
Left Pane (The Demand): Keep the Car Allocations list but add a "Drag-and-Drop" handle to each car row.

Right Pane (The Supply): Show a condensed Shop Capacity Grid.

The Action: A user drags a car (like INGX770101) from the left and drops it into a specific shop/month cell (like AITX-BRK / Feb) on the right.

2. Dynamic Capacity Feedback
As cars are assigned, the Shop Capacity Grid should update instantly to prevent overbooking:

Real-time Math: If a shop has a 0/50 capacity and you assign 5 cars, the cell should immediately update to 5/50.

Visual Warnings: If a shop hits 51/50, the cell should turn Red immediately to signal a bottleneck.

3. Simplified "Fleet-to-Shop" Filtering
With 668 shops and 100k cars, finding the right match is the hardest part.

Proximity Filter: Add a "Smart Suggest" filter. When a car is selected, highlight only the shops in the Capacity Grid that are within a certain rail-mile radius or on the car's current route.

Capability Match: If a car needs a "Tank Qual" (from your Demand Forecasts), the grid should automatically gray out shops that don't perform that specific service.

4. Technical "Definition of Done" for Developers
Since we're moving the budget and demand away, here is the checklist for this specific Shop Loading Tool:

[ ] Virtual Grid: The Shop Capacity Grid must support horizontal and vertical sticky headers so users don't lose track of which Shop or Month they are looking at.

[ ] State Sync: Moving a car from "To Be Routed" to a shop via the [Shop Now] button must decrement the available capacity in the shops database table.

[ ] Bulk Drag: Users must be able to select multiple cars (e.g., all 12 cars for Q1 Tank Quals - Jan) and drop them into a shop at once.

[ ] Hover Details: Hovering over a capacity cell (e.g., 10/50) should trigger a tooltip listing the specific Car Numbers already assigned to that slot.

