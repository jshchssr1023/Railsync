-- ============================================================================
-- Migration 048: Demand-Plan Unification
-- Adds plan_id FK to demands table so demands can belong to a master plan.
-- ============================================================================

-- Add plan_id FK so demands can belong to a master plan
ALTER TABLE demands ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES master_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_demands_plan_id ON demands(plan_id);

DO $$ BEGIN RAISE NOTICE 'Migration 048 complete: demands.plan_id FK added for plan unification.'; END $$;
