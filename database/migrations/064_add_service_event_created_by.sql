-- Migration 064: Add created_by column to service_events
-- Fixes: GET /api/service-events returns 500 because queries reference se.created_by
-- which does not exist in the table schema.

ALTER TABLE service_events
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Also add the car_input and evaluation_result columns referenced by createServiceEvent
ALTER TABLE service_events
ADD COLUMN IF NOT EXISTS car_input JSONB,
ADD COLUMN IF NOT EXISTS evaluation_result JSONB;

CREATE INDEX IF NOT EXISTS idx_service_events_created_by ON service_events(created_by);
