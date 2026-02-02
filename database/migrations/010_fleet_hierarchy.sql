-- Migration 010: Fleet Hierarchy Views and Demo Data
-- Customer → Master Lease → Rider → Amendment → Cars
-- Adapts to existing schema

-- ============================================================================
-- ADD MISSING COLUMNS TO CUSTOMERS TABLE
-- ============================================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(200);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS country VARCHAR(50) DEFAULT 'USA';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';

-- ============================================================================
-- VIEWS (using existing column names)
-- ============================================================================

-- Customer summary with fleet counts
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT
    c.id,
    c.customer_code,
    c.customer_name,
    COALESCE(c.status, CASE WHEN c.is_active THEN 'Active' ELSE 'Inactive' END) AS status,
    c.city,
    c.state,
    COUNT(DISTINCT ml.id) AS active_leases,
    COUNT(DISTINCT CASE WHEN lca.status = 'OnLease' THEN lca.car_number END) AS cars_on_lease,
    SUM(CASE WHEN lca.status = 'OnLease' THEN COALESCE(lca.car_rate, lr.rate_per_car, ml.base_rate_per_car, 0) ELSE 0 END) AS monthly_revenue
FROM customers c
LEFT JOIN master_leases ml ON ml.customer_id = c.id AND ml.status = 'Active'
LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id AND lr.status = 'Active'
LEFT JOIN lease_car_assignments lca ON lca.rider_id = lr.id
GROUP BY c.id, c.customer_code, c.customer_name, c.status, c.is_active, c.city, c.state;

-- Lease summary with car counts
CREATE OR REPLACE VIEW v_lease_summary AS
SELECT
    ml.id,
    ml.lease_id,
    ml.lease_name,
    ml.customer_id,
    c.customer_name,
    ml.start_date,
    ml.end_date,
    ml.base_rate_per_car,
    ml.status,
    COUNT(DISTINCT lr.id) AS rider_count,
    COUNT(DISTINCT CASE WHEN lca.status = 'OnLease' THEN lca.car_number END) AS cars_on_lease,
    COUNT(DISTINCT la.id) AS amendment_count
FROM master_leases ml
JOIN customers c ON c.id = ml.customer_id
LEFT JOIN lease_riders lr ON lr.master_lease_id = ml.id
LEFT JOIN lease_car_assignments lca ON lca.rider_id = lr.id
LEFT JOIN lease_amendments la ON la.master_lease_id = ml.id
GROUP BY ml.id, ml.lease_id, ml.lease_name, ml.customer_id, c.customer_name,
         ml.start_date, ml.end_date, ml.base_rate_per_car, ml.status;

-- Rider summary with car counts
CREATE OR REPLACE VIEW v_rider_summary AS
SELECT
    lr.id,
    lr.rider_id,
    lr.rider_name,
    lr.master_lease_id,
    ml.lease_id AS lease_number,
    ml.lease_name,
    c.customer_name,
    c.customer_code,
    lr.effective_date,
    lr.expiration_date,
    lr.status,
    COALESCE(lr.rate_per_car, ml.base_rate_per_car) AS effective_rate,
    lr.car_count,
    COUNT(DISTINCT CASE WHEN lca.status = 'OnLease' THEN lca.id END) AS actual_cars_on_lease,
    COUNT(DISTINCT la.id) AS amendment_count
FROM lease_riders lr
JOIN master_leases ml ON ml.id = lr.master_lease_id
JOIN customers c ON c.id = ml.customer_id
LEFT JOIN lease_car_assignments lca ON lca.rider_id = lr.id
LEFT JOIN lease_amendments la ON la.rider_id = lr.id
GROUP BY lr.id, lr.rider_id, lr.rider_name, lr.master_lease_id, ml.lease_id, ml.lease_name,
         c.customer_name, c.customer_code, lr.effective_date, lr.expiration_date, lr.status,
         lr.rate_per_car, ml.base_rate_per_car, lr.car_count;

-- Amendment summary view
CREATE OR REPLACE VIEW v_amendment_summary AS
SELECT
    la.id,
    la.amendment_id,
    la.master_lease_id,
    la.rider_id,
    la.amendment_type,
    la.effective_date,
    la.change_summary,
    la.cars_added,
    la.cars_removed,
    la.new_rate,
    la.status,
    la.approved_by,
    la.approved_at,
    ml.lease_id AS lease_number,
    ml.lease_name,
    c.customer_name,
    c.customer_code,
    lr.rider_id AS rider_number,
    lr.rider_name
FROM lease_amendments la
LEFT JOIN master_leases ml ON ml.id = la.master_lease_id
LEFT JOIN customers c ON c.id = ml.customer_id
LEFT JOIN lease_riders lr ON lr.id = la.rider_id;

-- Cars on lease view
CREATE OR REPLACE VIEW v_cars_on_lease AS
SELECT
    lca.id,
    lca.car_number,
    lca.rider_id,
    lca.assigned_date,
    lca.released_date,
    lca.car_rate,
    lca.status,
    lr.rider_id AS rider_number,
    lr.rider_name,
    ml.lease_id AS lease_number,
    ml.lease_name,
    c.customer_code,
    c.customer_name,
    COALESCE(lca.car_rate, lr.rate_per_car, ml.base_rate_per_car) AS effective_rate,
    cars.car_type,
    cars.capacity,
    cars.mfg_year
