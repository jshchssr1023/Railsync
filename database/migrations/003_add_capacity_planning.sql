-- Migration: Add Capacity Planning Tables
-- Version: 003
-- Date: 2026-02-01
-- Description: Add allocations and extend shop_monthly_capacity for confirmed vs planned tracking

-- ============================================================================
-- ADD MISSING COLUMNS TO CARS TABLE
-- ============================================================================
ALTER TABLE cars ADD COLUMN IF NOT EXISTS qual_exp_date DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_cars_qual_exp ON cars(qual_exp_date) WHERE qual_exp_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cars_active ON cars(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- EXTEND SHOP MONTHLY CAPACITY TABLE
-- Add confirmed/planned columns and version for optimistic locking
-- Note: Table already exists from 002_phase9_planning.sql
-- ============================================================================
ALTER TABLE shop_monthly_capacity ADD COLUMN IF NOT EXISTS confirmed_railcars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shop_monthly_capacity ADD COLUMN IF NOT EXISTS planned_railcars INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shop_monthly_capacity ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE shop_monthly_capacity ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add computed columns for capacity tracking
-- Note: PostgreSQL doesn't support computed/generated columns in ALTER TABLE easily,
-- so we'll handle these in the view instead

-- ============================================================================
-- EXTEND ALLOCATIONS TABLE
-- Add any missing columns needed for capacity planning
-- Note: Table already exists from 002_phase9_planning.sql with different structure
-- ============================================================================
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS service_event_id UUID;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_allocations_month ON allocations(target_month);

-- ============================================================================
-- TRIGGER: Update shop_monthly_capacity when allocation status changes
-- Phase 9 Status values: 'Need Shopping', 'To Be Routed', 'Planned Shopping', 'Enroute', 'Arrived', 'Complete', 'Released'
-- confirmed_railcars = Arrived, Complete
-- planned_railcars = Planned Shopping, Enroute
-- ============================================================================
CREATE OR REPLACE FUNCTION update_monthly_capacity_on_allocation()
RETURNS TRIGGER AS $$
DECLARE
    is_old_confirmed BOOLEAN := FALSE;
    is_new_confirmed BOOLEAN := FALSE;
    is_old_planned BOOLEAN := FALSE;
    is_new_planned BOOLEAN := FALSE;
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Ensure capacity record exists
        INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity)
        VALUES (NEW.shop_code, NEW.target_month, 50)
        ON CONFLICT (shop_code, month) DO NOTHING;

        IF NEW.status IN ('Arrived', 'Complete') THEN
            UPDATE shop_monthly_capacity
            SET confirmed_railcars = confirmed_railcars + 1,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
        ELSIF NEW.status IN ('Planned Shopping', 'Enroute') THEN
            UPDATE shop_monthly_capacity
            SET planned_railcars = planned_railcars + 1,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
        END IF;
        RETURN NEW;
    END IF;

    -- Handle UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Status changed
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            is_old_confirmed := OLD.status IN ('Arrived', 'Complete');
            is_new_confirmed := NEW.status IN ('Arrived', 'Complete');
            is_old_planned := OLD.status IN ('Planned Shopping', 'Enroute');
            is_new_planned := NEW.status IN ('Planned Shopping', 'Enroute');

            -- Decrement old status count
            IF is_old_confirmed THEN
                UPDATE shop_monthly_capacity
                SET confirmed_railcars = GREATEST(0, confirmed_railcars - 1),
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
            ELSIF is_old_planned THEN
                UPDATE shop_monthly_capacity
                SET planned_railcars = GREATEST(0, planned_railcars - 1),
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
            END IF;

            -- Increment new status count
            IF is_new_confirmed THEN
                UPDATE shop_monthly_capacity
                SET confirmed_railcars = confirmed_railcars + 1,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
            ELSIF is_new_planned THEN
                UPDATE shop_monthly_capacity
                SET planned_railcars = planned_railcars + 1,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('Arrived', 'Complete') THEN
            UPDATE shop_monthly_capacity
            SET confirmed_railcars = GREATEST(0, confirmed_railcars - 1),
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
        ELSIF OLD.status IN ('Planned Shopping', 'Enroute') THEN
            UPDATE shop_monthly_capacity
            SET planned_railcars = GREATEST(0, planned_railcars - 1),
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_allocation_capacity ON allocations;
CREATE TRIGGER trg_allocation_capacity
    AFTER INSERT OR UPDATE OR DELETE ON allocations
    FOR EACH ROW EXECUTE FUNCTION update_monthly_capacity_on_allocation();

