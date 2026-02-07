-- ============================================================================
-- Migration 053: Release Management & Contract Transfer Workflow
-- Sprint 5 gap closure: car releases from leases and car-to-rider transfers
-- ============================================================================

-- ============================================================================
-- 1. ADD COMPLETION TRACKING TO car_lease_transitions
-- ============================================================================

ALTER TABLE car_lease_transitions
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS completion_notes TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ============================================================================
-- 2. CAR RELEASES TABLE
-- Tracks the release of cars from lease riders (end of assignment lifecycle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS car_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),
  rider_id UUID NOT NULL REFERENCES lease_riders(id),
  assignment_id UUID REFERENCES car_assignments(id),
  shopping_event_id UUID,
  release_type VARCHAR(30) NOT NULL CHECK (release_type IN (
    'lease_expiry',        -- Lease/rider expired
    'voluntary_return',    -- Lessee returning car early
    'shop_complete',       -- Released after shop work complete
    'contract_transfer',   -- Released as part of transfer to new rider
    'disposition'          -- Car being scrapped/sold
  )),
  status VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN (
    'INITIATED',    -- Release requested
    'APPROVED',     -- Release approved by admin/planner
    'EXECUTING',    -- In process (car being returned/transferred)
    'COMPLETED',    -- Release finalized
    'CANCELLED'     -- Release cancelled
  )),
  initiated_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  transition_id UUID REFERENCES car_lease_transitions(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_releases_car ON car_releases(car_number);
CREATE INDEX IF NOT EXISTS idx_car_releases_rider ON car_releases(rider_id);
CREATE INDEX IF NOT EXISTS idx_car_releases_status ON car_releases(status);
CREATE INDEX IF NOT EXISTS idx_car_releases_active ON car_releases(status) WHERE status IN ('INITIATED', 'APPROVED', 'EXECUTING');

-- ============================================================================
-- 3. RELEASE STATUS TRANSITION ENFORCEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_car_release_transition()
RETURNS TRIGGER AS $$
DECLARE
  allowed_transitions JSONB := '{
    "INITIATED":  ["APPROVED", "CANCELLED"],
    "APPROVED":   ["EXECUTING", "CANCELLED"],
    "EXECUTING":  ["COMPLETED", "CANCELLED"],
    "COMPLETED":  [],
    "CANCELLED":  []
  }'::JSONB;
  allowed JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  allowed := allowed_transitions -> OLD.status;

  IF allowed IS NULL OR NOT allowed ? NEW.status THEN
    RAISE EXCEPTION 'Invalid car release transition: % -> %', OLD.status, NEW.status;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_car_release_transition ON car_releases;
CREATE TRIGGER trg_car_release_transition
  BEFORE UPDATE OF status ON car_releases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_car_release_transition();

-- ============================================================================
-- 4. VIEW: Active releases with details
-- ============================================================================

CREATE OR REPLACE VIEW v_active_releases AS
SELECT
  cr.id,
  cr.car_number,
  c.car_type,
  c.material_type,
  c.lessee_name,
  cr.rider_id,
  lr.rider_name,
  ml.lease_id,
  cust.customer_name,
  cr.release_type,
  cr.status,
  cr.assignment_id,
  cr.shopping_event_id,
  cr.transition_id,
  cr.initiated_by,
  init_user.email AS initiated_by_email,
  cr.approved_by,
  cr.approved_at,
  cr.completed_by,
  cr.completed_at,
  cr.notes,
  cr.created_at,
  -- Related assignment info
  ca.status AS assignment_status,
  ca.shop_code AS assignment_shop,
  ca.target_month AS assignment_month
FROM car_releases cr
JOIN cars c ON c.car_number = cr.car_number
JOIN lease_riders lr ON lr.id = cr.rider_id
JOIN master_leases ml ON ml.id = lr.master_lease_id
JOIN customers cust ON cust.id = ml.customer_id
LEFT JOIN users init_user ON init_user.id = cr.initiated_by
LEFT JOIN car_assignments ca ON ca.id = cr.assignment_id
WHERE cr.status NOT IN ('COMPLETED', 'CANCELLED');

-- ============================================================================
-- 5. VIEW: Transfer overview
-- ============================================================================

CREATE OR REPLACE VIEW v_transfer_overview AS
SELECT
  clt.id,
  clt.car_number,
  c.car_type,
  c.material_type,
  clt.transition_type,
  clt.status,
  clt.from_rider_id,
  from_lr.rider_name AS from_rider_name,
  from_cust.customer_name AS from_customer,
  clt.to_rider_id,
  to_lr.rider_name AS to_rider_name,
  to_cust.customer_name AS to_customer,
  clt.initiated_date,
  clt.target_completion_date,
  clt.completed_date,
  clt.requires_shop_visit,
  clt.shop_visit_id,
  clt.notes,
  clt.created_by,
  creator.email AS created_by_email,
  clt.completed_by,
  completer.email AS completed_by_email,
  clt.created_at,
  -- Check for active assignments on the car
  COALESCE((
    SELECT COUNT(*) FROM car_assignments ca
    WHERE ca.car_number = clt.car_number
    AND ca.status NOT IN ('Complete', 'Cancelled')
  ), 0)::INTEGER AS active_assignments,
  -- Check for active releases
  COALESCE((
    SELECT COUNT(*) FROM car_releases cr
    WHERE cr.car_number = clt.car_number
    AND cr.status NOT IN ('COMPLETED', 'CANCELLED')
  ), 0)::INTEGER AS active_releases
FROM car_lease_transitions clt
JOIN cars c ON c.car_number = clt.car_number
LEFT JOIN lease_riders from_lr ON from_lr.id = clt.from_rider_id
LEFT JOIN master_leases from_ml ON from_ml.id = from_lr.master_lease_id
LEFT JOIN customers from_cust ON from_cust.id = from_ml.customer_id
LEFT JOIN lease_riders to_lr ON to_lr.id = clt.to_rider_id
LEFT JOIN master_leases to_ml ON to_ml.id = to_lr.master_lease_id
LEFT JOIN customers to_cust ON to_cust.id = to_ml.customer_id
LEFT JOIN users creator ON creator.id = clt.created_by
LEFT JOIN users completer ON completer.id = clt.completed_by;

COMMENT ON TABLE car_releases IS 'Tracks car releases from lease riders with approval workflow';
COMMENT ON VIEW v_active_releases IS 'Active (non-completed/cancelled) car releases with full context';
COMMENT ON VIEW v_transfer_overview IS 'Car lease transitions with customer/rider details and blocker counts';
