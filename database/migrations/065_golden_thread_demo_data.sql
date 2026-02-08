-- =============================================================================
-- 065: Golden Thread Demo Data
-- =============================================================================
-- Creates 5 interconnected demo cars that trace through the ENTIRE Railsync
-- lifecycle, demonstrating traceability and feature connectivity for UT/demos.
--
-- Car 1 (UTLX123456): Full lifecycle complete — released, billed, paid
-- Car 2 (GATX789012): In estimate review — 2 estimate versions, pending decisions
-- Car 3 (PROX345678): In active repair — mid-service with partial components
-- Car 4 (TILX901234): Pending billing — completed service, unbilled
-- Car 5 (GATX112233): Transfer in progress — inter-shop lease transition
--
-- All 5 cars use existing entities (users, shops, customers, leases, riders).
-- =============================================================================

-- ─── Reference IDs (existing data) ──────────────────────────────────────────
-- Users
--   admin:    de69920f-cdcb-4668-9f21-9c4dbccfb8c9
--   operator: 7b15c7ba-1b51-4aef-a48c-338e0713405f
--   viewer:   63d82d01-7bff-4d4d-8774-59babd94e9a2
--
-- Customers: DUPONT (88cd2100...), BASF (cd99d810...), EXXON (fe9ed36d...)
-- Shops: BNSF001 (Alliance NE), NS001 (Roanoke VA), CSX001 (Waycross GA),
--        UP001 (North Platte NE), IND001 (Trinity Dallas TX)
-- =============================================================================

BEGIN;

-- ─── STABLE UUIDs (prefix AA for golden-thread, easy to identify) ───────────
-- We use deterministic UUIDs so re-running this migration is idempotent.

-- Demands
-- aa000001-0001-4000-a000-000000000001  FY26 Q1 Qualification Demand
-- aa000001-0001-4000-a000-000000000002  FY26 Q2 Lease-Return Demand

-- Allocations
-- aa000002-0001-4000-a000-000000000001  Car 1 allocation
-- aa000002-0001-4000-a000-000000000002  Car 2 allocation
-- aa000002-0001-4000-a000-000000000003  Car 3 allocation
-- aa000002-0001-4000-a000-000000000004  Car 4 allocation
-- aa000002-0001-4000-a000-000000000005  Car 5 allocation (from-shop)
-- aa000002-0001-4000-a000-000000000006  Car 5 allocation (to-shop)

-- Car Assignments
-- aa000003-0001-4000-a000-000000000001 through ...005

-- Shopping Events
-- aa000004-0001-4000-a000-000000000001 through ...005

-- Estimate Submissions
-- aa000005-0001-4000-a000-000000000001  Car 1 est v1 (approved)
-- aa000005-0001-4000-a000-000000000002  Car 2 est v1 (changes_required)
-- aa000005-0001-4000-a000-000000000003  Car 2 est v2 (submitted — under review)
-- aa000005-0001-4000-a000-000000000004  Car 3 est v1 (approved)
-- aa000005-0001-4000-a000-000000000005  Car 4 est v1 (approved)

-- Estimate Lines (aa000006-...-00001 through 00020)
-- Estimate Line Decisions (aa000007-...-00001 through 00010)
-- Scope of Work (aa000008-...-00001 through 00004)
-- Scope Library (aa000009-...-00001 through 00004)
-- Components (aa00000a-...-00001 through 00006)
-- Invoices (vendor) (aa00000b-...-00001 and 00002)
-- Invoice Line Items (aa00000c-...-00001 through 00006)
-- Outbound Invoices (aa00000d-...-00001)
-- Outbound Invoice Lines (aa00000e-...-00001 through 00003)
-- Billing Runs (aa00000f-...-00001)
-- Car Releases (aa000010-...-00001)
-- Car Lease Transitions (aa000011-...-00001)
-- Riders (simplified, from 022) (aa000012-...-00001 and 00002)
-- Project Cars (aa000013-...-00001 through 00003)
-- Project Assignments (aa000014-...-00001 through 00003)
-- State Transition Log (aa000015-...-00001 through 00020)
-- Alerts (aa000016-...-00001 through 00004)
-- Cost Allocation Entries (aa000017-...-00001 and 00002)

-- =============================================================================
-- 1. UPDATE CARS — Ensure our 5 demo cars have complete, realistic attributes
-- =============================================================================

UPDATE cars SET
  car_type = 'DOT-111 Tank Car',
  lessee_name = 'DuPont Chemical',
  contract_number = 'DUPONT-2024-001',
  contract_expiration = '2027-12-31',
  portfolio_status = 'Active',
  commodity = 'Chemicals - Organic',
  is_jacketed = true,
  is_lined = true,
  car_age = 12,
  tank_qual_year = 2022,
  safety_relief_year = 2023,
  current_status = 'Released',
  current_region = 'Midwest',
  csr_name = 'Demo Admin',
  qual_exp_date = '2027-06-30'
WHERE car_number = 'UTLX123456';

UPDATE cars SET
  car_type = 'DOT-111 Tank Car',
  lessee_name = 'BASF Corporation',
  contract_number = 'BASF-2024-001',
  contract_expiration = '2028-06-30',
  portfolio_status = 'Active',
  commodity = 'Chemicals - Inorganic',
  is_jacketed = true,
  is_lined = false,
  car_age = 8,
  tank_qual_year = 2020,
  safety_relief_year = 2021,
  current_status = 'InShop',
  current_region = 'Southeast',
  csr_name = 'Demo Operator',
  qual_exp_date = '2026-06-30'
WHERE car_number = 'GATX789012';

UPDATE cars SET
  car_type = 'DOT-117 Pressurized',
  lessee_name = 'ExxonMobil',
  contract_number = 'EXXON-ML-2024',
  contract_expiration = '2029-01-31',
  portfolio_status = 'Active',
  commodity = 'Petroleum - Naphtha',
  is_jacketed = true,
  is_lined = true,
  car_age = 5,
  tank_qual_year = 2021,
  safety_relief_year = 2022,
  current_status = 'InShop',
  current_region = 'South',
  csr_name = 'Demo Admin',
  qual_exp_date = '2026-03-31'
WHERE car_number = 'PROX345678';

UPDATE cars SET
  car_type = 'DOT-111 Tank Car',
  lessee_name = 'Mosaic Company',
  contract_number = 'MOSAIC-ML-2024',
  contract_expiration = '2027-09-30',
  portfolio_status = 'Active',
  commodity = 'Fertilizer - Phosphate',
  is_jacketed = false,
  is_lined = true,
  car_age = 15,
  tank_qual_year = 2023,
  safety_relief_year = 2024,
  current_status = 'Complete',
  current_region = 'Midwest',
  csr_name = 'Demo Admin',
  qual_exp_date = '2028-06-30'
WHERE car_number = 'TILX901234';

UPDATE cars SET
  car_type = 'DOT-117 Pressurized',
  lessee_name = 'Bunge North America',
  contract_number = 'BUNGE-ML-2024',
  contract_expiration = '2028-03-31',
  portfolio_status = 'Active',
  commodity = 'Vegetable Oils',
  is_jacketed = true,
  is_lined = true,
  car_age = 10,
  tank_qual_year = 2022,
  safety_relief_year = 2023,
  current_status = 'Enroute',
  current_region = 'Midwest',
  csr_name = 'Demo Operator',
  qual_exp_date = '2027-12-31'
WHERE car_number = 'GATX112233';


-- =============================================================================
-- 2. DEMANDS — Create 2 demands that feed our allocations
-- =============================================================================

