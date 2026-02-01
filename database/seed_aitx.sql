-- Railsync Shop Loading Tool - AITX Seed Data
-- Updated with AITX shops and 100 sample cars

-- Clear existing data
TRUNCATE shops CASCADE;
TRUNCATE cars CASCADE;
TRUNCATE allocations CASCADE;
TRUNCATE demands CASCADE;
TRUNCATE running_repairs_budget CASCADE;
TRUNCATE service_event_budget CASCADE;

-- ============================================================================
-- AITX SHOPS (from cleaned shop locations.csv)
-- ============================================================================
INSERT INTO shops (shop_code, shop_name, primary_railroad, region, city, state, labor_rate, material_multiplier, is_preferred_network, tier, latitude, longitude) VALUES
('AITX-SAR', 'AITX Fleet Services of Canada Inc.', 'CN', 'Canada', 'Sarnia', 'ON', 85.00, 1.000, TRUE, 1, 42.930113, -82.406464),
('AITX-NKC', 'AITX Railcar Services LLC', 'BNSF', 'Midwest', 'N Kansas City', 'MO', 82.00, 1.000, TRUE, 1, 39.127556, -94.569552),
('AITX-MND', 'AITX Mini/Mobile Unit 93', 'CN', 'Midwest', 'Mounds', 'IL', 75.00, 0.950, TRUE, 1, 38.1168, -89.1998),
('AITX-LAP', 'AITX Mobile Headquarters', 'UP', 'Gulf', 'LaPorte', 'TX', 80.00, 1.000, TRUE, 1, 29.6658, -95.0194),
('AITX-HOU', 'AITX Mobile Operations', 'UP', 'Gulf', 'Houston', 'TX', 82.00, 1.050, TRUE, 1, 29.7604, -95.3698),
('AITX-BRK', 'AITX Railcar Services LLC', 'CN', 'South', 'Brookhaven', 'MS', 72.00, 0.920, TRUE, 1, 31.5790, -90.4407),
('AITX-BUD', 'AITX Railcar Services LLC', 'CN', 'South', 'Bude', 'MS', 70.00, 0.900, TRUE, 1, 31.459391, -90.83776),
('AITX-LGV', 'AITX Railcar Services LLC', 'UP', 'Gulf', 'Longview', 'TX', 78.00, 0.950, TRUE, 1, 32.505217, -94.812179),
('AITX-TEN', 'AITX Railcar Services LLC', 'NS', 'Southeast', 'Tennille', 'GA', 75.00, 0.920, TRUE, 1, 32.929923, -82.822774),
('AITX-KCK', 'AITX Repair-KCK MRU', 'BNSF', 'Midwest', 'Kansas City', 'KS', 80.00, 1.000, TRUE, 2, 39.1155, -94.6268),
('AITX-MIL', 'AITX Repair-Milton MRU', 'NS', 'Northeast', 'Milton', 'PA', 78.00, 0.950, TRUE, 2, 41.0120, -76.8469),
('AITX-SWT', 'AITX Repair-Sweetwater MRU', 'UP', 'Southwest', 'Sweetwater', 'TX', 72.00, 0.900, TRUE, 2, 32.4710, -100.4059),
('AITX-GDR', 'AITX Railcar Services LLC', 'UP', 'Gulf', 'Goodrich', 'TX', 76.00, 0.940, TRUE, 1, 30.596967, -94.946659),
('AITX-CLN', 'AITX Railcar Services', 'CSX', 'Midwest', 'Clinton', 'IN', 74.00, 0.930, TRUE, 2, 39.6567, -87.3981),
('AITX-PCT', 'AITX - Point Comfort TX', 'UP', 'Gulf', 'Point Comfort', 'TX', 80.00, 1.000, TRUE, 1, 28.6836, -96.5542);

-- ============================================================================
-- SHOP CAPABILITIES (for all AITX shops)
-- ============================================================================
INSERT INTO shop_capabilities (shop_code, capability_type, capability_value, certified_date)
SELECT shop_code, 'car_type', 'Tank', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'car_type', 'Hopper', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'material', 'Carbon Steel', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'material', 'Stainless', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'lining', 'Epoxy', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'lining', 'High Bake', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'certification', 'AAR', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'certification', 'DOT', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'certification', 'HM201', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%' AND tier = 1
UNION ALL
SELECT shop_code, 'nitrogen_stage', '1', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'nitrogen_stage', '2', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'nitrogen_stage', '3', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'service', 'Cleaning', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'service', 'Mechanical', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'service', 'Blast', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'service', 'Paint', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%'
UNION ALL
SELECT shop_code, 'service', 'Lining', '2024-01-01' FROM shops WHERE shop_code LIKE 'AITX%' AND tier = 1;

