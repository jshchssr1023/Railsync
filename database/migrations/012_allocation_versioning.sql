-- ============================================================================
-- Migration 012: Add version column to allocations for optimistic locking
-- Used by Shop Loading Tool for concurrent edit protection
-- ============================================================================

-- Add version column for optimistic locking
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Add work_type column if not exists (needed for shop loading filtering)
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS work_type VARCHAR(50);

-- Add current_status column if not exists (used for pipeline tracking)
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS current_status VARCHAR(30);

-- Sync status to current_status if current_status is null
UPDATE allocations
SET current_status = status
WHERE current_status IS NULL;

-- Create index on current_status for filtering
CREATE INDEX IF NOT EXISTS idx_allocations_current_status ON allocations(current_status);

-- Create index on work_type for filtering
CREATE INDEX IF NOT EXISTS idx_allocations_work_type ON allocations(work_type);
