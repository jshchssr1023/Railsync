-- ============================================================================
-- Migration 079: Unified Shopping Event
-- Phase 1 of the Car Lifecycle Correction Plan (docs/design/car-lifecycle-correction-plan.md)
--
-- Absorbs car_assignments into a single table with one state machine.
-- Creates the derived fleet status view. Both old tables remain untouched
-- during migration — nothing is deleted or renamed.
--
-- Sections:
--   1. shopping_events_v2 table (14-state + CANCELLED)
--   2. State transition trigger (forward-skip, review loops, MRU exception,
--      disposition gating)
--   3. Repair limit fields on estimate_submissions
--   4. v_car_fleet_status derived view (never stored)
-- ============================================================================

-- ============================================================================
-- 1. SHOPPING_EVENTS_V2 TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_events_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_number VARCHAR(50) UNIQUE NOT NULL,

  -- CAR IDENTITY
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),

  -- STATE
  state VARCHAR(30) NOT NULL DEFAULT 'EVENT' CHECK (state IN (
    'EVENT', 'PACKET', 'SOW', 'SHOP_ASSIGNED', 'DISPO_TO_SHOP',
    'ENROUTE', 'ARRIVED', 'ESTIMATE_RECEIVED', 'ESTIMATE_APPROVED',
    'WORK_IN_PROGRESS', 'FINAL_ESTIMATE_RECEIVED', 'FINAL_APPROVED',
    'DISPO_TO_DESTINATION', 'CLOSED', 'CANCELLED'
  )),

  -- WHY THIS EVENT EXISTS
  source VARCHAR(30) NOT NULL CHECK (source IN (
    'lease_prep', 'bad_order', 'qualification', 'triage',
    'demand_plan', 'service_plan', 'master_plan', 'project_plan',
    'quick_shop', 'manual', 'import', 'migration'
  )),
  source_reference_id UUID,
  source_reference_type VARCHAR(30),

  -- CUSTOMER LINK (when source = lease_prep or time-attributed)
  rider_car_id UUID,  -- links to rider_cars when triggered by customer assignment

  -- LOGISTICS (absorbed from car_assignments)
  shop_code VARCHAR(20) REFERENCES shops(shop_code),
  shop_name VARCHAR(100),
  target_month VARCHAR(7),          -- YYYY-MM
  target_date DATE,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
  is_expedited BOOLEAN DEFAULT FALSE,
  expedite_reason TEXT,
  expedited_at TIMESTAMPTZ,
  expedited_by_id UUID,

  -- WORK DETAIL
  shopping_type_code VARCHAR(50),   -- MRU, QUAL_REG, BAD_ORDER, etc.
  shopping_reason_code VARCHAR(50),
  scope_of_work_id UUID,
  batch_id UUID,                    -- For batch shopping

  -- COST (summary level — detail in estimate_submissions)
  estimated_cost DECIMAL(14,2),     -- Initial estimate (planning)
  approved_cost DECIMAL(14,2),      -- Approved final estimate (projection)
  invoiced_cost DECIMAL(14,2),      -- Actual shop invoice amount (profitability)
  cost_variance DECIMAL(14,2) GENERATED ALWAYS AS (invoiced_cost - approved_cost) STORED,

  -- TRANSPORTATION COST
  transport_to_shop_cost DECIMAL(12,2),
  transport_from_shop_cost DECIMAL(12,2),

  -- DISPOSITION (filled at DISPO_TO_DESTINATION)
  disposition VARCHAR(30) CHECK (disposition IN (
    'to_customer',      -- Goes on rent (completes linked assignment)
    'to_storage',       -- Back to idle
    'to_another_shop',  -- Re-shop (new shopping event)
    'to_scrap'          -- Enters scrap workflow
  )),
  disposition_reference_id UUID,  -- Next shopping_event ID, scrap ID, rider_car ID
  disposition_notes TEXT,

  -- PROJECT INTEGRATION
  project_id UUID,
  project_assignment_id UUID,

  -- MODIFICATION TRACKING
  original_shop_code VARCHAR(20),
  original_target_month VARCHAR(7),
  modification_reason TEXT,

  -- CANCELLATION
  cancelled_at TIMESTAMPTZ,
  cancelled_by_id UUID,
  cancellation_reason TEXT,

  -- STATUS TIMESTAMPS (one per significant state)
  event_at TIMESTAMPTZ DEFAULT NOW(),
  packet_at TIMESTAMPTZ,
  sow_at TIMESTAMPTZ,
  shop_assigned_at TIMESTAMPTZ,
  dispo_to_shop_at TIMESTAMPTZ,
  enroute_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  estimate_received_at TIMESTAMPTZ,
  estimate_approved_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  final_estimate_received_at TIMESTAMPTZ,
  final_approved_at TIMESTAMPTZ,
  dispo_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- AUDIT
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_id UUID
);

