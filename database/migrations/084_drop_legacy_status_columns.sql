-- ============================================================================
-- Migration 084: Drop Legacy Status Columns
-- Drop display-only status columns that are never written by application logic.
-- current_status is retained (still used for display and CSV-import-populated).
-- ============================================================================

ALTER TABLE cars DROP COLUMN IF EXISTS adjusted_status;
ALTER TABLE cars DROP COLUMN IF EXISTS plan_status;
ALTER TABLE cars DROP COLUMN IF EXISTS scheduled_status;
