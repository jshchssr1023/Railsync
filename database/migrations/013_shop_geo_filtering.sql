-- Migration 013: Shop Geo Data and Filtering Support
-- Adds latitude/longitude fields and capability filtering

-- ============================================================================
-- ADD GEO FIELDS TO SHOPS TABLE
-- ============================================================================

ALTER TABLE shops ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;

-- Create index for geo queries
CREATE INDEX IF NOT EXISTS idx_shops_geo ON shops(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_tier ON shops(tier);

-- ============================================================================
-- SEED SAMPLE GEO DATA FOR EXISTING SHOPS
-- Using approximate US railroad shop locations
-- ============================================================================

UPDATE shops SET latitude = 29.7604, longitude = -95.3698, tier = 1 WHERE shop_code = 'AITX-HOU';
UPDATE shops SET latitude = 32.7767, longitude = -96.7970, tier = 1 WHERE shop_code = 'AITX-DAL';
UPDATE shops SET latitude = 41.8781, longitude = -87.6298, tier = 1 WHERE shop_code = 'AITX-CHI';
UPDATE shops SET latitude = 33.7490, longitude = -84.3880, tier = 1 WHERE shop_code = 'AITX-ATL';
UPDATE shops SET latitude = 39.7392, longitude = -104.9903, tier = 2 WHERE shop_code = 'AITX-DEN';
UPDATE shops SET latitude = 47.6062, longitude = -122.3321, tier = 2 WHERE shop_code = 'AITX-SEA';
UPDATE shops SET latitude = 34.0522, longitude = -118.2437, tier = 1 WHERE shop_code = 'AITX-LAX';
UPDATE shops SET latitude = 37.7749, longitude = -122.4194, tier = 2 WHERE shop_code = 'AITX-SFO';
UPDATE shops SET latitude = 35.2271, longitude = -80.8431, tier = 2 WHERE shop_code = 'AITX-CLT';
UPDATE shops SET latitude = 39.9612, longitude = -82.9988, tier = 2 WHERE shop_code = 'AITX-COL';
UPDATE shops SET latitude = 36.1627, longitude = -86.7816, tier = 2 WHERE shop_code = 'AITX-NSH';
UPDATE shops SET latitude = 29.4241, longitude = -98.4936, tier = 2 WHERE shop_code = 'AITX-SAT';
UPDATE shops SET latitude = 39.0997, longitude = -94.5786, tier = 1 WHERE shop_code = 'AITX-KCI';
UPDATE shops SET latitude = 44.9778, longitude = -93.2650, tier = 2 WHERE shop_code = 'AITX-MSP';
UPDATE shops SET latitude = 42.3601, longitude = -71.0589, tier = 2 WHERE shop_code = 'AITX-BOS';

-- For AITX-BRK (Breckenridge, TX area)
UPDATE shops SET latitude = 32.7555, longitude = -98.9020, tier = 1 WHERE shop_code = 'AITX-BRK';

-- Set default coordinates for any shops without geo data (central US)
UPDATE shops
SET latitude = 39.8283, longitude = -98.5795, tier = 3
WHERE latitude IS NULL;

-- ============================================================================
-- CAPABILITY TYPES FOR FILTERING
-- ============================================================================

-- Ensure we have distinct capability types for filtering
CREATE TABLE IF NOT EXISTS capability_types (
    capability_type VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 100
);

INSERT INTO capability_types (capability_type, display_name, description, sort_order)
VALUES
    ('car_type', 'Car Type', 'Types of railcars the shop can service', 10),
    ('material', 'Material Handling', 'Materials the shop can handle (carbon, stainless, aluminum)', 20),
    ('lining', 'Lining Types', 'Interior lining types the shop can install/repair', 30),
    ('certification', 'Certifications', 'Regulatory certifications (DOT, AAR, etc.)', 40),
    ('nitrogen_stage', 'Nitrogen Staging', 'Nitrogen pad handling capabilities', 50),
    ('service', 'Service Types', 'Types of services offered (cleaning, paint, mechanical)', 60),
    ('special', 'Special Handling', 'Special handling capabilities (asbestos, hazmat)', 70)
ON CONFLICT (capability_type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- VIEW: SHOPS WITH CAPABILITIES SUMMARY
-- ============================================================================

CREATE OR REPLACE VIEW v_shop_capabilities_summary AS
SELECT
    s.shop_code,
    s.shop_name,
    s.region,
    s.latitude,
    s.longitude,
    s.tier,
    s.is_preferred_network,
    s.is_active,
    COALESCE(
        ARRAY_AGG(DISTINCT sc.capability_type) FILTER (WHERE sc.capability_type IS NOT NULL),
        ARRAY[]::VARCHAR[]
    ) AS capability_types,
    COUNT(DISTINCT sc.id) AS total_capabilities,
    COUNT(DISTINCT sc.capability_type) AS unique_capability_types
FROM shops s
LEFT JOIN shop_capabilities sc ON s.shop_code = sc.shop_code
    AND sc.is_active = TRUE
    AND (sc.expiration_date IS NULL OR sc.expiration_date > CURRENT_DATE)
WHERE s.is_active = TRUE
GROUP BY s.shop_code, s.shop_name, s.region, s.latitude, s.longitude, s.tier, s.is_preferred_network, s.is_active;

-- ============================================================================
-- FUNCTION: Calculate distance between two points (Haversine formula)
-- Returns distance in miles
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_distance_miles(
    lat1 DECIMAL,
    lon1 DECIMAL,
    lat2 DECIMAL,
    lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    R DECIMAL := 3959; -- Earth's radius in miles
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);

    a := SIN(dlat/2) * SIN(dlat/2) +
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
         SIN(dlon/2) * SIN(dlon/2);

    c := 2 * ATAN2(SQRT(a), SQRT(1-a));

    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCTION: Find shops within radius
-- ============================================================================

CREATE OR REPLACE FUNCTION find_shops_within_radius(
    origin_lat DECIMAL,
    origin_lon DECIMAL,
    radius_miles DECIMAL DEFAULT 500
) RETURNS TABLE (
    shop_code VARCHAR,
    shop_name VARCHAR,
    region VARCHAR,
    latitude DECIMAL,
    longitude DECIMAL,
    distance_miles DECIMAL,
    tier INTEGER,
    is_preferred_network BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.shop_code,
        s.shop_name,
        s.region,
        s.latitude,
        s.longitude,
        calculate_distance_miles(origin_lat, origin_lon, s.latitude, s.longitude) AS distance_miles,
        s.tier,
        s.is_preferred_network
    FROM shops s
    WHERE s.is_active = TRUE
      AND s.latitude IS NOT NULL
      AND s.longitude IS NOT NULL
      AND calculate_distance_miles(origin_lat, origin_lon, s.latitude, s.longitude) <= radius_miles
    ORDER BY distance_miles;
END;
$$ LANGUAGE plpgsql;
