-- Migration 040: Car Identifiers Table
-- Multi-identifier resolution table supporting car_number, car_mark_number, UMLER, DOT, etc.

CREATE TABLE IF NOT EXISTS car_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id UUID NOT NULL REFERENCES cars(id),
  identifier_type VARCHAR(30) NOT NULL,   -- 'car_number', 'car_mark_number', 'umler', 'dot'
  identifier_value VARCHAR(50) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from DATE,
  effective_to DATE,   -- NULL = currently active
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active identifier per type+value combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_car_identifiers_unique
  ON car_identifiers(identifier_type, identifier_value)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_car_identifiers_car_id ON car_identifiers(car_id);

-- Seed from existing data: car_number identifiers
INSERT INTO car_identifiers (car_id, identifier_type, identifier_value, is_primary)
SELECT id, 'car_number', car_number, TRUE
FROM cars
ON CONFLICT DO NOTHING;

-- Seed from existing data: car_mark_number (composed string like "SHQX006002")
-- Note: cars.car_id is the original VARCHAR(15) column from migration 002
INSERT INTO car_identifiers (car_id, identifier_type, identifier_value, is_primary)
SELECT id, 'car_mark_number', car_id, FALSE
FROM cars
WHERE car_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMENT ON TABLE car_identifiers IS 'Maps multiple identifier schemes back to the canonical cars.id UUID';
