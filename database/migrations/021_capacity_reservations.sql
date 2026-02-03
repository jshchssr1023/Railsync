-- ============================================================================
-- Migration 021: Capacity Reservations
-- Pre-allocate shop slots for future months by lessee (hard blocks)
-- ============================================================================

-- Add capacity column to shops if not exists
ALTER TABLE shops ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 20;

-- Capacity reservations table
CREATE TABLE IF NOT EXISTS capacity_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
  lessee_code VARCHAR(20) NOT NULL,
  lessee_name VARCHAR(200),

  -- Time range (can span multiple months)
  start_year INT NOT NULL,
  start_month INT NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  end_year INT NOT NULL,
  end_month INT NOT NULL CHECK (end_month BETWEEN 1 AND 12),

  -- Capacity
  reserved_slots INT NOT NULL CHECK (reserved_slots > 0),
  allocated_slots INT NOT NULL DEFAULT 0 CHECK (allocated_slots >= 0),

  -- Status: draft (planning), confirmed (hard block), fulfilled (all slots filled), cancelled
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'fulfilled', 'cancelled')),

  -- Rollover tracking
  rolled_from_id UUID,
  rolled_slots INT DEFAULT 0,

  -- Notes
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID REFERENCES users(id),

  -- Ensure end date is not before start date
  CONSTRAINT valid_date_range CHECK (
    (end_year > start_year) OR
    (end_year = start_year AND end_month >= start_month)
  )
);

-- Add self-reference constraint after table exists
ALTER TABLE capacity_reservations
  ADD CONSTRAINT fk_rolled_from
  FOREIGN KEY (rolled_from_id) REFERENCES capacity_reservations(id);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_capacity_reservations_shop ON capacity_reservations(shop_code);
CREATE INDEX IF NOT EXISTS idx_capacity_reservations_lessee ON capacity_reservations(lessee_code);
CREATE INDEX IF NOT EXISTS idx_capacity_reservations_status ON capacity_reservations(status);
CREATE INDEX IF NOT EXISTS idx_capacity_reservations_date ON capacity_reservations(start_year, start_month);

-- Link allocations to reservations
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES capacity_reservations(id);
CREATE INDEX IF NOT EXISTS idx_allocations_reservation ON allocations(reservation_id);

-- View: Shop capacity by month (base capacity minus confirmed reservations)
CREATE OR REPLACE VIEW v_shop_capacity_calendar AS
WITH months AS (
  -- Generate months for next 24 months
  SELECT
    EXTRACT(YEAR FROM d)::INT AS year,
    EXTRACT(MONTH FROM d)::INT AS month
  FROM generate_series(
    date_trunc('month', CURRENT_DATE),
    date_trunc('month', CURRENT_DATE) + INTERVAL '24 months',
    INTERVAL '1 month'
  ) AS d
),
shop_reservations AS (
  SELECT
    cr.shop_code,
    m.year,
    m.month,
    SUM(cr.reserved_slots) AS reserved_slots,
    SUM(cr.allocated_slots) AS allocated_slots
  FROM capacity_reservations cr
  CROSS JOIN months m
  WHERE cr.status IN ('confirmed', 'fulfilled')
    AND (
      (cr.start_year < m.year) OR
      (cr.start_year = m.year AND cr.start_month <= m.month)
    )
    AND (
      (cr.end_year > m.year) OR
      (cr.end_year = m.year AND cr.end_month >= m.month)
    )
  GROUP BY cr.shop_code, m.year, m.month
)
SELECT
  s.shop_code,
  s.shop_name,
  s.city,
  s.state,
  m.year,
  m.month,
  COALESCE(s.capacity, 20) AS base_capacity,
  COALESCE(sr.reserved_slots, 0) AS reserved_slots,
  COALESCE(sr.allocated_slots, 0) AS allocated_slots,
  COALESCE(s.capacity, 20) - COALESCE(sr.reserved_slots, 0) AS available_capacity
FROM shops s
CROSS JOIN months m
LEFT JOIN shop_reservations sr ON sr.shop_code = s.shop_code AND sr.year = m.year AND sr.month = m.month
WHERE s.is_active = TRUE
ORDER BY s.shop_name, m.year, m.month;

-- View: Reservation details with shop info
CREATE OR REPLACE VIEW v_capacity_reservations AS
SELECT
  cr.*,
  s.shop_name,
  s.city,
  s.state,
  cr.reserved_slots - cr.allocated_slots AS remaining_slots,
  CASE
    WHEN cr.status = 'cancelled' THEN 'Cancelled'
    WHEN cr.allocated_slots >= cr.reserved_slots THEN 'Fulfilled'
    WHEN cr.allocated_slots > 0 THEN 'Partially Filled'
    ELSE 'Empty'
  END AS fill_status,
  uc.email AS created_by_email,
  ub.email AS confirmed_by_email
