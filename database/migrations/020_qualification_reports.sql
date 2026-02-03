-- ============================================================================
-- Migration 020: Qualification Report Views
-- ============================================================================

-- Qualification summary by year
CREATE OR REPLACE VIEW v_qual_by_year AS
SELECT
  tank_qual_year,
  COUNT(*) AS car_count,
  COUNT(CASE WHEN tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE) THEN 1 END) AS overdue_count,
  COUNT(CASE WHEN tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 1 END) AS due_next_year
FROM cars
WHERE is_active = TRUE AND tank_qual_year IS NOT NULL
GROUP BY tank_qual_year
ORDER BY tank_qual_year;

-- Overdue cars (tank qual year <= current year)
CREATE OR REPLACE VIEW v_overdue_cars AS
SELECT
  c.car_number, c.car_mark, c.car_type, c.lessee_name, c.lessee_code,
  c.commodity, c.tank_qual_year, c.car_age, c.csr_name, c.csl_name,
  c.current_region, c.current_status, c.portfolio_status,
  EXTRACT(YEAR FROM CURRENT_DATE)::INT - c.tank_qual_year AS years_overdue
FROM cars c
WHERE c.is_active = TRUE
  AND c.tank_qual_year IS NOT NULL
  AND c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY c.tank_qual_year, c.car_number;

-- Upcoming quals (next 2 years)
CREATE OR REPLACE VIEW v_upcoming_quals AS
SELECT
  c.car_number, c.car_mark, c.car_type, c.lessee_name, c.lessee_code,
  c.commodity, c.tank_qual_year, c.car_age, c.csr_name, c.csl_name,
  c.current_region, c.current_status, c.portfolio_status
FROM cars c
WHERE c.is_active = TRUE
  AND c.tank_qual_year IS NOT NULL
  AND c.tank_qual_year > EXTRACT(YEAR FROM CURRENT_DATE)
  AND c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE) + 2
ORDER BY c.tank_qual_year, c.car_number;

-- Qualification summary by CSR
CREATE OR REPLACE VIEW v_qual_by_csr AS
SELECT
  c.csr_name,
  COUNT(*) AS total_cars,
  COUNT(CASE WHEN c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE) THEN 1 END) AS overdue,
  COUNT(CASE WHEN c.tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 1 END) AS due_next_year,
  COUNT(CASE WHEN c.tank_qual_year > EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 1 END) AS current
FROM cars c
WHERE c.is_active = TRUE AND c.csr_name IS NOT NULL
GROUP BY c.csr_name
ORDER BY overdue DESC, c.csr_name;

-- Qualification summary by lessee
CREATE OR REPLACE VIEW v_qual_by_lessee AS
SELECT
  c.lessee_name,
  c.lessee_code,
  COUNT(*) AS total_cars,
  COUNT(CASE WHEN c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE) THEN 1 END) AS overdue,
  COUNT(CASE WHEN c.tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 1 END) AS due_next_year,
  COUNT(CASE WHEN c.tank_qual_year > EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 1 END) AS current
FROM cars c
WHERE c.is_active = TRUE AND c.lessee_name IS NOT NULL
GROUP BY c.lessee_name, c.lessee_code
ORDER BY overdue DESC, c.lessee_name;

-- Qualification summary by region
CREATE OR REPLACE VIEW v_qual_by_region AS
SELECT
  c.current_region,
  COUNT(*) AS total_cars,
  COUNT(CASE WHEN c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE) THEN 1 END) AS overdue,
  COUNT(CASE WHEN c.tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 1 END) AS due_next_year,
  COUNT(CASE WHEN c.tank_qual_year > EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 1 END) AS current
FROM cars c
WHERE c.is_active = TRUE AND c.current_region IS NOT NULL
GROUP BY c.current_region
ORDER BY overdue DESC, c.current_region;

-- Overall qualification dashboard stats
CREATE OR REPLACE VIEW v_qual_dashboard AS
SELECT
  (SELECT COUNT(*) FROM cars WHERE is_active = TRUE) AS total_cars,
  (SELECT COUNT(*) FROM cars WHERE is_active = TRUE AND tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE)) AS overdue_cars,
  (SELECT COUNT(*) FROM cars WHERE is_active = TRUE AND tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE) + 1) AS due_next_year,
  (SELECT COUNT(*) FROM cars WHERE is_active = TRUE AND tank_qual_year > EXTRACT(YEAR FROM CURRENT_DATE) + 1) AS current_cars,
  (SELECT COUNT(DISTINCT csr_name) FROM cars WHERE is_active = TRUE) AS total_csrs,
  (SELECT COUNT(DISTINCT lessee_name) FROM cars WHERE is_active = TRUE) AS total_lessees;
