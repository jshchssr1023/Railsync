-- ============================================================================
-- Migration 078: Car Lifecycle Foundation
-- Phase 1 of the Car Lifecycle Correction Plan (docs/design/car-lifecycle-correction-plan.md)
--
-- Creates all new tables and columns alongside existing tables.
-- Nothing is deleted or renamed. Existing functionality continues unchanged.
--
-- Sections:
--   1. Cars table: fleet_status, asset fields, ready_to_load
--   2. Rider cars: status lifecycle column + timestamps
--   3. New tables: triage_queue, portfolio_repair_limits, storage_rates,
--                  idle_periods, car_movements
--   4. Triggers: guard_car_disposal, rider_car transitions,
--                master_lease transitions, lease_rider transitions,
--                guard_rider_car_parent
--   5. Indexes: one-active constraints
--   6. car_releases: shopping_event_id FK
-- ============================================================================

-- ============================================================================
-- 1A. FLEET STATUS on cars (replaces is_active — both coexist during migration)
-- ============================================================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS fleet_status VARCHAR(20) NOT NULL DEFAULT 'in_fleet'
  CHECK (fleet_status IN ('onboarding', 'in_fleet', 'disposed'));

-- Backfill from is_active
UPDATE cars SET fleet_status = CASE
  WHEN is_active = FALSE THEN 'disposed'
  ELSE 'in_fleet'
END
WHERE fleet_status = 'in_fleet'; -- only update defaults

-- ============================================================================
-- 1B. ASSET FINANCIAL FIELDS on cars
-- ============================================================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS acquisition_cost DECIMAL(14,2);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS acquisition_date DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS book_value DECIMAL(14,2);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS book_value_as_of DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS salvage_floor DECIMAL(14,2);

-- ============================================================================
-- 1C. READY TO LOAD with audit trail on cars
-- ============================================================================

ALTER TABLE cars ADD COLUMN IF NOT EXISTS ready_to_load BOOLEAN DEFAULT FALSE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS ready_to_load_at TIMESTAMPTZ;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS ready_to_load_by UUID;

CREATE INDEX IF NOT EXISTS idx_cars_fleet_status ON cars(fleet_status);
CREATE INDEX IF NOT EXISTS idx_cars_ready_to_load ON cars(ready_to_load) WHERE ready_to_load = TRUE;

-- ============================================================================
-- 2. RIDER CARS LIFECYCLE STATUS
--    Adds 6-state lifecycle alongside existing is_active/is_on_rent booleans.
--    Both coexist during migration; Phase 4 drops the booleans.
-- ============================================================================

ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'on_rent'
  CHECK (status IN (
    'decided',          -- Car committed to this rider, not yet on rent
    'prep_required',    -- Waiting for shopping event to complete
    'on_rent',          -- Car is on rent, billing active
    'releasing',        -- Release initiated, billing stops, car in transit/return
    'off_rent',         -- Car returned / removed (terminal)
    'cancelled'         -- Cancelled before going on rent (terminal)
  ));

ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS shopping_event_id UUID;
  -- nullable: links to prep shopping event when status = prep_required

ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS decided_by UUID;
ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS on_rent_at TIMESTAMPTZ;
ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS releasing_at TIMESTAMPTZ;
ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS off_rent_at TIMESTAMPTZ;

-- Backfill rider_cars.status from existing boolean columns.
-- MUST happen before the one-active-per-car unique index (Section 5) is created,
-- otherwise the index will fail on cars with multiple rider_cars records.
-- Inactive records → 'off_rent' (excluded from the unique index).
UPDATE rider_cars SET status = 'off_rent', off_rent_at = COALESCE(removed_date::TIMESTAMPTZ, created_at, NOW())
  WHERE is_active = FALSE AND status != 'off_rent';

-- Active + on_rent records keep the default 'on_rent'; set timestamp
UPDATE rider_cars SET on_rent_at = COALESCE(created_at, NOW())
  WHERE is_active = TRUE AND status = 'on_rent' AND on_rent_at IS NULL;

-- ============================================================================
-- 3A. TRIAGE QUEUE (replaces "pending" in operational_status_group)
-- ============================================================================

CREATE TABLE IF NOT EXISTS triage_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),

  reason VARCHAR(30) NOT NULL CHECK (reason IN (
    'lease_expiring',       -- Auto-flagged: lease within 30 days
    'lease_expired',        -- Auto-flagged: lease past expiration
    'scrap_cancelled',      -- Re-entered from cancelled scrap
    'customer_return',      -- Car returned from customer
    'bad_order',            -- Bad order report received
    'qualification_due',    -- Qualification approaching due date
    'manual'                -- Planner manually flagged
  )),

  source_reference_id UUID,   -- Link to lease, scrap, return, etc.
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
  notes TEXT,

  -- Resolution
  resolved_at TIMESTAMPTZ,    -- NULL = still in queue
  resolution VARCHAR(30) CHECK (resolution IN (
    'assigned_to_shop',     -- Shopping event created
    'assigned_to_customer', -- Direct to rider (no prep needed)
    'released_to_idle',     -- No action needed, back to idle
    'scrap_proposed',       -- Scrap workflow initiated
    'dismissed'             -- False alarm, no action
  )),
  resolution_reference_id UUID,  -- Shopping event ID, rider_car ID, scrap ID
  resolved_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- One active triage entry per car
