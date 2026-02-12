-- ============================================================================
-- Migration 081: Release Cancellation Path
-- Phase 2 of the Car Lifecycle Correction Plan
--
-- Adds `releasing -> on_rent` as an allowed backward transition in the
-- rider_car state machine. This is the ONLY backward transition and
-- represents "release was cancelled, car returns to active billing."
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_rider_car_transition() RETURNS TRIGGER AS $$
DECLARE
  allowed_transitions JSONB := '{
    "decided":        ["prep_required", "on_rent", "cancelled"],
    "prep_required":  ["on_rent", "cancelled"],
    "on_rent":        ["releasing"],
    "releasing":      ["off_rent", "on_rent"]
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

  -- Clear releasing_at when reverting releasing -> on_rent (release cancelled)
  IF OLD.status = 'releasing' AND NEW.status = 'on_rent' THEN
    NEW.releasing_at := NULL;
    NEW.is_on_rent := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
