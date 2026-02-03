-- ============================================================================
-- SEED DATA: Storage (Y-prefix) and Scrap (Z-prefix) Shops
-- With varied capacity and capabilities for testing
-- ============================================================================

-- ============================================================================
-- STORAGE LOCATIONS (Y-prefix) - shop_designation = 'storage'
-- Used for railcar storage/layup with prep capabilities
-- ============================================================================
INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, labor_rate, material_multiplier, is_preferred_network, tier, latitude, longitude, capacity, shop_designation) VALUES
-- Gulf Region Storage
('Y-HOU', 'Houston Storage Yard', 'UP', 'Gulf', 'Houston', 'TX', 45.00, 0.850, TRUE, 2, 29.7604, -95.3698, 150, 'storage'),
('Y-LAP', 'La Porte Storage Terminal', 'UP', 'Gulf', 'La Porte', 'TX', 42.00, 0.800, TRUE, 2, 29.6658, -95.0194, 200, 'storage'),
('Y-BEA', 'Beaumont Storage Complex', 'UP', 'Gulf', 'Beaumont', 'TX', 40.00, 0.780, FALSE, 3, 30.0802, -94.1266, 300, 'storage'),
('Y-LKC', 'Lake Charles Storage', 'UP', 'Gulf', 'Lake Charles', 'LA', 38.00, 0.750, FALSE, 3, 30.2266, -93.2174, 250, 'storage'),

-- Midwest Region Storage
('Y-CHI', 'Chicago Storage Hub', 'CN', 'Midwest', 'Chicago', 'IL', 55.00, 0.920, TRUE, 1, 41.8781, -87.6298, 175, 'storage'),
('Y-KCM', 'Kansas City Storage Yard', 'BNSF', 'Midwest', 'Kansas City', 'MO', 48.00, 0.850, TRUE, 2, 39.0997, -94.5786, 225, 'storage'),
('Y-STL', 'St. Louis Storage Terminal', 'NS', 'Midwest', 'St. Louis', 'MO', 46.00, 0.830, FALSE, 2, 38.6270, -90.1994, 180, 'storage'),

-- Southeast Region Storage
('Y-ATL', 'Atlanta Storage Yard', 'NS', 'Southeast', 'Atlanta', 'GA', 50.00, 0.880, TRUE, 2, 33.7490, -84.3880, 160, 'storage'),
('Y-BHM', 'Birmingham Storage', 'NS', 'Southeast', 'Birmingham', 'AL', 42.00, 0.800, FALSE, 3, 33.5186, -86.8104, 275, 'storage'),
('Y-JAX', 'Jacksonville Storage Complex', 'CSX', 'Southeast', 'Jacksonville', 'FL', 44.00, 0.820, FALSE, 3, 30.3322, -81.6557, 350, 'storage'),

-- West Region Storage
('Y-LAX', 'Los Angeles Storage Yard', 'UP', 'West', 'Los Angeles', 'CA', 65.00, 1.050, TRUE, 1, 34.0522, -118.2437, 120, 'storage'),
('Y-PHX', 'Phoenix Storage Terminal', 'UP', 'West', 'Phoenix', 'AZ', 48.00, 0.850, FALSE, 2, 33.4484, -112.0740, 400, 'storage'),

-- Northeast Region Storage
('Y-NWK', 'Newark Storage Facility', 'NS', 'Northeast', 'Newark', 'NJ', 60.00, 1.000, TRUE, 2, 40.7357, -74.1724, 100, 'storage'),
('Y-PHL', 'Philadelphia Storage Yard', 'CSX', 'Northeast', 'Philadelphia', 'PA', 55.00, 0.950, FALSE, 2, 39.9526, -75.1652, 140, 'storage')
ON CONFLICT (shop_code) DO UPDATE SET
  shop_name = EXCLUDED.shop_name,
  primary_railroad = EXCLUDED.primary_railroad,
  region = EXCLUDED.region,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  labor_rate = EXCLUDED.labor_rate,
  material_multiplier = EXCLUDED.material_multiplier,
  is_preferred_network = EXCLUDED.is_preferred_network,
  tier = EXCLUDED.tier,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  capacity = EXCLUDED.capacity,
  shop_designation = EXCLUDED.shop_designation;

-- ============================================================================
-- SCRAP LOCATIONS (Z-prefix) - shop_designation = 'scrap'
-- Used for railcar scrapping/disposal
-- ============================================================================
INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, labor_rate, material_multiplier, is_preferred_network, tier, latitude, longitude, capacity, shop_designation) VALUES
-- Gulf Region Scrap
('Z-HOU', 'Houston Scrap Facility', 'UP', 'Gulf', 'Houston', 'TX', 35.00, 0.700, TRUE, 3, 29.8168, -95.4208, 50, 'scrap'),
('Z-BTR', 'Baton Rouge Scrap Yard', 'CN', 'Gulf', 'Baton Rouge', 'LA', 32.00, 0.680, FALSE, 3, 30.4515, -91.1871, 75, 'scrap'),

