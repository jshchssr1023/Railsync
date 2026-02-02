-- Migration 010: Lease Hierarchy (Customer → Lease → Rider → Cars)
-- Phase 16: Fleet page navigation hierarchy

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(20) NOT NULL UNIQUE,
    customer_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    contact_email VARCHAR(200),
    contact_phone VARCHAR(30),
    billing_address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(customer_name);

-- ============================================================================
-- MASTER LEASES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id VARCHAR(30) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    lease_name VARCHAR(200),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(30) DEFAULT 'Active', -- Active, Expired, Terminated
    terms_summary TEXT,
    base_rate_per_car DECIMAL(10,2),
    payment_terms VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_leases_customer ON master_leases(customer_id);
CREATE INDEX IF NOT EXISTS idx_master_leases_status ON master_leases(status);

-- ============================================================================
-- LEASE RIDERS TABLE (Schedules attached to master lease)
-- ============================================================================

CREATE TABLE IF NOT EXISTS lease_riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id VARCHAR(30) NOT NULL UNIQUE,
    master_lease_id UUID NOT NULL REFERENCES master_leases(id),
    rider_name VARCHAR(200),
    effective_date DATE NOT NULL,
    expiration_date DATE,
    car_count INTEGER DEFAULT 0,
    rate_per_car DECIMAL(10,2),
    specific_terms TEXT,
    status VARCHAR(30) DEFAULT 'Active', -- Active, Expired, Superseded
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lease_riders_master ON lease_riders(master_lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_riders_status ON lease_riders(status);

-- ============================================================================
-- LEASE AMENDMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lease_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id VARCHAR(30) NOT NULL UNIQUE,
    master_lease_id UUID REFERENCES master_leases(id),
    rider_id UUID REFERENCES lease_riders(id),
    amendment_type VARCHAR(50) NOT NULL, -- Add Cars, Remove Cars, Rate Change, Extension, Terms Change
    effective_date DATE NOT NULL,
    change_summary TEXT NOT NULL,
    cars_added INTEGER DEFAULT 0,
    cars_removed INTEGER DEFAULT 0,
    new_rate DECIMAL(10,2),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amendments_lease ON lease_amendments(master_lease_id);
CREATE INDEX IF NOT EXISTS idx_amendments_rider ON lease_amendments(rider_id);
CREATE INDEX IF NOT EXISTS idx_amendments_date ON lease_amendments(effective_date);

-- ============================================================================
-- RIDER CARS JUNCTION TABLE (Which cars are on which rider)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rider_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES lease_riders(id),
    car_number VARCHAR(20) NOT NULL REFERENCES cars(car_number),
    added_date DATE NOT NULL DEFAULT CURRENT_DATE,
    removed_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(rider_id, car_number, added_date)
);