-- ============================================================================
-- CARS (100 sample cars from Qual Planner Master)
-- ============================================================================
INSERT INTO cars (car_number, product_code, material_type, stencil_class, lining_type, commodity_cin, has_asbestos, asbestos_abatement_required, nitrogen_pad_stage, owner_code, lessee_code, is_active, qual_exp_date) VALUES
('SHQX006002', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN001', FALSE, FALSE, 3, 'SHQX', 'ACME', TRUE, '2025-12-31'),
('SHQX009709', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-07-01'),
('SHQX009710', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-02-11'),
('SHQX009711', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-08-01'),
('SHQX009712', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-03-01'),
('SHQX009713', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-04-15'),
('SHQX009714', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-05-01'),
('SHQX009715', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-06-01'),
('SHQX009716', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-09-01'),
('SHQX009717', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2025-10-01'),
('UTLX100001', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN003', FALSE, FALSE, 2, 'UTLX', 'CARGILL', TRUE, '2026-02-15'),
('UTLX100002', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN003', FALSE, FALSE, 2, 'UTLX', 'CARGILL', TRUE, '2026-03-01'),
('UTLX100003', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN003', FALSE, FALSE, 2, 'UTLX', 'CARGILL', TRUE, '2026-04-15'),
('UTLX100004', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN003', FALSE, FALSE, 2, 'UTLX', 'CARGILL', TRUE, '2026-05-01'),
('UTLX100005', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN003', FALSE, FALSE, 2, 'UTLX', 'CARGILL', TRUE, '2026-06-15'),
('UTLX100006', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-01-15'),
('UTLX100007', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-02-28'),
('UTLX100008', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-03-15'),
('UTLX100009', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-04-30'),
('UTLX100010', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-05-15'),
('GATX200001', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-02-01'),
('GATX200002', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-03-15'),
('GATX200003', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-04-01'),
('GATX200004', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-05-30'),
('GATX200005', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-06-15'),
('PROX300001', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-01-31'),
('PROX300002', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-02-28'),
('PROX300003', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-03-31'),
('PROX300004', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-04-30'),
('PROX300005', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-05-31'),
('TILX400001', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-02-15'),
('TILX400002', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-03-01'),
('TILX400003', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-04-15'),
('TILX400004', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-05-01'),
('TILX400005', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-06-15'),
('CEFX500001', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-01-20'),
('CEFX500002', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-02-10'),
('CEFX500003', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-03-25'),
('CEFX500004', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-04-10'),
('CEFX500005', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-05-20'),
('ACFX600001', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-02-05'),
('ACFX600002', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-03-10'),
('ACFX600003', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-04-20'),
('ACFX600004', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-05-25'),
('ACFX600005', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-06-30'),
('HOKX700001', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-03-01'),
('HOKX700002', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-04-15'),
('HOKX700003', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-05-01'),
('HOKX700004', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-06-15'),
('HOKX700005', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-07-01'),
-- Add 50 more cars with varying qual dates and statuses
('SHQX010001', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN001', FALSE, FALSE, 2, 'SHQX', 'ACME', TRUE, '2026-02-28'),
('SHQX010002', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN001', FALSE, FALSE, 2, 'SHQX', 'ACME', TRUE, '2026-03-15'),
('SHQX010003', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN001', FALSE, FALSE, 2, 'SHQX', 'ACME', TRUE, '2026-04-01'),
('SHQX010004', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN001', FALSE, FALSE, 2, 'SHQX', 'ACME', TRUE, '2026-05-15'),
('SHQX010005', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN001', FALSE, FALSE, 2, 'SHQX', 'ACME', TRUE, '2026-06-01'),
('UTLX110001', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-01-30'),
('UTLX110002', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-02-20'),
('UTLX110003', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-03-10'),
('UTLX110004', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-04-05'),
('UTLX110005', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN004', FALSE, FALSE, 1, 'UTLX', 'DOW', TRUE, '2026-05-20'),
('GATX210001', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-02-10'),
('GATX210002', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-03-05'),
('GATX210003', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-04-20'),
('GATX210004', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-05-10'),
('GATX210005', 'Tank', 'Carbon Steel', 'DOT111A100W', 'High Bake', 'CIN005', FALSE, FALSE, 3, 'GATX', 'BASF', TRUE, '2026-06-25'),
('PROX310001', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-01-25'),
('PROX310002', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-02-15'),
('PROX310003', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-03-20'),
('PROX310004', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-04-15'),
('PROX310005', 'Tank', 'Carbon Steel', 'DOT117', NULL, 'CIN006', FALSE, FALSE, 2, 'PROX', 'SHELL', TRUE, '2026-05-25'),
('TILX410001', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-02-08'),
('TILX410002', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-03-12'),
('TILX410003', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-04-22'),
('TILX410004', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-05-18'),
('TILX410005', 'Tank', 'Carbon Steel', 'DOT111A100W', 'Epoxy', 'CIN007', TRUE, FALSE, 3, 'TILX', 'EXXON', TRUE, '2026-06-28'),
('CEFX510001', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-01-18'),
('CEFX510002', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-02-22'),
('CEFX510003', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-03-28'),
('CEFX510004', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-04-18'),
('CEFX510005', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN008', FALSE, FALSE, 2, 'CEFX', 'CHEVRON', TRUE, '2026-05-28'),
('ACFX610001', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-02-12'),
('ACFX610002', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-03-18'),
('ACFX610003', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-04-25'),
('ACFX610004', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-05-30'),
('ACFX610005', 'Tank', 'Stainless', 'DOT111A100W', NULL, 'CIN009', FALSE, FALSE, 1, 'ACFX', 'DUPONT', TRUE, '2026-06-15'),
('HOKX710001', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-02-25'),
('HOKX710002', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-03-30'),
('HOKX710003', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-04-28'),
('HOKX710004', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-05-22'),
('HOKX710005', 'Hopper', 'Carbon Steel', NULL, NULL, 'CIN010', FALSE, FALSE, NULL, 'HOKX', 'ARCHER', TRUE, '2026-06-18'),
('SHQX020001', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2026-07-15'),
('SHQX020002', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2026-08-01'),
('SHQX020003', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2026-09-15'),
('SHQX020004', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2026-10-01'),
('SHQX020005', 'Tank', 'Carbon Steel', 'DOT111A100W', NULL, 'CIN002', FALSE, FALSE, 3, 'SHQX', 'ADM', TRUE, '2026-11-15');

-- ============================================================================
-- COMMODITIES
-- ============================================================================
INSERT INTO commodities (cin_code, description, cleaning_class, hazmat_class, requires_kosher, recommended_price) VALUES
('CIN001', 'Castor Oil', 'A', NULL, FALSE, 1200.00),
('CIN002', 'Corn Oil, Refined', 'A', NULL, FALSE, 1100.00),
('CIN003', 'Ethanol', 'B', 'Class 3', FALSE, 1500.00),
('CIN004', 'Sodium Hydroxide', 'C', 'Class 8', FALSE, 1800.00),
('CIN005', 'Styrene Monomer', 'C', 'Class 3', FALSE, 2000.00),
('CIN006', 'Crude Oil', 'D', 'Class 3', FALSE, 1400.00),
('CIN007', 'Benzene', 'D', 'Class 3', FALSE, 2200.00),
('CIN008', 'Diesel Fuel', 'C', 'Class 3', FALSE, 1300.00),
('CIN009', 'Sulfuric Acid', 'D', 'Class 8', FALSE, 2500.00),
('CIN010', 'Plastic Pellets', 'A', NULL, FALSE, 800.00)
ON CONFLICT (cin_code) DO UPDATE SET description = EXCLUDED.description;

-- ============================================================================
-- SHOP BACKLOG
-- ============================================================================
INSERT INTO shop_backlog (shop_code, date, hours_backlog, cars_backlog, cars_en_route_0_6, cars_en_route_7_14, cars_en_route_15_plus, weekly_inbound, weekly_outbound)
SELECT shop_code, CURRENT_DATE,
    (random() * 400 + 100)::DECIMAL(10,2),
    (random() * 15 + 3)::INT,
    (random() * 5)::INT,
    (random() * 3)::INT,
    (random() * 2)::INT,
    (random() * 8 + 2)::INT,
    (random() * 10 + 3)::INT
FROM shops WHERE shop_code LIKE 'AITX%';

-- ============================================================================
-- SHOP CAPACITY
-- ============================================================================
INSERT INTO shop_capacity (shop_code, work_type, weekly_hours_capacity, current_utilization_pct, available_hours, effective_date)
SELECT shop_code, work_type,
    CASE work_type
        WHEN 'qual' THEN 120
        WHEN 'mechanical' THEN 80
        WHEN 'blast' THEN 60
        WHEN 'lining' THEN 50
        ELSE 40
    END,
    (random() * 70 + 10)::DECIMAL(5,2),
    (random() * 40 + 10)::DECIMAL(10,2),
    CURRENT_DATE
FROM shops
CROSS JOIN (VALUES ('qual'), ('mechanical'), ('blast'), ('lining'), ('cleaning')) AS wt(work_type)
WHERE shop_code LIKE 'AITX%';

-- ============================================================================
-- SHOP MONTHLY CAPACITY (for 2026)
-- ============================================================================
INSERT INTO shop_monthly_capacity (shop_code, month, total_capacity, confirmed_railcars, planned_railcars)
SELECT
    s.shop_code,
    m.month,
    CASE WHEN s.tier = 1 THEN 50 ELSE 30 END,
    (random() * 10)::INT,
    (random() * 15)::INT
FROM shops s
CROSS JOIN (
    SELECT '2026-01' AS month UNION ALL SELECT '2026-02' UNION ALL SELECT '2026-03'
    UNION ALL SELECT '2026-04' UNION ALL SELECT '2026-05' UNION ALL SELECT '2026-06'
    UNION ALL SELECT '2026-07' UNION ALL SELECT '2026-08' UNION ALL SELECT '2026-09'
    UNION ALL SELECT '2026-10' UNION ALL SELECT '2026-11' UNION ALL SELECT '2026-12'
) m
WHERE s.shop_code LIKE 'AITX%'
ON CONFLICT (shop_code, month) DO UPDATE SET
    total_capacity = EXCLUDED.total_capacity,
    confirmed_railcars = EXCLUDED.confirmed_railcars,
    planned_railcars = EXCLUDED.planned_railcars;

-- ============================================================================
-- ALLOCATIONS (sample allocations for 2026)
-- ============================================================================
INSERT INTO allocations (car_id, car_number, shop_code, target_month, status, current_status, estimated_cost)
SELECT
    c.car_number, c.car_number,
    (SELECT shop_code FROM shops WHERE shop_code LIKE 'AITX%' ORDER BY random() LIMIT 1),
    TO_CHAR(c.qual_exp_date, 'YYYY-MM'),
    CASE (random() * 4)::INT
        WHEN 0 THEN 'Need Shopping'
        WHEN 1 THEN 'Planned Shopping'
        WHEN 2 THEN 'Enroute'
        WHEN 3 THEN 'Arrived'
        ELSE 'Complete'
    END,
    CASE (random() * 4)::INT
        WHEN 0 THEN 'planned'
        WHEN 1 THEN 'scheduled'
        WHEN 2 THEN 'enroute'
        WHEN 3 THEN 'in_shop'
        ELSE 'completed'
    END,
    (random() * 3000 + 2000)::DECIMAL(10,2)
FROM cars c
WHERE c.qual_exp_date >= '2026-01-01' AND c.qual_exp_date <= '2026-12-31'
LIMIT 50;

-- ============================================================================
-- DEMANDS (monthly demands for 2026)
-- ============================================================================
INSERT INTO demands (fiscal_year, target_month, event_type, car_count, status, priority, source, notes)
VALUES
(2026, '2026-01', 'Tank Qual', 12, 'Confirmed', 'High', 'Annual Plan', 'Q1 quals'),
(2026, '2026-02', 'Tank Qual', 15, 'Confirmed', 'High', 'Annual Plan', 'Q1 quals'),
(2026, '2026-03', 'Tank Qual', 18, 'Confirmed', 'Medium', 'Annual Plan', 'Q1 quals'),
(2026, '2026-04', 'Tank Qual', 14, 'Allocating', 'Medium', 'Annual Plan', 'Q2 quals'),
(2026, '2026-05', 'Tank Qual', 16, 'Forecast', 'Medium', 'Annual Plan', 'Q2 quals'),
(2026, '2026-06', 'Tank Qual', 20, 'Forecast', 'Low', 'Annual Plan', 'Q2 quals'),
(2026, '2026-07', 'Tank Qual', 15, 'Forecast', 'Low', 'Annual Plan', 'Q3 quals'),
(2026, '2026-08', 'Tank Qual', 12, 'Forecast', 'Low', 'Annual Plan', 'Q3 quals'),
(2026, '2026-09', 'Tank Qual', 18, 'Forecast', 'Low', 'Annual Plan', 'Q3 quals'),
(2026, '2026-10', 'Tank Qual', 14, 'Forecast', 'Low', 'Annual Plan', 'Q4 quals'),
(2026, '2026-11', 'Tank Qual', 10, 'Forecast', 'Low', 'Annual Plan', 'Q4 quals'),
(2026, '2026-12', 'Tank Qual', 8, 'Forecast', 'Low', 'Annual Plan', 'Q4 quals'),
(2026, '2026-02', 'Mechanical', 8, 'Confirmed', 'High', 'Bad Order', 'Urgent repairs'),
(2026, '2026-03', 'Mechanical', 6, 'Confirmed', 'Medium', 'Bad Order', 'Scheduled repairs'),
(2026, '2026-04', 'Lining', 5, 'Forecast', 'Medium', 'Customer Request', 'Relining jobs');

-- ============================================================================
-- RUNNING REPAIRS BUDGET (2026)
-- ============================================================================
INSERT INTO running_repairs_budget (fiscal_year, month, cars_on_lease, allocation_per_car, monthly_budget, actual_spend)
VALUES
(2026, '2026-01', 1200, 450.00, 540000.00, 485000.00),
(2026, '2026-02', 1220, 450.00, 549000.00, 125000.00),
(2026, '2026-03', 1250, 450.00, 562500.00, 0.00),
(2026, '2026-04', 1280, 450.00, 576000.00, 0.00),
(2026, '2026-05', 1300, 450.00, 585000.00, 0.00),
(2026, '2026-06', 1320, 450.00, 594000.00, 0.00),
(2026, '2026-07', 1340, 450.00, 603000.00, 0.00),
(2026, '2026-08', 1350, 450.00, 607500.00, 0.00),
(2026, '2026-09', 1360, 450.00, 612000.00, 0.00),
(2026, '2026-10', 1380, 450.00, 621000.00, 0.00),
(2026, '2026-11', 1390, 450.00, 625500.00, 0.00),
(2026, '2026-12', 1400, 450.00, 630000.00, 0.00);

-- ============================================================================
-- SERVICE EVENT BUDGET (2026)
-- ============================================================================
INSERT INTO service_event_budget (fiscal_year, event_type, annual_budget, q1_budget, q2_budget, q3_budget, q4_budget)
VALUES
(2026, 'Tank Qual', 2400000.00, 600000.00, 600000.00, 600000.00, 600000.00),
(2026, 'Mechanical', 800000.00, 200000.00, 200000.00, 200000.00, 200000.00),
(2026, 'Lining', 400000.00, 100000.00, 100000.00, 100000.00, 100000.00),
(2026, 'Cleaning', 200000.00, 50000.00, 50000.00, 50000.00, 50000.00);

-- ============================================================================
-- FREIGHT RATES (for AITX shops)
-- ============================================================================
INSERT INTO freight_rates (origin_region, destination_shop, distance_miles, base_rate, per_mile_rate, fuel_surcharge_pct, effective_date)
SELECT
    r.region,
    s.shop_code,
    (random() * 800 + 100)::INT,
    (random() * 200 + 100)::DECIMAL(10,2),
    (random() * 1.5 + 0.5)::DECIMAL(6,4),
    15.00,
    '2024-01-01'
FROM shops s
CROSS JOIN (VALUES ('Midwest'), ('Gulf'), ('Southeast'), ('Northeast'), ('Southwest'), ('Canada')) AS r(region)
WHERE s.shop_code LIKE 'AITX%'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ORIGIN LOCATIONS
-- ============================================================================
INSERT INTO origin_locations (location_code, location_name, region, latitude, longitude, is_active) VALUES
('CHI', 'Chicago Area', 'Midwest', 41.8781, -87.6298, TRUE),
('HOU', 'Houston Area', 'Gulf', 29.7604, -95.3698, TRUE),
('ATL', 'Atlanta Area', 'Southeast', 33.7490, -84.3880, TRUE),
('DFW', 'Dallas-Fort Worth', 'Southwest', 32.7767, -96.7970, TRUE),
('LAX', 'Los Angeles Area', 'West', 34.0522, -118.2437, TRUE),
('NYC', 'New York Area', 'Northeast', 40.7128, -74.0060, TRUE),
('TOR', 'Toronto Area', 'Canada', 43.6532, -79.3832, TRUE),
('DEN', 'Denver Area', 'Mountain', 39.7392, -104.9903, TRUE),
('SEA', 'Seattle Area', 'Northwest', 47.6062, -122.3321, TRUE),
('MIA', 'Miami Area', 'Southeast', 25.7617, -80.1918, TRUE)
ON CONFLICT (location_code) DO UPDATE SET location_name = EXCLUDED.location_name;

-- ============================================================================
-- LABOR RATES (for AITX shops)
-- ============================================================================
INSERT INTO labor_rates (shop_code, work_type, hourly_rate, effective_date)
SELECT
    s.shop_code,
    wt.work_type,
    s.labor_rate * CASE wt.work_type
        WHEN 'qual' THEN 1.0
        WHEN 'mechanical' THEN 0.95
        WHEN 'blast' THEN 0.90
        WHEN 'lining' THEN 1.10
        WHEN 'cleaning' THEN 0.85
        ELSE 1.0
    END,
    '2024-01-01'
FROM shops s
CROSS JOIN (VALUES ('qual'), ('mechanical'), ('blast'), ('lining'), ('cleaning')) AS wt(work_type)
WHERE s.shop_code LIKE 'AITX%'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ELIGIBILITY RULES
-- ============================================================================
INSERT INTO eligibility_rules (rule_name, rule_type, condition_field, condition_operator, condition_value, priority, is_active, description) VALUES
('Tank Car Only', 'hard', 'product_code', 'equals', 'Tank', 1, TRUE, 'Shop only handles tank cars'),
('HM201 Required', 'hard', 'certification', 'includes', 'HM201', 2, TRUE, 'HM201 certification required for hazmat'),
('Nitrogen Stage Match', 'hard', 'nitrogen_stage', 'includes', 'nitrogen_stage', 3, TRUE, 'Shop must handle car nitrogen stage'),
('Lining Capable', 'soft', 'lining_type', 'includes', 'lining', 4, TRUE, 'Prefer shops with lining capability'),
('Tier 1 Preferred', 'soft', 'tier', 'equals', '1', 5, TRUE, 'Prefer Tier 1 shops'),
('Same Region Preferred', 'soft', 'region', 'equals', 'region', 6, TRUE, 'Prefer shops in same region'),
('Low Backlog Preferred', 'soft', 'hours_backlog', 'less_than', '300', 7, TRUE, 'Prefer shops with low backlog')
ON CONFLICT DO NOTHING;

-- Update tier column on shops based on tier value
UPDATE shops SET tier = 1 WHERE tier IS NULL AND is_preferred_network = TRUE;
UPDATE shops SET tier = 2 WHERE tier IS NULL AND is_preferred_network = FALSE;

-- Ensure current_status is populated for allocations
UPDATE allocations SET current_status =
    CASE
        WHEN status IN ('Complete', 'Released') THEN 'completed'
        WHEN status = 'Arrived' THEN 'in_shop'
        WHEN status = 'Enroute' THEN 'enroute'
        WHEN status IN ('Planned Shopping', 'To Be Routed') THEN 'scheduled'
        ELSE 'planned'
    END
WHERE current_status IS NULL OR current_status = '';

SELECT 'Seed data loaded: ' || COUNT(*) || ' shops, ' || (SELECT COUNT(*) FROM cars) || ' cars, ' || (SELECT COUNT(*) FROM allocations) || ' allocations' FROM shops;
