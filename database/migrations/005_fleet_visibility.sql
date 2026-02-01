-- Phase 12: Fleet Visibility & Budget Tracking
-- Migration: 005_fleet_visibility.sql

-- Extend allocations for detailed status tracking
ALTER TABLE allocations
    ADD COLUMN IF NOT EXISTS current_status VARCHAR(20) DEFAULT 'planned'
        CHECK (current_status IN ('planned','scheduled','enroute','in_shop','dispo','completed')),
    ADD COLUMN IF NOT EXISTS enroute_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispo_date TIMESTAMPTZ;

-- Update existing allocations with current_status based on status
UPDATE allocations SET current_status =
    CASE
        WHEN status IN ('Arrived', 'Complete') THEN 'in_shop'
        WHEN status = 'Enroute' THEN 'enroute'
        WHEN status IN ('Planned Shopping', 'To Be Routed') THEN 'scheduled'
        WHEN status = 'Released' THEN 'completed'
        ELSE 'planned'
    END
WHERE current_status IS NULL OR current_status = 'planned';

-- Fleet summary view
CREATE OR REPLACE VIEW v_fleet_summary AS
SELECT
    COUNT(*) FILTER (WHERE current_status = 'in_shop') AS in_shop_count,
    COUNT(*) FILTER (WHERE current_status IN ('planned','proposed')) AS planned_count,
    COUNT(*) FILTER (WHERE current_status = 'enroute') AS enroute_count,
    COUNT(*) FILTER (WHERE current_status = 'dispo') AS dispo_count,
    COUNT(*) FILTER (WHERE current_status = 'scheduled') AS scheduled_count,
    COUNT(*) FILTER (WHERE current_status = 'completed') AS completed_count,
    COUNT(*) AS total_fleet,
    COALESCE(SUM(CAST(estimated_cost AS DECIMAL)), 0) AS total_planned_cost,
    COALESCE(SUM(CAST(actual_cost AS DECIMAL)), 0) AS total_actual_cost
FROM allocations
WHERE status NOT IN ('Released', 'cancelled');

-- Monthly volumes view
CREATE OR REPLACE VIEW v_monthly_volumes AS
SELECT
    a.target_month as month,
    COUNT(*) FILTER (WHERE current_status = 'in_shop') AS in_shop,
    COUNT(*) FILTER (WHERE current_status = 'planned') AS planned,
    COUNT(*) FILTER (WHERE current_status = 'scheduled') AS scheduled,
    COUNT(*) FILTER (WHERE current_status = 'enroute') AS enroute,
    COUNT(*) AS total_cars,
    COALESCE(SUM(CAST(a.estimated_cost AS DECIMAL)), 0) AS planned_cost,
    COALESCE(SUM(CAST(a.actual_cost AS DECIMAL)), 0) AS actual_cost,
    rb.total_budget AS budget_amount,
    rb.actual_spend AS budget_spent
FROM allocations a
LEFT JOIN running_repairs_budget rb ON a.target_month = rb.month
GROUP BY a.target_month, rb.total_budget, rb.actual_spend
ORDER BY a.target_month;

-- Tier summary view (by shop tier)
CREATE OR REPLACE VIEW v_tier_summary AS
SELECT
    COALESCE(s.tier, 1) as tier,
    COUNT(*) FILTER (WHERE a.current_status = 'in_shop') AS in_shop_count,
    COUNT(*) FILTER (WHERE a.current_status = 'planned') AS planned_count,
    COUNT(*) AS total_count
FROM allocations a
JOIN shops s ON a.shop_code = s.shop_code
WHERE a.status NOT IN ('Released', 'cancelled')
GROUP BY s.tier
ORDER BY s.tier;

-- Add sample data for current month
INSERT INTO running_repairs_budget (month, active_cars, budget_per_car, actual_spend)
VALUES
    ('2026-01', 1200, 450.00, 485000.00),
    ('2026-02', 1250, 450.00, 125000.00),
    ('2026-03', 1300, 450.00, 0.00)
ON CONFLICT (month) DO NOTHING;
