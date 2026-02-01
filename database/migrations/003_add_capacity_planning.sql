-- Migration: Add Capacity Planning Tables
-- Version: 003
-- Date: 2026-02-01
-- Description: Add allocations and shop_monthly_capacity for confirmed vs planned tracking

-- ============================================================================
-- ADD MISSING COLUMNS TO CARS TABLE
-- ============================================================================
ALTER TABLE cars ADD COLUMN IF NOT EXISTS qual_exp_date DATE;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_cars_qual_exp ON cars(qual_exp_date) WHERE qual_exp_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cars_active ON cars(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SHOP MONTHLY CAPACITY TABLE
-- Tracks monthly capacity limits and usage (confirmed vs planned)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_monthly_capacity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- YYYY-MM format
    total_capacity INTEGER NOT NULL DEFAULT 50, -- Max railcars per month
    confirmed_railcars INTEGER NOT NULL DEFAULT 0,
    planned_railcars INTEGER NOT NULL DEFAULT 0,
    -- Calculated fields
    remaining_capacity INTEGER GENERATED ALWAYS AS (
        total_capacity - confirmed_railcars
    ) STORED,
    utilization_pct DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN total_capacity > 0
            THEN (confirmed_railcars::DECIMAL / total_capacity * 100)
            ELSE 0
        END
    ) STORED,
    is_at_risk BOOLEAN GENERATED ALWAYS AS (
        confirmed_railcars >= total_capacity * 0.9
    ) STORED,
    -- Optimistic locking
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_code, month)
);

CREATE INDEX idx_shop_monthly_capacity_shop ON shop_monthly_capacity(shop_code);
CREATE INDEX idx_shop_monthly_capacity_month ON shop_monthly_capacity(month);
CREATE INDEX idx_shop_monthly_capacity_at_risk ON shop_monthly_capacity(is_at_risk) WHERE is_at_risk = TRUE;

-- ============================================================================
-- ALLOCATIONS TABLE
-- Tracks individual car allocations to shops with status
-- ============================================================================
CREATE TABLE IF NOT EXISTS allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    car_id VARCHAR(20) NOT NULL, -- Can be car_number or generated ID
    car_number VARCHAR(20) REFERENCES cars(car_number),
    shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code),
    target_month VARCHAR(7) NOT NULL, -- YYYY-MM format
    status VARCHAR(20) NOT NULL DEFAULT 'proposed',
    -- Status values: 'proposed', 'planned', 'confirmed', 'enroute', 'arrived', 'complete', 'cancelled'

    -- Cost tracking
    estimated_cost DECIMAL(12, 2),
    estimated_cost_breakdown JSONB, -- {labor, material, freight, abatement}
    actual_cost DECIMAL(12, 2),

    -- Tracking dates
    planned_arrival_date DATE,
    actual_arrival_date DATE,
    actual_completion_date DATE,

    -- BRC (Billing Record Card) tracking
    brc_number VARCHAR(20),
    brc_received_at TIMESTAMP WITH TIME ZONE,

    -- Linking
    demand_id UUID, -- Link to demand forecast
    scenario_id UUID, -- Link to planning scenario
    service_event_id UUID REFERENCES service_events(event_id),

    -- Optimistic locking
    version INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_allocations_car ON allocations(car_number);
CREATE INDEX idx_allocations_shop ON allocations(shop_code);
CREATE INDEX idx_allocations_month ON allocations(target_month);
CREATE INDEX idx_allocations_status ON allocations(status);
CREATE INDEX idx_allocations_demand ON allocations(demand_id);

-- Constraint: Only certain status values allowed
ALTER TABLE allocations ADD CONSTRAINT chk_allocation_status
    CHECK (status IN ('proposed', 'planned', 'confirmed', 'enroute', 'arrived', 'complete', 'cancelled'));

-- ============================================================================
-- TRIGGER: Update shop_monthly_capacity when allocation status changes
-- ============================================================================
CREATE OR REPLACE FUNCTION update_monthly_capacity_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        -- Ensure capacity record exists
        INSERT INTO shop_monthly_capacity (shop_code, month)
        VALUES (NEW.shop_code, NEW.target_month)
        ON CONFLICT (shop_code, month) DO NOTHING;

        IF NEW.status = 'confirmed' THEN
            UPDATE shop_monthly_capacity
            SET confirmed_railcars = confirmed_railcars + 1,
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
        ELSIF NEW.status = 'planned' THEN
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
        IF OLD.status != NEW.status THEN
            -- Decrement old status count
            IF OLD.status = 'confirmed' THEN
                UPDATE shop_monthly_capacity
                SET confirmed_railcars = GREATEST(0, confirmed_railcars - 1),
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
            ELSIF OLD.status = 'planned' THEN
                UPDATE shop_monthly_capacity
                SET planned_railcars = GREATEST(0, planned_railcars - 1),
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
            END IF;

            -- Increment new status count
            IF NEW.status = 'confirmed' THEN
                UPDATE shop_monthly_capacity
                SET confirmed_railcars = confirmed_railcars + 1,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE shop_code = NEW.shop_code AND month = NEW.target_month;
            ELSIF NEW.status = 'planned' THEN
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
        IF OLD.status = 'confirmed' THEN
            UPDATE shop_monthly_capacity
            SET confirmed_railcars = GREATEST(0, confirmed_railcars - 1),
                version = version + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE shop_code = OLD.shop_code AND month = OLD.target_month;
        ELSIF OLD.status = 'planned' THEN
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

CREATE TRIGGER trg_allocation_capacity
    AFTER INSERT OR UPDATE OR DELETE ON allocations
    FOR EACH ROW EXECUTE FUNCTION update_monthly_capacity_on_allocation();

-- ============================================================================
-- TRIGGER: Update timestamps
-- ============================================================================
CREATE TRIGGER update_shop_monthly_capacity_updated_at
    BEFORE UPDATE ON shop_monthly_capacity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
    smc.remaining_capacity,
    smc.utilization_pct,
    smc.is_at_risk,
    CASE
        WHEN smc.utilization_pct >= 95 THEN 'critical'
        WHEN smc.utilization_pct >= 85 THEN 'warning'
        WHEN smc.utilization_pct >= 70 THEN 'moderate'
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
INSERT INTO allocations (car_id, car_number, shop_code, target_month, status, estimated_cost, notes)
VALUES
  ('UTLX567890', 'UTLX567890', 'BNSF001', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'confirmed', 4500.00, 'Test confirmed allocation'),
  ('GATX112233', 'GATX112233', 'NS001', TO_CHAR(CURRENT_DATE, 'YYYY-MM'), 'planned', 3800.00, 'Test planned allocation'),
  ('CEFX445566', 'CEFX445566', 'CSX001', TO_CHAR(CURRENT_DATE + INTERVAL '1 month', 'YYYY-MM'), 'proposed', 5200.00, 'Test proposed allocation')
ON CONFLICT DO NOTHING;
