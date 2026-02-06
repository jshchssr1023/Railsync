-- Migration 049: State Transition Log + Reversibility Infrastructure
-- Provides: unified audit table for all state-changing processes,
-- backward transitions for shopping events + invoice cases,
-- and is_reversible tracking for undo/revert capability.

-- ============================================================================
-- SECTION 1: Unified State Transition Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS state_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  entity_number VARCHAR(100),
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,
  is_reversible BOOLEAN NOT NULL DEFAULT false,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id),
  reversal_transition_id UUID REFERENCES state_transition_log(id),
  side_effects JSONB DEFAULT '[]',
  actor_id UUID REFERENCES users(id),
  actor_email VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stl_process_entity ON state_transition_log(process_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_stl_actor ON state_transition_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_stl_created ON state_transition_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stl_reversible ON state_transition_log(is_reversible)
  WHERE reversed_at IS NULL;

COMMENT ON TABLE state_transition_log IS 'Unified audit log for all process state transitions. Existing per-process audit tables (invoice_audit_events, shopping_event_state_history, etc.) remain intact.';

-- Partial immutability: only reversal columns can be updated, and only once (NULL -> non-NULL)
CREATE OR REPLACE FUNCTION enforce_transition_log_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow updating ONLY the reversal columns
  IF OLD.process_type IS DISTINCT FROM NEW.process_type
    OR OLD.entity_id IS DISTINCT FROM NEW.entity_id
    OR OLD.entity_number IS DISTINCT FROM NEW.entity_number
    OR OLD.from_state IS DISTINCT FROM NEW.from_state
    OR OLD.to_state IS DISTINCT FROM NEW.to_state
    OR OLD.is_reversible IS DISTINCT FROM NEW.is_reversible
    OR OLD.side_effects IS DISTINCT FROM NEW.side_effects
    OR OLD.actor_id IS DISTINCT FROM NEW.actor_id
    OR OLD.actor_email IS DISTINCT FROM NEW.actor_email
    OR OLD.notes IS DISTINCT FROM NEW.notes
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'state_transition_log: only reversal columns (reversed_at, reversed_by, reversal_transition_id) can be updated';
  END IF;

  -- Reversal columns can only be set once (NULL -> non-NULL)
  IF OLD.reversed_at IS NOT NULL AND NEW.reversed_at IS DISTINCT FROM OLD.reversed_at THEN
    RAISE EXCEPTION 'state_transition_log: reversed_at already set, cannot modify';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transition_log_immutable
  BEFORE UPDATE ON state_transition_log
  FOR EACH ROW
  EXECUTE FUNCTION enforce_transition_log_immutability();

-- Prevent deletes
CREATE OR REPLACE FUNCTION prevent_transition_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'state_transition_log records cannot be deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transition_log_no_delete
  BEFORE DELETE ON state_transition_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_transition_log_delete();

-- ============================================================================
-- SECTION 2: Add is_reversible to invoice_state_transitions
-- ============================================================================

ALTER TABLE invoice_state_transitions
  ADD COLUMN IF NOT EXISTS is_reversible BOOLEAN DEFAULT false;

-- Mark existing backward transitions as reversible
UPDATE invoice_state_transitions SET is_reversible = true
WHERE (from_state, to_state) IN (
  ('WAITING_ON_SHOPPING', 'ASSIGNED'),
  ('WAITING_ON_CUSTOMER_APPROVAL', 'ASSIGNED'),
  ('APPROVER_REVIEW', 'ADMIN_REVIEW'),
  ('BILLING_REVIEW', 'APPROVER_REVIEW'),
  ('BLOCKED', 'ASSIGNED')
);

-- Mark forward transitions that are safe to revert as reversible
UPDATE invoice_state_transitions SET is_reversible = true
WHERE (from_state, to_state) IN (
  ('RECEIVED', 'ASSIGNED'),
  ('ASSIGNED', 'WAITING_ON_SHOPPING'),
  ('ASSIGNED', 'WAITING_ON_CUSTOMER_APPROVAL'),
  ('ASSIGNED', 'READY_FOR_IMPORT'),
  ('READY_FOR_IMPORT', 'IMPORTED'),
  ('IMPORTED', 'ADMIN_REVIEW'),
  ('ADMIN_REVIEW', 'SUBMITTED'),
  ('SUBMITTED', 'APPROVER_REVIEW'),
  ('APPROVED', 'BILLING_REVIEW'),
  ('BILLING_REVIEW', 'BILLING_APPROVED')
);

-- Add new backward transitions for revert capability
INSERT INTO invoice_state_transitions (from_state, to_state, required_role, requires_validation, is_reversible, notes) VALUES
  ('ASSIGNED', 'RECEIVED', 'admin', false, false, 'Revert: unassign case'),
  ('READY_FOR_IMPORT', 'ASSIGNED', 'admin', false, false, 'Revert: return for rework'),
  ('IMPORTED', 'READY_FOR_IMPORT', 'admin', false, false, 'Revert: undo import'),
  ('ADMIN_REVIEW', 'IMPORTED', 'admin', false, false, 'Revert: return to imported'),
  ('SUBMITTED', 'ADMIN_REVIEW', 'admin', false, false, 'Revert: return to admin review'),
  ('APPROVED', 'APPROVER_REVIEW', 'approver', false, false, 'Revert: withdraw approval'),
  ('BILLING_APPROVED', 'BILLING_REVIEW', 'billing', false, false, 'Revert: withdraw billing approval'),
  ('SAP_STAGED', 'BILLING_APPROVED', 'admin', true, false, 'Revert: unstage from SAP (only if not yet posted)')
ON CONFLICT (from_state, to_state) DO NOTHING;

-- ============================================================================
-- SECTION 3: Add backward transitions to shopping event state machine
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_shopping_event_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "REQUESTED": ["ASSIGNED_TO_SHOP", "CANCELLED"],
    "ASSIGNED_TO_SHOP": ["INBOUND", "REQUESTED", "CANCELLED"],
    "INBOUND": ["INSPECTION", "ASSIGNED_TO_SHOP", "CANCELLED"],
    "INSPECTION": ["ESTIMATE_SUBMITTED", "CANCELLED"],
    "ESTIMATE_SUBMITTED": ["ESTIMATE_UNDER_REVIEW", "CANCELLED"],
    "ESTIMATE_UNDER_REVIEW": ["ESTIMATE_APPROVED", "CHANGES_REQUIRED", "ESTIMATE_SUBMITTED", "CANCELLED"],
    "CHANGES_REQUIRED": ["ESTIMATE_SUBMITTED", "CANCELLED"],
    "ESTIMATE_APPROVED": ["WORK_AUTHORIZED", "ESTIMATE_UNDER_REVIEW", "CANCELLED"],
    "WORK_AUTHORIZED": ["IN_REPAIR", "CANCELLED"],
    "IN_REPAIR": ["QA_COMPLETE", "CANCELLED"],
    "QA_COMPLETE": ["FINAL_ESTIMATE_SUBMITTED", "IN_REPAIR", "CANCELLED"],
    "FINAL_ESTIMATE_SUBMITTED": ["FINAL_ESTIMATE_APPROVED", "CANCELLED"],
    "FINAL_ESTIMATE_APPROVED": ["READY_FOR_RELEASE", "CANCELLED"],
    "READY_FOR_RELEASE": ["RELEASED", "FINAL_ESTIMATE_APPROVED", "CANCELLED"]
  }'::JSONB;
  allowed_next JSONB;
BEGIN
  -- Skip if state not changing
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;

  -- Cannot transition from terminal states
  IF OLD.state IN ('RELEASED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state: %', OLD.state;
  END IF;

  -- Cancellation requires a reason
  IF NEW.state = 'CANCELLED' AND (NEW.cancellation_reason IS NULL OR NEW.cancellation_reason = '') THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  -- Check valid transitions
  allowed_next := valid_transitions -> OLD.state;
  IF allowed_next IS NULL OR NOT allowed_next ? NEW.state THEN
    RAISE EXCEPTION 'Invalid state transition: % -> %', OLD.state, NEW.state;
  END IF;

  -- Auto-set timestamps
  IF NEW.state = 'CANCELLED' THEN
    NEW.cancelled_at := NOW();
  END IF;

  -- Increment version
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists, CREATE OR REPLACE updates the function body
