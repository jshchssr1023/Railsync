-- ============================================================================
-- Migration 069: Cars + Contracts Information Architecture
-- ============================================================================
-- Implements:
--   1A: Scraps table + state machine + history
--   1B: Operational status group on cars
--   1C: CCM status column + publish lifecycle
--   1D: Assignment source extension (triage, lease_prep)
--   1E: Data backfill
-- ============================================================================

-- ============================================================================
-- 1A: SCRAPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS scraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Car reference (dual FK pattern used across codebase)
  car_id UUID NOT NULL,
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),

  -- Status lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'proposed' CHECK (status IN (
    'proposed',       -- Planner proposes scrap from triage
    'under_review',   -- Manager begins review
    'approved',       -- Manager approves
    'scheduled',      -- Facility and date assigned
    'in_progress',    -- Car at scrap facility, work underway
    'completed',      -- Scrapped — IRREVERSIBLE
    'cancelled'       -- Withdrawn or rejected
  )),

  -- Proposal details
  reason TEXT NOT NULL,
  estimated_salvage_value DECIMAL(12,2),
  actual_salvage_value DECIMAL(12,2),

  -- Scheduling
  facility_code VARCHAR(20) REFERENCES shops(shop_code),
  target_date DATE,
  completion_date DATE,
  completion_notes TEXT,

  -- Workflow actors
  proposed_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  scheduled_by UUID REFERENCES users(id),
  scheduled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,

  -- Audit
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraps_car_number ON scraps(car_number);
CREATE INDEX IF NOT EXISTS idx_scraps_status ON scraps(status);
CREATE INDEX IF NOT EXISTS idx_scraps_active ON scraps(status)
  WHERE status NOT IN ('completed', 'cancelled');

-- ============================================================================
-- 1A-ii: SCRAP STATE HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS scrap_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrap_id UUID NOT NULL REFERENCES scraps(id) ON DELETE CASCADE,
  from_state VARCHAR(20),
  to_state VARCHAR(20) NOT NULL,
  changed_by_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrap_history_scrap ON scrap_state_history(scrap_id);

-- ============================================================================
-- 1A-iii: SCRAP STATE MACHINE TRIGGER
-- Pattern: 027_shopping_workflow.sql enforce_shopping_event_state_transition()
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_scrap_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "proposed":      ["under_review", "cancelled"],
    "under_review":  ["approved", "cancelled"],
    "approved":      ["scheduled"],
    "scheduled":     ["in_progress", "cancelled"],
    "in_progress":   ["completed"]
  }'::JSONB;
  allowed_next JSONB;
BEGIN
  -- Skip if status not changing
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Cannot transition from terminal states
  IF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state: %', OLD.status;
  END IF;

  -- Cancellation requires a reason
  IF NEW.status = 'cancelled' AND (NEW.cancellation_reason IS NULL OR NEW.cancellation_reason = '') THEN
    RAISE EXCEPTION 'Cancellation reason is required for scrap cancellation';
  END IF;

  -- Check valid transitions
  allowed_next := valid_transitions -> OLD.status;
  IF allowed_next IS NULL OR NOT allowed_next ? NEW.status THEN
    RAISE EXCEPTION 'Invalid scrap status transition: % -> %', OLD.status, NEW.status;
  END IF;

  -- Auto-set timestamps based on new status
  IF NEW.status = 'under_review' THEN
    NEW.reviewed_at := NOW();
  ELSIF NEW.status = 'approved' THEN
    NEW.approved_at := NOW();
  ELSIF NEW.status = 'scheduled' THEN
    NEW.scheduled_at := NOW();
  ELSIF NEW.status = 'cancelled' THEN
    NEW.cancelled_at := NOW();
  ELSIF NEW.status = 'completed' THEN
    NEW.completed_at := NOW();
  END IF;

  -- Increment version
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_scrap_status
  BEFORE UPDATE OF status ON scraps
  FOR EACH ROW
  EXECUTE FUNCTION enforce_scrap_status_transition();