FROM capacity_reservations cr
JOIN shops s ON s.shop_code = cr.shop_code
LEFT JOIN users uc ON uc.id = cr.created_by
LEFT JOIN users ub ON ub.id = cr.confirmed_by;

-- View: Reservations by lessee summary
CREATE OR REPLACE VIEW v_reservations_by_lessee AS
SELECT
  cr.lessee_code,
  cr.lessee_name,
  COUNT(*) AS total_reservations,
  SUM(CASE WHEN cr.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count,
  SUM(CASE WHEN cr.status = 'confirmed' THEN cr.reserved_slots ELSE 0 END) AS total_reserved,
  SUM(CASE WHEN cr.status = 'confirmed' THEN cr.allocated_slots ELSE 0 END) AS total_allocated,
  SUM(CASE WHEN cr.status = 'confirmed' THEN cr.reserved_slots - cr.allocated_slots ELSE 0 END) AS total_remaining
FROM capacity_reservations cr
WHERE cr.status != 'cancelled'
GROUP BY cr.lessee_code, cr.lessee_name
ORDER BY total_reserved DESC;

-- Function to check available capacity before confirming reservation
CREATE OR REPLACE FUNCTION check_reservation_capacity(
  p_shop_code VARCHAR(10),
  p_start_year INT,
  p_start_month INT,
  p_end_year INT,
  p_end_month INT,
  p_slots INT,
  p_exclude_id UUID DEFAULT NULL
) RETURNS TABLE (
  year INT,
  month INT,
  available INT,
  would_exceed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT
      EXTRACT(YEAR FROM d)::INT AS yr,
      EXTRACT(MONTH FROM d)::INT AS mo
    FROM generate_series(
      make_date(p_start_year, p_start_month, 1),
      make_date(p_end_year, p_end_month, 1),
      INTERVAL '1 month'
    ) AS d
  ),
  existing AS (
    SELECT
      m.yr,
      m.mo,
      SUM(cr.reserved_slots) AS reserved
    FROM capacity_reservations cr
    CROSS JOIN months m
    WHERE cr.shop_code = p_shop_code
      AND cr.status IN ('confirmed', 'fulfilled')
      AND (p_exclude_id IS NULL OR cr.id != p_exclude_id)
      AND (
        (cr.start_year < m.yr) OR
        (cr.start_year = m.yr AND cr.start_month <= m.mo)
      )
      AND (
        (cr.end_year > m.yr) OR
        (cr.end_year = m.yr AND cr.end_month >= m.mo)
      )
    GROUP BY m.yr, m.mo
  )
  SELECT
    m.yr,
    m.mo,
    (COALESCE((SELECT capacity FROM shops WHERE shop_code = p_shop_code), 20) - COALESCE(e.reserved, 0))::INT AS available,
    (COALESCE((SELECT capacity FROM shops WHERE shop_code = p_shop_code), 20) - COALESCE(e.reserved, 0) - p_slots) < 0 AS would_exceed
  FROM months m
  LEFT JOIN existing e ON e.yr = m.yr AND e.mo = m.mo;
END;
$$ LANGUAGE plpgsql;

-- Function to roll over unfilled slots to next month
CREATE OR REPLACE FUNCTION rollover_reservation(p_reservation_id UUID) RETURNS UUID AS $$
DECLARE
  v_reservation capacity_reservations%ROWTYPE;
  v_remaining INT;
  v_new_id UUID;
  v_next_year INT;
  v_next_month INT;
BEGIN
  SELECT * INTO v_reservation FROM capacity_reservations WHERE id = p_reservation_id;

  IF v_reservation IS NULL THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  v_remaining := v_reservation.reserved_slots - v_reservation.allocated_slots;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'No remaining slots to roll over';
  END IF;

  -- Calculate next month
  IF v_reservation.end_month = 12 THEN
    v_next_year := v_reservation.end_year + 1;
    v_next_month := 1;
  ELSE
    v_next_year := v_reservation.end_year;
    v_next_month := v_reservation.end_month + 1;
  END IF;

  -- Create new reservation
  INSERT INTO capacity_reservations (
    shop_code, lessee_code, lessee_name,
    start_year, start_month, end_year, end_month,
    reserved_slots, status, rolled_from_id, rolled_slots,
    notes, created_by
  ) VALUES (
    v_reservation.shop_code, v_reservation.lessee_code, v_reservation.lessee_name,
    v_next_year, v_next_month, v_next_year, v_next_month,
    v_remaining, 'confirmed', p_reservation_id, v_remaining,
    'Rolled over from previous reservation',
    v_reservation.created_by
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;
