-- 067_master_plans_lifecycle.sql
-- Extends master_plans for full lifecycle management, capacity fit, and communication

-- Add lifecycle columns to master_plans
DO $$ BEGIN
  ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS committed_at TIMESTAMPTZ;
ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS committed_by UUID;
ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS est_start_date DATE;
ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS est_completion_date DATE;
ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS capacity_fit_score INT;
ALTER TABLE master_plans ADD COLUMN IF NOT EXISTS capacity_fit_level VARCHAR(10);

-- Update status check constraint to include new lifecycle statuses
-- First drop existing constraint if it exists
DO $$ BEGIN
  ALTER TABLE master_plans DROP CONSTRAINT IF EXISTS master_plans_status_check;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Add updated constraint
ALTER TABLE master_plans ADD CONSTRAINT master_plans_status_check
  CHECK (status IN ('draft', 'active', 'archived', 'soft_plan', 'locked', 'pending_commitment', 'committed'));

-- Migrate existing 'active' status to 'soft_plan' for proper lifecycle
-- (keeping 'active' as valid value for backward compatibility)

-- Plan communications table for customer communication layer
CREATE TABLE IF NOT EXISTS plan_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES master_plans(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'plan_shared',
  recipient VARCHAR(255),
  subject VARCHAR(500),
  summary_snapshot JSONB NOT NULL DEFAULT '{}',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_communications_plan_id ON plan_communications(plan_id);

-- Add car_type to allocations if not already present
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS car_type VARCHAR(50);

-- Update allocations car_type from cars table where available
UPDATE allocations a
SET car_type = c.car_type
FROM cars c
WHERE a.car_id = c.id AND a.car_type IS NULL;

-- View for plan summary with project info
-- Must DROP first: column order changed (locked_at/locked_by added before created_by)
DROP VIEW IF EXISTS v_master_plan_summary;
CREATE OR REPLACE VIEW v_master_plan_summary AS
SELECT
  mp.id,
  mp.name,
  mp.description,
  mp.fiscal_year,
  mp.planning_month,
  mp.status,
  mp.locked_at,
  mp.locked_by,
  mp.committed_at,
  mp.committed_by,
  mp.est_start_date,
  mp.est_completion_date,
  mp.capacity_fit_score,
  mp.capacity_fit_level,
  mp.created_by,
  mp.created_at,
  mp.updated_at,
  COALESCE(alloc.total_allocations, 0) as current_allocation_count,
  COALESCE(alloc.total_estimated_cost, 0) as current_estimated_cost,
  COALESCE(ver.version_count, 0) as version_count,
  ver.latest_version,
  array_agg(DISTINCT alloc_shops.shop_code) FILTER (WHERE alloc_shops.shop_code IS NOT NULL) as target_shops,
  u.first_name || ' ' || u.last_name as created_by_name
FROM master_plans mp
LEFT JOIN (
  SELECT plan_id,
    COUNT(*)::int as total_allocations,
    COALESCE(SUM(estimated_cost), 0)::numeric as total_estimated_cost
  FROM allocations
  WHERE status NOT IN ('Released')
  GROUP BY plan_id
) alloc ON alloc.plan_id = mp.id
LEFT JOIN (
  SELECT plan_id,
    COUNT(*)::int as version_count,
    MAX(version_number)::int as latest_version
  FROM master_plan_versions
  GROUP BY plan_id
) ver ON ver.plan_id = mp.id
LEFT JOIN allocations alloc_shops ON alloc_shops.plan_id = mp.id AND alloc_shops.shop_code IS NOT NULL
LEFT JOIN users u ON u.id = mp.created_by
GROUP BY mp.id, mp.name, mp.description, mp.fiscal_year, mp.planning_month,
  mp.status, mp.locked_at, mp.locked_by, mp.committed_at, mp.committed_by,
  mp.est_start_date, mp.est_completion_date, mp.capacity_fit_score, mp.capacity_fit_level,
  mp.created_by, mp.created_at, mp.updated_at,
  alloc.total_allocations, alloc.total_estimated_cost,
  ver.version_count, ver.latest_version, u.first_name, u.last_name;
