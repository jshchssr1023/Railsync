-- Migration 009: S&OP Monthly Planning
-- Phase 16: Sales & Operations Planning support

-- ============================================================================
-- S&OP MONTHLY SNAPSHOT
-- Captures the "as of this month" view of expected leases
-- ============================================================================

CREATE TABLE IF NOT EXISTS sop_monthly_snapshot (
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

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sop_snapshot_month ON sop_monthly_snapshot(snapshot_month);
CREATE INDEX IF NOT EXISTS idx_sop_target_month ON sop_monthly_snapshot(target_month);
CREATE INDEX IF NOT EXISTS idx_sop_fiscal_year ON sop_monthly_snapshot(fiscal_year);

-- ============================================================================
-- MAINTENANCE FORECAST V2 VIEW
-- Combines Running Repairs and Service Event budgets
-- ============================================================================

CREATE OR REPLACE VIEW v_maintenance_forecast_v2 AS

-- Running Repairs Summary
SELECT
    rrb.fiscal_year,
    'Running Repairs' AS budget_type,
    NULL::VARCHAR AS event_type,
    SUM(rrb.monthly_budget) AS total_budget,
    SUM(COALESCE(rrb.actual_spend, 0)) AS actual_cost,

    -- Planned = running repairs on cars currently in shop (from car_assignments)
    COALESCE(rr_planned.planned_cost, 0) AS planned_cost,

    SUM(rrb.monthly_budget) - COALESCE(rr_planned.planned_cost, 0) - SUM(COALESCE(rrb.actual_spend, 0)) AS remaining_budget

FROM running_repairs_budget rrb
LEFT JOIN (
    SELECT
        EXTRACT(YEAR FROM ca.created_at)::INTEGER AS fiscal_year,
        SUM(ca.estimated_cost) AS planned_cost
    FROM car_assignments ca
    WHERE ca.status IN ('Planned', 'Scheduled', 'Enroute', 'InShop')
    GROUP BY EXTRACT(YEAR FROM ca.created_at)
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

-- Planned costs from car_assignments
LEFT JOIN (
    SELECT
        EXTRACT(YEAR FROM ca.created_at)::INTEGER AS fiscal_year,
        CASE
            WHEN ca.source = 'service_plan' THEN 'Assignment'
            WHEN ca.source = 'demand_plan' THEN 'Qualification'
            ELSE 'Return'
        END AS event_type,
        SUM(ca.estimated_cost) AS planned_cost
    FROM car_assignments ca
    WHERE ca.status IN ('Planned', 'Scheduled', 'Enroute', 'InShop')
    GROUP BY EXTRACT(YEAR FROM ca.created_at),
             CASE
                 WHEN ca.source = 'service_plan' THEN 'Assignment'
                 WHEN ca.source = 'demand_plan' THEN 'Qualification'
                 ELSE 'Return'
             END
) planned ON seb.fiscal_year = planned.fiscal_year AND seb.event_type = planned.event_type

-- Actual costs from completed assignments
LEFT JOIN (
    SELECT
        EXTRACT(YEAR FROM ca.completed_at)::INTEGER AS fiscal_year,
        CASE
            WHEN ca.source = 'service_plan' THEN 'Assignment'
            WHEN ca.source = 'demand_plan' THEN 'Qualification'
            ELSE 'Return'
        END AS event_type,
        SUM(ca.actual_cost) AS actual_cost
    FROM car_assignments ca
    WHERE ca.status = 'Complete' AND ca.actual_cost IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM ca.completed_at),
             CASE
                 WHEN ca.source = 'service_plan' THEN 'Assignment'
                 WHEN ca.source = 'demand_plan' THEN 'Qualification'
                 ELSE 'Return'
             END
) actual ON seb.fiscal_year = actual.fiscal_year AND seb.event_type = actual.event_type

GROUP BY seb.fiscal_year, seb.event_type, planned.planned_cost, actual.actual_cost;

-- ============================================================================
-- S&OP BUDGET SUMMARY VIEW
-- Shows budget impact of S&OP projections
-- ============================================================================

CREATE OR REPLACE VIEW v_sop_budget_impact AS
SELECT
    s.snapshot_month,
    s.target_month,
    s.fiscal_year,
    s.projected_cars_on_lease,
    s.projected_new_leases,
    s.projected_lease_expirations,
    s.projected_qualifications,

    -- Calculate running repairs impact
    s.projected_cars_on_lease * 150.00 AS projected_rr_budget,  -- $150/car/month default

    -- Calculate service events impact
    s.projected_new_leases * 28000.00 AS projected_assignment_cost,
    s.projected_lease_expirations * 22000.00 AS projected_return_cost,
    s.projected_qualifications * 35000.00 AS projected_qualification_cost,

    -- Total projected impact
    (s.projected_cars_on_lease * 150.00) +
    (s.projected_new_leases * 28000.00) +
    (s.projected_lease_expirations * 22000.00) +
    (s.projected_qualifications * 35000.00) AS total_projected_cost,

    s.notes,
    s.created_at
FROM sop_monthly_snapshot s
ORDER BY s.snapshot_month DESC, s.target_month;

-- ============================================================================
-- SEED DEMO DATA
-- ============================================================================

-- Insert sample S&OP snapshots for demo
INSERT INTO sop_monthly_snapshot (snapshot_month, fiscal_year, target_month, projected_cars_on_lease, projected_new_leases, projected_lease_expirations, projected_qualifications, projected_running_repairs, projected_service_events, notes)
VALUES
    -- January 2026 S&OP meeting projections
    ('2026-01', 2026, '2026-02', 45000, 300, 250, 200, 6750000, 15750000, 'Q1 baseline projection'),
    ('2026-01', 2026, '2026-03', 45050, 320, 270, 210, 6757500, 16870000, 'Q1 baseline projection'),
    ('2026-01', 2026, '2026-04', 45100, 340, 290, 220, 6765000, 18020000, 'Q1 baseline projection'),

    -- February 2026 S&OP meeting - revised projections
    ('2026-02', 2026, '2026-03', 45200, 350, 280, 215, 6780000, 17475000, 'Revised - new deals added'),
    ('2026-02', 2026, '2026-04', 45400, 380, 300, 230, 6810000, 19190000, 'Revised - new deals added'),
    ('2026-02', 2026, '2026-05', 45600, 360, 310, 225, 6840000, 18665000, 'Revised - new deals added')
ON CONFLICT (snapshot_month, target_month) DO NOTHING;

COMMENT ON TABLE sop_monthly_snapshot IS 'S&OP monthly planning snapshots tracking lease projections over time';
COMMENT ON VIEW v_maintenance_forecast_v2 IS 'Combined maintenance budget forecast showing running repairs and service events';
COMMENT ON VIEW v_sop_budget_impact IS 'Budget impact calculations based on S&OP projections';
