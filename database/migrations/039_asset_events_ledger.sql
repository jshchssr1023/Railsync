-- Migration 039: Asset Events Lifecycle Ledger
-- Append-only table recording every state change for a car.
-- Uses the existing prevent_audit_modification() trigger for immutability.

CREATE TABLE IF NOT EXISTS asset_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  previous_state JSONB,
  new_state JSONB,
  source_table VARCHAR(100),
  source_id UUID,
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_asset_events_car_id ON asset_events(car_id);
CREATE INDEX IF NOT EXISTS idx_asset_events_type ON asset_events(event_type);
CREATE INDEX IF NOT EXISTS idx_asset_events_performed_at ON asset_events(performed_at);
CREATE INDEX IF NOT EXISTS idx_asset_events_source ON asset_events(source_table, source_id);

-- Immutability: reuse existing trigger function from invoice/project audit tables
CREATE TRIGGER trg_asset_events_immutable
  BEFORE UPDATE OR DELETE ON asset_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

COMMENT ON TABLE asset_events IS 'Append-only lifecycle ledger for car asset events. Immutable once written.';
COMMENT ON COLUMN asset_events.event_type IS 'e.g. allocation.created, allocation.shop_assigned, assignment.created, plan.added';
COMMENT ON COLUMN asset_events.source_table IS 'Table that triggered this event (allocations, car_assignments, etc.)';
COMMENT ON COLUMN asset_events.source_id IS 'Row ID in the source table';