-- CRITICAL: One active shopping event per car.
-- Allows a second event to be created while the first is in DISPO_TO_DESTINATION
-- (chain shopping handoff — see Pressure Test 5 in the plan).
CREATE UNIQUE INDEX IF NOT EXISTS idx_se_v2_one_active_per_car
  ON shopping_events_v2(car_number)
  WHERE state NOT IN ('CLOSED', 'CANCELLED', 'DISPO_TO_DESTINATION');

-- Disposition required when in DISPO_TO_DESTINATION state
ALTER TABLE shopping_events_v2 ADD CONSTRAINT chk_dispo_required
  CHECK (
    (state = 'DISPO_TO_DESTINATION' AND disposition IS NOT NULL)
    OR (state != 'DISPO_TO_DESTINATION')
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_se_v2_car ON shopping_events_v2(car_number);
CREATE INDEX IF NOT EXISTS idx_se_v2_car_id ON shopping_events_v2(car_id);
CREATE INDEX IF NOT EXISTS idx_se_v2_state ON shopping_events_v2(state);
CREATE INDEX IF NOT EXISTS idx_se_v2_shop ON shopping_events_v2(shop_code);
CREATE INDEX IF NOT EXISTS idx_se_v2_source ON shopping_events_v2(source);
CREATE INDEX IF NOT EXISTS idx_se_v2_rider_car ON shopping_events_v2(rider_car_id) WHERE rider_car_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_se_v2_project ON shopping_events_v2(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_se_v2_type_reason ON shopping_events_v2(shopping_type_code, shopping_reason_code);
CREATE INDEX IF NOT EXISTS idx_se_v2_created ON shopping_events_v2(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_se_v2_target_month ON shopping_events_v2(target_month);

-- ============================================================================
-- 2. STATE TRANSITION TRIGGER
--
-- Rules:
--   1. Forward skip allowed (any state → any later state in sequence)
--   2. No backward movement except two estimate review loops:
--        ESTIMATE_APPROVED → ESTIMATE_RECEIVED
--        FINAL_APPROVED → FINAL_ESTIMATE_RECEIVED
--   3. DISPO_TO_DESTINATION gated: must come from FINAL_APPROVED only
--   4. MRU exception: FINAL_APPROVED → CLOSED only when shopping_type_code = 'MRU'
--   5. CLOSED requires: DISPO_TO_DESTINATION (normal) or FINAL_APPROVED (MRU only)
--   6. Terminal states (CLOSED, CANCELLED) cannot transition
--   7. Any non-terminal state → CANCELLED is always allowed
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_shopping_event_v2_transition() RETURNS TRIGGER AS $$
DECLARE
  -- Ordinal position of each state in the forward sequence
  state_order CONSTANT JSONB := '{
    "EVENT": 1,
    "PACKET": 2,
    "SOW": 3,
    "SHOP_ASSIGNED": 4,
    "DISPO_TO_SHOP": 5,
    "ENROUTE": 6,
    "ARRIVED": 7,
    "ESTIMATE_RECEIVED": 8,
    "ESTIMATE_APPROVED": 9,
    "WORK_IN_PROGRESS": 10,
    "FINAL_ESTIMATE_RECEIVED": 11,
    "FINAL_APPROVED": 12,
    "DISPO_TO_DESTINATION": 13,
    "CLOSED": 14
  }'::JSONB;
  old_ord INTEGER;
  new_ord INTEGER;
BEGIN
  -- No-op if state unchanged
  IF OLD.state = NEW.state THEN RETURN NEW; END IF;

  -- Rule 6: Terminal states cannot transition
  IF OLD.state IN ('CLOSED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state: %', OLD.state;
  END IF;

  -- Rule 7: Any non-terminal state → CANCELLED is always allowed
  IF NEW.state = 'CANCELLED' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, NOW());
    RETURN NEW;
  END IF;

  -- Get ordinal positions
  old_ord := (state_order ->> OLD.state)::INTEGER;
  new_ord := (state_order ->> NEW.state)::INTEGER;

  -- Rule 2: Allowed backward movements (estimate review loops)
  IF OLD.state = 'ESTIMATE_APPROVED' AND NEW.state = 'ESTIMATE_RECEIVED' THEN
    -- Estimate rejected, shop resubmits
    NEW.estimate_received_at := NOW();
    RETURN NEW;
  END IF;

  IF OLD.state = 'FINAL_APPROVED' AND NEW.state = 'FINAL_ESTIMATE_RECEIVED' THEN
    -- Final rejected, shop resubmits
    NEW.final_estimate_received_at := NOW();
    RETURN NEW;
  END IF;

  -- All remaining transitions must be forward
  IF new_ord <= old_ord THEN
    RAISE EXCEPTION 'Invalid shopping_event_v2 backward transition: % -> %', OLD.state, NEW.state;
  END IF;

  -- Rule 3: DISPO_TO_DESTINATION can only come from FINAL_APPROVED
  IF NEW.state = 'DISPO_TO_DESTINATION' AND OLD.state != 'FINAL_APPROVED' THEN
    RAISE EXCEPTION 'DISPO_TO_DESTINATION can only be reached from FINAL_APPROVED, not %', OLD.state;
  END IF;

  -- Rule 5: CLOSED requires DISPO_TO_DESTINATION or FINAL_APPROVED (MRU only)
  IF NEW.state = 'CLOSED' THEN
    IF OLD.state = 'DISPO_TO_DESTINATION' THEN
      -- Normal path: ok
      NULL;
    ELSIF OLD.state = 'FINAL_APPROVED' THEN
      -- Rule 4: MRU exception only
      IF NEW.shopping_type_code != 'MRU' THEN
        RAISE EXCEPTION 'Only MRU events can skip DISPO_TO_DESTINATION (FINAL_APPROVED -> CLOSED). Type: %', NEW.shopping_type_code;
      END IF;
    ELSE
      RAISE EXCEPTION 'CLOSED can only be reached from DISPO_TO_DESTINATION or FINAL_APPROVED (MRU), not %', OLD.state;
    END IF;
  END IF;

  -- Auto-set timestamps for the target state
  CASE NEW.state
    WHEN 'PACKET' THEN NEW.packet_at := COALESCE(NEW.packet_at, NOW());
    WHEN 'SOW' THEN NEW.sow_at := COALESCE(NEW.sow_at, NOW());
    WHEN 'SHOP_ASSIGNED' THEN NEW.shop_assigned_at := COALESCE(NEW.shop_assigned_at, NOW());
    WHEN 'DISPO_TO_SHOP' THEN NEW.dispo_to_shop_at := COALESCE(NEW.dispo_to_shop_at, NOW());
    WHEN 'ENROUTE' THEN NEW.enroute_at := COALESCE(NEW.enroute_at, NOW());
    WHEN 'ARRIVED' THEN NEW.arrived_at := COALESCE(NEW.arrived_at, NOW());
    WHEN 'ESTIMATE_RECEIVED' THEN NEW.estimate_received_at := COALESCE(NEW.estimate_received_at, NOW());
    WHEN 'ESTIMATE_APPROVED' THEN NEW.estimate_approved_at := COALESCE(NEW.estimate_approved_at, NOW());
    WHEN 'WORK_IN_PROGRESS' THEN NEW.work_started_at := COALESCE(NEW.work_started_at, NOW());
    WHEN 'FINAL_ESTIMATE_RECEIVED' THEN NEW.final_estimate_received_at := COALESCE(NEW.final_estimate_received_at, NOW());
    WHEN 'FINAL_APPROVED' THEN NEW.final_approved_at := COALESCE(NEW.final_approved_at, NOW());
    WHEN 'DISPO_TO_DESTINATION' THEN NEW.dispo_at := COALESCE(NEW.dispo_at, NOW());
    WHEN 'CLOSED' THEN NEW.closed_at := COALESCE(NEW.closed_at, NOW());
    ELSE NULL;
  END CASE;

  -- Bump version on every state change
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shopping_event_v2_transition ON shopping_events_v2;
CREATE TRIGGER trg_shopping_event_v2_transition
  BEFORE UPDATE OF state ON shopping_events_v2
  FOR EACH ROW EXECUTE FUNCTION enforce_shopping_event_v2_transition();

-- ============================================================================
-- 3. REPAIR LIMIT FIELDS ON ESTIMATE_SUBMISSIONS
--
-- When an estimate is submitted, the system snapshots the car's current
-- book value and computed repair limit onto the estimate record.
-- exceeds_repair_limit is auto-computed so the UI can flag it.
-- ============================================================================

ALTER TABLE estimate_submissions
  ADD COLUMN IF NOT EXISTS car_book_value_at_estimate DECIMAL(14,2);

ALTER TABLE estimate_submissions
  ADD COLUMN IF NOT EXISTS economic_repair_limit DECIMAL(14,2);

-- Generated column: auto-computes whether estimate exceeds repair limit
-- Uses DO block to avoid error if column already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_submissions'
      AND column_name = 'exceeds_repair_limit'
  ) THEN
    ALTER TABLE estimate_submissions
      ADD COLUMN exceeds_repair_limit BOOLEAN
      GENERATED ALWAYS AS (
        CASE WHEN economic_repair_limit IS NOT NULL AND total_cost IS NOT NULL
        THEN total_cost > economic_repair_limit
        ELSE FALSE END
      ) STORED;
  END IF;
END $$;

-- ============================================================================
-- 4. V_CAR_FLEET_STATUS — DERIVED VIEW (NEVER STORED)
--
-- Replaces operational_status_group column. Computes fleet membership,
-- lease status, and operational disposition from source-of-truth tables.
-- ============================================================================

CREATE OR REPLACE VIEW v_car_fleet_status AS
SELECT
  c.car_number,
  c.id AS car_id,
  c.fleet_status,
  c.car_type,
  c.owner_code,
  c.book_value,

  -- LEASE STATUS (this is "active")
  CASE
    WHEN rc.id IS NOT NULL AND rc.status = 'on_rent' THEN TRUE
    ELSE FALSE
  END AS is_active,

  rc.rider_id AS active_rider_id,
  rc.status AS assignment_status,

  -- OPERATIONAL DISPOSITION (derived from sub-process facts)
  CASE
    WHEN sc.id IS NOT NULL THEN 'SCRAP_WORKFLOW'
    WHEN se.id IS NOT NULL THEN 'IN_SHOP'
    ELSE 'IDLE'
  END AS operational_disposition,

  -- SHOPPING EVENT DETAIL (when in shop)
  se.id AS active_shopping_event_id,
  se.state AS shopping_event_state,
  se.shop_code AS current_shop,
  se.shopping_type_code,
  se.source AS shopping_source,

  -- SCRAP DETAIL (when in scrap workflow)
  sc.id AS active_scrap_id,
  sc.status AS scrap_status,

  -- WORKFLOW FLAGS
  c.ready_to_load,
  c.ready_to_load_at,
  tq.id AS triage_entry_id,
  tq.reason AS triage_reason,
  tq.priority AS triage_priority,

  -- IDLE TRACKING
  ip.id AS active_idle_period_id,
  ip.start_date AS idle_since,
  ip.reason AS idle_reason,
  (CURRENT_DATE - ip.start_date) AS idle_days,
  ((CURRENT_DATE - ip.start_date) * ip.daily_rate) AS idle_cost

FROM cars c

-- Active rider assignment (decided, prep, or on_rent — excludes releasing/terminal)
LEFT JOIN rider_cars rc
  ON rc.car_number = c.car_number
  AND rc.status IN ('decided', 'prep_required', 'on_rent')

-- Active shopping event (from v2 table)
LEFT JOIN shopping_events_v2 se
  ON se.car_number = c.car_number
  AND se.state NOT IN ('CLOSED', 'CANCELLED')

-- Active scrap (non-terminal)
LEFT JOIN scraps sc
  ON sc.car_number = c.car_number
  AND sc.status NOT IN ('completed', 'cancelled')

-- Active triage entry (unresolved)
LEFT JOIN triage_queue tq
  ON tq.car_id = c.id
  AND tq.resolved_at IS NULL

-- Active idle period (open-ended)
LEFT JOIN idle_periods ip
  ON ip.car_number = c.car_number
  AND ip.end_date IS NULL

WHERE c.fleet_status != 'disposed';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE shopping_events_v2 IS 'Unified shopping event: absorbs car_assignments. 14-state machine from EVENT through CLOSED, plus CANCELLED.';
COMMENT ON COLUMN shopping_events_v2.state IS 'EVENT->PACKET->SOW->SHOP_ASSIGNED->DISPO_TO_SHOP->ENROUTE->ARRIVED->ESTIMATE_RECEIVED->ESTIMATE_APPROVED->WORK_IN_PROGRESS->FINAL_ESTIMATE_RECEIVED->FINAL_APPROVED->DISPO_TO_DESTINATION->CLOSED. Any non-terminal->CANCELLED.';
COMMENT ON COLUMN shopping_events_v2.source IS 'Why this event exists: lease_prep, bad_order, qualification, triage, demand_plan, service_plan, master_plan, project_plan, quick_shop, manual, import, migration.';
COMMENT ON COLUMN shopping_events_v2.rider_car_id IS 'Customer attribution: set when source=lease_prep OR when car has active on_rent rider at event creation.';
COMMENT ON COLUMN shopping_events_v2.disposition IS 'Required at DISPO_TO_DESTINATION: where the car goes next (to_customer, to_storage, to_another_shop, to_scrap).';
COMMENT ON COLUMN shopping_events_v2.cost_variance IS 'Auto-computed: invoiced_cost - approved_cost. Positive = over budget.';
COMMENT ON FUNCTION enforce_shopping_event_v2_transition IS 'Enforces 14-state forward-only machine with estimate review loops, DISPO gating from FINAL_APPROVED, MRU→CLOSED shortcut.';
COMMENT ON VIEW v_car_fleet_status IS 'Derived fleet status: fleet_membership + lease_status + operational_disposition. Never stored. Replaces operational_status_group column.';
COMMENT ON COLUMN estimate_submissions.car_book_value_at_estimate IS 'Snapshot of car book value at estimate submission time. Audit trail for repair limit decisions.';
COMMENT ON COLUMN estimate_submissions.economic_repair_limit IS 'Computed repair limit at estimate submission time. From get_economic_repair_limit().';