-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================
DROP TRIGGER IF EXISTS update_shop_monthly_capacity_updated_at ON shop_monthly_capacity;
CREATE TRIGGER update_shop_monthly_capacity_updated_at
    BEFORE UPDATE ON shop_monthly_capacity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_allocations_updated_at ON allocations;
CREATE TRIGGER update_allocations_updated_at
    BEFORE UPDATE ON allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEW: Shop capacity with utilization status
-- ============================================================================
CREATE OR REPLACE VIEW v_shop_capacity_status AS
SELECT
    smc.shop_code,
    s.shop_name,
    smc.month,
    smc.total_capacity,
    smc.confirmed_railcars,
    smc.planned_railcars,
    GREATEST(0, smc.total_capacity - smc.confirmed_railcars - smc.planned_railcars) AS remaining_capacity,
    CASE
        WHEN smc.total_capacity > 0 THEN
            ROUND(((smc.confirmed_railcars + smc.planned_railcars)::DECIMAL / smc.total_capacity) * 100, 1)
        ELSE 0
    END AS utilization_pct,
    CASE
        WHEN smc.total_capacity > 0 AND
             ((smc.confirmed_railcars + smc.planned_railcars)::DECIMAL / smc.total_capacity) >= 0.85
        THEN TRUE
        ELSE FALSE
    END AS is_at_risk,
    CASE
        WHEN smc.total_capacity > 0 AND
             ((smc.confirmed_railcars + smc.planned_railcars)::DECIMAL / smc.total_capacity) >= 0.95 THEN 'critical'
        WHEN smc.total_capacity > 0 AND
             ((smc.confirmed_railcars + smc.planned_railcars)::DECIMAL / smc.total_capacity) >= 0.85 THEN 'warning'
        WHEN smc.total_capacity > 0 AND
             ((smc.confirmed_railcars + smc.planned_railcars)::DECIMAL / smc.total_capacity) >= 0.70 THEN 'moderate'
        ELSE 'healthy'
    END AS capacity_status
FROM shop_monthly_capacity smc
JOIN shops s ON smc.shop_code = s.shop_code
WHERE s.is_active = TRUE;

-- ============================================================================
-- Initialize capacity for existing shops (next 6 months)
-- ============================================================================
INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity)
SELECT
    s.shop_code,
    TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) + (n || ' months')::INTERVAL, 'YYYY-MM') as month,
    50 as total_capacity
FROM shops s
CROSS JOIN generate_series(0, 5) as n
WHERE s.is_active = TRUE
ON CONFLICT (shop_code, month) DO NOTHING;

-- ============================================================================
-- TEST DATA: Update cars with qualification dates for alerts testing
-- ============================================================================
UPDATE cars SET qual_exp_date = CURRENT_DATE + INTERVAL '25 days' WHERE car_number = 'UTLX123456';
UPDATE cars SET qual_exp_date = CURRENT_DATE + INTERVAL '55 days' WHERE car_number = 'GATX789012';
UPDATE cars SET qual_exp_date = CURRENT_DATE + INTERVAL '85 days' WHERE car_number = 'PROX345678';
UPDATE cars SET qual_exp_date = CURRENT_DATE + INTERVAL '120 days' WHERE car_number = 'TILX901234';

-- ============================================================================
-- TEST DATA: Update some capacity to near-full for alerts testing
-- ============================================================================
UPDATE shop_monthly_capacity
SET confirmed_railcars = 47, total_capacity = 50
WHERE shop_code = 'CN002'
  AND month = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

UPDATE shop_monthly_capacity
SET confirmed_railcars = 44, total_capacity = 50
WHERE shop_code = 'UP002'
  AND month = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- ============================================================================
-- TEST DATA: Sample allocations
-- ============================================================================
INSERT INTO allocations (car_id, car_number, shop_code, target_month, status, estimated_cost)
VALUES
  ('UTLX567890', 'UTLX567890', 'BNSF001', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Planned Shopping', 4500.00),
  ('GATX112233', 'GATX112233', 'NS001', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'Arrived', 3800.00),
  ('CEFX445566', 'CEFX445566', 'CSX001', TO_CHAR(CURRENT_DATE + INTERVAL '1 month', 'YYYY-MM'), 'Need Shopping', 5200.00)
ON CONFLICT DO NOTHING;
