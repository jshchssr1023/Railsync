-- ============================================================================
-- Migration 083: rider_cars Boolean Cleanup
-- Drop redundant boolean columns replaced by rider_cars.status lifecycle:
--   is_active = TRUE  ↔  status NOT IN ('off_rent', 'cancelled')
--   is_on_rent = TRUE ↔  status = 'on_rent'
-- ============================================================================

-- Drop old boolean-based indexes
DROP INDEX IF EXISTS idx_rider_cars_active;
DROP INDEX IF EXISTS idx_rider_cars_on_rent;

-- Create status-based indexes
CREATE INDEX IF NOT EXISTS idx_rider_cars_status ON rider_cars(status);
CREATE INDEX IF NOT EXISTS idx_rider_cars_on_rent_status
  ON rider_cars(status) WHERE status = 'on_rent';

-- Drop redundant columns
ALTER TABLE rider_cars DROP COLUMN IF EXISTS is_active;
ALTER TABLE rider_cars DROP COLUMN IF EXISTS is_on_rent;
