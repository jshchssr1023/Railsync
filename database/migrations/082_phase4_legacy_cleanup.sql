-- ============================================================================
-- Migration 082: Phase 4 Legacy Cleanup
-- Drop deprecated columns from cars table.
-- These are now derived by v_car_fleet_status view:
--   operational_status_group → v.operational_disposition
--   is_active               → fleet_status != 'disposed'
-- ============================================================================

ALTER TABLE cars DROP COLUMN IF EXISTS operational_status_group;
ALTER TABLE cars DROP COLUMN IF EXISTS is_active;
