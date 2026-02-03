-- Migration 016: Master Plan Versioning
-- Enables version control for allocation planning scenarios

-- Master plans represent a planning cycle (e.g., monthly S&OP)
CREATE TABLE IF NOT EXISTS master_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    fiscal_year INTEGER NOT NULL,
    planning_month VARCHAR(7) NOT NULL,  -- e.g., "2026-03"
    status VARCHAR(50) NOT NULL DEFAULT 'draft',  -- draft, active, archived
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(fiscal_year, planning_month, name)
);

-- Plan versions track snapshots of allocations at a point in time
CREATE TABLE IF NOT EXISTS master_plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES master_plans(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    label VARCHAR(100),  -- e.g., "Initial Draft", "After Customer Review"
    notes TEXT,
    snapshot_data JSONB NOT NULL,  -- Stores allocation snapshot
    allocation_count INTEGER NOT NULL DEFAULT 0,
    total_estimated_cost DECIMAL(14,2) DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(plan_id, version_number)
);

-- Track which allocations are included in a plan version
CREATE TABLE IF NOT EXISTS master_plan_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES master_plan_versions(id) ON DELETE CASCADE,
    allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
    allocation_snapshot JSONB NOT NULL,  -- Full allocation state at time of snapshot
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(version_id, allocation_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_master_plans_fiscal_year ON master_plans(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_master_plans_status ON master_plans(status);
CREATE INDEX IF NOT EXISTS idx_master_plan_versions_plan_id ON master_plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_master_plan_allocations_version ON master_plan_allocations(version_id);

-- View: Plan summary with version count
CREATE OR REPLACE VIEW v_master_plan_summary AS
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
    COALESCE(latest.allocation_count, 0) AS current_allocation_count,
    COALESCE(latest.total_estimated_cost, 0) AS current_estimated_cost
FROM master_plans mp
LEFT JOIN master_plan_versions mpv ON mp.id = mpv.plan_id
LEFT JOIN LATERAL (
    SELECT allocation_count, total_estimated_cost
    FROM master_plan_versions
    WHERE plan_id = mp.id
    ORDER BY version_number DESC
    LIMIT 1
) latest ON true
GROUP BY mp.id, mp.name, mp.description, mp.fiscal_year, mp.planning_month,
         mp.status, mp.created_by, mp.created_at, mp.updated_at,
         latest.allocation_count, latest.total_estimated_cost;

-- View: Version comparison helper
CREATE OR REPLACE VIEW v_plan_version_comparison AS
SELECT
    mpv.id AS version_id,
    mpv.plan_id,
    mpv.version_number,
    mpv.label,
    mpv.allocation_count,
    mpv.total_estimated_cost,
    mpv.created_at,
    LAG(mpv.allocation_count) OVER (PARTITION BY mpv.plan_id ORDER BY mpv.version_number) AS prev_allocation_count,
    LAG(mpv.total_estimated_cost) OVER (PARTITION BY mpv.plan_id ORDER BY mpv.version_number) AS prev_estimated_cost,
    mpv.allocation_count - COALESCE(LAG(mpv.allocation_count) OVER (PARTITION BY mpv.plan_id ORDER BY mpv.version_number), 0) AS allocation_delta,
    mpv.total_estimated_cost - COALESCE(LAG(mpv.total_estimated_cost) OVER (PARTITION BY mpv.plan_id ORDER BY mpv.version_number), 0) AS cost_delta
FROM master_plan_versions mpv;

-- Function to create a new version snapshot
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

    -- Get current allocations for the planning month
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
    WHERE target_month = (SELECT planning_month FROM master_plans WHERE id = p_plan_id)
      AND status NOT IN ('cancelled', 'complete');

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
    WHERE target_month = (SELECT planning_month FROM master_plans WHERE id = p_plan_id)
      AND status NOT IN ('cancelled', 'complete');

    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update master_plans.updated_at
CREATE OR REPLACE FUNCTION update_master_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE master_plans SET updated_at = NOW() WHERE id = NEW.plan_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_master_plan_timestamp ON master_plan_versions;
CREATE TRIGGER trg_update_master_plan_timestamp
    AFTER INSERT ON master_plan_versions
    FOR EACH ROW EXECUTE FUNCTION update_master_plan_timestamp();