-- ============================================================================
-- 1A-iv: SCRAP STATE HISTORY LOGGING TRIGGER (AFTER UPDATE)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_scrap_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO scrap_state_history (
      scrap_id, from_state, to_state, changed_by_id, notes
    ) VALUES (
      NEW.id, OLD.status, NEW.status,
      CASE
        WHEN NEW.status = 'under_review' THEN NEW.reviewed_by
        WHEN NEW.status = 'approved' THEN NEW.approved_by
        WHEN NEW.status = 'scheduled' THEN NEW.scheduled_by
        WHEN NEW.status = 'cancelled' THEN NEW.cancelled_by
        WHEN NEW.status = 'completed' THEN NEW.completed_by
        ELSE NULL
      END,
      CASE
        WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason
        WHEN NEW.status = 'completed' THEN NEW.completion_notes
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_scrap_state_log
  AFTER UPDATE OF status ON scraps
  FOR EACH ROW
  EXECUTE FUNCTION log_scrap_state_change();

-- ============================================================================
-- 1A-v: SCRAP INITIAL STATE LOGGING TRIGGER (AFTER INSERT)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_scrap_initial_state()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO scrap_state_history (
    scrap_id, from_state, to_state, changed_by_id
  ) VALUES (
    NEW.id, NULL, NEW.status, NEW.proposed_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_scrap_initial_state
  AFTER INSERT ON scraps
  FOR EACH ROW
  EXECUTE FUNCTION log_scrap_initial_state();

-- ============================================================================
-- 1A-vi: SCRAP IMMUTABILITY GUARD — Block updates on completed scraps
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_completed_scrap_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'Completed scraps are immutable and cannot be updated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_scrap_immutable
  BEFORE UPDATE ON scraps
  FOR EACH ROW
  EXECUTE FUNCTION prevent_completed_scrap_update();

-- ============================================================================
-- 1B: OPERATIONAL STATUS GROUP ON CARS
-- ============================================================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS operational_status_group VARCHAR(30)
  DEFAULT 'idle_storage';

-- Add CHECK constraint (use DO block since ALTER TABLE ADD CONSTRAINT IF NOT EXISTS
-- is not available in all PG versions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cars_operational_status_group'
  ) THEN
    ALTER TABLE cars ADD CONSTRAINT chk_cars_operational_status_group
      CHECK (operational_status_group IS NULL OR operational_status_group IN (
        'in_shop', 'idle_storage', 'ready_to_load', 'pending'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cars_operational_status_group
  ON cars(operational_status_group)
  WHERE operational_status_group IS NOT NULL;

-- ============================================================================
-- 1C: CCM STATUS COLUMN + PUBLISH LIFECYCLE
-- ============================================================================

-- Add status column (nullable first, backfill, then set NOT NULL)
ALTER TABLE ccm_forms ADD COLUMN IF NOT EXISTS status VARCHAR(20);

-- Backfill from existing is_current boolean
UPDATE ccm_forms SET status = CASE
  WHEN is_current = TRUE THEN 'current'
  ELSE 'archived'
END
WHERE status IS NULL;

-- Set default and NOT NULL
ALTER TABLE ccm_forms ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE ccm_forms ALTER COLUMN status SET NOT NULL;

-- Add CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ccm_forms_status'
  ) THEN
    ALTER TABLE ccm_forms ADD CONSTRAINT chk_ccm_forms_status
      CHECK (status IN ('draft', 'current', 'archived'));
  END IF;
END $$;

-- Add publish tracking columns
ALTER TABLE ccm_forms ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE ccm_forms ADD COLUMN IF NOT EXISTS published_by_id UUID REFERENCES users(id);

-- Backfill published_at for existing current forms
UPDATE ccm_forms SET published_at = updated_at
WHERE status = 'current' AND published_at IS NULL;

-- Unique partial index: only one 'current' per lessee_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccm_forms_one_current_per_lessee
  ON ccm_forms(lessee_code)
  WHERE status = 'current';

-- ============================================================================
-- 1D: ASSIGNMENT SOURCE EXTENSION
-- ============================================================================

-- Add 'triage' and 'lease_prep' to the source CHECK constraint.
-- Must drop and recreate since ALTER CONSTRAINT is not supported.
ALTER TABLE car_assignments DROP CONSTRAINT IF EXISTS chk_ca_source;
ALTER TABLE car_assignments ADD CONSTRAINT chk_ca_source
  CHECK (source IN (
    'demand_plan', 'service_plan', 'scenario_export',
    'bad_order', 'quick_shop', 'import',
    'master_plan', 'migration',
    'triage', 'lease_prep'
  ));

-- ============================================================================
-- 1E: DATA BACKFILL — Set operational_status_group for existing cars
-- ============================================================================

-- Cars with active (non-terminal) shopping events → 'in_shop'
UPDATE cars c SET operational_status_group = 'in_shop'
WHERE EXISTS (
  SELECT 1 FROM shopping_events se
  WHERE se.car_number = c.car_number
    AND se.state NOT IN ('RELEASED', 'CANCELLED')
)
AND c.is_active = TRUE;

-- All other active cars default to 'idle_storage' (already the default,
-- but explicit for clarity)
UPDATE cars SET operational_status_group = 'idle_storage'
WHERE operational_status_group IS NULL
  AND is_active = TRUE;

-- Inactive cars: NULL status group (not part of fleet overview)
UPDATE cars SET operational_status_group = NULL
WHERE is_active = FALSE;

-- ============================================================================
-- ACTIVE SCRAPS VIEW (for dashboard queries)
-- ============================================================================

CREATE OR REPLACE VIEW v_active_scraps AS
SELECT
  s.*,
  c.product_code AS car_type,
  c.material_type,
  c.lessee_code,
  c.owner_code,
  (u_prop.first_name || ' ' || u_prop.last_name) AS proposed_by_name,
  (u_rev.first_name || ' ' || u_rev.last_name) AS reviewed_by_name,
  (u_appr.first_name || ' ' || u_appr.last_name) AS approved_by_name,
  sh.shop_name AS facility_name,
  EXTRACT(DAY FROM NOW() - s.created_at)::INTEGER AS days_since_proposed
FROM scraps s
JOIN cars c ON c.car_number = s.car_number
LEFT JOIN users u_prop ON u_prop.id = s.proposed_by
LEFT JOIN users u_rev ON u_rev.id = s.reviewed_by
LEFT JOIN users u_appr ON u_appr.id = s.approved_by
LEFT JOIN shops sh ON sh.shop_code = s.facility_code
WHERE s.status NOT IN ('completed', 'cancelled');

-- ============================================================================
-- END OF MIGRATION 069
-- ============================================================================