CREATE UNIQUE INDEX IF NOT EXISTS idx_triage_one_active
  ON triage_queue(car_id) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_triage_queue_reason ON triage_queue(reason) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_triage_queue_priority ON triage_queue(priority) WHERE resolved_at IS NULL;

-- ============================================================================
-- 3B. PORTFOLIO REPAIR LIMITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_repair_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_code VARCHAR(20) NOT NULL,
  limit_type VARCHAR(20) NOT NULL CHECK (limit_type IN (
    'percentage_of_book',
    'fixed_amount',
    'lesser_of'
  )),
  percentage DECIMAL(5,2),
  fixed_amount DECIMAL(14,2),
  effective_date DATE NOT NULL,
  superseded_date DATE,
  set_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_limit_per_portfolio
  ON portfolio_repair_limits(portfolio_code)
  WHERE superseded_date IS NULL;

-- Function to compute economic repair limit for a specific car
CREATE OR REPLACE FUNCTION get_economic_repair_limit(p_car_number VARCHAR)
RETURNS DECIMAL(14,2) AS $$
DECLARE
  v_book DECIMAL(14,2);
  v_type VARCHAR(20);
  v_pct DECIMAL(5,2);
  v_fixed DECIMAL(14,2);
BEGIN
  SELECT c.book_value, prl.limit_type, prl.percentage, prl.fixed_amount
  INTO v_book, v_type, v_pct, v_fixed
  FROM cars c
  JOIN portfolio_repair_limits prl
    ON prl.portfolio_code = c.owner_code AND prl.superseded_date IS NULL
  WHERE c.car_number = p_car_number;

  IF v_book IS NULL THEN RETURN NULL; END IF;

  RETURN CASE v_type
    WHEN 'percentage_of_book' THEN v_book * (v_pct / 100)
    WHEN 'fixed_amount' THEN v_fixed
    WHEN 'lesser_of' THEN LEAST(v_book * (v_pct / 100), v_fixed)
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3C. STORAGE RATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code VARCHAR(20) NOT NULL,
  rate_per_day DECIMAL(10,2) NOT NULL,
  rate_type VARCHAR(20) NOT NULL CHECK (rate_type IN (
    'yard_fee', 'insurance', 'regulatory', 'combined'
  )),
  effective_date DATE NOT NULL,
  superseded_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_rate_per_loc_type
  ON storage_rates(location_code, rate_type)
  WHERE superseded_date IS NULL;

-- ============================================================================
-- 3D. IDLE PERIODS
-- ============================================================================

CREATE TABLE IF NOT EXISTS idle_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id),
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),

  start_date DATE NOT NULL,
  end_date DATE,  -- NULL = still idle

  location_code VARCHAR(20),
  reason VARCHAR(30) CHECK (reason IN (
    'between_leases',
    'awaiting_prep',
    'awaiting_triage',
    'market_conditions',
    'hold',
    'new_to_fleet',
    'unknown'
  )),

  daily_rate DECIMAL(10,2),  -- Snapshot from storage_rates at period start

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active idle period per car
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_idle_per_car
  ON idle_periods(car_id) WHERE end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_idle_periods_car ON idle_periods(car_number);
CREATE INDEX IF NOT EXISTS idx_idle_periods_open ON idle_periods(end_date) WHERE end_date IS NULL;

-- ============================================================================
-- 3E. CAR MOVEMENTS (transport cost tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS car_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),
  car_id UUID NOT NULL REFERENCES cars(id),

  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
    'to_customer',
    'customer_return',
    'yard_transfer',
    'to_shop',
    'from_shop'
  )),

  origin_code VARCHAR(20),
  destination_code VARCHAR(20),

  transport_cost DECIMAL(12,2),
  carrier VARCHAR(100),
  waybill_number VARCHAR(50),

  dispatched_date DATE,
  arrival_date DATE,

  -- Attribution
  shopping_event_id UUID,   -- If part of a shop visit
  rider_car_id UUID,        -- If delivering to/from customer

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_car_movements_car ON car_movements(car_number);
CREATE INDEX IF NOT EXISTS idx_car_movements_dates ON car_movements(dispatched_date, arrival_date);

