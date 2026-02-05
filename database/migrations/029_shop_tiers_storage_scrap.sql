-- Migration 029: Add material_markup column, storage/scrap shops, and varied tiers
-- Adds material_markup to shops, inserts storage (Y-prefix) and scrap (Z-prefix) shops,
-- and updates existing repair shops with differentiated tiers.

-- ============================================================================
-- 1. Add material_markup column
-- ============================================================================
ALTER TABLE shops ADD COLUMN IF NOT EXISTS material_markup NUMERIC(5,2) DEFAULT 15.00;

-- ============================================================================
-- 2. Update existing repair shops with varied tiers and material_markup
-- ============================================================================

-- Tier 2 shops: secondary network shops
UPDATE shops SET tier = 2, material_markup = 18.00
WHERE shop_code IN ('NS002', 'CN001', 'KCS001', 'IND003')
  AND shop_designation = 'repair';

-- Tier 3 shops: independent / third-party
UPDATE shops SET tier = 3, material_markup = 22.00
WHERE shop_code IN ('IND001', 'IND002')
  AND shop_designation = 'repair';

-- Tier 1 shops: set default material_markup for preferred network
UPDATE shops SET material_markup = 12.00
WHERE tier = 1 AND shop_designation = 'repair'
  AND (material_markup IS NULL OR material_markup = 15.00);
-- ============================================================================
-- 3. Insert storage shops (Y-prefix)
-- ============================================================================
INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, latitude, longitude, tier, is_preferred_network, shop_designation, capacity, labor_rate, material_markup)
VALUES
  ('YBNSF01', 'BNSF Storage Alliance',    'BNSF', 'Midwest',   'Alliance',     'NE', 42.10, -102.87, 1, true,  'storage', 50,  0, 5.50),
  ('YUP001',  'UP Storage North Platte',   'UP',   'Midwest',   'North Platte', 'NE', 41.14, -100.76, 1, true,  'storage', 80,  0, 4.75),
  ('YCSX01',  'CSX Storage Waycross',      'CSX',  'Southeast', 'Waycross',     'GA', 31.21, -82.35,  2, false, 'storage', 40,  0, 6.00),
  ('YNS001',  'NS Storage Roanoke',        'NS',   'Southeast', 'Roanoke',      'VA', 37.27, -79.94,  2, false, 'storage', 35,  0, 5.25),
  ('YIND01',  'Trinity Storage Dallas',    'IND',  'South',     'Dallas',       'TX', 32.78, -96.80,  3, false, 'storage', 100, 0, 7.00)
ON CONFLICT (shop_code) DO NOTHING;
-- ============================================================================
-- 4. Insert scrap shops (Z-prefix)
-- ============================================================================
INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, latitude, longitude, tier, is_preferred_network, shop_designation, capacity, labor_rate, material_markup)
VALUES
  ('ZBNSF01', 'BNSF Scrap Galesburg',  'BNSF', 'Midwest',   'Galesburg',    'IL', 40.95, -90.37,  1, true,  'scrap', 30, 0, 0),
  ('ZCSX01',  'CSX Scrap Cumberland',   'CSX',  'Northeast', 'Cumberland',   'MD', 39.65, -78.76,  2, false, 'scrap', 25, 0, 0),
  ('ZIND01',  'Progress Scrap Yard',    'IND',  'Southeast', 'Albertville',  'AL', 34.27, -86.21,  3, false, 'scrap', 60, 0, 0),
  ('ZUP001',  'UP Scrap Roseville',     'UP',   'West',      'Roseville',    'CA', 38.75, -121.29, 2, false, 'scrap', 40, 0, 0)
ON CONFLICT (shop_code) DO NOTHING;
-- ============================================================================
-- 5. Add capabilities for storage shops
-- ============================================================================
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
VALUES
  ('YBNSF01', 'service', 'Cleaning', '2024-01-15'),
  ('YBNSF01', 'service', 'Storage Prep', '2024-01-15'),
  ('YBNSF01', 'car_type', 'Tank', '2024-01-15'),
  ('YBNSF01', 'car_type', 'Hopper', '2024-01-15'),
  ('YUP001', 'service', 'Cleaning', '2024-01-15'),
  ('YUP001', 'service', 'Storage Prep', '2024-01-15'),
  ('YUP001', 'service', 'Nitrogen Purge', '2024-01-15'),
  ('YUP001', 'car_type', 'Tank', '2024-01-15'),
  ('YUP001', 'car_type', 'Hopper', '2024-01-15'),
  ('YUP001', 'car_type', 'Gondola', '2024-01-15'),
  ('YCSX01', 'service', 'Cleaning', '2024-03-01'),
  ('YCSX01', 'service', 'Storage Prep', '2024-03-01'),
  ('YCSX01', 'car_type', 'Tank', '2024-03-01'),
  ('YNS001', 'service', 'Cleaning', '2024-02-15'),
  ('YNS001', 'service', 'Storage Prep', '2024-02-15'),
  ('YNS001', 'car_type', 'Tank', '2024-02-15'),
  ('YNS001', 'car_type', 'Hopper', '2024-02-15'),
  ('YIND01', 'service', 'Cleaning', '2024-01-01'),
  ('YIND01', 'service', 'Storage Prep', '2024-01-01'),
  ('YIND01', 'service', 'Nitrogen Purge', '2024-01-01'),
  ('YIND01', 'car_type', 'Tank', '2024-01-01'),
  ('YIND01', 'car_type', 'Hopper', '2024-01-01'),
  ('YIND01', 'car_type', 'Gondola', '2024-01-01'),
  ('YIND01', 'car_type', 'Flatcar', '2024-01-01')
ON CONFLICT DO NOTHING;
-- ============================================================================
-- 6. Add capabilities for scrap shops
-- ============================================================================
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
VALUES
  ('ZBNSF01', 'service', 'Scrapping', '2024-01-15'),
  ('ZBNSF01', 'service', 'Dismantling', '2024-01-15'),
  ('ZBNSF01', 'car_type', 'Tank', '2024-01-15'),
  ('ZBNSF01', 'car_type', 'Hopper', '2024-01-15'),
  ('ZCSX01', 'service', 'Scrapping', '2024-03-01'),
  ('ZCSX01', 'car_type', 'Tank', '2024-03-01'),
  ('ZCSX01', 'car_type', 'Hopper', '2024-03-01'),
  ('ZIND01', 'service', 'Scrapping', '2024-01-01'),
  ('ZIND01', 'service', 'Dismantling', '2024-01-01'),
  ('ZIND01', 'service', 'Hazmat Disposal', '2024-01-01'),
  ('ZIND01', 'car_type', 'Tank', '2024-01-01'),
  ('ZIND01', 'car_type', 'Hopper', '2024-01-01'),
  ('ZIND01', 'car_type', 'Gondola', '2024-01-01'),
  ('ZIND01', 'car_type', 'Flatcar', '2024-01-01'),
  ('ZUP001', 'service', 'Scrapping', '2024-02-01'),
  ('ZUP001', 'service', 'Dismantling', '2024-02-01'),
  ('ZUP001', 'car_type', 'Tank', '2024-02-01'),
  ('ZUP001', 'car_type', 'Hopper', '2024-02-01')
ON CONFLICT DO NOTHING;
