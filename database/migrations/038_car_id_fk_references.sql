-- Migration 038: Rename Conflicting car_id Columns + Add UUID FKs
-- Renames the existing car_id columns (VARCHAR/random UUID) to car_mark_number,
-- then adds proper car_id UUID FK columns pointing to cars(id).

-- ============================================================
-- 038a: DROP dependent views that reference allocations.car_id
-- ============================================================

DROP VIEW IF EXISTS v_backlog_cars;
DROP VIEW IF EXISTS v_pipeline_cars;
DROP VIEW IF EXISTS v_active_cars;
DROP VIEW IF EXISTS v_healthy_cars;

-- ============================================================
-- 038b: ALLOCATIONS — rename car_id VARCHAR(15) → car_mark_number
-- ============================================================

ALTER TABLE allocations RENAME COLUMN car_id TO car_mark_number;

-- Add proper UUID FK column
ALTER TABLE allocations ADD COLUMN car_id UUID;

-- Backfill from cars table using car_number join
UPDATE allocations a
  SET car_id = c.id
  FROM cars c
  WHERE a.car_number = c.car_number;

-- Add FK constraint
ALTER TABLE allocations
  ADD CONSTRAINT fk_allocations_car_id FOREIGN KEY (car_id) REFERENCES cars(id);

CREATE INDEX IF NOT EXISTS idx_allocations_car_id_uuid ON allocations(car_id);

-- ============================================================
-- 038c: CAR_ASSIGNMENTS — rename car_id UUID (random) → car_mark_number
-- ============================================================

-- Drop the unique-active index that references old car_id column
DROP INDEX IF EXISTS idx_one_active_per_car;

ALTER TABLE car_assignments RENAME COLUMN car_id TO car_mark_number;

-- Add proper UUID FK column
ALTER TABLE car_assignments ADD COLUMN car_id UUID;

-- Backfill from cars table
UPDATE car_assignments ca
  SET car_id = c.id
  FROM cars c
  WHERE ca.car_number = c.car_number;

-- Add FK constraint
ALTER TABLE car_assignments
  ADD CONSTRAINT fk_car_assignments_car_id FOREIGN KEY (car_id) REFERENCES cars(id);

CREATE INDEX IF NOT EXISTS idx_car_assignments_car_id ON car_assignments(car_id);

-- Recreate unique-active constraint using new car_id
CREATE UNIQUE INDEX idx_one_active_per_car ON car_assignments(car_id)
  WHERE status NOT IN ('Complete', 'Cancelled');

-- ============================================================
-- 038d: RECREATE dropped views with updated column names
-- car_id now = UUID, car_mark_number = old composed string
-- ============================================================

CREATE OR REPLACE VIEW v_backlog_cars AS
SELECT
    a.id,
    a.car_id,
    a.car_mark_number,
    a.car_number,
    c.car_mark,
    c.product_code,
    a.current_status,
    a.needs_shopping_reason,
    a.plan_status_year,
    a.last_shopping_date,
    a.target_month,
    a.created_at
FROM allocations a
LEFT JOIN cars c ON a.car_number = c.car_number
WHERE a.pipeline_status = 'backlog'
    AND a.status NOT IN ('Released', 'cancelled')
ORDER BY
    CASE a.current_status
        WHEN 'planned' THEN 1
        WHEN 'scheduled' THEN 2
        ELSE 3
    END,
    a.target_month;

CREATE OR REPLACE VIEW v_pipeline_cars AS
SELECT
    a.id,
    a.car_id,
    a.car_mark_number,
    a.car_number,
    c.car_mark,
    c.product_code,
    a.shop_code,
    s.shop_name,
    a.current_status,
    a.target_month,
    a.estimated_cost
FROM allocations a
LEFT JOIN cars c ON a.car_number = c.car_number
LEFT JOIN shops s ON a.shop_code = s.shop_code
WHERE a.pipeline_status = 'pipeline'
    AND a.status NOT IN ('Released', 'cancelled')
ORDER BY a.target_month;

CREATE OR REPLACE VIEW v_active_cars AS
SELECT
    a.id,
    a.car_id,
    a.car_mark_number,
    a.car_number,
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
LEFT JOIN cars c ON a.car_number = c.car_number
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

CREATE OR REPLACE VIEW v_healthy_cars AS
SELECT
    a.id,
    a.car_id,
    a.car_mark_number,
    a.car_number,
    c.car_mark,
    c.product_code,
    a.shop_code,
    s.shop_name,
    a.last_shopping_date,
    a.plan_status_year,
    a.actual_cost
FROM allocations a
LEFT JOIN cars c ON a.car_number = c.car_number
LEFT JOIN shops s ON a.shop_code = s.shop_code
WHERE a.pipeline_status IN ('healthy', 'complete')
    AND a.status NOT IN ('cancelled')
ORDER BY a.last_shopping_date DESC;

-- ============================================================
-- 038e: UPDATE create_plan_version_snapshot() function
-- Change column references from car_id to car_mark_number in snapshot JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION create_plan_version_snapshot(
    p_plan_id UUID,
    p_label VARCHAR(100) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_version_id UUID;
    v_next_version INTEGER;
    v_allocation_count INTEGER;
    v_total_cost DECIMAL(14,2);
    v_snapshot JSONB;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM master_plan_versions WHERE plan_id = p_plan_id;

    -- Get current allocations belonging to THIS plan (by plan_id)
    SELECT
        COUNT(*),
        COALESCE(SUM(estimated_cost), 0),
        jsonb_agg(jsonb_build_object(
            'id', id,
            'car_id', car_id,
            'car_mark_number', car_mark_number,
            'car_number', car_number,
            'shop_code', shop_code,
            'target_month', target_month,
            'status', status,
            'estimated_cost', estimated_cost,
            'version', version
        ))
    INTO v_allocation_count, v_total_cost, v_snapshot
    FROM allocations
    WHERE plan_id = p_plan_id
      AND status NOT IN ('cancelled');

    -- Create version record
    INSERT INTO master_plan_versions (
        plan_id, version_number, label, notes,
        snapshot_data, allocation_count, total_estimated_cost, created_by
    ) VALUES (
        p_plan_id, v_next_version, p_label, p_notes,
        COALESCE(v_snapshot, '[]'::jsonb), v_allocation_count, v_total_cost, p_created_by
    ) RETURNING id INTO v_version_id;

    -- Store individual allocation snapshots
    INSERT INTO master_plan_allocations (version_id, allocation_id, allocation_snapshot)
    SELECT
        v_version_id,
        id,
        jsonb_build_object(
            'id', id,
            'car_id', car_id,
            'car_mark_number', car_mark_number,
            'car_number', car_number,
            'shop_code', shop_code,
            'target_month', target_month,
            'status', status,
            'estimated_cost', estimated_cost,
            'estimated_cost_breakdown', estimated_cost_breakdown,
            'version', version,
            'created_at', created_at
        )
    FROM allocations
    WHERE plan_id = p_plan_id
      AND status NOT IN ('cancelled');

    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;
