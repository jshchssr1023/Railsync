-- Migration 036: Master Plan Allocations
-- Links allocations directly to master plans, enables plan-based car management

-- 1a. Add plan_id FK to allocations so allocations belong to a specific plan
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES master_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_allocations_plan_id ON allocations(plan_id);

-- 1b. Make shop_code nullable so cars can be added to a plan before shop assignment
ALTER TABLE allocations ALTER COLUMN shop_code DROP NOT NULL;

-- 1c. Update v_master_plan_summary to use live allocation counts (by plan_id)
DROP VIEW IF EXISTS v_master_plan_summary;
CREATE VIEW v_master_plan_summary AS
SELECT
    mp.id,
    mp.name,
    mp.description,
    mp.fiscal_year,
    mp.planning_month,
    mp.status,
    mp.created_by,
    mp.created_at,
    mp.updated_at,
    COUNT(DISTINCT mpv.id) AS version_count,
    MAX(mpv.version_number) AS latest_version,
    (SELECT COUNT(*)
     FROM allocations a
     WHERE a.plan_id = mp.id
       AND a.status NOT IN ('cancelled', 'Released')
    ) AS current_allocation_count,
    (SELECT COALESCE(SUM(a.estimated_cost), 0)
     FROM allocations a
     WHERE a.plan_id = mp.id
       AND a.status NOT IN ('cancelled', 'Released')
    ) AS current_estimated_cost
FROM master_plans mp
LEFT JOIN master_plan_versions mpv ON mp.id = mpv.plan_id
GROUP BY mp.id, mp.name, mp.description, mp.fiscal_year, mp.planning_month,
         mp.status, mp.created_by, mp.created_at, mp.updated_at;

-- 1d. Replace create_plan_version_snapshot() to snapshot only plan-specific allocations
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
