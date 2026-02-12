-- Migration 073: Amendment Lifecycle State Machine
-- Phase 2 of Lease Management System
--
-- Adds:
--   1. Expanded status values (Draft, Pending, Approved, Active, Superseded)
--   2. Review tracking columns (submitted_by, submitted_at, rejection_reason, version)
--   3. amendment_state_history table (audit trail)
--   4. Trigger-enforced valid state transitions

-- ============================================================================
-- 1. EXPAND AMENDMENT STATUS VALUES + ADD REVIEW TRACKING
-- ============================================================================

-- Drop existing constraint if any (status was a plain varchar before)
ALTER TABLE lease_amendments DROP CONSTRAINT IF EXISTS lease_amendments_status_check;

-- Add constraint with full lifecycle statuses
ALTER TABLE lease_amendments ADD CONSTRAINT lease_amendments_status_check
  CHECK (status IN ('Draft', 'Pending', 'Approved', 'Active', 'Superseded'));

-- Convert existing 'Pending' records to 'Draft' for clean state
-- (These were seeded amendments that were never formally submitted)
UPDATE lease_amendments SET status = 'Draft' WHERE status = 'Pending';

-- Add review tracking columns
ALTER TABLE lease_amendments ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
ALTER TABLE lease_amendments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE lease_amendments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE lease_amendments ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Change approved_by from VARCHAR to also store user reference
-- (Keep existing varchar column, add UUID reference for proper tracking)
ALTER TABLE lease_amendments ADD COLUMN IF NOT EXISTS approved_by_id UUID REFERENCES users(id);

-- ============================================================================
-- 2. AMENDMENT STATE HISTORY TABLE (audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS amendment_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id UUID NOT NULL REFERENCES lease_amendments(id) ON DELETE CASCADE,
    from_state VARCHAR(30),
    to_state VARCHAR(30) NOT NULL,
    changed_by_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amendment_state_history_amendment
  ON amendment_state_history(amendment_id);
CREATE INDEX IF NOT EXISTS idx_amendment_state_history_created
  ON amendment_state_history(created_at);

-- ============================================================================
-- 3. TRANSITION ENFORCEMENT TRIGGER
-- ============================================================================

-- Valid transitions:
--   Draft    → Pending   (submit for review)
--   Pending  → Approved  (approve)
--   Pending  → Draft     (reject / send back)
--   Approved → Active    (activate — applies rate changes)
--   Approved → Draft     (send back from approved)
--   Active   → Superseded (superseded by newer amendment)

CREATE OR REPLACE FUNCTION enforce_amendment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow if status hasn't changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transition
    IF NOT (
        (OLD.status = 'Draft'    AND NEW.status = 'Pending')   OR
        (OLD.status = 'Pending'  AND NEW.status = 'Approved')  OR
        (OLD.status = 'Pending'  AND NEW.status = 'Draft')     OR
        (OLD.status = 'Approved' AND NEW.status = 'Active')    OR
        (OLD.status = 'Approved' AND NEW.status = 'Draft')     OR
        (OLD.status = 'Active'   AND NEW.status = 'Superseded')
    ) THEN
        RAISE EXCEPTION 'Invalid amendment status transition: % → %', OLD.status, NEW.status;
    END IF;

    -- Auto-increment version on resubmission
    IF OLD.status IN ('Pending', 'Approved') AND NEW.status = 'Draft' THEN
        NEW.version := COALESCE(OLD.version, 1) + 1;
        NEW.rejection_reason := NEW.rejection_reason; -- Preserve the rejection reason set by the service
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_amendment_status ON lease_amendments;
CREATE TRIGGER trg_amendment_status
    BEFORE UPDATE OF status ON lease_amendments
    FOR EACH ROW
    EXECUTE FUNCTION enforce_amendment_status_transition();

-- ============================================================================
-- 4. SEED INITIAL STATE HISTORY FOR EXISTING AMENDMENTS
-- ============================================================================

INSERT INTO amendment_state_history (amendment_id, from_state, to_state, notes)
SELECT id, NULL, status, 'Backfilled from migration 073'
FROM lease_amendments
ON CONFLICT DO NOTHING;

COMMENT ON TABLE amendment_state_history IS 'Audit trail of amendment status transitions. Every state change is logged.';
COMMENT ON FUNCTION enforce_amendment_status_transition IS 'Trigger function enforcing valid amendment status transitions: Draft→Pending→Approved→Active→Superseded with rejection paths back to Draft.';
