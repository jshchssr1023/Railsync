# Railsync Phas 16
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


