-- Phase 13: Status Automation & Pipeline View
-- Migration: 006_phase13_automation.sql

-- Extend allocations for automation tracking
ALTER TABLE allocations
    ADD COLUMN IF NOT EXISTS last_shopping_date DATE,
    ADD COLUMN IF NOT EXISTS plan_status_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    ADD COLUMN IF NOT EXISTS needs_shopping_reason TEXT;

-- Add pipeline status for better bucket categorization
ALTER TABLE allocations
    ADD COLUMN IF NOT EXISTS pipeline_status VARCHAR(30) DEFAULT 'backlog'
        CHECK (pipeline_status IN ('backlog', 'pipeline', 'active', 'healthy', 'complete'));

-- Update pipeline_status based on current_status
UPDATE allocations SET pipeline_status =
    CASE
        WHEN current_status IN ('planned', 'scheduled') AND shop_code IS NULL THEN 'backlog'
        WHEN current_status = 'scheduled' AND shop_code IS NOT NULL THEN 'pipeline'
        WHEN current_status IN ('enroute', 'in_shop') THEN 'active'
        WHEN current_status = 'completed' THEN 'complete'
        ELSE 'backlog'
    END
WHERE pipeline_status = 'backlog' OR pipeline_status IS NULL;

-- Pipeline buckets view
CREATE OR REPLACE VIEW v_pipeline_buckets AS
SELECT
    pipeline_status,
    COUNT(*) as car_count,
    COALESCE(SUM(CAST(estimated_cost AS DECIMAL)), 0) as total_estimated_cost,
    COALESCE(SUM(CAST(actual_cost AS DECIMAL)), 0) as total_actual_cost
FROM allocations
WHERE status NOT IN ('Released', 'cancelled')
GROUP BY pipeline_status
ORDER BY
    CASE pipeline_status
        WHEN 'backlog' THEN 1
        WHEN 'pipeline' THEN 2
        WHEN 'active' THEN 3
        WHEN 'healthy' THEN 4
        WHEN 'complete' THEN 5
    END;

-- Detailed backlog view (cars needing shopping)
CREATE OR REPLACE VIEW v_backlog_cars AS
SELECT
    a.id,
    a.car_id,
    c.car_number,
    c.car_mark,
    c.product_code,
    a.current_status,
    a.needs_shopping_reason,
    a.plan_status_year,
    a.last_shopping_date,
    a.target_month,
    a.created_at
FROM allocations a
LEFT JOIN cars c ON a.car_id = c.id
WHERE a.pipeline_status = 'backlog'
    AND a.status NOT IN ('Released', 'cancelled')
ORDER BY
    CASE a.current_status
        WHEN 'planned' THEN 1
        WHEN 'scheduled' THEN 2
        ELSE 3
    END,
    a.target_month;

-- Pipeline cars view (cars with shop assigned, not yet active)
CREATE OR REPLACE VIEW v_pipeline_cars AS
SELECT
    a.id,
    a.car_id,
    c.car_number,
    c.car_mark,
    c.product_code,
    a.shop_code,
    s.shop_name,
    a.current_status,
    a.target_month,
    a.estimated_cost
FROM allocations a
LEFT JOIN cars c ON a.car_id = c.id
LEFT JOIN shops s ON a.shop_code = s.shop_code
WHERE a.pipeline_status = 'pipeline'
    AND a.status NOT IN ('Released', 'cancelled')
ORDER BY a.target_month;

-- Active cars view (in shop or enroute)
CREATE OR REPLACE VIEW v_active_cars AS
SELECT
    a.id,
    a.car_id,
    c.car_number,
    c.car_mark,
    c.product_code,
    a.shop_code,
    s.shop_name,
    a.current_status,
    a.enroute_date,
    a.target_month,
    a.estimated_cost,
    a.actual_cost
FROM allocations a
LEFT JOIN cars c ON a.car_id = c.id
LEFT JOIN shops s ON a.shop_code = s.shop_code
WHERE a.pipeline_status = 'active'
    AND a.status NOT IN ('Released', 'cancelled')
ORDER BY
    CASE a.current_status
        WHEN 'enroute' THEN 1
        WHEN 'in_shop' THEN 2
        ELSE 3
    END,
    a.enroute_date;

-- Healthy cars view (completed in current plan year)
CREATE OR REPLACE VIEW v_healthy_cars AS
SELECT
    a.id,
    a.car_id,
    c.car_number,
    c.car_mark,
    c.product_code,
    a.shop_code,
    s.shop_name,
    a.last_shopping_date,
    a.plan_status_year,
    a.actual_cost
FROM allocations a
LEFT JOIN cars c ON a.car_id = c.id
LEFT JOIN shops s ON a.shop_code = s.shop_code
WHERE a.pipeline_status IN ('healthy', 'complete')
    AND a.status NOT IN ('cancelled')
ORDER BY a.last_shopping_date DESC;

-- Update seed data with pipeline-relevant fields
UPDATE allocations
SET needs_shopping_reason = 'TANK QUALIFICATION'
WHERE needs_shopping_reason IS NULL
  AND work_type = 'QUAL';

UPDATE allocations
SET needs_shopping_reason = 'RUNNING REPAIR'
WHERE needs_shopping_reason IS NULL
  AND work_type = 'REPAIR';

-- Add index for pipeline queries
CREATE INDEX IF NOT EXISTS idx_allocations_pipeline ON allocations(pipeline_status, current_status);
