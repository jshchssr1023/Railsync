-- ============================================================================
-- Migration 071: Seed Qualification Records for All 10 Types
-- Backfills the remaining 9 qualification types (migration 050 only did TANK_REQUALIFICATION)
-- Uses existing car data (years columns, car age, lining type, commodity) to generate
-- realistic statuses, last-completed dates, and next-due dates.
-- ============================================================================

-- ============================================================================
-- 1. AIR_BRAKE — derive from car age; 48-month cycle
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.car_age IS NULL THEN 'unknown'
    -- Simulate: last done sometime in the past based on random offset from car age
    WHEN (CURRENT_DATE - INTERVAL '48 months' * (1 + (c.car_age % 3))) > CURRENT_DATE THEN 'overdue'
    WHEN estimated_next_due <= CURRENT_DATE THEN 'overdue'
    WHEN estimated_next_due <= CURRENT_DATE + INTERVAL '90 days' THEN 'due_soon'
    ELSE 'current'
  END,
  estimated_last_completed,
  estimated_next_due,
  estimated_next_due + INTERVAL '30 days',
  48
FROM cars c
CROSS JOIN qualification_types qt
CROSS JOIN LATERAL (
  SELECT
    -- Last completed: stagger based on car_age mod to create variety
    CASE WHEN c.car_age IS NOT NULL
      THEN CURRENT_DATE - ((c.car_age % 4) * INTERVAL '12 months') - INTERVAL '6 months'
      ELSE NULL
    END AS estimated_last_completed,
    CASE WHEN c.car_age IS NOT NULL
      THEN CURRENT_DATE - ((c.car_age % 4) * INTERVAL '12 months') - INTERVAL '6 months' + INTERVAL '48 months'
      ELSE NULL
    END AS estimated_next_due
) derived
WHERE qt.code = 'AIR_BRAKE'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 2. SAFETY_APPLIANCE — derive from service_equipment_year; 60-month cycle
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.service_equipment_year IS NULL THEN 'unknown'
    WHEN make_date(c.service_equipment_year, 1, 1) <= CURRENT_DATE THEN
      CASE
        WHEN make_date(c.service_equipment_year, 1, 1) + INTERVAL '60 months' <= CURRENT_DATE THEN 'overdue'
        WHEN make_date(c.service_equipment_year, 1, 1) + INTERVAL '60 months' <= CURRENT_DATE + INTERVAL '90 days' THEN 'due_soon'
        ELSE 'current'
      END
    ELSE 'current'
  END,
  CASE WHEN c.service_equipment_year IS NOT NULL
    THEN make_date(GREATEST(c.service_equipment_year - 5, 2000), 6, 15)
    ELSE NULL
  END,
  CASE WHEN c.service_equipment_year IS NOT NULL
    THEN make_date(c.service_equipment_year, 1, 1) + INTERVAL '60 months'
    ELSE NULL
  END,
  CASE WHEN c.service_equipment_year IS NOT NULL
    THEN make_date(c.service_equipment_year, 12, 31) + INTERVAL '60 months'
    ELSE NULL
  END,
  60
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'SAFETY_APPLIANCE'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 3. HAZMAT_QUALIFICATION — same cycle as tank requalification for hazmat cars
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.tank_qual_year IS NULL THEN 'unknown'
    WHEN c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE)::int THEN 'overdue'
    WHEN c.tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE)::int + 1 THEN 'due_soon'
    ELSE 'current'
  END,
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year - 10, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year, 12, 31)
    ELSE NULL
  END,
  120
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'HAZMAT_QUALIFICATION'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 4. PRESSURE_TEST — same cycle as tank requalification (done together)
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.tank_qual_year IS NULL THEN 'unknown'
    WHEN c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE)::int THEN 'overdue'
    WHEN c.tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE)::int + 1 THEN 'due_soon'
    ELSE 'current'
  END,
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year - 10, 3, 1) -- offset slightly from tank qual
    ELSE NULL
  END,
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year, 3, 1)
    ELSE NULL
  END,
  CASE WHEN c.tank_qual_year IS NOT NULL
    THEN make_date(c.tank_qual_year, 12, 31)
    ELSE NULL
  END,
  120
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'PRESSURE_TEST'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 5. VALVE_INSPECTION — derive from safety_relief_year; 60-month cycle
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.safety_relief_year IS NULL THEN 'unknown'
    WHEN make_date(c.safety_relief_year, 1, 1) + INTERVAL '60 months' <= CURRENT_DATE THEN 'overdue'
    WHEN make_date(c.safety_relief_year, 1, 1) + INTERVAL '60 months' <= CURRENT_DATE + INTERVAL '90 days' THEN 'due_soon'
    ELSE 'current'
  END,
  CASE WHEN c.safety_relief_year IS NOT NULL
    THEN make_date(c.safety_relief_year, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.safety_relief_year IS NOT NULL
    THEN make_date(c.safety_relief_year, 1, 1) + INTERVAL '60 months'
    ELSE NULL
  END,
  CASE WHEN c.safety_relief_year IS NOT NULL
    THEN make_date(c.safety_relief_year, 12, 31) + INTERVAL '60 months'
    ELSE NULL
  END,
  60
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'VALVE_INSPECTION'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 6. THICKNESS_TEST — derive from tank_thickness_year; 120-month cycle
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.tank_thickness_year IS NULL THEN 'unknown'
    WHEN c.tank_thickness_year <= EXTRACT(YEAR FROM CURRENT_DATE)::int THEN 'overdue'
    WHEN c.tank_thickness_year = EXTRACT(YEAR FROM CURRENT_DATE)::int + 1 THEN 'due_soon'
    ELSE 'current'
  END,
  CASE WHEN c.tank_thickness_year IS NOT NULL
    THEN make_date(c.tank_thickness_year - 10, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.tank_thickness_year IS NOT NULL
    THEN make_date(c.tank_thickness_year, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.tank_thickness_year IS NOT NULL
    THEN make_date(c.tank_thickness_year, 12, 31)
    ELSE NULL
  END,
  120
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'THICKNESS_TEST'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 7. EXTERIOR_VISUAL — annual; stagger based on car_age for realistic distribution
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.car_age IS NULL THEN 'unknown'
    -- Most cars are current on annual visuals; some overdue
    WHEN (c.car_age % 7) = 0 THEN 'overdue'
    WHEN (c.car_age % 7) = 1 THEN 'due_soon'
    ELSE 'current'
  END,
  -- Last completed: within the past year for most cars
  CASE WHEN c.car_age IS NOT NULL
    THEN CURRENT_DATE - ((c.car_age % 14) * INTERVAL '1 month')
    ELSE NULL
  END,
  CASE WHEN c.car_age IS NOT NULL
    THEN CURRENT_DATE - ((c.car_age % 14) * INTERVAL '1 month') + INTERVAL '12 months'
    ELSE NULL
  END,
  CASE WHEN c.car_age IS NOT NULL
    THEN CURRENT_DATE - ((c.car_age % 14) * INTERVAL '1 month') + INTERVAL '13 months'
    ELSE NULL
  END,
  12
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'EXTERIOR_VISUAL'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 8. LINING_INSPECTION — only for lined cars; 60-month cycle from interior_lining_year
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months, is_exempt, exempt_reason)
SELECT
  c.id,
  qt.id,
  CASE
    -- Unlined cars are exempt
    WHEN c.is_lined = FALSE OR c.is_lined IS NULL THEN 'exempt'
    WHEN c.interior_lining_year IS NULL THEN 'unknown'
    WHEN make_date(c.interior_lining_year, 1, 1) + INTERVAL '60 months' <= CURRENT_DATE THEN 'overdue'
    WHEN make_date(c.interior_lining_year, 1, 1) + INTERVAL '60 months' <= CURRENT_DATE + INTERVAL '90 days' THEN 'due_soon'
    ELSE 'current'
  END,
  CASE WHEN c.is_lined = TRUE AND c.interior_lining_year IS NOT NULL
    THEN make_date(c.interior_lining_year, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.is_lined = TRUE AND c.interior_lining_year IS NOT NULL
    THEN make_date(c.interior_lining_year, 1, 1) + INTERVAL '60 months'
    ELSE NULL
  END,
  CASE WHEN c.is_lined = TRUE AND c.interior_lining_year IS NOT NULL
    THEN make_date(c.interior_lining_year, 12, 31) + INTERVAL '60 months'
    ELSE NULL
  END,
  60,
  CASE WHEN c.is_lined = FALSE OR c.is_lined IS NULL THEN TRUE ELSE FALSE END,
  CASE WHEN c.is_lined = FALSE OR c.is_lined IS NULL THEN 'Car is not lined — lining inspection not applicable' ELSE NULL END
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'LINING_INSPECTION'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 9. STUB_SILL — derive from stub_sill_year; 120-month cycle
-- ============================================================================
INSERT INTO qualifications (car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months)
SELECT
  c.id,
  qt.id,
  CASE
    WHEN c.stub_sill_year IS NULL THEN 'unknown'
    WHEN c.stub_sill_year <= EXTRACT(YEAR FROM CURRENT_DATE)::int THEN 'overdue'
    WHEN c.stub_sill_year = EXTRACT(YEAR FROM CURRENT_DATE)::int + 1 THEN 'due_soon'
    ELSE 'current'
  END,
  CASE WHEN c.stub_sill_year IS NOT NULL
    THEN make_date(c.stub_sill_year - 10, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.stub_sill_year IS NOT NULL
    THEN make_date(c.stub_sill_year, 1, 1)
    ELSE NULL
  END,
  CASE WHEN c.stub_sill_year IS NOT NULL
    THEN make_date(c.stub_sill_year, 12, 31)
    ELSE NULL
  END,
  120
FROM cars c
CROSS JOIN qualification_types qt
WHERE qt.code = 'STUB_SILL'
  AND c.is_active = TRUE
ON CONFLICT (car_id, qualification_type_id) DO NOTHING;

-- ============================================================================
-- 10. Run status recalculation to normalize any edge cases
-- The scheduler cron job does this daily, but run it now for immediate consistency.
-- This updates status based on actual date math vs the heuristics above.
-- ============================================================================
UPDATE qualifications
SET status = CASE
    WHEN is_exempt = TRUE THEN 'exempt'
    WHEN next_due_date IS NULL THEN 'unknown'
    WHEN next_due_date < CURRENT_DATE THEN 'overdue'
    WHEN next_due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'due'
    WHEN next_due_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'due_soon'
    ELSE 'current'
  END,
  updated_at = NOW()
WHERE status != 'exempt' OR (status = 'exempt' AND is_exempt = FALSE);
