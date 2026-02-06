-- Migration 042: Data Health Gates
-- Trigger-based gates that auto-resolve car_id from car_number on INSERT/UPDATE,
-- and a health check view for monitoring data integrity.

-- Gate 1: Allocations — auto-resolve car_id from car_number
CREATE OR REPLACE FUNCTION check_allocation_car_exists() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.car_id IS NULL AND NEW.car_number IS NOT NULL THEN
    SELECT id INTO NEW.car_id FROM cars WHERE car_number = NEW.car_number;
  END IF;

  IF NEW.car_id IS NULL AND NEW.car_number IS NOT NULL THEN
    RAISE EXCEPTION 'Allocation must reference a valid car (car_number "%" not found in cars)', NEW.car_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_allocation_car_gate ON allocations;
CREATE TRIGGER trg_allocation_car_gate
  BEFORE INSERT OR UPDATE ON allocations
  FOR EACH ROW EXECUTE FUNCTION check_allocation_car_exists();

-- Gate 2: Car Assignments — auto-resolve car_id from car_number
CREATE OR REPLACE FUNCTION check_assignment_car_exists() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.car_id IS NULL AND NEW.car_number IS NOT NULL THEN
    SELECT id INTO NEW.car_id FROM cars WHERE car_number = NEW.car_number;
  END IF;

  IF NEW.car_id IS NULL AND NEW.car_number IS NOT NULL THEN
    RAISE EXCEPTION 'Car assignment must reference a valid car (car_number "%" not found in cars)', NEW.car_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assignment_car_gate ON car_assignments;
CREATE TRIGGER trg_assignment_car_gate
  BEFORE INSERT OR UPDATE ON car_assignments
  FOR EACH ROW EXECUTE FUNCTION check_assignment_car_exists();

-- Health check view: counts of integrity violations across key tables
CREATE OR REPLACE VIEW v_data_health AS
SELECT
  'allocations_missing_car_id' AS check_name,
  COUNT(*) AS violation_count
FROM allocations WHERE car_id IS NULL AND car_number IS NOT NULL
UNION ALL
SELECT
  'car_assignments_missing_car_id',
  COUNT(*)
FROM car_assignments WHERE car_id IS NULL AND car_number IS NOT NULL
UNION ALL
SELECT
  'orphan_allocations_no_car',
  COUNT(*)
FROM allocations a
LEFT JOIN cars c ON a.car_number = c.car_number
WHERE c.car_number IS NULL AND a.car_number IS NOT NULL
UNION ALL
SELECT
  'orphan_assignments_no_car',
  COUNT(*)
FROM car_assignments ca
LEFT JOIN cars c ON ca.car_number = c.car_number
WHERE c.car_number IS NULL AND ca.car_number IS NOT NULL;

COMMENT ON VIEW v_data_health IS 'Dashboard view of data integrity violations. All counts should be 0.';