-- Midwest Region Scrap
('Z-CHI', 'Chicago Scrap Terminal', 'CN', 'Midwest', 'Chicago', 'IL', 45.00, 0.780, TRUE, 2, 41.7508, -87.7126, 60, 'scrap'),
('Z-STL', 'St. Louis Scrap Facility', 'NS', 'Midwest', 'St. Louis', 'MO', 38.00, 0.720, FALSE, 3, 38.5836, -90.2801, 80, 'scrap'),
('Z-CLE', 'Cleveland Scrap Yard', 'CSX', 'Midwest', 'Cleveland', 'OH', 42.00, 0.750, FALSE, 2, 41.4993, -81.6944, 45, 'scrap'),

-- Southeast Region Scrap
('Z-ATL', 'Atlanta Scrap Center', 'NS', 'Southeast', 'Atlanta', 'GA', 40.00, 0.740, TRUE, 2, 33.6838, -84.4549, 55, 'scrap'),
('Z-BHM', 'Birmingham Steel Scrap', 'NS', 'Southeast', 'Birmingham', 'AL', 34.00, 0.680, FALSE, 3, 33.4579, -86.9019, 90, 'scrap'),

-- West Region Scrap
('Z-LAX', 'Los Angeles Scrap Facility', 'UP', 'West', 'Los Angeles', 'CA', 55.00, 0.850, TRUE, 2, 33.9425, -118.2551, 40, 'scrap'),
('Z-PHX', 'Phoenix Scrap Terminal', 'UP', 'West', 'Phoenix', 'AZ', 42.00, 0.720, FALSE, 3, 33.3942, -112.1401, 65, 'scrap'),

-- Northeast Region Scrap
('Z-PIT', 'Pittsburgh Steel Scrap', 'NS', 'Northeast', 'Pittsburgh', 'PA', 48.00, 0.800, TRUE, 2, 40.4406, -79.9959, 35, 'scrap')
ON CONFLICT (shop_code) DO UPDATE SET
  shop_name = EXCLUDED.shop_name,
  primary_railroad = EXCLUDED.primary_railroad,
  region = EXCLUDED.region,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  labor_rate = EXCLUDED.labor_rate,
  material_multiplier = EXCLUDED.material_multiplier,
  is_preferred_network = EXCLUDED.is_preferred_network,
  tier = EXCLUDED.tier,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  capacity = EXCLUDED.capacity,
  shop_designation = EXCLUDED.shop_designation;

-- ============================================================================
-- STORAGE SHOP CAPABILITIES
-- Storage locations have prep capabilities (cleaning, coating, minor repairs)
-- ============================================================================

-- Delete existing capabilities for these shops to refresh
DELETE FROM shop_capabilities WHERE shop_code LIKE 'Y-%' OR shop_code LIKE 'Z-%';

-- Car types supported by storage locations (for prep work)
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'car_type', 'Tank', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%'
UNION ALL
SELECT shop_code, 'car_type', 'Hopper', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%'
UNION ALL
SELECT shop_code, 'car_type', 'Gondola', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-HOU', 'Y-CHI', 'Y-LAX', 'Y-ATL')
UNION ALL
SELECT shop_code, 'car_type', 'Boxcar', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-CHI', 'Y-KCM', 'Y-NWK');

-- Storage service types
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'service', 'Storage', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%'
UNION ALL
SELECT shop_code, 'service', 'Layup', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%'
UNION ALL
SELECT shop_code, 'service', 'Interior Clean', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%'
UNION ALL
SELECT shop_code, 'service', 'Exterior Clean', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-HOU', 'Y-LAP', 'Y-CHI', 'Y-LAX', 'Y-ATL', 'Y-NWK')
UNION ALL
SELECT shop_code, 'service', 'Nitrogen Purge', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-HOU', 'Y-LAP', 'Y-CHI', 'Y-LAX')
UNION ALL
SELECT shop_code, 'service', 'Heated Storage', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-CHI', 'Y-KCM', 'Y-NWK', 'Y-PHL');

-- Storage prep materials
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'material', 'Carbon Steel', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%'
UNION ALL
SELECT shop_code, 'material', 'Stainless', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-HOU', 'Y-LAP', 'Y-CHI', 'Y-LAX', 'Y-ATL')
UNION ALL
SELECT shop_code, 'material', 'Aluminum', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-HOU', 'Y-CHI', 'Y-LAX');

-- Storage certifications (limited)
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'certification', 'AAR', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND tier <= 2
UNION ALL
SELECT shop_code, 'certification', 'Food Grade', '2024-01-01' FROM shops WHERE shop_code LIKE 'Y-%' AND shop_code IN ('Y-HOU', 'Y-CHI', 'Y-LAX');

