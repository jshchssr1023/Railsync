-- ============================================================================
-- Migration 047: Comprehensive 3-Year Historical Demo Data
-- Covers 2023-01 through 2026-02 across all feature areas
-- Safe to run multiple times (ON CONFLICT DO NOTHING)
-- ============================================================================

-- Reference IDs
-- Admin:    de69920f-cdcb-4668-9f21-9c4dbccfb8c9
-- Operator: 7b15c7ba-1b51-4aef-a48c-338e0713405f
-- Customer: 63d82d01-7bff-4d4d-8774-59babd94e9a2

-- ============================================================================
-- 1. UPDATE EXISTING CARS WITH LESSEE/OWNER METADATA
-- ============================================================================

UPDATE cars SET lessee_code = 'ADM', lessee_name = 'Archer Daniels Midland', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Epoxy'), commodity = COALESCE(commodity, 'Vegetable Oil')
WHERE car_number LIKE 'SHPX200%';

UPDATE cars SET lessee_code = 'BASF', lessee_name = 'BASF Corporation', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'High Bake'), commodity = COALESCE(commodity, 'Chemical - Organic')
WHERE car_number LIKE 'SHPX201%';

UPDATE cars SET lessee_code = 'DUPONT', lessee_name = 'DuPont Chemical', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Stainless'),
  lining_type = COALESCE(lining_type, 'Vinyl Ester'), commodity = COALESCE(commodity, 'Chemical - Inorganic')
WHERE car_number LIKE 'SHPX202%';

UPDATE cars SET lessee_code = 'DOW', lessee_name = 'Dow Chemical', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Rubber'), commodity = COALESCE(commodity, 'Chemical - Specialty')
WHERE car_number LIKE 'SHPX205%';

UPDATE cars SET lessee_code = 'EXXON', lessee_name = 'ExxonMobil', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  commodity = COALESCE(commodity, 'Petroleum - Crude')
WHERE car_number LIKE 'SHPX206%';

UPDATE cars SET lessee_code = 'CARGILL', lessee_name = 'Cargill Inc', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Stainless'),
  lining_type = COALESCE(lining_type, 'Epoxy'), commodity = COALESCE(commodity, 'Vegetable Oil - Soybean')
WHERE car_number LIKE 'SHPX207%';

UPDATE cars SET lessee_code = 'BUNGE', lessee_name = 'Bunge North America', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Hopper'), material_type = COALESCE(material_type, 'Carbon Steel'),
  commodity = COALESCE(commodity, 'Grain - Soybeans')
WHERE car_number LIKE 'SHPX209%';

UPDATE cars SET lessee_code = 'MOSAIC', lessee_name = 'Mosaic Company', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Rubber'), commodity = COALESCE(commodity, 'Phosphoric Acid')
WHERE car_number LIKE 'SHPX211%';

UPDATE cars SET lessee_code = 'ADM', lessee_name = 'Archer Daniels Midland', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Epoxy'), commodity = COALESCE(commodity, 'Corn Syrup')
WHERE car_number LIKE 'SHPX213%';

UPDATE cars SET lessee_code = 'DUPONT', lessee_name = 'DuPont Chemical', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Plasite'), commodity = COALESCE(commodity, 'Sulfuric Acid')
WHERE car_number LIKE 'SHPX214%';

UPDATE cars SET lessee_code = 'BASF', lessee_name = 'BASF Corporation', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'High Bake'), commodity = COALESCE(commodity, 'Methanol')
WHERE car_number LIKE 'SHPX215%';

UPDATE cars SET lessee_code = 'EXXON', lessee_name = 'ExxonMobil', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  commodity = COALESCE(commodity, 'Petroleum - Gasoline')
WHERE car_number LIKE 'SHPX220%';

UPDATE cars SET lessee_code = 'CARGILL', lessee_name = 'Cargill Inc', owner_code = 'SHPX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Stainless'),
  lining_type = COALESCE(lining_type, 'Epoxy'), commodity = COALESCE(commodity, 'Vegetable Oil - Canola')
WHERE car_number LIKE 'SHPX240%';

UPDATE cars SET lessee_code = 'CARGILL', lessee_name = 'Cargill Inc', owner_code = 'SHQX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Epoxy'), commodity = COALESCE(commodity, 'Vegetable Oil')
WHERE car_number LIKE 'SHQX006%';

UPDATE cars SET lessee_code = 'ADM', lessee_name = 'Archer Daniels Midland', owner_code = 'SHQX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'High Bake'), commodity = COALESCE(commodity, 'Corn Syrup')
WHERE car_number LIKE 'SHQX007%';

UPDATE cars SET lessee_code = 'DUPONT', lessee_name = 'DuPont Chemical', owner_code = 'SHQX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Vinyl Ester'), commodity = COALESCE(commodity, 'Chemical - Specialty')
WHERE car_number LIKE 'SHQX009%' AND car_number < 'SHQX009700';

UPDATE cars SET lessee_code = 'BASF', lessee_name = 'BASF Corporation', owner_code = 'SHQX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'High Bake'), commodity = COALESCE(commodity, 'Chemical - Organic')
WHERE car_number LIKE 'SHQX010%';

UPDATE cars SET lessee_code = 'DOW', lessee_name = 'Dow Chemical', owner_code = 'SHQX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Rubber'), commodity = COALESCE(commodity, 'Styrene')
WHERE car_number LIKE 'SHQX050%';

UPDATE cars SET lessee_code = 'MOSAIC', lessee_name = 'Mosaic Company', owner_code = 'SHQX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Rubber'), commodity = COALESCE(commodity, 'Phosphoric Acid')
WHERE car_number LIKE 'SHQX051%';

UPDATE cars SET lessee_code = 'CARGILL', lessee_name = 'Cargill Inc', owner_code = 'TCBX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Epoxy'), commodity = COALESCE(commodity, 'Vegetable Oil')
WHERE car_number LIKE 'TCBX%';

UPDATE cars SET lessee_code = 'EXXON', lessee_name = 'ExxonMobil', owner_code = 'TEIX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  commodity = COALESCE(commodity, 'Petroleum - Naphtha')
WHERE car_number LIKE 'TEIX%';

UPDATE cars SET lessee_code = 'ADM', lessee_name = 'Archer Daniels Midland', owner_code = 'TAEX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Epoxy'), commodity = COALESCE(commodity, 'Ethanol')
WHERE car_number LIKE 'TAEX%';

-- Catch-all: remaining SHQX cars with numeric lessee codes
UPDATE cars SET lessee_code = 'DOW', lessee_name = 'Dow Chemical', owner_code = 'SHQX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'Rubber'), commodity = COALESCE(commodity, 'Chemical - Organic')
WHERE car_number LIKE 'SHQX%' AND lessee_code SIMILAR TO '[0-9]+';

-- ACFX cars
UPDATE cars SET lessee_code = 'BASF', lessee_name = 'BASF Corporation', owner_code = 'ACFX',
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel'),
  lining_type = COALESCE(lining_type, 'High Bake'), commodity = COALESCE(commodity, 'Chemical - Organic')
WHERE car_number LIKE 'ACFX%' AND lessee_code SIMILAR TO '[0-9]+';

-- Remaining small marks
UPDATE cars SET lessee_code = 'DOW', lessee_name = 'Dow Chemical', owner_code = LEFT(car_number, 4)
WHERE car_number SIMILAR TO '(CEFX|CLIX|STPX|TILX)%' AND lessee_code SIMILAR TO '[0-9]+';

-- Any remaining with numeric codes
UPDATE cars SET lessee_code = 'ADM', lessee_name = 'Archer Daniels Midland', owner_code = LEFT(car_number, 4),
  product_code = COALESCE(product_code, 'Tank'), material_type = COALESCE(material_type, 'Carbon Steel')
WHERE lessee_code SIMILAR TO '[0-9]+';