INSERT INTO demands (id, name, description, fiscal_year, target_month, car_count, event_type, car_type, priority, status, created_by, created_at, updated_at)
VALUES
  ('aa000001-0001-4000-a000-000000000001',
   'FY26 Q1 Tank Qualification',
   'Regulatory qualification batch for tank cars with qual expiring H1 2026. Covers DOT-111 and DOT-117 fleet.',
   2026, '2026-01', 3, 'Qualification', 'DOT-111 Tank Car', 'High', 'Allocated',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days'),
  ('aa000001-0001-4000-a000-000000000002',
   'FY26 Q2 Lease Return Processing',
   'End-of-lease returns and inter-lessee transfers for contract renewals.',
   2026, '2026-04', 2, 'Lease Return', 'DOT-117 Pressurized', 'Medium', 'Allocating',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '45 days', NOW() - INTERVAL '15 days')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 3. ALLOCATIONS — Link demands → cars → shops
-- =============================================================================

INSERT INTO allocations (id, demand_id, car_mark_number, car_number, shop_code, target_month, status, current_status, estimated_cost, work_type, version, created_at, updated_at)
VALUES
  -- Car 1: UTLX123456 → BNSF001 (Complete → Released)
  ('aa000002-0001-4000-a000-000000000001',
   'aa000001-0001-4000-a000-000000000001', 'UTLX123456', 'UTLX123456', 'BNSF001', '2026-01',
   'Complete', 'completed', 12500.00, 'Qualification', 1,
   NOW() - INTERVAL '55 days', NOW() - INTERVAL '5 days'),
  -- Car 2: GATX789012 → NS001 (Arrived — estimate under review)
  ('aa000002-0001-4000-a000-000000000002',
   'aa000001-0001-4000-a000-000000000001', 'GATX789012', 'GATX789012', 'NS001', '2026-01',
   'Arrived', 'in_shop', 9800.00, 'Qualification', 1,
   NOW() - INTERVAL '50 days', NOW() - INTERVAL '2 days'),
  -- Car 3: PROX345678 → IND001 (In-shop — active repair)
  ('aa000002-0001-4000-a000-000000000003',
   'aa000001-0001-4000-a000-000000000001', 'PROX345678', 'PROX345678', 'IND001', '2026-02',
   'Arrived', 'in_shop', 15200.00, 'Qualification', 1,
   NOW() - INTERVAL '40 days', NOW() - INTERVAL '1 day'),
  -- Car 4: TILX901234 → UP001 (Complete — pending billing)
  ('aa000002-0001-4000-a000-000000000004',
   'aa000001-0001-4000-a000-000000000002', 'TILX901234', 'TILX901234', 'UP001', '2026-03',
   'Complete', 'completed', 8900.00, 'Lease Return', 1,
   NOW() - INTERVAL '35 days', NOW() - INTERVAL '3 days'),
  -- Car 5: GATX112233 → NS001 (original), transferring to CSX001
  ('aa000002-0001-4000-a000-000000000005',
   'aa000001-0001-4000-a000-000000000002', 'GATX112233', 'GATX112233', 'NS001', '2026-04',
   'Enroute', 'enroute', 7500.00, 'Lease Return', 1,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '10 days'),
  ('aa000002-0001-4000-a000-000000000006',
   'aa000001-0001-4000-a000-000000000002', 'GATX112233', 'GATX112233', 'CSX001', '2026-05',
   'Need Shopping', 'planned', 7500.00, 'Lease Return', 1,
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 4. CAR ASSIGNMENTS — SSOT assignment records
-- =============================================================================

-- First remove existing conflicting assignments for our demo cars
DELETE FROM car_assignments WHERE car_number IN ('UTLX123456','GATX789012','PROX345678','TILX901234','GATX112233')
  AND id NOT IN (
    'aa000003-0001-4000-a000-000000000001'::uuid,
    'aa000003-0001-4000-a000-000000000002'::uuid,
    'aa000003-0001-4000-a000-000000000003'::uuid,
    'aa000003-0001-4000-a000-000000000004'::uuid,
    'aa000003-0001-4000-a000-000000000005'::uuid
  );

INSERT INTO car_assignments (id, car_id, car_mark_number, car_number, shop_code, shop_name, target_month, status, priority, source, estimated_cost, actual_cost, created_by_id, version, created_at, updated_at)
VALUES
  ('aa000003-0001-4000-a000-000000000001',
   (SELECT id FROM cars WHERE car_number = 'UTLX123456'),
   (SELECT ci.id FROM car_identifiers ci JOIN cars c ON c.id = ci.car_id WHERE c.car_number = 'UTLX123456' AND ci.identifier_type = 'car_mark_number'),
   'UTLX123456', 'BNSF001', 'Alliance Repair Center',
   '2026-01', 'Complete', 1, 'demand_plan', 12500.00, 11800.00,
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '55 days', NOW() - INTERVAL '5 days'),
  ('aa000003-0001-4000-a000-000000000002',
   (SELECT id FROM cars WHERE car_number = 'GATX789012'),
   (SELECT ci.id FROM car_identifiers ci JOIN cars c ON c.id = ci.car_id WHERE c.car_number = 'GATX789012' AND ci.identifier_type = 'car_mark_number'),
   'GATX789012', 'NS001', 'Roanoke Heavy Repair',
   '2026-01', 'InShop', 2, 'demand_plan', 9800.00, NULL,
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '50 days', NOW() - INTERVAL '2 days'),
  ('aa000003-0001-4000-a000-000000000003',
   (SELECT id FROM cars WHERE car_number = 'PROX345678'),
   (SELECT ci.id FROM car_identifiers ci JOIN cars c ON c.id = ci.car_id WHERE c.car_number = 'PROX345678' AND ci.identifier_type = 'car_mark_number'),
   'PROX345678', 'IND001', 'Trinity Industries',
   '2026-02', 'InShop', 1, 'demand_plan', 15200.00, NULL,
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '40 days', NOW() - INTERVAL '1 day'),
  ('aa000003-0001-4000-a000-000000000004',
   (SELECT id FROM cars WHERE car_number = 'TILX901234'),
   (SELECT ci.id FROM car_identifiers ci JOIN cars c ON c.id = ci.car_id WHERE c.car_number = 'TILX901234' AND ci.identifier_type = 'car_mark_number'),
   'TILX901234', 'UP001', 'North Platte Facility',
   '2026-03', 'Complete', 2, 'demand_plan', 8900.00, 8650.00,
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '35 days', NOW() - INTERVAL '3 days'),
  ('aa000003-0001-4000-a000-000000000005',
   (SELECT id FROM cars WHERE car_number = 'GATX112233'),
   (SELECT ci.id FROM car_identifiers ci JOIN cars c ON c.id = ci.car_id WHERE c.car_number = 'GATX112233' AND ci.identifier_type = 'car_mark_number'),
   'GATX112233', 'CSX001', 'Waycross Complex',
   '2026-05', 'Enroute', 3, 'demand_plan', 7500.00, NULL,
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 5. SHOPPING EVENTS — One per car (Car 5 uses original shop SE)
-- =============================================================================

INSERT INTO shopping_events (id, event_number, car_id, car_number, shop_code, car_assignment_id, state, shopping_type_code, created_by_id, version, created_at, updated_at)
VALUES
  -- Car 1: Full lifecycle → RELEASED
  ('aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01',
   (SELECT id FROM cars WHERE car_number = 'UTLX123456'), 'UTLX123456', 'BNSF001',
   'aa000003-0001-4000-a000-000000000001', 'RELEASED', 'QUAL_REG',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '50 days', NOW() - INTERVAL '5 days'),
  -- Car 2: Estimate under review
  ('aa000004-0001-4000-a000-000000000002', 'SE-2026-GT02',
   (SELECT id FROM cars WHERE car_number = 'GATX789012'), 'GATX789012', 'NS001',
   'aa000003-0001-4000-a000-000000000002', 'ESTIMATE_UNDER_REVIEW', 'QUAL_REG',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '45 days', NOW() - INTERVAL '2 days'),
  -- Car 3: In repair
  ('aa000004-0001-4000-a000-000000000003', 'SE-2026-GT03',
   (SELECT id FROM cars WHERE car_number = 'PROX345678'), 'PROX345678', 'IND001',
   'aa000003-0001-4000-a000-000000000003', 'IN_REPAIR', 'QUAL_REG',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '35 days', NOW() - INTERVAL '1 day'),
  -- Car 4: Released (completed service)
  ('aa000004-0001-4000-a000-000000000004', 'SE-2026-GT04',
   (SELECT id FROM cars WHERE car_number = 'TILX901234'), 'TILX901234', 'UP001',
   'aa000003-0001-4000-a000-000000000004', 'RELEASED', 'LEASE_RETURN',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '30 days', NOW() - INTERVAL '3 days'),
  -- Car 5: Requested (pre-transfer)
  ('aa000004-0001-4000-a000-000000000005', 'SE-2026-GT05',
   (SELECT id FROM cars WHERE car_number = 'GATX112233'), 'GATX112233', 'CSX001',
   'aa000003-0001-4000-a000-000000000005', 'REQUESTED', 'LEASE_RETURN',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 6. SCOPE LIBRARY + SCOPE OF WORK
-- =============================================================================

INSERT INTO scope_library (id, name, car_type, shopping_type_code, description, is_active, created_by_id, created_at, updated_at)
VALUES
  ('aa000009-0001-4000-a000-000000000001', 'Tank Qualification - Standard', 'DOT-111 Tank Car', 'QUAL_REG',
   'Standard tank qualification scope: UT, hydro test, valve inspection, exterior visual, repairs as needed.',
   true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
  ('aa000009-0001-4000-a000-000000000002', 'Tank Qualification - Pressurized', 'DOT-117 Pressurized', 'QUAL_REG',
   'Pressurized tank car qualification with pressure test, valve overhaul, and lining inspection.',
   true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days'),
  ('aa000009-0001-4000-a000-000000000003', 'Lease Return Prep', NULL, 'LEASE_RETURN',
   'Standard lease return: interior cleaning, exterior paint touch-up, running gear inspection.',
   true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '90 days', NOW() - INTERVAL '90 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO scope_of_work (id, scope_library_id, status, finalized_by_id, finalized_at, created_by_id, created_at, updated_at)
VALUES
  -- Car 1 SOW (finalized)
  ('aa000008-0001-4000-a000-000000000001', 'aa000009-0001-4000-a000-000000000001', 'finalized',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '40 days',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days'),
  -- Car 3 SOW (sent — in repair, SOW sent to shop)
  ('aa000008-0001-4000-a000-000000000002', 'aa000009-0001-4000-a000-000000000002', 'sent',
   NULL, NULL,
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '25 days', NOW() - INTERVAL '1 day'),
  -- Car 4 SOW (finalized)
  ('aa000008-0001-4000-a000-000000000003', 'aa000009-0001-4000-a000-000000000003', 'finalized',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '10 days',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '20 days', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- Link SOW to shopping events
UPDATE shopping_events SET scope_of_work_id = 'aa000008-0001-4000-a000-000000000001' WHERE id = 'aa000004-0001-4000-a000-000000000001';
UPDATE shopping_events SET scope_of_work_id = 'aa000008-0001-4000-a000-000000000002' WHERE id = 'aa000004-0001-4000-a000-000000000003';
UPDATE shopping_events SET scope_of_work_id = 'aa000008-0001-4000-a000-000000000003' WHERE id = 'aa000004-0001-4000-a000-000000000004';


-- =============================================================================
-- 7. ESTIMATE SUBMISSIONS + LINES + DECISIONS
-- =============================================================================

-- Car 1: v1 approved ($11,800)
INSERT INTO estimate_submissions (id, shopping_event_id, version_number, submitted_by, submitted_at, status, total_labor_hours, total_material_cost, total_cost, notes, created_at, updated_at)
VALUES
  ('aa000005-0001-4000-a000-000000000001', 'aa000004-0001-4000-a000-000000000001', 1,
   'BNSF001 Shop Foreman', NOW() - INTERVAL '42 days', 'approved',
   48.0, 5200.00, 11800.00, 'Standard qualification package. All items within BRC limits.',
   NOW() - INTERVAL '42 days', NOW() - INTERVAL '38 days')
ON CONFLICT (id) DO NOTHING;

-- Car 1 estimate lines (4 items)
INSERT INTO estimate_lines (id, estimate_submission_id, line_number, job_code, description, labor_hours, material_cost, total_cost, created_at)
VALUES
  ('aa000006-0001-4000-a000-000000000001', 'aa000005-0001-4000-a000-000000000001', 1, 'T08', 'Tank Qualification Test', 12.0, 800.00, 3200.00, NOW() - INTERVAL '42 days'),
  ('aa000006-0001-4000-a000-000000000002', 'aa000005-0001-4000-a000-000000000001', 2, 'T10', 'Ultrasonic Test', 8.0, 400.00, 2000.00, NOW() - INTERVAL '42 days'),
  ('aa000006-0001-4000-a000-000000000003', 'aa000005-0001-4000-a000-000000000001', 3, 'T06', 'Tank Shell Repair — minor pitting', 16.0, 2800.00, 4000.00, NOW() - INTERVAL '42 days'),
  ('aa000006-0001-4000-a000-000000000004', 'aa000005-0001-4000-a000-000000000001', 4, 'T05', 'Tank Exterior Paint', 12.0, 1200.00, 2600.00, NOW() - INTERVAL '42 days')
ON CONFLICT (id) DO NOTHING;

-- Car 1 estimate decisions (all approved by human)
INSERT INTO estimate_line_decisions (id, estimate_line_id, decision_source, decision, confidence_score, responsibility, basis_type, basis_reference, decided_by_id, decided_at, created_at)
VALUES
  ('aa000007-0001-4000-a000-000000000001', 'aa000006-0001-4000-a000-000000000001', 'human', 'approve', 1.00, 'lessor', 'cri_table', 'CRI-2024-QUAL-STD', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
  ('aa000007-0001-4000-a000-000000000002', 'aa000006-0001-4000-a000-000000000002', 'human', 'approve', 1.00, 'lessor', 'cri_table', 'CRI-2024-UT-STD', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
  ('aa000007-0001-4000-a000-000000000003', 'aa000006-0001-4000-a000-000000000003', 'human', 'approve', 1.00, 'lessor', 'lease_clause', 'Sec 4.2 — Lessor bears normal wear repair', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
  ('aa000007-0001-4000-a000-000000000004', 'aa000006-0001-4000-a000-000000000004', 'ai', 'approve', 0.95, 'customer', 'policy', 'PAINT-POLICY-2024-v2: Customer responsible for cosmetic exterior', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days')
ON CONFLICT (id) DO NOTHING;

-- Car 2: v1 changes_required, v2 submitted (under review)
INSERT INTO estimate_submissions (id, shopping_event_id, version_number, submitted_by, submitted_at, status, total_labor_hours, total_material_cost, total_cost, notes, created_at, updated_at)
VALUES
  ('aa000005-0001-4000-a000-000000000002', 'aa000004-0001-4000-a000-000000000002', 1,
   'NS001 Shop Estimator', NOW() - INTERVAL '10 days', 'changes_required',
   56.0, 4800.00, 14200.00, 'Initial estimate — valve replacement may not be needed.',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days'),
  ('aa000005-0001-4000-a000-000000000003', 'aa000004-0001-4000-a000-000000000002', 2,
   'NS001 Shop Estimator', NOW() - INTERVAL '3 days', 'submitted',
   42.0, 3600.00, 9800.00, 'Revised per review — removed unnecessary valve replacement, reduced shell repair scope.',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Car 2 v1 lines (higher cost, some rejected)
INSERT INTO estimate_lines (id, estimate_submission_id, line_number, job_code, description, labor_hours, material_cost, total_cost, created_at)
VALUES
  ('aa000006-0001-4000-a000-000000000005', 'aa000005-0001-4000-a000-000000000002', 1, 'T08', 'Tank Qualification Test', 12.0, 800.00, 3200.00, NOW() - INTERVAL '10 days'),
  ('aa000006-0001-4000-a000-000000000006', 'aa000005-0001-4000-a000-000000000002', 2, 'T09', 'Hydrostatic Test', 8.0, 600.00, 2200.00, NOW() - INTERVAL '10 days'),
  ('aa000006-0001-4000-a000-000000000007', 'aa000005-0001-4000-a000-000000000002', 3, 'T06', 'Tank Shell Repair — extensive corrosion', 20.0, 2400.00, 5400.00, NOW() - INTERVAL '10 days'),
  ('aa000006-0001-4000-a000-000000000008', 'aa000005-0001-4000-a000-000000000002', 4, 'R05', 'Safety Valve Replacement', 16.0, 1000.00, 3400.00, NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- Car 2 v1 decisions (2 approved, 1 review, 1 rejected → triggered v2)
INSERT INTO estimate_line_decisions (id, estimate_line_id, decision_source, decision, confidence_score, responsibility, basis_type, basis_reference, decision_notes, decided_by_id, decided_at, created_at)
VALUES
  ('aa000007-0001-4000-a000-000000000005', 'aa000006-0001-4000-a000-000000000005', 'ai', 'approve', 0.98, 'lessor', 'cri_table', 'CRI-2024-QUAL-STD', NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('aa000007-0001-4000-a000-000000000006', 'aa000006-0001-4000-a000-000000000006', 'ai', 'approve', 0.92, 'lessor', 'cri_table', 'CRI-2024-HYDRO-STD', NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('aa000007-0001-4000-a000-000000000007', 'aa000006-0001-4000-a000-000000000007', 'human', 'review', 0.60, 'unknown', 'manual', 'Shell repair scope seems excessive for 8-yr car. Request photo evidence.', 'Requesting photos of corrosion before approving full scope.', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
  ('aa000007-0001-4000-a000-000000000008', 'aa000006-0001-4000-a000-000000000008', 'human', 'reject', 0.30, 'customer', 'lease_clause', 'Sec 5.1 — Valve was replaced 2 years ago, still under warranty.', 'Valve replacement unnecessary. Under manufacturer warranty until 2027.', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;

-- Car 2 v2 lines (revised — lower cost, no valve)
INSERT INTO estimate_lines (id, estimate_submission_id, line_number, job_code, description, labor_hours, material_cost, total_cost, created_at)
VALUES
  ('aa000006-0001-4000-a000-000000000009', 'aa000005-0001-4000-a000-000000000003', 1, 'T08', 'Tank Qualification Test', 12.0, 800.00, 3200.00, NOW() - INTERVAL '3 days'),
  ('aa000006-0001-4000-a000-000000000010', 'aa000005-0001-4000-a000-000000000003', 2, 'T09', 'Hydrostatic Test', 8.0, 600.00, 2200.00, NOW() - INTERVAL '3 days'),
  ('aa000006-0001-4000-a000-000000000011', 'aa000005-0001-4000-a000-000000000003', 3, 'T06', 'Tank Shell Repair — spot weld only (per photos)', 14.0, 1600.00, 3400.00, NOW() - INTERVAL '3 days'),
  ('aa000006-0001-4000-a000-000000000012', 'aa000005-0001-4000-a000-000000000003', 4, 'T05', 'Exterior Paint Touch-up', 8.0, 600.00, 1000.00, NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Car 3: v1 approved ($15,200)
INSERT INTO estimate_submissions (id, shopping_event_id, version_number, submitted_by, submitted_at, status, total_labor_hours, total_material_cost, total_cost, notes, created_at, updated_at)
VALUES
  ('aa000005-0001-4000-a000-000000000004', 'aa000004-0001-4000-a000-000000000003', 1,
   'IND001 Sr. Estimator', NOW() - INTERVAL '28 days', 'approved',
   64.0, 6400.00, 15200.00, 'Pressurized tank qualification + lining inspection. Extended scope approved.',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '24 days')
ON CONFLICT (id) DO NOTHING;

-- Car 3 lines
INSERT INTO estimate_lines (id, estimate_submission_id, line_number, job_code, description, labor_hours, material_cost, total_cost, created_at)
VALUES
  ('aa000006-0001-4000-a000-000000000013', 'aa000005-0001-4000-a000-000000000004', 1, 'T08', 'Tank Qualification Test', 12.0, 800.00, 3200.00, NOW() - INTERVAL '28 days'),
  ('aa000006-0001-4000-a000-000000000014', 'aa000005-0001-4000-a000-000000000004', 2, 'T09', 'Hydrostatic Test (High Pressure)', 10.0, 1200.00, 3200.00, NOW() - INTERVAL '28 days'),
  ('aa000006-0001-4000-a000-000000000015', 'aa000005-0001-4000-a000-000000000004', 3, 'T03', 'Tank Interior Lining - Apply', 20.0, 3200.00, 5200.00, NOW() - INTERVAL '28 days'),
  ('aa000006-0001-4000-a000-000000000016', 'aa000005-0001-4000-a000-000000000004', 4, 'R05', 'Air Brake Overhaul', 12.0, 800.00, 2200.00, NOW() - INTERVAL '28 days'),
  ('aa000006-0001-4000-a000-000000000017', 'aa000005-0001-4000-a000-000000000004', 5, 'T05', 'Tank Exterior Paint', 10.0, 400.00, 1400.00, NOW() - INTERVAL '28 days')
ON CONFLICT (id) DO NOTHING;

-- Car 4: v1 approved ($8,650)
INSERT INTO estimate_submissions (id, shopping_event_id, version_number, submitted_by, submitted_at, status, total_labor_hours, total_material_cost, total_cost, notes, created_at, updated_at)
VALUES
  ('aa000005-0001-4000-a000-000000000005', 'aa000004-0001-4000-a000-000000000004', 1,
   'UP001 Estimator', NOW() - INTERVAL '25 days', 'approved',
   36.0, 3200.00, 8650.00, 'Lease return prep — cleaning, paint, running gear check.',
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '22 days')
ON CONFLICT (id) DO NOTHING;

-- Car 4 lines
INSERT INTO estimate_lines (id, estimate_submission_id, line_number, job_code, description, labor_hours, material_cost, total_cost, created_at)
VALUES
  ('aa000006-0001-4000-a000-000000000018', 'aa000005-0001-4000-a000-000000000005', 1, 'T01', 'Tank Interior Cleaning', 8.0, 400.00, 2000.00, NOW() - INTERVAL '25 days'),
  ('aa000006-0001-4000-a000-000000000019', 'aa000005-0001-4000-a000-000000000005', 2, 'T05', 'Tank Exterior Paint', 12.0, 1200.00, 2800.00, NOW() - INTERVAL '25 days'),
  ('aa000006-0001-4000-a000-000000000020', 'aa000005-0001-4000-a000-000000000005', 3, 'R01', 'Truck Overhaul', 16.0, 1600.00, 3850.00, NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 8. COMPONENTS — Car 1 (replaced), Car 3 (partial install), Car 4 (inspected)
-- =============================================================================

INSERT INTO components (id, car_number, component_type, serial_number, manufacturer, model, install_date, last_inspection_date, next_inspection_due, status, specification, notes, created_by, created_at, updated_at)
VALUES
  -- Car 1: components from completed repair
  ('aa00000a-0001-4000-a000-000000000001', 'UTLX123456', 'valve', 'VLV-2026-00142', 'Midland Manufacturing', 'A-400 PRV', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', NOW() + INTERVAL '365 days', 'active', 'Pressure relief valve, 75 PSI rating', 'Installed during SE-2026-GT01 qualification', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  ('aa00000a-0001-4000-a000-000000000002', 'UTLX123456', 'gauge', 'GAU-2026-00088', 'Rochester Gauges', 'TL-6100', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', NOW() + INTERVAL '730 days', 'active', 'Magnetic liquid level gauge', 'Replaced — old gauge failed calibration', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  -- Car 3: partial components (in progress)
  ('aa00000a-0001-4000-a000-000000000003', 'PROX345678', 'lining', 'LIN-2026-00203', 'Hempel Coatings', 'Hempadur 15570', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() + INTERVAL '1825 days', 'active', 'Epoxy lining, 12 mil DFT', 'Applied during tank qual — curing for 72h', '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('aa00000a-0001-4000-a000-000000000004', 'PROX345678', 'valve', 'VLV-2026-00156', 'Midland Manufacturing', 'A-400 PRV', NULL, NULL, NULL, 'removed', 'Pressure relief valve, 150 PSI rating', 'Removed for inspection — awaiting reinstall after hydro test', '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '8 days', NOW() - INTERVAL '2 days'),
  -- Car 4: inspected running gear
  ('aa00000a-0001-4000-a000-000000000005', 'TILX901234', 'fitting', 'FIT-2024-01892', 'Continental Industries', 'CI-300 BOV', '2024-03-15', NOW() - INTERVAL '8 days', NOW() + INTERVAL '365 days', 'active', 'Bottom outlet valve, 4-inch', 'Inspected and approved during lease return prep', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('aa00000a-0001-4000-a000-000000000006', 'TILX901234', 'relief_device', 'RD-2024-00445', 'Anderson Greenwood', 'Series 200', '2024-03-15', NOW() - INTERVAL '8 days', NOW() + INTERVAL '365 days', 'active', 'Pressure relief device, 100 PSI set point', 'Passed annual test during SE-2026-GT04', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 9. VENDOR INVOICES + LINE ITEMS — Car 1 (paid) + Car 4 (approved)
-- =============================================================================

-- Car 1: vendor invoice (sent to SAP)
INSERT INTO invoices (id, invoice_number, vendor_code, shop_code, invoice_date, received_date, invoice_total, brc_total, variance_amount, variance_pct, status, reviewed_by, original_filename, file_format, created_at, updated_at)
VALUES
  ('aa00000b-0001-4000-a000-000000000001', 'INV-BNSF001-GT01', 'BNSF-ALLIANCE', 'BNSF001',
   (NOW() - INTERVAL '8 days')::date, (NOW() - INTERVAL '6 days')::date,
   11800.00, 12500.00, -700.00, -5.60, 'sent_to_sap',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'BNSF001_UTLX123456_inv.pdf', 'pdf',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- Car 4: vendor invoice (approved, not yet posted)
INSERT INTO invoices (id, invoice_number, vendor_code, shop_code, invoice_date, received_date, invoice_total, brc_total, variance_amount, variance_pct, status, reviewed_by, original_filename, file_format, created_at, updated_at)
VALUES
  ('aa00000b-0001-4000-a000-000000000002', 'INV-UP001-GT04', 'UP-NORTHPLATTE', 'UP001',
   (NOW() - INTERVAL '4 days')::date, (NOW() - INTERVAL '2 days')::date,
   8650.00, 8900.00, -250.00, -2.81, 'approved',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'UP001_TILX901234_inv.pdf', 'pdf',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- Invoice line items — Car 1
INSERT INTO invoice_line_items (id, invoice_id, line_number, car_number, job_code, labor_amount, material_amount, total_amount, description, match_status, matched_allocation_id, match_confidence)
VALUES
  ('aa00000c-0001-4000-a000-000000000001', 'aa00000b-0001-4000-a000-000000000001', 1, 'UTLX123456', 'T08', 2400.00, 800.00, 3200.00, 'Tank Qualification Test', 'exact_match', 'aa000002-0001-4000-a000-000000000001', 0.99),
  ('aa00000c-0001-4000-a000-000000000002', 'aa00000b-0001-4000-a000-000000000001', 2, 'UTLX123456', 'T10', 1600.00, 400.00, 2000.00, 'Ultrasonic Test', 'exact_match', 'aa000002-0001-4000-a000-000000000001', 0.98),
  ('aa00000c-0001-4000-a000-000000000003', 'aa00000b-0001-4000-a000-000000000001', 3, 'UTLX123456', 'T06', 1200.00, 2800.00, 4000.00, 'Tank Shell Repair', 'exact_match', 'aa000002-0001-4000-a000-000000000001', 0.97)
ON CONFLICT (id) DO NOTHING;

-- Invoice line items — Car 4
INSERT INTO invoice_line_items (id, invoice_id, line_number, car_number, job_code, labor_amount, material_amount, total_amount, description, match_status, matched_allocation_id, match_confidence)
VALUES
  ('aa00000c-0001-4000-a000-000000000004', 'aa00000b-0001-4000-a000-000000000002', 1, 'TILX901234', 'T01', 1600.00, 400.00, 2000.00, 'Tank Interior Cleaning', 'exact_match', 'aa000002-0001-4000-a000-000000000004', 0.99),
  ('aa00000c-0001-4000-a000-000000000005', 'aa00000b-0001-4000-a000-000000000002', 2, 'TILX901234', 'T05', 1600.00, 1200.00, 2800.00, 'Tank Exterior Paint', 'exact_match', 'aa000002-0001-4000-a000-000000000004', 0.98),
  ('aa00000c-0001-4000-a000-000000000006', 'aa00000b-0001-4000-a000-000000000002', 3, 'TILX901234', 'R01', 2250.00, 1600.00, 3850.00, 'Truck Overhaul', 'exact_match', 'aa000002-0001-4000-a000-000000000004', 0.96)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 10. COST ALLOCATION ENTRIES — Link vendor costs to customers
-- =============================================================================

INSERT INTO cost_allocation_entries (id, allocation_id, customer_id, car_number, labor_cost, material_cost, total_cost, billing_entity, lessee_share_pct, owner_share_pct, lessee_amount, owner_amount, shopping_event_id, status, allocated_by, notes, created_at, updated_at)
VALUES
  -- Car 1: DuPont customer, 80% lessor / 20% customer split
  ('aa000017-0001-4000-a000-000000000001',
   'aa000002-0001-4000-a000-000000000001',
   (SELECT id FROM customers WHERE customer_code = 'DUPONT'),
   'UTLX123456', 5200.00, 5200.00, 11800.00, 'DUPONT',
   20.00, 80.00, 2360.00, 9440.00,
   'aa000004-0001-4000-a000-000000000001', 'invoiced',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
   'Customer responsible for paint (20%). Lessor bears qualification + structural.',
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days'),
  -- Car 4: Mosaic customer, 100% lessor (lease return is owner responsibility)
  ('aa000017-0001-4000-a000-000000000002',
   'aa000002-0001-4000-a000-000000000004',
   (SELECT id FROM customers WHERE customer_code = 'MOSAIC'),
   'TILX901234', 5450.00, 3200.00, 8650.00, 'MOSAIC',
   0.00, 100.00, 0.00, 8650.00,
   'aa000004-0001-4000-a000-000000000004', 'allocated',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
   'Lease return — all costs borne by lessor per standard terms.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 11. BILLING RUN — Car 1 included in completed billing run
-- =============================================================================

INSERT INTO billing_runs (id, fiscal_year, fiscal_month, run_type, preflight_passed, status, invoices_generated, total_amount, initiated_by, approved_by, approved_at, completed_at, created_at, current_step)
VALUES
  ('aa00000f-0001-4000-a000-000000000001',
   2026, 1, 'full', true, 'completed', 1, 2360.00,
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day',
   NOW() - INTERVAL '3 days', 'complete')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 12. OUTBOUND INVOICE + LINES — Car 1 customer charge to DuPont
-- =============================================================================

INSERT INTO outbound_invoices (id, invoice_number, customer_id, billing_period_start, billing_period_end, fiscal_year, fiscal_month, invoice_type, rental_total, chargeback_total, invoice_total, status, generated_by, approved_by, approved_at, sent_to_customer_at, payment_due_date, notes, created_at, updated_at)
VALUES
  ('aa00000d-0001-4000-a000-000000000001',
   'OBI-2026-01-DUPONT-001',
   (SELECT id FROM customers WHERE customer_code = 'DUPONT'),
   '2026-01-01', '2026-01-31', 2026, 1, 'chargeback',
   0.00, 2360.00, 2360.00, 'sent',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
   NOW() - INTERVAL '1 day',
   NOW() - INTERVAL '1 day',
   (NOW() + INTERVAL '29 days')::date,
   'FY26-01 chargeback: UTLX123456 exterior paint per lease Sec 5.1.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO outbound_invoice_lines (id, invoice_id, line_number, line_type, description, car_number, quantity, unit_rate, line_total, notes, created_at)
VALUES
  ('aa00000e-0001-4000-a000-000000000001', 'aa00000d-0001-4000-a000-000000000001', 1, 'chargeback', 'Tank Exterior Paint — UTLX123456 (Customer Responsibility per Sec 5.1)', 'UTLX123456', 1, 2360.00, 2360.00, 'SE-2026-GT01 line 4 — AI-flagged customer responsibility, human-confirmed', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 13. CAR RELEASE — Car 1 released from shop
-- =============================================================================

INSERT INTO car_releases (id, car_number, rider_id, assignment_id, shopping_event_id, release_type, status, initiated_by, approved_by, approved_at, completed_by, completed_at, notes, created_at, updated_at)
VALUES
  ('aa000010-0001-4000-a000-000000000001',
   'UTLX123456',
   (SELECT id FROM lease_riders WHERE rider_id = 'RDR-ML-ADM-2024-A'), -- ADM rider (UTLX123456 lessee = ADM)
   'aa000003-0001-4000-a000-000000000001',
   'aa000004-0001-4000-a000-000000000001',
   'shop_complete', 'COMPLETED',
   '7b15c7ba-1b51-4aef-a48c-338e0713405f',  -- operator initiated
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',  -- admin approved
   NOW() - INTERVAL '5 days',
   '7b15c7ba-1b51-4aef-a48c-338e0713405f',
   NOW() - INTERVAL '5 days',
   'Qualification complete. All tests passed. Car released to BNSF mainline.',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 14. LEASE TRANSITION — Car 5 transferring between riders (Bunge → DuPont)
-- =============================================================================

INSERT INTO car_lease_transitions (id, car_number, from_rider_id, to_rider_id, transition_type, status, initiated_date, target_completion_date, requires_shop_visit, notes, created_by, created_at, updated_at)
VALUES
  ('aa000011-0001-4000-a000-000000000001',
   'GATX112233',
   (SELECT id FROM lease_riders WHERE rider_id = 'RDR-ML-BUNGE-2024-A'),
   (SELECT id FROM lease_riders WHERE rider_id = 'RDR-ML-DUPONT-2024-A'),
   'reassignment', 'InProgress',
   (NOW() - INTERVAL '12 days')::date,
   (NOW() + INTERVAL '18 days')::date,
   true,
   'Bunge releasing car early per amendment. DuPont accepting for organic chemical service. Requires cleaning + lining inspection before reassignment.',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 15. RIDERS (simplified table from 022) — For CCM/billable items context
-- =============================================================================

INSERT INTO riders (id, lessee_code, lessee_name, contract_base, rider_number, full_contract_number, effective_date, expiration_date, terms_summary, car_count, created_at, updated_at)
VALUES
  ('aa000012-0001-4000-a000-000000000001', 'DUPONT', 'DuPont Chemical', 'DUPONT-2024', 'R001', 'DUPONT-2024-R001', '2024-01-01', '2027-12-31', 'Standard tank car lease. Lessor bears qualification and structural repair. Customer bears exterior cosmetic and commodity-specific cleaning.', 50, NOW() - INTERVAL '365 days', NOW()),
  ('aa000012-0001-4000-a000-000000000002', 'MOSAIC', 'Mosaic Company', 'MOSAIC-2024', 'R001', 'MOSAIC-2024-R001', '2024-06-01', '2027-09-30', 'Fertilizer fleet lease. All repair costs borne by lessor. Customer responsible for demurrage.', 30, NOW() - INTERVAL '240 days', NOW())
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 16. BILLABLE ITEMS — Define who pays for what per lessee
-- =============================================================================

INSERT INTO billable_items (id, lessee_code, commodity, car_type, item_code, item_description, is_customer_responsible, billing_notes, created_by, created_at, updated_at)
VALUES
  ('aa000018-0001-4000-a000-000000000001', 'DUPONT', 'Chemicals - Organic', 'DOT-111 Tank Car', 'T05', 'Tank Exterior Paint', true, 'Customer responsible per lease Sec 5.1 — cosmetic exterior', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '180 days', NOW()),
  ('aa000018-0001-4000-a000-000000000002', 'DUPONT', 'Chemicals - Organic', 'DOT-111 Tank Car', 'T08', 'Tank Qualification Test', false, 'Lessor responsibility — regulatory', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '180 days', NOW()),
  ('aa000018-0001-4000-a000-000000000003', 'MOSAIC', 'Fertilizer - Phosphate', 'DOT-111 Tank Car', 'T05', 'Tank Exterior Paint', false, 'All maintenance costs borne by lessor per agreement', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '180 days', NOW()),
  ('aa000018-0001-4000-a000-000000000004', 'EXXON', 'Petroleum - Naphtha', 'DOT-117 Pressurized', 'T03', 'Tank Interior Lining', true, 'Customer responsible for commodity-specific lining per Sec 6.3', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '180 days', NOW())
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 17. PROJECT CARS + ASSIGNMENTS — Link cars 1, 2, 3 to qualification project
-- =============================================================================

-- Use existing project: 10000001-0000-0000-0000-000000000001 (FY26 Q2 Tank Qualification Batch)
INSERT INTO project_cars (id, project_id, car_number, status, added_at, added_by)
VALUES
  ('aa000013-0001-4000-a000-000000000001', '10000001-0000-0000-0000-000000000001', 'UTLX123456', 'completed',
   NOW() - INTERVAL '55 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('aa000013-0001-4000-a000-000000000002', '10000001-0000-0000-0000-000000000001', 'GATX789012', 'in_progress',
   NOW() - INTERVAL '50 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('aa000013-0001-4000-a000-000000000003', '10000001-0000-0000-0000-000000000001', 'PROX345678', 'in_progress',
   NOW() - INTERVAL '40 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_assignments (id, project_id, project_car_id, car_number, car_assignment_id, shop_code, shop_name, target_month, estimated_cost, plan_state, version, created_at, created_by, updated_at)
VALUES
  ('aa000014-0001-4000-a000-000000000001', '10000001-0000-0000-0000-000000000001', 'aa000013-0001-4000-a000-000000000001', 'UTLX123456', 'aa000003-0001-4000-a000-000000000001', 'BNSF001', 'Alliance Repair Center', '2026-01', 12500.00, 'Locked', 1, NOW() - INTERVAL '55 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '50 days'),
  ('aa000014-0001-4000-a000-000000000002', '10000001-0000-0000-0000-000000000001', 'aa000013-0001-4000-a000-000000000002', 'GATX789012', 'aa000003-0001-4000-a000-000000000002', 'NS001', 'Roanoke Heavy Repair', '2026-01', 9800.00, 'Locked', 1, NOW() - INTERVAL '50 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '45 days'),
  ('aa000014-0001-4000-a000-000000000003', '10000001-0000-0000-0000-000000000001', 'aa000013-0001-4000-a000-000000000003', 'PROX345678', 'aa000003-0001-4000-a000-000000000003', 'IND001', 'Trinity Industries', '2026-02', 15200.00, 'Locked', 1, NOW() - INTERVAL '40 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '35 days')
ON CONFLICT (id) DO NOTHING;

-- Update project to reflect linked cars
UPDATE projects SET
  planned_cars_count = 3,
  locked_cars_count = 3,
  estimated_total_cost = 37500.00,
  status = 'in_progress'
WHERE id = '10000001-0000-0000-0000-000000000001';


-- =============================================================================
-- 18. ALERTS — Active alerts for demo visibility
-- =============================================================================

INSERT INTO alerts (id, alert_type, severity, title, message, entity_type, entity_id, target_user_id, target_role, is_read, is_dismissed, metadata, created_at)
VALUES
  -- Car 2: Estimate needs human review
  ('aa000016-0001-4000-a000-000000000001', 'estimate_review', 'warning',
   'Estimate v2 Pending Review — GATX789012',
   'Revised estimate submitted for GATX789012 at NS001 (Roanoke). v1 had rejected items. v2 total: $9,800. Review required.',
   'shopping_event', 'aa000004-0001-4000-a000-000000000002',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin', false, false,
   '{"car_number":"GATX789012","shop_code":"NS001","estimate_version":2,"total_cost":9800}',
   NOW() - INTERVAL '3 days'),
  -- Car 3: Component removed — awaiting reinstall
  ('aa000016-0001-4000-a000-000000000002', 'component_status', 'critical',
   'Safety Valve Removed — PROX345678',
   'Pressure relief valve VLV-2026-00156 removed from PROX345678 at IND001. Car cannot be released until valve is reinstalled and tested.',
   'component', 'aa00000a-0001-4000-a000-000000000004',
   '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'operator', false, false,
   '{"car_number":"PROX345678","component_type":"valve","serial":"VLV-2026-00156","shop_code":"IND001"}',
   NOW() - INTERVAL '2 days'),
  -- Car 4: Billing pending — invoice approved but not yet posted
  ('aa000016-0001-4000-a000-000000000003', 'billing_pending', 'info',
   'Vendor Invoice Approved — TILX901234 Ready for SAP Posting',
   'Invoice INV-UP001-GT04 for TILX901234 ($8,650) has been approved. Ready for SAP posting and outbound billing.',
   'invoice', 'aa00000b-0001-4000-a000-000000000002',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin', false, false,
   '{"car_number":"TILX901234","invoice_number":"INV-UP001-GT04","total":8650,"shop_code":"UP001"}',
   NOW() - INTERVAL '1 day'),
  -- Car 5: Transfer in progress
  ('aa000016-0001-4000-a000-000000000004', 'lease_transition', 'warning',
   'Lease Transfer In Progress — GATX112233',
   'GATX112233 transferring from Bunge (RDR-ML-BUNGE-2024-A) to DuPont (RDR-ML-DUPONT-2024-A). Enroute to CSX001 Waycross for cleaning and inspection. Target completion: 18 days.',
   'car_lease_transition', 'aa000011-0001-4000-a000-000000000001',
   'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin', false, false,
   '{"car_number":"GATX112233","from_lessee":"BUNGE","to_lessee":"DUPONT","target_shop":"CSX001"}',
   NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 19. STATE TRANSITION LOG — Complete audit trail for Car 1 (golden path)
-- =============================================================================

INSERT INTO state_transition_log (id, process_type, entity_id, entity_number, from_state, to_state, is_reversible, actor_id, actor_email, notes, created_at)
VALUES
  -- Car 1: Full lifecycle transitions
  ('aa000015-0001-4000-a000-000000000001', 'allocation', 'aa000002-0001-4000-a000-000000000001', 'UTLX123456', NULL, 'Need Shopping', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Demand FY26 Q1 → allocation created', NOW() - INTERVAL '55 days'),
  ('aa000015-0001-4000-a000-000000000002', 'allocation', 'aa000002-0001-4000-a000-000000000001', 'UTLX123456', 'Need Shopping', 'Planned Shopping', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Assigned to BNSF001 Alliance', NOW() - INTERVAL '54 days'),
  ('aa000015-0001-4000-a000-000000000003', 'car_assignment', 'aa000003-0001-4000-a000-000000000001', 'UTLX123456', NULL, 'Planned', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Car assignment created from demand plan', NOW() - INTERVAL '54 days'),
  ('aa000015-0001-4000-a000-000000000004', 'car_assignment', 'aa000003-0001-4000-a000-000000000001', 'UTLX123456', 'Planned', 'Scheduled', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Scheduled for Jan 2026 at BNSF001', NOW() - INTERVAL '52 days'),
  ('aa000015-0001-4000-a000-000000000005', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', NULL, 'REQUESTED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Shopping event created', NOW() - INTERVAL '50 days'),
  ('aa000015-0001-4000-a000-000000000006', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'REQUESTED', 'ASSIGNED_TO_SHOP', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Assigned to BNSF001 Alliance Repair Center', NOW() - INTERVAL '49 days'),
  ('aa000015-0001-4000-a000-000000000007', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'ASSIGNED_TO_SHOP', 'INBOUND', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'Car enroute to shop', NOW() - INTERVAL '47 days'),
  ('aa000015-0001-4000-a000-000000000008', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'INBOUND', 'INSPECTION', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'Car arrived, entering inspection', NOW() - INTERVAL '45 days'),
  ('aa000015-0001-4000-a000-000000000009', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'INSPECTION', 'ESTIMATE_SUBMITTED', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'Estimate v1 submitted ($11,800)', NOW() - INTERVAL '42 days'),
  ('aa000015-0001-4000-a000-000000000010', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'ESTIMATE_SUBMITTED', 'ESTIMATE_UNDER_REVIEW', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Estimate under admin review', NOW() - INTERVAL '41 days'),
  ('aa000015-0001-4000-a000-000000000011', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'ESTIMATE_UNDER_REVIEW', 'ESTIMATE_APPROVED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'All 4 lines approved. Paint flagged as customer responsibility.', NOW() - INTERVAL '40 days'),
  ('aa000015-0001-4000-a000-000000000012', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'ESTIMATE_APPROVED', 'WORK_AUTHORIZED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Work authorized, SOW finalized', NOW() - INTERVAL '38 days'),
  ('aa000015-0001-4000-a000-000000000013', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'WORK_AUTHORIZED', 'IN_REPAIR', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'Repair commenced — qual test + shell repair', NOW() - INTERVAL '35 days'),
  ('aa000015-0001-4000-a000-000000000014', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'IN_REPAIR', 'QA_COMPLETE', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'All repairs complete, QA inspection passed', NOW() - INTERVAL '15 days'),
  ('aa000015-0001-4000-a000-000000000015', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'QA_COMPLETE', 'READY_FOR_RELEASE', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'Components installed, ready for release authorization', NOW() - INTERVAL '10 days'),
  ('aa000015-0001-4000-a000-000000000016', 'shopping_event', 'aa000004-0001-4000-a000-000000000001', 'SE-2026-GT01', 'READY_FOR_RELEASE', 'RELEASED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Car released. Invoice submitted. Outbound billing sent to DuPont.', NOW() - INTERVAL '5 days'),

  -- Car 2: Partial transitions (stuck at estimate review)
  ('aa000015-0001-4000-a000-000000000017', 'shopping_event', 'aa000004-0001-4000-a000-000000000002', 'SE-2026-GT02', NULL, 'REQUESTED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Shopping event created for GATX789012', NOW() - INTERVAL '45 days'),
  ('aa000015-0001-4000-a000-000000000018', 'shopping_event', 'aa000004-0001-4000-a000-000000000002', 'SE-2026-GT02', 'ESTIMATE_SUBMITTED', 'ESTIMATE_UNDER_REVIEW', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'v1 submitted $14,200 — reviewing line items', NOW() - INTERVAL '10 days'),
  ('aa000015-0001-4000-a000-000000000019', 'shopping_event', 'aa000004-0001-4000-a000-000000000002', 'SE-2026-GT02', 'ESTIMATE_UNDER_REVIEW', 'CHANGES_REQUIRED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'v1 rejected: valve unnecessary, shell repair excessive. Requested revision.', NOW() - INTERVAL '7 days'),
  ('aa000015-0001-4000-a000-000000000020', 'shopping_event', 'aa000004-0001-4000-a000-000000000002', 'SE-2026-GT02', 'CHANGES_REQUIRED', 'ESTIMATE_UNDER_REVIEW', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'v2 submitted $9,800 — awaiting review', NOW() - INTERVAL '3 days'),

  -- Car 3: In repair
  ('aa000015-0001-4000-a000-000000000021', 'shopping_event', 'aa000004-0001-4000-a000-000000000003', 'SE-2026-GT03', 'ESTIMATE_APPROVED', 'WORK_AUTHORIZED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Work authorized — pressurized tank qualification + lining', NOW() - INTERVAL '24 days'),
  ('aa000015-0001-4000-a000-000000000022', 'shopping_event', 'aa000004-0001-4000-a000-000000000003', 'SE-2026-GT03', 'WORK_AUTHORIZED', 'IN_REPAIR', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'Repair started — lining application in progress', NOW() - INTERVAL '20 days'),

  -- Car 4: Released
  ('aa000015-0001-4000-a000-000000000023', 'shopping_event', 'aa000004-0001-4000-a000-000000000004', 'SE-2026-GT04', 'IN_REPAIR', 'QA_COMPLETE', false, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'demo-operator@railsync.com', 'Lease return prep complete, QA passed', NOW() - INTERVAL '8 days'),
  ('aa000015-0001-4000-a000-000000000024', 'shopping_event', 'aa000004-0001-4000-a000-000000000004', 'SE-2026-GT04', 'QA_COMPLETE', 'RELEASED', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Released. Invoice pending SAP posting.', NOW() - INTERVAL '3 days'),

  -- Car 5: Transition log
  ('aa000015-0001-4000-a000-000000000025', 'car_lease_transition', 'aa000011-0001-4000-a000-000000000001', 'GATX112233', NULL, 'Pending', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Lease transition initiated: Bunge → DuPont', NOW() - INTERVAL '12 days'),
  ('aa000015-0001-4000-a000-000000000026', 'car_lease_transition', 'aa000011-0001-4000-a000-000000000001', 'GATX112233', 'Pending', 'InProgress', false, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'demo-admin@railsync.com', 'Car enroute to CSX001 Waycross for transition prep', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 20. QUALIFICATIONS — Link to our demo cars
-- =============================================================================

-- Update existing qualifications for our demo cars (they exist with 'unknown' status)
-- Car 1: Recently qualified (current)
UPDATE qualifications SET
  status = 'current',
  last_completed_date = (NOW() - INTERVAL '15 days')::date,
  next_due_date = (NOW() + INTERVAL '1825 days')::date,
  expiry_date = (NOW() + INTERVAL '1825 days')::date,
  interval_months = 60,
  completed_by = '7b15c7ba-1b51-4aef-a48c-338e0713405f',
  completion_shop_code = 'BNSF001',
  notes = 'Qualified during SE-2026-GT01. UT + hydro passed. Next due 2031.',
  updated_at = NOW()
WHERE car_id = (SELECT id FROM cars WHERE car_number = 'UTLX123456')
  AND qualification_type_id = (SELECT id FROM qualification_types WHERE code = 'TANK_REQUALIFICATION');

-- Car 2: Due soon (why it's in qualification)
UPDATE qualifications SET
  status = 'due_soon',
  last_completed_date = '2020-07-15',
  next_due_date = '2026-07-15',
  expiry_date = '2026-07-15',
  interval_months = 60,
  notes = 'Qualification expiring July 2026. In shop for requalification.',
  updated_at = NOW()
WHERE car_id = (SELECT id FROM cars WHERE car_number = 'GATX789012')
  AND qualification_type_id = (SELECT id FROM qualification_types WHERE code = 'TANK_REQUALIFICATION');

-- Car 3: Overdue (critical — why it's priority 1)
UPDATE qualifications SET
  status = 'overdue',
  last_completed_date = '2021-03-31',
  next_due_date = '2026-03-31',
  expiry_date = '2026-03-31',
  interval_months = 60,
  notes = 'Qualification expired March 2026. Car in shop at IND001 for emergency qualification.',
  updated_at = NOW()
WHERE car_id = (SELECT id FROM cars WHERE car_number = 'PROX345678')
  AND qualification_type_id = (SELECT id FROM qualification_types WHERE code = 'TANK_REQUALIFICATION');

-- Car 1: Air brake also current (insert — may not exist yet)
INSERT INTO qualifications (id, car_id, qualification_type_id, status, last_completed_date, next_due_date, expiry_date, interval_months, completed_by, completion_shop_code, notes, created_at, updated_at)
VALUES
  ('aa000019-0001-4000-a000-000000000004',
   (SELECT id FROM cars WHERE car_number = 'UTLX123456'),
   (SELECT id FROM qualification_types WHERE code = 'AIR_BRAKE'),
   'current', (NOW() - INTERVAL '15 days')::date, (NOW() + INTERVAL '365 days')::date, (NOW() + INTERVAL '365 days')::date, 12,
   '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'BNSF001',
   'Air brake overhaul completed during SE-2026-GT01.',
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days')
ON CONFLICT (car_id, qualification_type_id) DO UPDATE SET
  status = EXCLUDED.status,
  last_completed_date = EXCLUDED.last_completed_date,
  next_due_date = EXCLUDED.next_due_date,
  expiry_date = EXCLUDED.expiry_date,
  completed_by = EXCLUDED.completed_by,
  completion_shop_code = EXCLUDED.completion_shop_code,
  notes = EXCLUDED.notes,
  updated_at = EXCLUDED.updated_at;


-- =============================================================================
-- 21. CAR LOCATIONS — Show where each demo car is
-- =============================================================================

-- Upsert car_locations (unique on car_number)
INSERT INTO car_locations (id, car_number, location_type, railroad, city, state, latitude, longitude, source, reported_at, created_at, updated_at)
VALUES
  ('aa00001a-0001-4000-a000-000000000001', 'UTLX123456', 'in_transit', 'BNSF', 'Omaha', 'NE', 41.1039, -96.7898, 'railinc', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('aa00001a-0001-4000-a000-000000000002', 'GATX789012', 'at_shop', 'NS', 'Roanoke', 'VA', 37.2710, -79.9414, 'manual', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('aa00001a-0001-4000-a000-000000000003', 'PROX345678', 'at_shop', 'BNSF', 'Dallas', 'TX', 32.7767, -96.7970, 'manual', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('aa00001a-0001-4000-a000-000000000004', 'TILX901234', 'at_yard', 'UP', 'North Platte', 'NE', 41.1230, -100.7654, 'railinc', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('aa00001a-0001-4000-a000-000000000005', 'GATX112233', 'in_transit', 'CSX', 'Greenville', 'SC', 34.5037, -82.6501, 'railinc', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (car_number) DO UPDATE SET
  location_type = EXCLUDED.location_type,
  railroad = EXCLUDED.railroad,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  source = EXCLUDED.source,
  reported_at = EXCLUDED.reported_at,
  updated_at = EXCLUDED.updated_at;


COMMIT;

-- =============================================================================
-- DEMO NARRATIVE SUMMARY
-- =============================================================================
-- Car 1 (UTLX123456) — FULL LIFECYCLE COMPLETE
--   Demand → Allocation → Assignment → Shopping Event → Estimate (approved) →
--   SOW (finalized) → Components (installed) → Service → Vendor Invoice (SAP) →
--   Cost Allocation (80/20 split) → Billing Run → Outbound Invoice (sent) →
--   Release (completed) → Qualifications (current)
--   State transitions: 16 logged entries tracing every step
--
-- Car 2 (GATX789012) — ESTIMATE REVIEW IN PROGRESS
--   Demand → Allocation → Assignment → Shopping Event → Estimate v1 (rejected) →
--   Estimate v2 (submitted, under review) → Alert (pending review)
--   Demonstrates: Version comparison, line-item decisions (AI + human),
--   rejection workflow, estimate revision
--
-- Car 3 (PROX345678) — ACTIVE REPAIR
--   Demand → Allocation → Assignment → Shopping Event → Estimate (approved) →
--   SOW (active) → Components (partial — valve removed, lining applied) →
--   Alert (critical: safety valve removed)
--   Demonstrates: Mid-repair state, component tracking, qualification overdue
--
-- Car 4 (TILX901234) — PENDING BILLING
--   Demand → Allocation → Assignment → Shopping Event → Estimate (approved) →
--   SOW (finalized) → Released → Vendor Invoice (approved) → Cost Allocation →
--   Alert (ready for SAP posting)
--   Demonstrates: Billing pipeline, cost allocation, unbilled work
--
-- Car 5 (GATX112233) — TRANSFER IN PROGRESS
--   Demand → Allocation → Lease Transition (Bunge → DuPont) → Enroute to new shop →
--   Alert (transfer in progress)
--   Demonstrates: Inter-lessee transfer, lease transitions, shop reassignment
-- =============================================================================
