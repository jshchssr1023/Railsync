-- Migration 037: Cars UUID Identity
-- Adds an immutable UUID identity column to the cars table.
-- cars.car_number remains the natural PK; cars.id is a surrogate for FK references.

-- 1. Add UUID column with default
ALTER TABLE cars ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- 2. Backfill any NULL ids (existing rows)
UPDATE cars SET id = gen_random_uuid() WHERE id IS NULL;

-- 3. Make NOT NULL + UNIQUE
ALTER TABLE cars ALTER COLUMN id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_id ON cars(id);

-- 4. Immutability trigger: prevent changing id once set
CREATE OR REPLACE FUNCTION prevent_cars_id_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'cars.id is immutable and cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cars_id_immutable ON cars;
CREATE TRIGGER trg_cars_id_immutable
  BEFORE UPDATE ON cars
  FOR EACH ROW EXECUTE FUNCTION prevent_cars_id_mutation();