CREATE INDEX IF NOT EXISTS idx_rider_cars_rider ON rider_cars(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_cars_car ON rider_cars(car_number);
CREATE INDEX IF NOT EXISTS idx_rider_cars_active ON rider_cars(is_active);

-- ============================================================================
-- VIEWS FOR FLEET PAGE NAVIGATION
-- ============================================================================

-- Customer summary view
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT
    c.id,
    c.customer_code,
    c.customer_name,
    c.is_active,
    COUNT(DISTINCT ml.id) AS active_leases,
    COUNT(DISTINCT lr.id) AS total_riders,
    COUNT(DISTINCT rc.car_number) AS total_cars
FROM customers c
LEFT JOIN master_leases ml ON ml.customer_id = c.id AND ml.status = 'Active'
LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
GROUP BY c.id, c.customer_code, c.customer_name, c.is_active;

-- Master lease summary view
CREATE OR REPLACE VIEW v_master_lease_summary AS
SELECT
    ml.id,
    ml.lease_id,
    ml.customer_id,
    c.customer_name,
    ml.start_date,
    ml.end_date,
    ml.status,
    COUNT(DISTINCT lr.id) AS rider_count,
    COUNT(DISTINCT rc.car_number) AS car_count,
    COALESCE(SUM(lr.rate_per_car * lr.car_count), 0) AS monthly_revenue
FROM master_leases ml
JOIN customers c ON c.id = ml.customer_id
LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
GROUP BY ml.id, ml.lease_id, ml.customer_id, c.customer_name, ml.start_date, ml.end_date, ml.status;

-- Rider summary view
CREATE OR REPLACE VIEW v_rider_summary AS
SELECT
    lr.id,
    lr.rider_id,
    lr.master_lease_id,
    ml.lease_id,
    c.customer_name,
    lr.rider_name,
    lr.effective_date,
    lr.expiration_date,
    lr.status,
    COUNT(DISTINCT rc.car_number) AS car_count,
    COUNT(DISTINCT la.id) AS amendment_count
FROM lease_riders lr
JOIN master_leases ml ON ml.id = lr.master_lease_id
JOIN customers c ON c.id = ml.customer_id
LEFT JOIN rider_cars rc ON rc.rider_id = lr.id AND rc.is_active = TRUE
LEFT JOIN lease_amendments la ON la.rider_id = lr.id
GROUP BY lr.id, lr.rider_id, lr.master_lease_id, ml.lease_id, c.customer_name,
         lr.rider_name, lr.effective_date, lr.expiration_date, lr.status;

-- ============================================================================
-- SEED DEMO DATA
-- ============================================================================

-- Insert sample customers
INSERT INTO customers (customer_code, customer_name, is_active, notes)
VALUES
    ('DUPONT', 'DuPont Chemical', TRUE, 'Major chemical shipper'),
    ('BASF', 'BASF Corporation', TRUE, 'Chemical manufacturing'),
    ('CARGILL', 'Cargill Inc', TRUE, 'Agricultural commodities'),
    ('DOW', 'Dow Chemical', TRUE, 'Chemical producer'),
    ('EXXON', 'ExxonMobil', TRUE, 'Petroleum products'),
    ('BUNGE', 'Bunge North America', TRUE, 'Agribusiness'),
    ('ADM', 'Archer Daniels Midland', TRUE, 'Food processing'),
    ('MOSAIC', 'Mosaic Company', TRUE, 'Fertilizer production')
ON CONFLICT (customer_code) DO NOTHING;

-- Insert sample master leases
INSERT INTO master_leases (lease_id, customer_id, lease_name, start_date, end_date, status, base_rate_per_car)
SELECT
    'ML-' || c.customer_code || '-2024',
    c.id,
    c.customer_name || ' Master Lease 2024',
    '2024-01-01',
    '2029-12-31',
    'Active',
    450.00
FROM customers c
ON CONFLICT (lease_id) DO NOTHING;

-- Insert sample riders for each lease
INSERT INTO lease_riders (rider_id, master_lease_id, rider_name, effective_date, car_count, rate_per_car, status)
SELECT
    'RDR-' || ml.lease_id || '-A',
    ml.id,
    'Schedule A - Initial Fleet',
    ml.start_date,
    10,
    450.00,
    'Active'
FROM master_leases ml
ON CONFLICT (rider_id) DO NOTHING;

-- Link cars to riders based on lessee_code
INSERT INTO rider_cars (rider_id, car_number, added_date, is_active)
SELECT DISTINCT
    lr.id,
    c.car_number,
    lr.effective_date,
    TRUE
FROM cars c
JOIN customers cust ON (
    c.lessee_code = cust.customer_code
    OR c.lessee_name ILIKE '%' || cust.customer_name || '%'
)
JOIN master_leases ml ON ml.customer_id = cust.id
JOIN lease_riders lr ON lr.master_lease_id = ml.id
WHERE c.lessee_code IS NOT NULL OR c.lessee_name IS NOT NULL
ON CONFLICT (rider_id, car_number, added_date) DO NOTHING;

-- Update rider car counts
UPDATE lease_riders lr SET car_count = (
    SELECT COUNT(*) FROM rider_cars rc WHERE rc.rider_id = lr.id AND rc.is_active = TRUE
);

COMMENT ON TABLE customers IS 'Customer master data for lease management';
COMMENT ON TABLE master_leases IS 'Master lease agreements with customers';
COMMENT ON TABLE lease_riders IS 'Lease schedules/riders attached to master leases';
COMMENT ON TABLE lease_amendments IS 'Amendments to leases and riders';
COMMENT ON TABLE rider_cars IS 'Junction table linking cars to lease riders';