-- Set qualification/inspection years
UPDATE cars SET
  tank_qual_year = 2021 + (HASHTEXT(car_number) % 4),
  qual_exp_date = ('2023-01-01'::date + ((HASHTEXT(car_number) % 1460) || ' days')::interval)::date,
  rule_88b_year = 2020 + (HASHTEXT(car_number) % 5),
  safety_relief_year = 2021 + (HASHTEXT(car_number) % 4),
  stub_sill_year = 2019 + (HASHTEXT(car_number) % 6),
  interior_lining_year = 2020 + (HASHTEXT(car_number) % 5),
  car_age = 5 + (HASHTEXT(car_number) % 25)
WHERE car_number LIKE 'SHPX%' OR car_number LIKE 'SHQX%' OR car_number LIKE 'TCBX%';

-- ============================================================================
-- 2. RUNNING REPAIRS BUDGET — 36 months (Jan 2023 – Feb 2026)
-- ============================================================================

DELETE FROM running_repairs_budget WHERE fiscal_year IN (2023, 2024, 2025) OR (fiscal_year = 2026 AND month IN ('2026-01', '2026-02'));

INSERT INTO running_repairs_budget (fiscal_year, month, cars_on_lease, allocation_per_car, monthly_budget, actual_spend, actual_car_count, remaining_budget, notes, created_by)
VALUES
  (2023, '2023-01', 1200, 125.00, 150000, 142350, 18, 7650, 'January actuals finalized', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-02', 1200, 125.00, 150000, 138200, 17, 11800, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-03', 1210, 125.00, 151250, 165800, 22, -14550, 'Over budget - bad order surge', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-04', 1210, 125.00, 151250, 148900, 20, 2350, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-05', 1215, 125.00, 151875, 155200, 21, -3325, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-06', 1220, 125.00, 152500, 143600, 19, 8900, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-07', 1220, 125.00, 152500, 131200, 16, 21300, 'Summer slowdown', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-08', 1225, 125.00, 153125, 149800, 20, 3325, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-09', 1225, 125.00, 153125, 162400, 22, -9275, 'Qualification rush Q3', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-10', 1230, 125.00, 153750, 158100, 21, -4350, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-11', 1230, 125.00, 153750, 147600, 19, 6150, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, '2023-12', 1235, 125.00, 154375, 136200, 17, 18175, 'Holiday slowdown', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-01', 1240, 130.00, 161200, 152800, 19, 8400, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-02', 1240, 130.00, 161200, 158900, 20, 2300, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-03', 1250, 130.00, 162500, 171200, 23, -8700, 'Spring qualification push', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-04', 1255, 130.00, 163150, 159400, 21, 3750, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-05', 1260, 130.00, 163800, 167200, 22, -3400, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-06', 1260, 130.00, 163800, 155100, 20, 8700, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-07', 1265, 130.00, 164450, 148300, 18, 16150, 'Mid-year budget review', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-08', 1270, 130.00, 165100, 162800, 21, 2300, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-09', 1275, 130.00, 165750, 178400, 24, -12650, 'Major bad order month', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-10', 1275, 130.00, 165750, 163200, 21, 2550, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-11', 1280, 130.00, 166400, 159800, 20, 6600, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, '2024-12', 1280, 130.00, 166400, 142500, 18, 23900, 'Year-end slowdown', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-01', 1290, 135.00, 174150, 168200, 21, 5950, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-02', 1290, 135.00, 174150, 171800, 22, 2350, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-03', 1300, 135.00, 175500, 182400, 24, -6900, 'Spring surge', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-04', 1305, 135.00, 176175, 173600, 22, 2575, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-05', 1310, 135.00, 176850, 179200, 23, -2350, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-06', 1310, 135.00, 176850, 168400, 21, 8450, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-07', 1315, 135.00, 177525, 155800, 19, 21725, 'Summer dip', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-08', 1320, 135.00, 178200, 174600, 22, 3600, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-09', 1320, 135.00, 178200, 185400, 25, -7200, 'Q3 qualification rush', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-10', 1325, 135.00, 178875, 176200, 23, 2675, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-11', 1330, 135.00, 179550, 172800, 22, 6750, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, '2025-12', 1330, 135.00, 179550, 158200, 20, 21350, 'Year-end', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2026, '2026-01', 1340, 140.00, 187600, 181400, 23, 6200, 'New fiscal year', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2026, '2026-02', 1345, 140.00, 188300, NULL, NULL, 188300, 'Current month', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9');

-- ============================================================================
-- 3. SERVICE EVENT BUDGETS — 3 fiscal years
-- ============================================================================

INSERT INTO service_event_budget (fiscal_year, event_type, budgeted_car_count, avg_cost_per_car, total_budget, fleet_segment, car_type, notes, created_by)
VALUES
  (2023, 'Qualification', 120, 5500, 660000, 'General Service', 'Tank', 'Annual qualification program', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, 'Assignment', 45, 4200, 189000, 'All', 'Tank', 'New lease assignments', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2023, 'Return', 30, 3800, 114000, 'All', 'Tank', 'Lease returns', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, 'Qualification', 130, 5800, 754000, 'General Service', 'Tank', 'Increased volume', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, 'Assignment', 50, 4500, 225000, 'All', 'Tank', 'Growth year', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2024, 'Return', 35, 4000, 140000, 'All', 'Tank', 'Lease returns', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, 'Qualification', 140, 6000, 840000, 'General Service', 'Tank', 'Peak qualification year', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, 'Assignment', 55, 4800, 264000, 'All', 'Tank', 'Steady growth', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2025, 'Return', 40, 4200, 168000, 'All', 'Tank', 'Returns', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2026, 'Qualification', 150, 6200, 930000, 'General Service', 'Tank', 'FY26 forecast', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2026, 'Assignment', 60, 5000, 300000, 'All', 'Tank', 'FY26 budget', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (2026, 'Return', 45, 4500, 202500, 'All', 'Tank', 'FY26 returns', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9');

-- ============================================================================
-- 4. HISTORICAL CAR ASSIGNMENTS — 3 years
-- ============================================================================

INSERT INTO car_assignments (car_mark_number, car_number, shop_code, shop_name, target_month, status, source, estimated_cost, actual_cost, created_by_id, created_at)
VALUES
  -- 2023 Complete
  (gen_random_uuid(), 'SHPX200883', 'BNSF001', 'Alliance Repair Center', '2023-01', 'Complete', 'demand_plan', 5200, 4980, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-01-05'),
  (gen_random_uuid(), 'SHPX200885', 'NS001', 'Roanoke Heavy Repair', '2023-01', 'Complete', 'demand_plan', 6100, 6350, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-01-08'),
  (gen_random_uuid(), 'SHQX009730', 'CSX001', 'Waycross Complex', '2023-02', 'Complete', 'demand_plan', 4800, 4650, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-02-01'),
  (gen_random_uuid(), 'TCBX231000', 'UP001', 'North Platte Facility', '2023-02', 'Complete', 'service_plan', 3900, 4100, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-02-10'),
  (gen_random_uuid(), 'SHPX201146', 'BNSF002', 'Galesburg Tank Shop', '2023-03', 'Complete', 'demand_plan', 5500, 5380, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-03-01'),
  (gen_random_uuid(), 'SHQX050735', 'CPKC001', 'Kansas City Hub', '2023-03', 'Complete', 'demand_plan', 7200, 7450, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-03-05'),
  (gen_random_uuid(), 'SHPX202933', 'NS002', 'Atlanta Terminal', '2023-04', 'Complete', 'quick_shop', 4200, 4050, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-04-01'),
  (gen_random_uuid(), 'TEIX025166', 'KCS001', 'Shreveport Terminal', '2023-04', 'Complete', 'demand_plan', 5800, 5920, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-04-10'),
  (gen_random_uuid(), 'SHPX205321', 'CN001', 'Memphis Intermodal', '2023-05', 'Complete', 'demand_plan', 4500, 4380, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-05-01'),
  (gen_random_uuid(), 'TAEX000252', 'BNSF001', 'Alliance Repair Center', '2023-05', 'Complete', 'service_plan', 6800, 7100, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-05-05'),
  (gen_random_uuid(), 'SHQX007222', 'UP002', 'Roseville Yard', '2023-06', 'Complete', 'demand_plan', 5100, 5250, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-06-01'),
  (gen_random_uuid(), 'TCBX280000', 'CSX002', 'Cumberland Shops', '2023-06', 'Complete', 'demand_plan', 4700, 4550, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-06-10'),
  (gen_random_uuid(), 'SHPX206570', 'IND001', 'Trinity Industries', '2023-07', 'Complete', 'demand_plan', 5900, 6100, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-07-01'),
  (gen_random_uuid(), 'SHQX010136', 'BNSF001', 'Alliance Repair Center', '2023-07', 'Complete', 'demand_plan', 4800, 4650, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-07-08'),
  (gen_random_uuid(), 'SHPX207084', 'NS001', 'Roanoke Heavy Repair', '2023-08', 'Complete', 'bad_order', 8500, 9200, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-08-01'),
  (gen_random_uuid(), 'SHPX213549', 'BNSF002', 'Galesburg Tank Shop', '2023-08', 'Complete', 'demand_plan', 5200, 5100, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-08-12'),
  (gen_random_uuid(), 'SHQX009402', 'UP001', 'North Platte Facility', '2023-09', 'Complete', 'demand_plan', 4600, 4780, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-09-01'),
  (gen_random_uuid(), 'TCBX231001', 'CSX001', 'Waycross Complex', '2023-09', 'Complete', 'service_plan', 3800, 3650, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-09-10'),
  (gen_random_uuid(), 'SHPX214341', 'CN002', 'Chicago Gateway', '2023-10', 'Complete', 'demand_plan', 5400, 5580, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-10-01'),
  (gen_random_uuid(), 'SHQX050736', 'CPKC001', 'Kansas City Hub', '2023-10', 'Complete', 'demand_plan', 6200, 6050, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-10-08'),
  (gen_random_uuid(), 'TEIX025167', 'BNSF001', 'Alliance Repair Center', '2023-11', 'Complete', 'demand_plan', 5000, 4850, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-11-01'),
  (gen_random_uuid(), 'SHPX200886', 'NS002', 'Atlanta Terminal', '2023-11', 'Complete', 'quick_shop', 4300, 4500, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-11-10'),
  (gen_random_uuid(), 'SHQX007228', 'KCS001', 'Shreveport Terminal', '2023-12', 'Complete', 'demand_plan', 5600, 5420, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-12-01'),
  (gen_random_uuid(), 'TAEX000256', 'IND003', 'Progress Rail', '2023-12', 'Complete', 'demand_plan', 3800, 3950, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-12-05'),
  -- 2024 Complete
  (gen_random_uuid(), 'SHPX200887', 'BNSF001', 'Alliance Repair Center', '2024-01', 'Complete', 'demand_plan', 5500, 5350, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-01-03'),
  (gen_random_uuid(), 'SHPX200888', 'NS001', 'Roanoke Heavy Repair', '2024-01', 'Complete', 'demand_plan', 6200, 6500, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-01-08'),
  (gen_random_uuid(), 'SHQX009731', 'CSX001', 'Waycross Complex', '2024-02', 'Complete', 'service_plan', 4900, 4750, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-02-01'),
  (gen_random_uuid(), 'TCBX231002', 'BNSF002', 'Galesburg Tank Shop', '2024-02', 'Complete', 'demand_plan', 5300, 5180, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-02-12'),
  (gen_random_uuid(), 'SHPX201457', 'UP001', 'North Platte Facility', '2024-03', 'Complete', 'demand_plan', 4100, 4280, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-03-01'),
  (gen_random_uuid(), 'SHQX050737', 'CPKC001', 'Kansas City Hub', '2024-03', 'Complete', 'demand_plan', 7500, 7320, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-03-05'),
  (gen_random_uuid(), 'SHPX202938', 'CN001', 'Memphis Intermodal', '2024-04', 'Complete', 'demand_plan', 4600, 4450, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-04-01'),
  (gen_random_uuid(), 'TEIX025168', 'KCS001', 'Shreveport Terminal', '2024-04', 'Complete', 'quick_shop', 5900, 6100, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-04-08'),
  (gen_random_uuid(), 'SHPX205994', 'BNSF001', 'Alliance Repair Center', '2024-05', 'Complete', 'demand_plan', 5400, 5280, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-05-01'),
  (gen_random_uuid(), 'TAEX000261', 'NS002', 'Atlanta Terminal', '2024-05', 'Complete', 'demand_plan', 4300, 4500, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-05-10'),
  (gen_random_uuid(), 'SHQX007229', 'UP002', 'Roseville Yard', '2024-06', 'Complete', 'service_plan', 5800, 5650, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-06-01'),
  (gen_random_uuid(), 'TCBX280001', 'CSX002', 'Cumberland Shops', '2024-06', 'Complete', 'demand_plan', 4800, 4950, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-06-08'),
  (gen_random_uuid(), 'SHPX206596', 'IND001', 'Trinity Industries', '2024-07', 'Complete', 'demand_plan', 6100, 5980, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-07-01'),
  (gen_random_uuid(), 'SHQX010138', 'BNSF001', 'Alliance Repair Center', '2024-07', 'Complete', 'demand_plan', 5000, 4850, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-07-10'),
  (gen_random_uuid(), 'SHPX207088', 'NS001', 'Roanoke Heavy Repair', '2024-08', 'Complete', 'bad_order', 9000, 9500, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-08-01'),
  (gen_random_uuid(), 'SHPX213550', 'BNSF002', 'Galesburg Tank Shop', '2024-08', 'Complete', 'demand_plan', 5400, 5220, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-08-12'),
  (gen_random_uuid(), 'SHQX009604', 'CSX001', 'Waycross Complex', '2024-09', 'Complete', 'demand_plan', 4700, 4880, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-09-01'),
  (gen_random_uuid(), 'TCBX231003', 'CN002', 'Chicago Gateway', '2024-09', 'Complete', 'demand_plan', 5600, 5450, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-09-05'),
  (gen_random_uuid(), 'SHPX214344', 'UP001', 'North Platte Facility', '2024-10', 'Complete', 'service_plan', 4200, 4380, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-10-01'),
  (gen_random_uuid(), 'SHQX050738', 'CPKC001', 'Kansas City Hub', '2024-10', 'Complete', 'demand_plan', 6800, 6650, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-10-08'),
  (gen_random_uuid(), 'TEIX025169', 'BNSF001', 'Alliance Repair Center', '2024-11', 'Complete', 'demand_plan', 5200, 5050, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-11-01'),
  (gen_random_uuid(), 'SHPX200889', 'NS002', 'Atlanta Terminal', '2024-11', 'Complete', 'demand_plan', 4500, 4680, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-11-10'),
  (gen_random_uuid(), 'SHQX007234', 'KCS001', 'Shreveport Terminal', '2024-12', 'Complete', 'demand_plan', 5800, 5620, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-12-01'),
  (gen_random_uuid(), 'TAEX000264', 'IND002', 'Greenbrier Repair', '2024-12', 'Complete', 'demand_plan', 4900, 5100, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-12-05'),
  -- 2025 Complete
  (gen_random_uuid(), 'SHPX200890', 'BNSF001', 'Alliance Repair Center', '2025-01', 'Complete', 'demand_plan', 5600, 5480, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-01-03'),
  (gen_random_uuid(), 'SHPX200891', 'NS001', 'Roanoke Heavy Repair', '2025-01', 'Complete', 'demand_plan', 6400, 6250, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-01-08'),
  (gen_random_uuid(), 'SHQX009732', 'BNSF002', 'Galesburg Tank Shop', '2025-02', 'Complete', 'demand_plan', 5300, 5450, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-02-01'),
  (gen_random_uuid(), 'TCBX231004', 'CSX001', 'Waycross Complex', '2025-02', 'Complete', 'service_plan', 4100, 3980, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-02-10'),
  (gen_random_uuid(), 'SHPX201459', 'UP001', 'North Platte Facility', '2025-03', 'Complete', 'demand_plan', 4400, 4580, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-03-01'),
  (gen_random_uuid(), 'SHQX050739', 'CPKC001', 'Kansas City Hub', '2025-03', 'Complete', 'demand_plan', 7300, 7180, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-03-05'),
  (gen_random_uuid(), 'SHPX202960', 'CN001', 'Memphis Intermodal', '2025-04', 'Complete', 'demand_plan', 4800, 4650, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-04-01'),
  (gen_random_uuid(), 'TEIX025171', 'IND001', 'Trinity Industries', '2025-04', 'Complete', 'demand_plan', 6000, 6200, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-04-08'),
  (gen_random_uuid(), 'SHPX205995', 'BNSF001', 'Alliance Repair Center', '2025-05', 'Complete', 'demand_plan', 5500, 5380, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-05-01'),
  (gen_random_uuid(), 'TAEX000268', 'NS002', 'Atlanta Terminal', '2025-05', 'Complete', 'quick_shop', 4400, 4580, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-05-10'),
  (gen_random_uuid(), 'SHQX007236', 'UP002', 'Roseville Yard', '2025-06', 'Complete', 'demand_plan', 5900, 5750, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-06-01'),
  (gen_random_uuid(), 'TCBX280003', 'CSX002', 'Cumberland Shops', '2025-06', 'Complete', 'demand_plan', 4900, 5080, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-06-08'),
  (gen_random_uuid(), 'SHPX206598', 'KCS001', 'Shreveport Terminal', '2025-07', 'Complete', 'demand_plan', 5100, 4980, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-07-01'),
  (gen_random_uuid(), 'SHQX010142', 'BNSF001', 'Alliance Repair Center', '2025-07', 'Complete', 'demand_plan', 5300, 5150, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-07-10'),
  (gen_random_uuid(), 'SHPX207090', 'NS001', 'Roanoke Heavy Repair', '2025-08', 'Complete', 'bad_order', 9200, 9800, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-08-01'),
  (gen_random_uuid(), 'SHPX213551', 'BNSF002', 'Galesburg Tank Shop', '2025-08', 'Complete', 'demand_plan', 5500, 5380, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-08-12'),
  (gen_random_uuid(), 'SHQX009605', 'CPKC001', 'Kansas City Hub', '2025-09', 'Complete', 'demand_plan', 6500, 6350, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-09-01'),
  (gen_random_uuid(), 'TCBX231015', 'CN002', 'Chicago Gateway', '2025-09', 'Complete', 'service_plan', 5800, 5650, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-09-05'),
  (gen_random_uuid(), 'SHPX214345', 'UP001', 'North Platte Facility', '2025-10', 'Complete', 'demand_plan', 4500, 4680, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-10-01'),
  (gen_random_uuid(), 'SHQX050740', 'IND001', 'Trinity Industries', '2025-10', 'Complete', 'demand_plan', 6200, 6050, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-10-08'),
  (gen_random_uuid(), 'TEIX025172', 'BNSF001', 'Alliance Repair Center', '2025-11', 'Complete', 'demand_plan', 5400, 5280, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-11-01'),
  (gen_random_uuid(), 'SHPX200892', 'NS002', 'Atlanta Terminal', '2025-11', 'Complete', 'demand_plan', 4600, 4780, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-11-10'),
  (gen_random_uuid(), 'SHQX007237', 'CSX001', 'Waycross Complex', '2025-12', 'Complete', 'demand_plan', 5000, 4850, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-12-01'),
  (gen_random_uuid(), 'TAEX000386', 'IND003', 'Progress Rail', '2025-12', 'Complete', 'demand_plan', 3900, 4050, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-12-05');

-- ============================================================================
-- 5. HISTORICAL SHOPPING EVENTS
-- ============================================================================

INSERT INTO shopping_events (event_number, car_number, shop_code, state, shopping_type_code, created_by_id, created_at)
VALUES
  ('SE-2023-H001', 'SHPX200883', 'BNSF001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-01-10'),
  ('SE-2023-H002', 'SHPX200885', 'NS001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-01-15'),
  ('SE-2023-H003', 'SHQX009730', 'CSX001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-02-05'),
  ('SE-2023-H004', 'SHPX201146', 'BNSF002', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-03-10'),
  ('SE-2023-H005', 'SHPX207084', 'NS001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-08-05'),
  ('SE-2023-H006', 'SHPX206570', 'IND001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-07-08'),
  ('SE-2023-H007', 'TEIX025166', 'KCS001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-04-12'),
  ('SE-2024-H001', 'SHPX200887', 'BNSF001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-01-08'),
  ('SE-2024-H002', 'SHPX200888', 'NS001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-01-12'),
  ('SE-2024-H003', 'TCBX231002', 'BNSF002', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-02-15'),
  ('SE-2024-H004', 'SHPX201457', 'UP001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-03-05'),
  ('SE-2024-H005', 'SHPX207088', 'NS001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-08-05'),
  ('SE-2024-H006', 'SHPX206596', 'IND001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-07-05'),
  ('SE-2024-H007', 'TEIX025168', 'KCS001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-04-10'),
  ('SE-2025-H001', 'SHPX200890', 'BNSF001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-01-08'),
  ('SE-2025-H002', 'SHPX200891', 'NS001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-01-12'),
  ('SE-2025-H003', 'SHQX009732', 'BNSF002', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-02-05'),
  ('SE-2025-H004', 'SHPX201459', 'UP001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-03-05'),
  ('SE-2025-H005', 'SHPX207090', 'NS001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-08-05'),
  ('SE-2025-H006', 'TEIX025171', 'IND001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-04-10'),
  ('SE-2025-H007', 'SHPX206598', 'KCS001', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-07-05'),
  ('SE-2025-H008', 'SHQX050739', 'CPKC001', 'RELEASED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-03-08');

-- ============================================================================
-- 6. HISTORICAL BAD ORDERS
-- ============================================================================

INSERT INTO bad_order_reports (car_id, car_number, reported_date, issue_type, issue_description, severity, location, reported_by, reporter_contact, status, created_by_id)
VALUES
  (gen_random_uuid(), 'SHPX200886', '2023-03-15', 'mechanical', 'Bottom outlet valve leaking product.', 'critical', 'Alliance, NE', 'Mike Thompson - BNSF', 'mthompson@bnsf.com', 'resolved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (gen_random_uuid(), 'SHQX009733', '2023-06-20', 'structural', 'Stub sill crack found during inspection.', 'high', 'Roanoke, VA', 'Jim Davis - NS', 'jdavis@nscorp.com', 'resolved', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  (gen_random_uuid(), 'TCBX231017', '2023-09-10', 'contamination', 'Interior lining delamination.', 'medium', 'Memphis, TN', 'Sarah Lee - CN', 'slee@cn.ca', 'resolved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (gen_random_uuid(), 'SHPX207167', '2024-02-14', 'mechanical', 'Safety relief valve failed pressure test.', 'critical', 'Galesburg, IL', 'Tom Wilson - BNSF', 'twilson@bnsf.com', 'resolved', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  (gen_random_uuid(), 'SHQX050741', '2024-05-08', 'structural', 'Tank shell pitting below minimum thickness.', 'high', 'Kansas City, MO', 'Robert Chen - CPKC', 'rchen@cpkc.com', 'resolved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (gen_random_uuid(), 'TEIX025173', '2024-08-22', 'mechanical', 'Coupler knuckle broken. Car set out.', 'high', 'Shreveport, LA', 'Carlos Ruiz - KCS', 'cruiz@kcs.com', 'resolved', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  (gen_random_uuid(), 'SHPX214346', '2024-11-05', 'contamination', 'Previous commodity residue incompatible.', 'medium', 'Chicago, IL', 'Amy Park - CN', 'apark@cn.ca', 'resolved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (gen_random_uuid(), 'SHPX200895', '2025-01-18', 'mechanical', 'Air brake system failure.', 'critical', 'North Platte, NE', 'Kevin Brown - UP', 'kbrown@up.com', 'resolved', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  (gen_random_uuid(), 'SHQX009734', '2025-04-12', 'structural', 'Heater coil leak detected during loading.', 'high', 'Waycross, GA', 'Lisa Martinez - CSX', 'lmartinez@csx.com', 'resolved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (gen_random_uuid(), 'TCBX280004', '2025-07-20', 'mechanical', 'Truck bearing overheating.', 'critical', 'Cumberland, MD', 'Dave Nelson - CSX', 'dnelson@csx.com', 'resolved', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  (gen_random_uuid(), 'SHPX213552', '2025-10-15', 'contamination', 'Wrong commodity loaded. Needs full cleaning.', 'high', 'Alliance, NE', 'Pat Garcia - BNSF', 'pgarcia@bnsf.com', 'resolved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  (gen_random_uuid(), 'SHPX207168', '2026-01-08', 'mechanical', 'Hatch mechanism jammed. Cannot seal.', 'high', 'Roseville, CA', 'Chris Anderson - UP', 'canderson@up.com', 'assigned', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  (gen_random_uuid(), 'SHQX009735', '2026-01-22', 'structural', 'External corrosion on bottom course.', 'medium', 'Atlanta, GA', 'Rachel Wong - NS', 'rwong@nscorp.com', 'open', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9');

-- Resolve historical bad orders
UPDATE bad_order_reports SET resolved_at = reported_date + INTERVAL '14 days', resolved_by_id = '7b15c7ba-1b51-4aef-a48c-338e0713405f',
  resolution_notes = 'Repaired and returned to service.', resolution_action = 'repair_only'
WHERE status = 'resolved' AND car_number IN ('SHPX200886', 'SHPX207167', 'SHPX200895', 'TCBX280004', 'TEIX025173', 'TCBX231017')
  AND resolved_at IS NULL;

UPDATE bad_order_reports SET resolved_at = reported_date + INTERVAL '21 days', resolved_by_id = 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
  resolution_notes = 'Combined with existing shop assignment.', resolution_action = 'expedite_existing'
WHERE status = 'resolved' AND car_number IN ('SHQX009733', 'SHQX050741', 'SHQX009734', 'SHPX213552', 'SHPX214346')
  AND resolved_at IS NULL;

-- ============================================================================
-- 7. INVOICE CASES — historical
-- ============================================================================

INSERT INTO invoice_cases (case_number, invoice_type, workflow_state, vendor_name, shop_code, invoice_number, invoice_date, currency, total_amount, car_marks, lessee, received_at, created_by)
VALUES
  ('IC-2023-H001', 'SHOP', 'PAID', 'BNSF Railway - Alliance Repair', 'BNSF001', 'BN-INV-20230115', '2023-01-15', 'USD', 4980, '{SHPX200883}', 'Archer Daniels Midland', '2023-01-20', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2023-H002', 'SHOP', 'PAID', 'Norfolk Southern - Roanoke', 'NS001', 'NS-INV-20230125', '2023-01-25', 'USD', 6350, '{SHPX200885}', 'BASF Corporation', '2023-01-30', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2023-H003', 'SHOP', 'PAID', 'CSX - Waycross Complex', 'CSX001', 'CSX-INV-20230310', '2023-03-10', 'USD', 4650, '{SHQX009730}', 'DuPont Chemical', '2023-03-15', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2023-H004', 'MRU', 'PAID', 'BNSF Railway - Alliance Repair', 'BNSF001', 'BN-INV-20230520', '2023-05-20', 'USD', 7100, '{TAEX000252}', 'Archer Daniels Midland', '2023-05-25', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2023-H005', 'SHOP', 'PAID', 'Trinity Industries', 'IND001', 'TI-INV-20230815', '2023-08-15', 'USD', 6100, '{SHPX206570}', 'ExxonMobil', '2023-08-20', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2023-H006', 'SHOP', 'CLOSED', 'Norfolk Southern - Roanoke', 'NS001', 'NS-INV-20230905', '2023-09-05', 'USD', 9200, '{SHPX207084}', 'Cargill Inc', '2023-09-10', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2024-H001', 'SHOP', 'PAID', 'BNSF Railway - Alliance Repair', 'BNSF001', 'BN-INV-20240120', '2024-01-20', 'USD', 5350, '{SHPX200887}', 'Archer Daniels Midland', '2024-01-25', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2024-H002', 'SHOP', 'PAID', 'Norfolk Southern - Roanoke', 'NS001', 'NS-INV-20240205', '2024-02-05', 'USD', 6500, '{SHPX200888}', 'BASF Corporation', '2024-02-10', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2024-H003', 'SHOP', 'PAID', 'Union Pacific - North Platte', 'UP001', 'UP-INV-20240412', '2024-04-12', 'USD', 4280, '{SHPX201457}', 'BASF Corporation', '2024-04-17', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2024-H004', 'MRU', 'PAID', 'Norfolk Southern - Roanoke', 'NS001', 'NS-INV-20240910', '2024-09-10', 'USD', 9500, '{SHPX207088}', 'Cargill Inc', '2024-09-15', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2025-H001', 'SHOP', 'PAID', 'BNSF Railway - Alliance Repair', 'BNSF001', 'BN-INV-20250115', '2025-01-15', 'USD', 5480, '{SHPX200890}', 'Archer Daniels Midland', '2025-01-20', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2025-H002', 'SHOP', 'PAID', 'Norfolk Southern - Roanoke', 'NS001', 'NS-INV-20250210', '2025-02-10', 'USD', 6250, '{SHPX200891}', 'BASF Corporation', '2025-02-15', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2025-H003', 'SHOP', 'APPROVED', 'Union Pacific - North Platte', 'UP001', 'UP-INV-20250520', '2025-05-20', 'USD', 4580, '{TAEX000268}', 'Archer Daniels Midland', '2025-05-25', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2025-H004', 'MRU', 'SAP_POSTED', 'Norfolk Southern - Roanoke', 'NS001', 'NS-INV-20250910', '2025-09-10', 'USD', 9800, '{SHPX207090}', 'Cargill Inc', '2025-09-15', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2025-H005', 'SHOP', 'BILLING_REVIEW', 'CPKC - Kansas City Hub', 'CPKC001', 'CPKC-INV-20251010', '2025-10-10', 'USD', 6350, '{SHQX009605}', 'DuPont Chemical', '2025-10-15', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2025-H006', 'SHOP', 'APPROVER_REVIEW', 'BNSF Railway - Alliance Repair', 'BNSF001', 'BN-INV-20251205', '2025-12-05', 'USD', 5280, '{TEIX025172}', 'ExxonMobil', '2025-12-10', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2026-H001', 'SHOP', 'SUBMITTED', 'CSX - Waycross Complex', 'CSX001', 'CSX-INV-20260110', '2026-01-10', 'USD', 4850, '{SHQX007237}', 'DuPont Chemical', '2026-01-15', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('IC-2026-H002', 'MRU', 'RECEIVED', 'Trinity Industries', 'IND001', 'TI-INV-20260125', '2026-01-25', 'USD', 6200, '{SHQX050740}', 'Dow Chemical', '2026-01-30', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('IC-2026-H003', 'SHOP', 'ADMIN_REVIEW', 'BNSF Railway - Galesburg', 'BNSF002', 'BN-INV-20260130', '2026-01-30', 'USD', 5450, '{SHQX009732}', 'BASF Corporation', '2026-02-03', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9');

-- ============================================================================
-- 8. SHOPPING REQUESTS — historical and current
-- ============================================================================

INSERT INTO shopping_requests (request_number, status, customer_company, customer_first_name, customer_last_name, customer_email, customer_phone, car_number, current_railroad, current_location_city, current_location_state, residue_clean, gasket, o_rings, last_known_commodity, shopping_type_code, comments, created_by_id, created_at, submitted_at)
VALUES
  ('SR-20230315-00001', 'approved', 'BASF Corporation', 'Karl', 'Mueller', 'kmueller@basf.com', '973-555-0101', 'SHPX200885', 'NS', 'Roanoke', 'VA', 'yes', 'yes', 'unknown', 'Methanol', 'QUAL_REG', 'Annual qualification due.', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-03-15', '2023-03-15'),
  ('SR-20230620-00001', 'approved', 'Cargill Inc', 'Jennifer', 'Walsh', 'jwalsh@cargill.com', '952-555-0202', 'SHPX207084', 'NS', 'Charlotte', 'NC', 'no', 'unknown', 'yes', 'Vegetable Oil', 'BAD_ORDER', 'Lining failure. Needs repair.', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-06-20', '2023-06-20'),
  ('SR-20240214-00001', 'approved', 'Cargill Inc', 'Jennifer', 'Walsh', 'jwalsh@cargill.com', '952-555-0202', 'SHPX207167', 'BNSF', 'Galesburg', 'IL', 'yes', 'no', 'no', 'Soybean Oil', 'BAD_ORDER', 'Safety valve failure. Critical.', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-02-14', '2024-02-14'),
  ('SR-20240805-00001', 'approved', 'DuPont Chemical', 'Mark', 'Stevens', 'mstevens@dupont.com', '302-555-0303', 'SHPX202960', 'CN', 'Memphis', 'TN', 'unknown', 'yes', 'yes', 'Chemical - Inorganic', 'COMMODITY_CONV', 'Converting from sulfuric acid to phosphoric acid.', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-08-05', '2024-08-05'),
  ('SR-20250118-00001', 'approved', 'ExxonMobil', 'David', 'Park', 'dpark@exxonmobil.com', '713-555-0404', 'SHPX200895', 'UP', 'North Platte', 'NE', 'no', 'no', 'yes', 'Naphtha', 'BAD_ORDER', 'Air brake failure. Urgent.', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-01-18', '2025-01-18'),
  ('SR-20250720-00001', 'approved', 'Cargill Inc', 'Jennifer', 'Walsh', 'jwalsh@cargill.com', '952-555-0202', 'TCBX280004', 'CSX', 'Cumberland', 'MD', 'yes', 'yes', 'unknown', 'Vegetable Oil', 'BAD_ORDER', 'Hot bearing detected.', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-07-20', '2025-07-20'),
  ('SR-20260108-00001', 'under_review', 'ExxonMobil', 'David', 'Park', 'dpark@exxonmobil.com', '713-555-0404', 'SHPX207168', 'UP', 'Roseville', 'CA', 'yes', 'unknown', 'no', 'Gasoline', 'BAD_ORDER', 'Hatch mechanism failure.', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2026-01-08', '2026-01-08'),
  ('SR-20260122-00001', 'submitted', 'BASF Corporation', 'Karl', 'Mueller', 'kmueller@basf.com', '973-555-0101', 'SHQX009735', 'NS', 'Atlanta', 'GA', 'unknown', 'yes', 'yes', 'Chemical - Organic', 'QUAL_REG', 'Qualification due Q2 2026.', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2026-01-22', '2026-01-22'),
  ('SR-20260201-00001', 'draft', 'Dow Chemical', 'Patricia', 'Nguyen', 'pnguyen@dow.com', '989-555-0505', 'SHQX050742', 'BNSF', 'Alliance', 'NE', 'no', 'no', 'unknown', 'Styrene', 'LESSEE_REQ', 'Interior inspection before next load.', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2026-02-01', NULL);

-- Set reviewed info on approved requests
UPDATE shopping_requests SET reviewed_at = submitted_at + INTERVAL '3 days', reviewed_by_id = 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', review_notes = 'Approved. Shopping event created.'
WHERE status = 'approved' AND reviewed_at IS NULL;

-- ============================================================================
-- 9. CAPACITY RESERVATIONS
-- ============================================================================

INSERT INTO capacity_reservations (shop_code, lessee_code, lessee_name, start_year, start_month, end_year, end_month, reserved_slots, allocated_slots, status, notes, created_by, created_at)
VALUES
  ('BNSF001', 'ADM', 'Archer Daniels Midland', 2023, 1, 2023, 6, 12, 12, 'fulfilled', 'H1 2023 qualification', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2022-11-15'),
  ('NS001', 'BASF', 'BASF Corporation', 2023, 1, 2023, 6, 8, 8, 'fulfilled', 'H1 2023 maintenance', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2022-12-01'),
  ('BNSF001', 'CARGILL', 'Cargill Inc', 2023, 7, 2023, 12, 10, 10, 'fulfilled', 'H2 2023 qualification', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-05-15'),
  ('BNSF001', 'ADM', 'Archer Daniels Midland', 2024, 1, 2024, 6, 14, 14, 'fulfilled', 'H1 2024 qualification', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-11-01'),
  ('NS001', 'BASF', 'BASF Corporation', 2024, 1, 2024, 12, 15, 15, 'fulfilled', 'Full year 2024', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-11-15'),
  ('CPKC001', 'DOW', 'Dow Chemical', 2024, 3, 2024, 9, 8, 8, 'fulfilled', 'Relining campaign', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-01-10'),
  ('BNSF001', 'ADM', 'Archer Daniels Midland', 2025, 1, 2025, 12, 16, 16, 'fulfilled', 'Full year 2025', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-10-15'),
  ('NS001', 'DUPONT', 'DuPont Chemical', 2025, 1, 2025, 12, 12, 12, 'fulfilled', 'Full year 2025', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-11-01'),
  ('BNSF001', 'ADM', 'Archer Daniels Midland', 2026, 1, 2026, 12, 18, 2, 'confirmed', 'Full year 2026', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-10-20'),
  ('NS001', 'BASF', 'BASF Corporation', 2026, 1, 2026, 12, 14, 1, 'confirmed', 'Full year 2026', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-11-05'),
  ('CPKC001', 'DOW', 'Dow Chemical', 2026, 3, 2026, 9, 10, 0, 'confirmed', '2026 relining program', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-12-10'),
  ('CSX001', 'MOSAIC', 'Mosaic Company', 2026, 1, 2026, 6, 6, 1, 'confirmed', 'H1 2026 rubber relining', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-12-15'),
  ('UP001', 'EXXON', 'ExxonMobil', 2026, 4, 2026, 9, 8, 0, 'draft', 'Q2-Q3 2026 planned', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2026-01-20');

-- ============================================================================
-- 10. DEMANDS
-- ============================================================================

INSERT INTO demands (name, description, fiscal_year, target_month, car_count, event_type, car_type, default_lessee_code, priority, status, created_by, created_at)
VALUES
  ('Q1 2023 Qualification', 'Tank car qualifications Q1 2023', 2023, '2023-01', 8, 'Qualification', 'Tank', 'ADM', 'High', 'Complete', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2022-12-01'),
  ('Q2 2023 Qualification', 'Tank car qualifications Q2 2023', 2023, '2023-04', 10, 'Qualification', 'Tank', 'BASF', 'High', 'Complete', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-03-01'),
  ('Q3 2023 Qualification', 'Tank car qualifications Q3 2023', 2023, '2023-07', 12, 'Qualification', 'Tank', 'CARGILL', 'Medium', 'Complete', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-06-01'),
  ('Q4 2023 Qualification', 'Tank car qualifications Q4 2023', 2023, '2023-10', 9, 'Qualification', 'Tank', 'DOW', 'High', 'Complete', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-09-01'),
  ('Q1 2024 Qualification', 'Tank car qualifications Q1 2024', 2024, '2024-01', 10, 'Qualification', 'Tank', 'ADM', 'High', 'Complete', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-12-01'),
  ('Q2 2024 Qualification', 'Tank car qualifications Q2 2024', 2024, '2024-04', 12, 'Qualification', 'Tank', 'DUPONT', 'High', 'Complete', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-03-01'),
  ('Q3 2024 Qualification', 'Tank car qualifications Q3 2024', 2024, '2024-07', 14, 'Qualification', 'Tank', 'BASF', 'Medium', 'Complete', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-06-01'),
  ('Q4 2024 Qualification', 'Tank car qualifications Q4 2024', 2024, '2024-10', 11, 'Qualification', 'Tank', 'EXXON', 'High', 'Complete', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-09-01'),
  ('Q1 2025 Qualification', 'Tank car qualifications Q1 2025', 2025, '2025-01', 12, 'Qualification', 'Tank', 'ADM', 'High', 'Complete', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-12-01'),
  ('Q2 2025 Qualification', 'Tank car qualifications Q2 2025', 2025, '2025-04', 14, 'Qualification', 'Tank', 'CARGILL', 'High', 'Complete', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-03-01'),
  ('Q3 2025 Qualification', 'Tank car qualifications Q3 2025', 2025, '2025-07', 15, 'Qualification', 'Tank', 'DOW', 'Medium', 'Complete', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-06-01'),
  ('Q4 2025 Qualification', 'Tank car qualifications Q4 2025', 2025, '2025-10', 13, 'Qualification', 'Tank', 'BASF', 'High', 'Complete', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-09-01'),
  ('Q1 2026 Qualification', 'Tank car qualifications Q1 2026', 2026, '2026-01', 15, 'Qualification', 'Tank', 'ADM', 'High', 'Allocated', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-12-01'),
  ('Q2 2026 Qualification', 'Tank car qualifications Q2 2026', 2026, '2026-04', 16, 'Qualification', 'Tank', 'DUPONT', 'High', 'Confirmed', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2026-01-15'),
  ('Q3 2026 Qualification', 'Tank car qualifications Q3 2026', 2026, '2026-07', 18, 'Qualification', 'Tank', 'CARGILL', 'Medium', 'Forecast', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2026-01-20'),
  ('FY24 Lease Assignments', 'Prepare cars for new lessees FY2024', 2024, '2024-03', 15, 'Assignment', 'Tank', NULL, 'Medium', 'Complete', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-01-15'),
  ('FY25 Lease Assignments', 'Prepare cars for new lessees FY2025', 2025, '2025-03', 18, 'Assignment', 'Tank', NULL, 'Medium', 'Complete', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-01-10'),
  ('FY26 Lease Assignments', 'Prepare cars for new lessees FY2026', 2026, '2026-03', 20, 'Assignment', 'Tank', NULL, 'Medium', 'Confirmed', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2026-01-05');

-- ============================================================================
-- 11. MASTER PLANS
-- ============================================================================

INSERT INTO master_plans (name, description, fiscal_year, planning_month, status, created_by, created_at)
VALUES
  ('FY2023 Master Plan', 'Annual plan for FY2023', 2023, '2023-01', 'archived', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2022-12-15'),
  ('FY2024 Master Plan', 'Annual plan for FY2024', 2024, '2024-01', 'archived', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-12-01'),
  ('FY2025 Master Plan', 'Annual plan for FY2025', 2025, '2025-01', 'archived', '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-11-15'),
  ('FY2026 Master Plan', 'Annual plan for FY2026', 2026, '2026-01', 'active', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-11-01');

-- Master plan versions
INSERT INTO master_plan_versions (plan_id, version_number, label, notes, snapshot_data, allocation_count, total_estimated_cost, created_by, created_at)
SELECT mp.id, v.vn, v.lbl, v.nts, '{}'::jsonb, v.ac, v.tec, v.cb::uuid, v.ca::timestamp
FROM master_plans mp
JOIN (VALUES
  ('FY2023 Master Plan', 1, 'Initial Draft', 'First draft', 24, 132000.00, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2022-12-15'),
  ('FY2023 Master Plan', 2, 'Final Approved', 'Board-approved', 26, 139800.00, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-01-05'),
  ('FY2024 Master Plan', 1, 'Initial Draft', 'First draft', 28, 152600.00, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-12-01'),
  ('FY2024 Master Plan', 2, 'Mid-Year Revision', 'Bad order adjustments', 30, 168200.00, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-07-01'),
  ('FY2024 Master Plan', 3, 'Final', 'Year-end final', 28, 159400.00, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-12-15'),
  ('FY2025 Master Plan', 1, 'Initial Draft', 'First draft', 32, 185000.00, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-11-15'),
  ('FY2025 Master Plan', 2, 'Q2 Revision', 'Added relining campaign', 35, 198500.00, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-04-01'),
  ('FY2025 Master Plan', 3, 'Final', 'Year-end final', 33, 192800.00, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-12-01'),
  ('FY2026 Master Plan', 1, 'Initial Draft', 'FY2026 initial', 38, 228000.00, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2025-11-01'),
  ('FY2026 Master Plan', 2, 'Board Approved', 'Approved by ops board', 40, 242000.00, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2026-01-10')
) AS v(pname, vn, lbl, nts, ac, tec, cb, ca) ON mp.name = v.pname;

-- ============================================================================
-- 12. CCM FORMS
-- ============================================================================

INSERT INTO ccm_forms (lessee_code, lessee_name, company_name, form_date, revision_date, primary_contact_name, primary_contact_email, primary_contact_phone, estimate_approval_contact_name, estimate_approval_contact_email, food_grade, kosher_wash, nitrogen_applied, nitrogen_psi, additional_notes, version, is_current, created_by_id, created_at)
VALUES
  ('ADM', 'Archer Daniels Midland', 'ADM Transportation', '2023-01-15', '2025-06-01', 'Robert Chen', 'rchen@adm.com', '217-555-0101', 'Sarah Williams', 'swilliams@adm.com', true, false, true, '15', 'Food-grade standard. No residual odor. Epoxy lining preferred.', 3, true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-01-15'),
  ('BASF', 'BASF Corporation', 'BASF Rail Services', '2023-03-01', '2025-09-15', 'Klaus Schmidt', 'kschmidt@basf.com', '973-555-0201', 'Maria Garcia', 'mgarcia@basf.com', false, false, true, '25', 'Chemical service. High bake phenolic required for organics.', 2, true, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-03-01'),
  ('CARGILL', 'Cargill Inc', 'Cargill Rail Operations', '2023-02-01', '2025-11-20', 'Jennifer Walsh', 'jwalsh@cargill.com', '952-555-0301', 'Mike Johnson', 'mjohnson@cargill.com', true, true, true, '10', 'Food-grade and kosher. Epoxy or stainless only.', 4, true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2023-02-01'),
  ('DUPONT', 'DuPont Chemical', 'DuPont Rail Logistics', '2023-06-15', '2025-08-01', 'Mark Stevens', 'mstevens@dupont.com', '302-555-0401', 'Lisa Park', 'lpark@dupont.com', false, false, true, '30', 'Vinyl ester for corrosives. Enhanced safety valve testing.', 2, true, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2023-06-15'),
  ('DOW', 'Dow Chemical', 'Dow Supply Chain', '2024-01-10', '2025-10-15', 'Patricia Nguyen', 'pnguyen@dow.com', '989-555-0501', 'James Wilson', 'jwilson@dow.com', false, false, true, '20', 'Rubber lining for styrene. Strict gasket requirements.', 2, true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-01-10'),
  ('EXXON', 'ExxonMobil', 'ExxonMobil Pipeline & Distribution', '2024-03-01', '2025-12-01', 'David Park', 'dpark@exxonmobil.com', '713-555-0601', 'Karen Lee', 'klee@exxonmobil.com', false, false, false, NULL, 'Petroleum. Unlined carbon steel OK. Standard DOT.', 1, true, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-03-01'),
  ('MOSAIC', 'Mosaic Company', 'Mosaic Logistics', '2024-06-01', '2025-07-15', 'Tom Garcia', 'tgarcia@mosaicco.com', '813-555-0701', 'Nancy White', 'nwhite@mosaicco.com', false, false, true, '15', 'Phosphoric acid. Rubber lining mandatory. Annual inspection.', 2, true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-06-01');

-- ============================================================================
-- 13. SHOP MONTHLY CAPACITY — 3 years of utilization
-- ============================================================================

INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity, allocated_count, completed_count)
SELECT
  s.shop_code,
  TO_CHAR(d, 'YYYY-MM'),
  s.cap,
  GREATEST(0, s.base_alloc + (EXTRACT(MONTH FROM d)::int % 5) + (HASHTEXT(s.shop_code || TO_CHAR(d, 'YYYY-MM')) % 4)),
  CASE WHEN d < DATE_TRUNC('month', CURRENT_DATE) THEN
    GREATEST(0, s.base_alloc + (EXTRACT(MONTH FROM d)::int % 5) + (HASHTEXT(s.shop_code || TO_CHAR(d, 'YYYY-MM')) % 3))
  ELSE 0 END
FROM
  (VALUES ('BNSF001', 25, 15), ('NS001', 20, 12), ('CSX001', 18, 10), ('UP001', 15, 8), ('BNSF002', 20, 12), ('CPKC001', 16, 9), ('NS002', 14, 8), ('CN002', 12, 6), ('KCS001', 10, 5), ('IND001', 18, 10)) AS s(shop_code, cap, base_alloc),
  generate_series('2023-01-01'::date, '2026-12-01'::date, '1 month'::interval) AS d
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 14. AUDIT LOG ENTRIES
-- ============================================================================

INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, new_value, created_at)
VALUES
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'master_plan', 'FY2023', '{"name":"FY2023 Master Plan"}', '2022-12-15 09:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'approve', 'master_plan', 'FY2023', '{"status":"active"}', '2023-01-05 14:30:00'),
  ('7b15c7ba-1b51-4aef-a48c-338e0713405f', 'operator@railsync.com', 'create', 'car_assignment', 'SHPX200883-2023', '{"car":"SHPX200883","shop":"BNSF001"}', '2023-01-05 10:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'bad_order', 'SHPX200886-2023', '{"car":"SHPX200886","severity":"critical"}', '2023-03-15 08:15:00'),
  ('7b15c7ba-1b51-4aef-a48c-338e0713405f', 'operator@railsync.com', 'resolve', 'bad_order', 'SHPX200886-2023', '{"action":"repair_only"}', '2023-03-29 16:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'approve', 'invoice_case', 'IC-2023-H001', '{"state":"PAID","amount":4980}', '2023-02-10 11:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'master_plan', 'FY2024', '{"name":"FY2024 Master Plan"}', '2023-12-01 09:00:00'),
  ('7b15c7ba-1b51-4aef-a48c-338e0713405f', 'operator@railsync.com', 'create', 'capacity_reservation', 'BNSF001-2024', '{"shop":"BNSF001","slots":14}', '2023-11-01 10:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'ccm_form', 'DOW-CCM', '{"lessee":"DOW"}', '2024-01-10 14:00:00'),
  ('7b15c7ba-1b51-4aef-a48c-338e0713405f', 'operator@railsync.com', 'update', 'master_plan', 'FY2024', '{"version":2}', '2024-07-01 09:30:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'shopping_request', 'SR-20240214', '{"car":"SHPX207167","type":"BAD_ORDER"}', '2024-02-14 08:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'approve', 'shopping_request', 'SR-20240214', '{"status":"approved"}', '2024-02-17 15:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'master_plan', 'FY2025', '{"name":"FY2025 Master Plan"}', '2024-11-15 09:00:00'),
  ('7b15c7ba-1b51-4aef-a48c-338e0713405f', 'operator@railsync.com', 'create', 'lease_amendment', 'CARGILL-EXT', '{"type":"Extension","customer":"CARGILL"}', '2024-12-15 14:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'master_plan', 'FY2026', '{"name":"FY2026 Master Plan"}', '2025-11-01 09:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'approve', 'master_plan', 'FY2026', '{"version":2,"status":"Board Approved"}', '2026-01-10 14:30:00'),
  ('7b15c7ba-1b51-4aef-a48c-338e0713405f', 'operator@railsync.com', 'create', 'bad_order', 'SHPX207168-2026', '{"car":"SHPX207168","severity":"high"}', '2026-01-08 09:00:00'),
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'create', 'invoice_case', 'IC-2026-H001', '{"invoice":"CSX-INV-20260110","amount":4850}', '2026-01-15 10:00:00');

-- ============================================================================
-- 15. PIPELINE STATUS — car distribution across buckets
-- ============================================================================

UPDATE cars SET current_status = 'Backlog', plan_status = 'unplanned'
WHERE car_number IN ('SHPX207171', 'SHPX207172', 'SHPX207173', 'SHPX207174', 'SHQX009736', 'SHQX009737', 'SHQX009738', 'SHQX009739', 'SHQX009740', 'TCBX280006');

UPDATE cars SET current_status = 'Pipeline', plan_status = 'planned', assigned_shop_code = 'BNSF001'
WHERE car_number IN ('SHPX207183', 'SHPX207188', 'SHQX009741', 'SHQX009742', 'SHQX009743', 'TCBX280007', 'TCBX280010');

UPDATE cars SET current_status = 'Active', plan_status = 'in_shop', assigned_shop_code = 'NS001'
WHERE car_number IN ('SHPX207209', 'SHPX207226', 'SHQX009744', 'SHQX009745', 'TCBX280016');

UPDATE cars SET current_status = 'Healthy', plan_status = 'complete'
WHERE car_number IN ('SHPX200883', 'SHPX200885', 'SHPX200886', 'SHPX200887', 'SHPX200888', 'SHPX200889', 'SHPX200890', 'SHPX200891', 'SHPX200892', 'SHPX200895',
  'SHQX009730', 'SHQX009731', 'SHQX009732', 'SHQX009733', 'SHQX009734',
  'TCBX231000', 'TCBX231001', 'TCBX231002', 'TCBX231003', 'TCBX231004');

-- ============================================================================
-- 16. LEASE AMENDMENTS
-- ============================================================================

INSERT INTO lease_amendments (amendment_id, master_lease_id, amendment_type, effective_date, change_summary, cars_added, approved_by, approved_at, notes, created_at)
SELECT 'AMD-ML-ADM-2024-001', ml.id, 'Add Cars', '2024-03-15', 'Added 10 cars from new production', 10, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-03-10', 'SHPX240xxx series', '2024-03-10'
FROM master_leases ml WHERE ml.lease_id = 'ML-ADM-2024'
ON CONFLICT (amendment_id) DO NOTHING;

INSERT INTO lease_amendments (amendment_id, master_lease_id, amendment_type, effective_date, change_summary, new_rate, approved_by, approved_at, notes, created_at)
SELECT 'AMD-ML-BASF-2024-001', ml.id, 'Rate Change', '2024-07-01', 'Annual CPI adjustment', 475.00, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2024-06-25', 'CPI increase 5.5%', '2024-06-25'
FROM master_leases ml WHERE ml.lease_id = 'ML-BASF-2024'
ON CONFLICT (amendment_id) DO NOTHING;

INSERT INTO lease_amendments (amendment_id, master_lease_id, amendment_type, effective_date, change_summary, approved_by, approved_at, notes, created_at)
SELECT 'AMD-ML-CARGILL-2025-001', ml.id, 'Extension', '2025-01-01', 'Extended through 2030-12-31', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', '2024-12-15', 'Customer requested extension', '2024-12-15'
FROM master_leases ml WHERE ml.lease_id = 'ML-CARGILL-2024'
ON CONFLICT (amendment_id) DO NOTHING;

INSERT INTO lease_amendments (amendment_id, master_lease_id, amendment_type, effective_date, change_summary, cars_removed, approved_by, approved_at, notes, created_at)
SELECT 'AMD-ML-DOW-2025-001', ml.id, 'Remove Cars', '2025-06-01', 'Returned 3 surplus cars', 3, '7b15c7ba-1b51-4aef-a48c-338e0713405f', '2025-05-28', 'Cars to BASF', '2025-05-28'
FROM master_leases ml WHERE ml.lease_id = 'ML-DOW-2024'
ON CONFLICT (amendment_id) DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Migration 047 complete: All 3-year historical demo data loaded successfully.'; END $$;
