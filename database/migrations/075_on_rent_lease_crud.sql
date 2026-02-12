-- Migration 072: On-Rent Tracking and Lease CRUD Foundation
-- Phase 1 of Lease Management System
--
-- Adds:
--   1. is_on_rent flag on rider_cars (source of truth for billing eligibility)
--   2. on_rent_history table (day-level audit trail for billing calculation)
--   3. Backfill: all active rider_cars start as on-rent

-- ============================================================================
-- 1. ON-RENT FLAG ON RIDER_CARS
-- ============================================================================

ALTER TABLE rider_cars ADD COLUMN IF NOT EXISTS is_on_rent BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_rider_cars_on_rent
  ON rider_cars(is_on_rent) WHERE is_on_rent = TRUE AND is_active = TRUE;

-- ============================================================================
-- 2. ON-RENT HISTORY TABLE (audit trail for billing day-count)
-- ============================================================================

CREATE TABLE IF NOT EXISTS on_rent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),
    rider_id UUID NOT NULL REFERENCES lease_riders(id),
    is_on_rent BOOLEAN NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    changed_by UUID REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_on_rent_history_car_period
  ON on_rent_history(car_number, effective_date);
CREATE INDEX IF NOT EXISTS idx_on_rent_history_rider
  ON on_rent_history(rider_id, effective_date);

-- ============================================================================
-- 3. BACKFILL: All active rider_cars start as on-rent
-- ============================================================================

UPDATE rider_cars SET is_on_rent = TRUE WHERE is_active = TRUE;
UPDATE rider_cars SET is_on_rent = FALSE WHERE is_active = FALSE;

-- Seed initial on_rent_history records for all active rider_cars
INSERT INTO on_rent_history (car_number, rider_id, is_on_rent, effective_date, change_reason)
SELECT rc.car_number, rc.rider_id, TRUE, rc.added_date, 'Initial backfill from migration 072'
FROM rider_cars rc
WHERE rc.is_active = TRUE
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN rider_cars.is_on_rent IS 'Whether this car is currently on-rent (billable). Source of truth for billing eligibility.';
COMMENT ON TABLE on_rent_history IS 'Audit trail of on-rent status changes per car per rider. Used for day-level billing calculation.';