-- ============================================================================
-- SCRAP SHOP CAPABILITIES
-- Scrap locations handle dismantling and material processing
-- ============================================================================

-- Scrap car types (all types accepted)
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'car_type', 'Tank', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'car_type', 'Hopper', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'car_type', 'Gondola', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'car_type', 'Boxcar', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'car_type', 'Flatcar', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%';

-- Scrap services
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'service', 'Scrapping', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'service', 'Dismantling', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'service', 'Parts Recovery', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%' AND shop_code IN ('Z-CHI', 'Z-ATL', 'Z-PIT', 'Z-LAX')
UNION ALL
SELECT shop_code, 'service', 'Hazmat Handling', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%' AND shop_code IN ('Z-HOU', 'Z-CHI', 'Z-LAX', 'Z-PIT');

-- Scrap materials processed
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'material', 'Carbon Steel', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'material', 'Stainless', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'material', 'Aluminum', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%' AND shop_code IN ('Z-CHI', 'Z-LAX', 'Z-PIT');

-- Environmental certifications for scrap
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'certification', 'EPA Compliant', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%'
UNION ALL
SELECT shop_code, 'certification', 'Hazmat Certified', '2024-01-01' FROM shops WHERE shop_code LIKE 'Z-%' AND shop_code IN ('Z-HOU', 'Z-CHI', 'Z-LAX', 'Z-PIT');

-- ============================================================================
-- UPDATE EXISTING REPAIR SHOPS TO HAVE VARIED CAPACITY
-- ============================================================================
UPDATE shops SET capacity = 25 WHERE shop_code = 'AITX-SAR';
UPDATE shops SET capacity = 35 WHERE shop_code = 'AITX-NKC';
UPDATE shops SET capacity = 15 WHERE shop_code = 'AITX-MND';
UPDATE shops SET capacity = 40 WHERE shop_code = 'AITX-LAP';
UPDATE shops SET capacity = 45 WHERE shop_code = 'AITX-HOU';
UPDATE shops SET capacity = 20 WHERE shop_code = 'AITX-BRK';
UPDATE shops SET capacity = 18 WHERE shop_code = 'AITX-BUD';
UPDATE shops SET capacity = 30 WHERE shop_code = 'AITX-LGV';
UPDATE shops SET capacity = 22 WHERE shop_code = 'AITX-TEN';
UPDATE shops SET capacity = 28 WHERE shop_code = 'AITX-KCK';
UPDATE shops SET capacity = 24 WHERE shop_code = 'AITX-MIL';
UPDATE shops SET capacity = 20 WHERE shop_code = 'AITX-SWT';
UPDATE shops SET capacity = 35 WHERE shop_code = 'AITX-GDR';
UPDATE shops SET capacity = 26 WHERE shop_code = 'AITX-CLN';
UPDATE shops SET capacity = 32 WHERE shop_code = 'AITX-PCT';

-- Update generic shops with varied capacity
UPDATE shops SET capacity = 30 WHERE shop_code = 'BNSF001';
UPDATE shops SET capacity = 25 WHERE shop_code = 'BNSF002';
UPDATE shops SET capacity = 50 WHERE shop_code = 'UP001';
UPDATE shops SET capacity = 35 WHERE shop_code = 'UP002';
UPDATE shops SET capacity = 28 WHERE shop_code = 'NS001';
UPDATE shops SET capacity = 40 WHERE shop_code = 'NS002';
UPDATE shops SET capacity = 45 WHERE shop_code = 'CSX001';
UPDATE shops SET capacity = 22 WHERE shop_code = 'CSX002';
UPDATE shops SET capacity = 38 WHERE shop_code = 'CN001';
UPDATE shops SET capacity = 55 WHERE shop_code = 'CN002';
UPDATE shops SET capacity = 20 WHERE shop_code = 'KCS001';
UPDATE shops SET capacity = 42 WHERE shop_code = 'CPKC001';
UPDATE shops SET capacity = 60 WHERE shop_code = 'IND001';
UPDATE shops SET capacity = 48 WHERE shop_code = 'IND002';
UPDATE shops SET capacity = 32 WHERE shop_code = 'IND003';

-- Make sure all existing repair shops have designation set
UPDATE shops SET shop_designation = 'repair' WHERE shop_designation IS NULL;
UPDATE shops SET shop_designation = 'repair' WHERE shop_code NOT LIKE 'Y-%' AND shop_code NOT LIKE 'Z-%';

-- ============================================================================
-- VERIFICATION QUERIES (commented out for production)
-- ============================================================================
-- SELECT shop_designation, COUNT(*) as count, SUM(capacity) as total_capacity
-- FROM shops WHERE is_active = TRUE GROUP BY shop_designation;
--
-- SELECT shop_code, shop_name, shop_designation, capacity, tier
-- FROM shops WHERE shop_code LIKE 'Y-%' OR shop_code LIKE 'Z-%' ORDER BY shop_code;