-- ============================================================================
-- 4A. GUARD TRIGGER: Prevent invalid fleet_status transitions on cars
-- ============================================================================

CREATE OR REPLACE FUNCTION guard_car_disposal() RETURNS TRIGGER AS $$
BEGIN
  -- Cannot dispose without completed scrap
  IF OLD.fleet_status != 'disposed' AND NEW.fleet_status = 'disposed' THEN
    IF NOT EXISTS (
      SELECT 1 FROM scraps WHERE car_id = NEW.id AND status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Cannot dispose car without completed scrap record';
    END IF;
  END IF;

  -- Cannot un-dispose
  IF OLD.fleet_status = 'disposed' AND NEW.fleet_status != 'disposed' THEN
    RAISE EXCEPTION 'Cannot reactivate a disposed car';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_car_disposal ON cars;
CREATE TRIGGER trg_guard_car_disposal
  BEFORE UPDATE OF fleet_status ON cars
  FOR EACH ROW EXECUTE FUNCTION guard_car_disposal();

-- ============================================================================
-- 4B. RIDER CAR STATE TRANSITION ENFORCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_rider_car_transition() RETURNS TRIGGER AS $$
DECLARE
  allowed_transitions JSONB := '{
    "decided":        ["prep_required", "on_rent", "cancelled"],
    "prep_required":  ["on_rent", "cancelled"],
    "on_rent":        ["releasing"],
    "releasing":      ["off_rent"]
  }'::JSONB;
  allowed TEXT[];
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Terminal states cannot transition
  IF OLD.status IN ('off_rent', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state: %', OLD.status;
  END IF;

  -- Check allowed transition
  SELECT ARRAY(SELECT jsonb_array_elements_text(allowed_transitions -> OLD.status))
    INTO allowed;

  IF NEW.status != ALL(allowed) THEN
    RAISE EXCEPTION 'Invalid rider_car transition: % -> %', OLD.status, NEW.status;
  END IF;

  -- Set timestamps automatically
  IF NEW.status = 'on_rent' AND OLD.status != 'on_rent' THEN
    NEW.on_rent_at := NOW();
  END IF;
  IF NEW.status = 'releasing' THEN
    NEW.releasing_at := NOW();
  END IF;
  IF NEW.status = 'off_rent' THEN
    NEW.off_rent_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rider_car_transition ON rider_cars;
CREATE TRIGGER trg_rider_car_transition
  BEFORE UPDATE OF status ON rider_cars
  FOR EACH ROW EXECUTE FUNCTION enforce_rider_car_transition();

-- ============================================================================
-- 4C. GUARD: Prevent rider_car on_rent when parent rider/lease not Active
-- ============================================================================

CREATE OR REPLACE FUNCTION guard_rider_car_parent() RETURNS TRIGGER AS $$
BEGIN
  -- When transitioning to on_rent, parent rider and lease must be Active
  IF NEW.status = 'on_rent' AND (OLD.status IS NULL OR OLD.status != 'on_rent') THEN
    IF NOT EXISTS (
      SELECT 1 FROM lease_riders lr
      JOIN master_leases ml ON ml.id = lr.master_lease_id
      WHERE lr.id = NEW.rider_id
        AND lr.status = 'Active'
        AND ml.status = 'Active'
    ) THEN
      RAISE EXCEPTION 'Cannot put car on rent: parent rider or lease is not Active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rider_car_parent_guard ON rider_cars;
CREATE TRIGGER trg_rider_car_parent_guard
  BEFORE UPDATE OF status ON rider_cars
  FOR EACH ROW EXECUTE FUNCTION guard_rider_car_parent();

-- ============================================================================
-- 4D. MASTER LEASE STATE TRANSITION ENFORCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_master_lease_transition() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- Only allowed transitions
  CASE OLD.status
    WHEN 'Active' THEN
      IF NEW.status NOT IN ('Expired', 'Terminated') THEN
        RAISE EXCEPTION 'Invalid master_lease transition: % -> %', OLD.status, NEW.status;
      END IF;
    WHEN 'Expired' THEN
      -- Expired can be reactivated (renewal) or terminated
      IF NEW.status NOT IN ('Active', 'Terminated') THEN
        RAISE EXCEPTION 'Invalid master_lease transition: % -> %', OLD.status, NEW.status;
      END IF;
    WHEN 'Terminated' THEN
      RAISE EXCEPTION 'Cannot transition from Terminated: terminal state';
    ELSE
      -- Allow transition from any other value (e.g. NULL or legacy)
      NULL;
  END CASE;

  -- Guard: Cannot terminate with active rider_cars
  IF NEW.status = 'Terminated' THEN
    IF EXISTS (
      SELECT 1 FROM lease_riders lr
      JOIN rider_cars rc ON rc.rider_id = lr.id
      WHERE lr.master_lease_id = NEW.id
        AND rc.status NOT IN ('off_rent', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Cannot terminate lease with active rider_cars - release all cars first';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_master_lease_transition ON master_leases;
CREATE TRIGGER trg_master_lease_transition
  BEFORE UPDATE OF status ON master_leases
  FOR EACH ROW EXECUTE FUNCTION enforce_master_lease_transition();

-- ============================================================================
-- 4E. LEASE RIDER STATE TRANSITION ENFORCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_lease_rider_transition() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE OLD.status
    WHEN 'Active' THEN
      IF NEW.status NOT IN ('Expired', 'Superseded') THEN
        RAISE EXCEPTION 'Invalid lease_rider transition: % -> %', OLD.status, NEW.status;
      END IF;
    WHEN 'Expired' THEN
      -- Expired can be reactivated (extension) or superseded
      IF NEW.status NOT IN ('Active', 'Superseded') THEN
        RAISE EXCEPTION 'Invalid lease_rider transition: % -> %', OLD.status, NEW.status;
      END IF;
    WHEN 'Superseded' THEN
      RAISE EXCEPTION 'Cannot transition from Superseded: terminal state';
    ELSE
      -- Allow transition from any other value (e.g. NULL or legacy)
      NULL;
  END CASE;

  -- Guard: Cannot expire/supersede with on_rent or releasing cars
  IF NEW.status IN ('Expired', 'Superseded') THEN
    IF EXISTS (
      SELECT 1 FROM rider_cars rc
      WHERE rc.rider_id = NEW.id
        AND rc.status IN ('on_rent', 'releasing')
    ) THEN
      RAISE EXCEPTION 'Cannot expire/supersede rider with on_rent or releasing cars';
    END IF;
  END IF;

  -- Guard: Cannot activate rider on non-Active lease
  IF NEW.status = 'Active' AND OLD.status != 'Active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM master_leases ml
      WHERE ml.id = NEW.master_lease_id AND ml.status = 'Active'
    ) THEN
      RAISE EXCEPTION 'Cannot activate rider: parent master_lease is not Active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lease_rider_transition ON lease_riders;
CREATE TRIGGER trg_lease_rider_transition
  BEFORE UPDATE OF status ON lease_riders
  FOR EACH ROW EXECUTE FUNCTION enforce_lease_rider_transition();

-- ============================================================================
-- 5. ONE-ACTIVE-PER-CAR CONSTRAINT on rider_cars
-- ============================================================================

-- A car can only be on one non-terminal rider at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_rider_per_car
  ON rider_cars(car_number)
  WHERE status NOT IN ('off_rent', 'cancelled');

-- ============================================================================
-- 6. CAR RELEASES: Add shopping_event_id FK for migration period
-- ============================================================================

-- car_releases already has assignment_id; add shopping_event_id alongside
-- Phase 4 will drop assignment_id after all releases reference shopping_events_v2
ALTER TABLE car_releases ADD COLUMN IF NOT EXISTS shopping_event_v2_id UUID;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN cars.fleet_status IS 'Fleet membership: onboarding, in_fleet, disposed. Replaces is_active (Phase 4 drops is_active).';
COMMENT ON COLUMN cars.ready_to_load IS 'Manual flag: car is ready for customer assignment. Always requires human action.';
COMMENT ON COLUMN rider_cars.status IS 'Lifecycle: decided -> prep_required -> on_rent -> releasing -> off_rent. Terminal: off_rent, cancelled.';
COMMENT ON TABLE triage_queue IS 'Replaces operational_status_group=pending. Every car needing a decision gets an explicit entry with reason and resolution.';
COMMENT ON TABLE idle_periods IS 'Tracks idle duration and cost per car. One active period per car (end_date IS NULL).';
COMMENT ON TABLE car_movements IS 'Transport events between locations. Cost attribution via shopping_event_id or rider_car_id.';
COMMENT ON FUNCTION guard_car_disposal IS 'Prevents disposal without completed scrap. Prevents un-disposal.';
COMMENT ON FUNCTION enforce_rider_car_transition IS 'Enforces rider_car lifecycle: decided->prep/on_rent/cancelled, on_rent->releasing, releasing->off_rent.';
COMMENT ON FUNCTION guard_rider_car_parent IS 'Prevents rider_car on_rent when parent rider or lease is not Active.';
COMMENT ON FUNCTION enforce_master_lease_transition IS 'Enforces master_lease lifecycle: Active->Expired/Terminated, Expired->Active/Terminated, Terminated=final.';
COMMENT ON FUNCTION enforce_lease_rider_transition IS 'Enforces lease_rider lifecycle: Active->Expired/Superseded, Expired->Active/Superseded, Superseded=final.';
