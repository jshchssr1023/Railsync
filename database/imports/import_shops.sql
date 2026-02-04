-- Import shops from cleaned shop locations.csv
-- Run with: docker exec -i railsync-db psql -U postgres -d railsync < database/import_shops.sql

-- Create temp table for CSV import
DROP TABLE IF EXISTS temp_shop_import;
CREATE TEMP TABLE temp_shop_import (
    action TEXT,
    id TEXT,
    shop_name TEXT,
    shop_name_display TEXT,
    shop_status TEXT,
    shop_type TEXT,
    splc TEXT,
    scac TEXT,
    address1 TEXT,
    address2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    is_aitx_shop TEXT,
    cert_class TEXT,
    cert_date TEXT,
    cert_exp TEXT,
    comment TEXT,
    currency TEXT,
    delivery_lines TEXT,
    display_cust_map TEXT,
    display_web TEXT,
    email TEXT,
    env_review TEXT,
    fax TEXT,
    labor_rate TEXT,
    latitude TEXT,
    longitude TEXT,
    logo_url TEXT,
    phone TEXT,
    sap TEXT,
    website TEXT,
    enter_date TEXT,
    enter_user TEXT,
    edit_date TEXT,
    edit_user TEXT,
    last_verified TEXT,
    extra1 TEXT,
    extra2 TEXT,
    extra3 TEXT,
    extra4 TEXT
);

-- Note: CSV must be copied into container first
-- docker cp "docs/cleaned shop locations.csv" railsync-db:/tmp/shops.csv

\COPY temp_shop_import FROM '/tmp/shops.csv' WITH (FORMAT csv, HEADER true, QUOTE '"');

-- Insert shops, generating shop_code from id
INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, labor_rate, material_multiplier, is_preferred_network, is_active, latitude, longitude)
SELECT
    'SHOP-' || LPAD(id, 4, '0') as shop_code,
    COALESCE(NULLIF(shop_name_display, ''), shop_name) as shop_name,
    COALESCE(
        CASE
            WHEN delivery_lines ILIKE '%UP%' THEN 'UP'
            WHEN delivery_lines ILIKE '%BNSF%' THEN 'BNSF'
            WHEN delivery_lines ILIKE '%CSX%' THEN 'CSX'
            WHEN delivery_lines ILIKE '%NS%' THEN 'NS'
            WHEN delivery_lines ILIKE '%CN%' THEN 'CN'
            WHEN delivery_lines ILIKE '%CP%' THEN 'CP'
            ELSE 'OTHER'
        END, 'OTHER'
    ) as primary_railroad,
    CASE
        WHEN state IN ('TX', 'OK', 'AR', 'LA') THEN 'Gulf'
        WHEN state IN ('CA', 'AZ', 'NV', 'OR', 'WA', 'UT', 'CO', 'NM') THEN 'West'
        WHEN state IN ('IL', 'IN', 'OH', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'ND', 'SD') THEN 'Midwest'
        WHEN state IN ('NY', 'PA', 'NJ', 'CT', 'MA', 'ME', 'NH', 'VT', 'RI') THEN 'Northeast'
        WHEN state IN ('FL', 'GA', 'AL', 'MS', 'SC', 'NC', 'TN', 'KY', 'VA', 'WV', 'MD', 'DE') THEN 'Southeast'
        ELSE 'Central'
    END as region,
    city,
    state,
    COALESCE(NULLIF(labor_rate, '')::DECIMAL, 75.00) as labor_rate,
    1.0 as material_multiplier,
    CASE WHEN LOWER(is_aitx_shop) = 'yes' THEN TRUE ELSE FALSE END as is_preferred_network,
    CASE WHEN LOWER(shop_status) = 'active' THEN TRUE ELSE FALSE END as is_active,
    NULLIF(latitude, '')::DECIMAL,
    NULLIF(longitude, '')::DECIMAL
FROM temp_shop_import
WHERE id IS NOT NULL
  AND id != ''
  AND shop_name IS NOT NULL
ON CONFLICT (shop_code) DO UPDATE SET
    shop_name = EXCLUDED.shop_name,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    labor_rate = EXCLUDED.labor_rate,
    is_preferred_network = EXCLUDED.is_preferred_network,
    is_active = EXCLUDED.is_active,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = NOW();

-- Add capabilities for AITX shops (Tank work)
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, is_active)
SELECT shop_code, 'car_type', 'Tank', TRUE
FROM shops WHERE is_preferred_network = TRUE
ON CONFLICT (shop_code, capability_type, capability_value) DO NOTHING;

INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, is_active)
SELECT shop_code, 'material', 'Carbon Steel', TRUE
FROM shops WHERE is_preferred_network = TRUE
ON CONFLICT (shop_code, capability_type, capability_value) DO NOTHING;

INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, is_active)
SELECT shop_code, 'service', 'Tank Qualification', TRUE
FROM shops WHERE is_preferred_network = TRUE
ON CONFLICT (shop_code, capability_type, capability_value) DO NOTHING;

-- Report results
SELECT
    COUNT(*) as total_shops,
    COUNT(*) FILTER (WHERE is_preferred_network) as aitx_shops,
    COUNT(*) FILTER (WHERE is_active) as active_shops
FROM shops;

DROP TABLE IF EXISTS temp_shop_import;