FROM lease_car_assignments lca
JOIN lease_riders lr ON lr.id = lca.rider_id
JOIN master_leases ml ON ml.id = lr.master_lease_id
JOIN customers c ON c.id = ml.customer_id
LEFT JOIN cars ON cars.car_number = lca.car_number;

-- ============================================================================
-- SEED DEMO DATA (using existing column names)
-- ============================================================================

-- Demo Customers (update existing or insert new)
INSERT INTO customers (customer_code, customer_name, contact_name, contact_email, city, state, status, is_active)
VALUES
    ('DUPONT', 'DuPont Chemical', 'John Smith', 'jsmith@dupont.com', 'Wilmington', 'DE', 'Active', true),
    ('DOW', 'Dow Chemical Company', 'Jane Doe', 'jdoe@dow.com', 'Midland', 'MI', 'Active', true),
    ('BASF', 'BASF Corporation', 'Bob Wilson', 'bwilson@basf.com', 'Florham Park', 'NJ', 'Active', true),
    ('EXXON', 'ExxonMobil Chemical', 'Mary Johnson', 'mjohnson@exxon.com', 'Houston', 'TX', 'Active', true),
    ('SHELL', 'Shell Chemical LP', 'Tom Brown', 'tbrown@shell.com', 'Houston', 'TX', 'Active', true)
ON CONFLICT (customer_code) DO UPDATE SET
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    status = EXCLUDED.status;

-- Demo Master Leases
INSERT INTO master_leases (customer_id, lease_id, lease_name, start_date, end_date, base_rate_per_car, status)
SELECT
    c.id,
    c.customer_code || '-2024-001',
    c.customer_name || ' Master Lease 2024',
    '2024-01-01',
    '2029-12-31',
    2500.00,
    'Active'
FROM customers c
WHERE c.customer_code IN ('DUPONT', 'DOW', 'BASF')
ON CONFLICT (lease_id) DO NOTHING;

-- Demo Riders
INSERT INTO lease_riders (master_lease_id, rider_id, rider_name, effective_date, expiration_date, status, specific_terms, car_count)
SELECT
    ml.id,
    ml.lease_id || '-R001',
    'Initial Schedule - Tank Cars',
    ml.start_date,
    ml.end_date,
    'Active',
    'Standard tank car lease terms apply',
    50
FROM master_leases ml
WHERE ml.lease_id LIKE '%-2024-001'
ON CONFLICT (rider_id) DO NOTHING;

-- Link some cars to riders (demo data)
-- First, update some cars to have the customer's lessee_code
UPDATE cars SET lessee_code = 'DUPONT' WHERE car_number IN (
    SELECT car_number FROM cars WHERE lessee_code IS NULL OR lessee_code = '' LIMIT 30
);
UPDATE cars SET lessee_code = 'DOW' WHERE car_number IN (
    SELECT car_number FROM cars WHERE lessee_code IS NULL OR lessee_code = '' LIMIT 25
);
UPDATE cars SET lessee_code = 'BASF' WHERE car_number IN (
    SELECT car_number FROM cars WHERE lessee_code IS NULL OR lessee_code = '' LIMIT 20
);

-- Now link cars to lease riders
INSERT INTO lease_car_assignments (rider_id, car_number, assigned_date, status)
SELECT
    lr.id,
    c.car_number,
    lr.effective_date,
    'OnLease'
FROM lease_riders lr
JOIN master_leases ml ON ml.id = lr.master_lease_id
JOIN customers cust ON cust.id = ml.customer_id
JOIN cars c ON c.lessee_code = cust.customer_code
WHERE lr.rider_id LIKE '%-R001'
ON CONFLICT (rider_id, car_number, assigned_date) DO NOTHING;

-- Demo Amendments
INSERT INTO lease_amendments (amendment_id, master_lease_id, rider_id, amendment_type, effective_date, change_summary, cars_added, status)
SELECT
    lr.rider_id || '-AMD001',
    ml.id,
    lr.id,
    'AddCars',
    '2024-03-01',
    'Added 10 additional tank cars to initial schedule',
    10,
    'Applied'
FROM lease_riders lr
JOIN master_leases ml ON ml.id = lr.master_lease_id
WHERE lr.rider_id LIKE 'DUPONT%-R001'
ON CONFLICT (amendment_id) DO NOTHING;

COMMENT ON VIEW v_customer_summary IS 'Customer summary with active lease and car counts';
COMMENT ON VIEW v_lease_summary IS 'Master lease summary with rider and car counts';
COMMENT ON VIEW v_rider_summary IS 'Rider summary with actual cars on lease';
COMMENT ON VIEW v_amendment_summary IS 'Amendment details with related lease/rider info';
COMMENT ON VIEW v_cars_on_lease IS 'Cars currently assigned to lease riders';
