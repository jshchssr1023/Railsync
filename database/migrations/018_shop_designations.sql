-- Migration 018: Shop Designations for Storage/Scrap Workflows
-- Adds shop designation types and prep commodity tracking

-- Add shop designation column
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shop_designation VARCHAR(20) DEFAULT 'repair';

-- Add constraint for valid designations
ALTER TABLE shops DROP CONSTRAINT IF EXISTS chk_shop_designation;
ALTER TABLE shops ADD CONSTRAINT chk_shop_designation
  CHECK (shop_designation IN ('repair', 'storage', 'scrap'));

-- Add prep commodity to allocations for storage prep tracking
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS prep_commodity VARCHAR(100);
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS prep_commodity_cin VARCHAR(20);

-- Create index for shop designation filtering
CREATE INDEX IF NOT EXISTS idx_shops_designation ON shops(shop_designation);

-- Common commodities for storage prep (reference table)
CREATE TABLE IF NOT EXISTS storage_commodities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cin VARCHAR(20) UNIQUE,
    name VARCHAR(100) NOT NULL,
    hazmat_class VARCHAR(20),
    requires_cleaning BOOLEAN DEFAULT true,
    requires_nitrogen BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert common commodities
INSERT INTO storage_commodities (cin, name, hazmat_class, requires_cleaning, requires_nitrogen, sort_order) VALUES
('EMPTY', 'Empty/General Storage', NULL, false, false, 1),
('CORN', 'Corn Syrup', NULL, true, false, 10),
('SOYB', 'Soybean Oil', NULL, true, false, 11),
('ETOH', 'Ethanol', '3', true, true, 20),
('MEOH', 'Methanol', '3', true, true, 21),
('CAUS', 'Caustic Soda', '8', true, false, 30),
('SULF', 'Sulfuric Acid', '8', true, false, 31),
('AMMO', 'Anhydrous Ammonia', '2.2', true, true, 40),
('PROP', 'Propane/LPG', '2.1', true, true, 41),
('CLOR', 'Chlorine', '2.3', true, false, 42),
('CRUD', 'Crude Oil', '3', true, false, 50),
('DIES', 'Diesel Fuel', '3', true, false, 51),
('ASPH', 'Asphalt', NULL, true, false, 60),
('FERT', 'Fertilizer (Liquid)', NULL, true, false, 70),
('FOOD', 'Food Grade Products', NULL, true, false, 80)
ON CONFLICT (cin) DO NOTHING;

-- View for shops by designation with counts
CREATE OR REPLACE VIEW v_shops_by_designation AS
SELECT
    shop_designation,
    COUNT(*) as shop_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count,
    STRING_AGG(DISTINCT region, ', ' ORDER BY region) as regions
FROM shops
GROUP BY shop_designation;

-- View for storage/scrap shop list
CREATE OR REPLACE VIEW v_storage_scrap_shops AS
SELECT
    shop_code,
    shop_name,
    shop_designation,
    region,
    city,
    state,
    tier,
    latitude,
    longitude,
    is_active
FROM shops
WHERE shop_designation IN ('storage', 'scrap')
ORDER BY shop_designation, region, shop_name;

-- Function to get shops by designation
CREATE OR REPLACE FUNCTION get_shops_by_designation(p_designation VARCHAR)
RETURNS TABLE (
    shop_code VARCHAR,
    shop_name VARCHAR,
    region VARCHAR,
    city VARCHAR,
    state VARCHAR,
    tier INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.shop_code, s.shop_name, s.region, s.city, s.state, s.tier
    FROM shops s
    WHERE s.shop_designation = p_designation
      AND s.is_active = true
    ORDER BY s.region, s.shop_name;
END;
$$ LANGUAGE plpgsql;

-- Mapping of shopping types to required shop designations
CREATE TABLE IF NOT EXISTS shopping_type_designations (
    shopping_type_id UUID REFERENCES shopping_types(id) ON DELETE CASCADE,
    required_designation VARCHAR(20) NOT NULL,
    PRIMARY KEY (shopping_type_id, required_designation),
    CONSTRAINT chk_required_designation CHECK (required_designation IN ('repair', 'storage', 'scrap'))
);

-- Insert mappings for storage and scrap types
INSERT INTO shopping_type_designations (shopping_type_id, required_designation)
SELECT id, 'storage' FROM shopping_types WHERE code IN ('STOR_PREP', 'STOR_DISPO', 'STORAGE_PREP')
ON CONFLICT DO NOTHING;

INSERT INTO shopping_type_designations (shopping_type_id, required_designation)
SELECT id, 'scrap' FROM shopping_types WHERE code IN ('SCRAP', 'SCRAP_PREP', 'RETIREMENT')
ON CONFLICT DO NOTHING;

-- Add storage prep and scrap shopping types if they don't exist
INSERT INTO shopping_types (code, name, description, is_planned, default_cost_owner, tier_preference, sort_order) VALUES
('STOR_PREP', 'Storage Prep', 'Prepare car for storage - clean and prep for specific commodity', true, 'lessor', NULL, 80),
('STOR_DISPO', 'Storage Disposition', 'Move car to storage location', true, 'lessor', NULL, 81),
('SCRAP_PREP', 'Scrap Preparation', 'Prepare car for scrapping/retirement', true, 'lessor', NULL, 90)
ON CONFLICT (code) DO NOTHING;

-- Link new types to designations
INSERT INTO shopping_type_designations (shopping_type_id, required_designation)
SELECT id, 'storage' FROM shopping_types WHERE code IN ('STOR_PREP', 'STOR_DISPO')
ON CONFLICT DO NOTHING;

INSERT INTO shopping_type_designations (shopping_type_id, required_designation)
SELECT id, 'scrap' FROM shopping_types WHERE code IN ('SCRAP_PREP')
ON CONFLICT DO NOTHING;
