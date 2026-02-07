-- ============================================================================
-- COMPREHENSIVE TEST DATA SEED
-- Fills all feature areas with realistic test data for end-to-end testing.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING where applicable).
-- ============================================================================

-- Reference IDs (created by migration 047_demo_historical_data.sql)
-- Admin user:    de69920f-cdcb-4668-9f21-9c4dbccfb8c9
-- Operator user: 7b15c7ba-1b51-4aef-a48c-338e0713405f
-- Customer user: 63d82d01-7bff-4d4d-8774-59babd94e9a2

-- ============================================================================
-- 1. NOTIFICATION PREFERENCES
-- ============================================================================

INSERT INTO notification_preferences (user_id, email_bad_orders, email_capacity_warnings, email_allocation_updates, email_daily_digest, email_project_lock_changes, email_project_bundling_alerts)
VALUES
  ('de69920f-cdcb-4668-9f21-9c4dbccfb8c9', true, true, true, true, true, true),
  ('7b15c7ba-1b51-4aef-a48c-338e0713405f', true, true, true, false, true, true),
  ('63d82d01-7bff-4d4d-8774-59babd94e9a2', false, false, false, false, false, false)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 2. SCOPE OF WORK LIBRARY
-- ============================================================================

INSERT INTO scope_library (id, name, car_type, shopping_type_code, description, is_active, created_by_id)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Tank Qualification - Standard', 'General Service Tank', 'QUAL', 'Standard qualification scope for general service tanks including interior inspection, shell measurement, valve inspection, and safety device testing.', true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('a0000001-0000-0000-0000-000000000002', 'Tank Qualification - High Bake Lining', 'General Service Tank', 'QUAL', 'Qualification with high bake phenolic lining removal and reapplication.', true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('a0000001-0000-0000-0000-000000000003', 'Running Repair - Mechanical', NULL, 'MECH', 'General mechanical repair including trucks, brakes, draft gear, and coupler.', true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('a0000001-0000-0000-0000-000000000004', 'Running Repair - Shell Patch', NULL, 'MECH', 'Shell patch and weld repair for corrosion or impact damage.', true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('a0000001-0000-0000-0000-000000000005', 'Bad Order - Emergency', NULL, 'BO', 'Emergency bad order repair to restore car to service.', true, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. ALERTS
-- ============================================================================

INSERT INTO alerts (id, alert_type, severity, title, message, entity_type, entity_id, target_role, is_read, is_dismissed, expires_at)
VALUES
  ('b0000001-0000-0000-0000-000000000001', 'capacity_warning', 'high', 'BNSF001 Nearing Capacity', 'Alliance Repair Center is at 92% capacity for March 2026. Consider redirecting non-urgent work.', 'shop', 'BNSF001', 'admin', false, false, '2026-04-01'),
  ('b0000001-0000-0000-0000-000000000002', 'capacity_warning', 'medium', 'NS002 Moderate Load', 'Atlanta Terminal is at 78% capacity for April 2026.', 'shop', 'NS002', 'operator', false, false, '2026-05-01'),
  ('b0000001-0000-0000-0000-000000000003', 'qualification_due', 'critical', 'SHQX009712 Qualification Overdue', 'Car SHQX009712 qualification expired 2025-12-15. Must be shopped immediately.', 'car', 'SHQX009712', 'admin', false, false, NULL),
  ('b0000001-0000-0000-0000-000000000004', 'qualification_due', 'high', 'ACFX079506 Qualification Due', 'Car ACFX079506 qualification due 2026-06-30.', 'car', 'ACFX079506', 'operator', false, false, '2026-07-01'),
  ('b0000001-0000-0000-0000-000000000005', 'bad_order', 'critical', 'UTLX567890 Bad Ordered', 'Car UTLX567890 was bad ordered at Shreveport for leaking bottom outlet valve.', 'car', 'UTLX567890', 'admin', true, false, NULL),
  ('b0000001-0000-0000-0000-000000000006', 'allocation_conflict', 'medium', 'Duplicate Allocation Detected', 'Car GATX112233 appears in both Demand D-2602-003 and master plan MP-2602-001.', 'car', 'GATX112233', 'admin', false, false, '2026-03-15'),
  ('b0000001-0000-0000-0000-000000000007', 'cost_variance', 'high', 'Invoice Over Estimate', 'Invoice INV-2026-0042 from BNSF001 exceeds estimate by 23%. Review required.', 'invoice', NULL, 'admin', false, false, NULL),
  ('b0000001-0000-0000-0000-000000000008', 'system', 'low', 'Scheduled Maintenance', 'System maintenance scheduled for 2026-02-15 02:00 UTC. Expected downtime: 30 minutes.', NULL, NULL, NULL, false, false, '2026-02-16'),
  ('b0000001-0000-0000-0000-000000000009', 'qualification_due', 'medium', 'CEFX445566 Qualification Due', 'Car CEFX445566 qualification due 2026-09-15.', 'car', 'CEFX445566', 'operator', true, true, '2026-10-01'),
  ('b0000001-0000-0000-0000-000000000010', 'capacity_warning', 'low', 'UP001 Low Utilization', 'North Platte Facility is at 35% capacity. Available for additional work.', 'shop', 'UP001', 'operator', false, false, '2026-03-01')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. CAR ASSIGNMENTS (SSOT)
-- ============================================================================

-- Disable trigger that validates car_number exists (UMLER cars may not be loaded yet)
ALTER TABLE car_assignments DISABLE TRIGGER trg_assignment_car_gate;

INSERT INTO car_assignments (id, car_mark_number, car_number, shop_code, shop_name, target_month, status, source, estimated_cost, created_by_id, created_at)
VALUES
  ('c0000001-0000-0000-0000-000000000001', gen_random_uuid(), 'ACFX079506', 'BNSF001', 'Alliance Repair Center', '2026-04', 'Planned', 'demand_plan', 4500, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '10 days'),
  ('c0000001-0000-0000-0000-000000000002', gen_random_uuid(), 'ACFX079727', 'BNSF002', 'Galesburg Tank Shop', '2026-04', 'Planned', 'demand_plan', 5200, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '10 days'),
  ('c0000001-0000-0000-0000-000000000003', gen_random_uuid(), 'ACFX079735', 'NS001', 'Roanoke Heavy Repair', '2026-05', 'Planned', 'demand_plan', 6100, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '8 days'),
  ('c0000001-0000-0000-0000-000000000004', gen_random_uuid(), 'ACFX079750', 'CSX001', 'Waycross Complex', '2026-03', 'Scheduled', 'demand_plan', 4800, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '20 days'),
  ('c0000001-0000-0000-0000-000000000005', gen_random_uuid(), 'ACFX095820', 'UP001', 'North Platte Facility', '2026-03', 'Scheduled', 'service_plan', 3900, '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '18 days'),
  ('c0000001-0000-0000-0000-000000000006', gen_random_uuid(), 'ACFX095821', 'BNSF001', 'Alliance Repair Center', '2026-02', 'Enroute', 'demand_plan', 5500, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '25 days'),
  ('c0000001-0000-0000-0000-000000000007', gen_random_uuid(), 'ACFX095823', 'NS002', 'Atlanta Terminal', '2026-02', 'Arrived', 'demand_plan', 4200, '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '30 days'),
  ('c0000001-0000-0000-0000-000000000008', gen_random_uuid(), 'ACFX095833', 'CPKC001', 'Kansas City Hub', '2026-02', 'InShop', 'quick_shop', 7800, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '35 days'),
  ('c0000001-0000-0000-0000-000000000009', gen_random_uuid(), 'ACFX095836', 'CSX002', 'Cumberland Shops', '2026-01', 'InShop', 'bad_order', 9200, '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '45 days'),
  ('c0000001-0000-0000-0000-000000000010', gen_random_uuid(), 'ACFX095837', 'BNSF001', 'Alliance Repair Center', '2025-12', 'Complete', 'demand_plan', 5100, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '60 days'),
  ('c0000001-0000-0000-0000-000000000011', gen_random_uuid(), 'ACFX095839', 'UP002', 'Roseville Yard', '2025-11', 'Complete', 'demand_plan', 4700, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '90 days'),
  ('c0000001-0000-0000-0000-000000000012', gen_random_uuid(), 'ACFX095852', 'NS001', 'Roanoke Heavy Repair', '2025-12', 'Complete', 'service_plan', 6300, '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '75 days'),
  ('c0000001-0000-0000-0000-000000000013', gen_random_uuid(), 'ACFX095853', 'KCS001', 'Shreveport Terminal', '2026-01', 'Cancelled', 'demand_plan', 5000, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '40 days')
ON CONFLICT (id) DO NOTHING;

-- Re-enable trigger
ALTER TABLE car_assignments ENABLE TRIGGER trg_assignment_car_gate;

-- ============================================================================
-- 5. BAD ORDER REPORTS
-- ============================================================================

INSERT INTO bad_order_reports (id, car_id, car_number, reported_date, issue_type, issue_description, severity, location, reported_by, reporter_contact, status, created_by_id)
VALUES
  ('d0000001-0000-0000-0000-000000000001', gen_random_uuid(), 'UTLX567890', '2026-01-20', 'mechanical', 'Bottom outlet valve leaking. Cannot load. Requires immediate repair.', 'critical', 'Shreveport, LA', 'Mike Johnson - KCS Yard', 'mjohnson@kcs.com', 'open', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('d0000001-0000-0000-0000-000000000002', gen_random_uuid(), 'GATX112233', '2026-01-25', 'structural', 'Crack found on stub sill during annual inspection. Restricted from loading.', 'high', 'Alliance, NE', 'Tom Davis - BNSF Inspector', 'tdavis@bnsf.com', 'assigned', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('d0000001-0000-0000-0000-000000000003', gen_random_uuid(), 'CEFX445566', '2025-12-10', 'contamination', 'Interior lining failure. Commodity residue incompatible with next load.', 'medium', 'Waycross, GA', 'Sarah Chen - CSX Operations', 'schen@csx.com', 'resolved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

UPDATE bad_order_reports SET resolved_at = '2026-01-15', resolved_by_id = '7b15c7ba-1b51-4aef-a48c-338e0713405f', resolution_notes = 'Cleaned and relined at Waycross. Released to service.', resolution_action = 'repair_only' WHERE id = 'd0000001-0000-0000-0000-000000000003';

-- ============================================================================
-- 6. SHOPPING EVENTS
-- ============================================================================

INSERT INTO shopping_events (id, event_number, car_number, shop_code, state, shopping_type_code, created_by_id, created_at)
VALUES
  ('e0000001-0000-0000-0000-000000000001', 'SE-2026-T001', 'ACFX200539', 'BNSF001', 'REQUESTED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '5 days'),
  ('e0000001-0000-0000-0000-000000000002', 'SE-2026-T002', 'ACFX200559', 'NS001', 'ASSIGNED_TO_SHOP', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '10 days'),
  ('e0000001-0000-0000-0000-000000000003', 'SE-2026-T003', 'ACFX200570', 'CSX001', 'INSPECTION', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '15 days'),
  ('e0000001-0000-0000-0000-000000000004', 'SE-2026-T004', 'ACFX200579', 'UP001', 'ESTIMATE_SUBMITTED', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '20 days'),
  ('e0000001-0000-0000-0000-000000000005', 'SE-2026-T005', 'ACFX200587', 'BNSF002', 'WORK_AUTHORIZED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '30 days'),
  ('e0000001-0000-0000-0000-000000000006', 'SE-2026-T006', 'ACFX200590', 'CPKC001', 'IN_REPAIR', 'QUAL', '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '40 days'),
  ('e0000001-0000-0000-0000-000000000007', 'SE-2026-T007', 'ACFX220361', 'NS002', 'RELEASED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '60 days'),
  ('e0000001-0000-0000-0000-000000000008', 'SE-2026-T008', 'ACFX220460', 'KCS001', 'CANCELLED', 'QUAL', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;

UPDATE shopping_events SET cancelled_at = NOW() - INTERVAL '20 days', cancelled_by_id = 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', cancellation_reason = 'Customer redirected car to different shop' WHERE id = 'e0000001-0000-0000-0000-000000000008' AND state = 'CANCELLED';

-- ============================================================================
-- 7. ESTIMATE SUBMISSIONS + LINES
-- ============================================================================

-- Estimate for ESTIMATE_SUBMITTED event (status must be 'submitted')
INSERT INTO estimate_submissions (id, shopping_event_id, version_number, submitted_by, status, total_labor_hours, total_material_cost, total_cost, notes, submitted_at)
VALUES
  ('f0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000004', 1, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'submitted', 48.5, 2200.00, 6050.00, 'Standard qualification scope. Interior inspection revealed minor pitting on shell.', NOW() - INTERVAL '18 days'),
  ('f0000001-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000005', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'approved', 72.0, 3500.00, 9500.00, 'Full qualification with lining removal. High bake phenolic recoat required.', NOW() - INTERVAL '28 days'),
  ('f0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000006', 1, '7b15c7ba-1b51-4aef-a48c-338e0713405f', 'approved', 56.0, 2800.00, 7200.00, 'Standard qual with shell patch on bottom course.', NOW() - INTERVAL '38 days'),
  ('f0000001-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000007', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'approved', 40.0, 1800.00, 5000.00, 'Initial estimate - standard qualification.', NOW() - INTERVAL '55 days'),
  ('f0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000007', 2, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'approved', 44.0, 2100.00, 5600.00, 'Final estimate - added valve replacement discovered during repair.', NOW() - INTERVAL '45 days')
ON CONFLICT (id) DO NOTHING;

-- Estimate lines for the submitted estimate
INSERT INTO estimate_lines (id, estimate_submission_id, line_number, aar_code, description, labor_hours, material_cost, total_cost)
VALUES
  ('f1000001-0000-0000-0000-000000000001', 'f0000001-0000-0000-0000-000000000001', 1, 'C-1', 'Interior cleaning and gas-free', 8.0, 150.00, 750.00),
  ('f1000001-0000-0000-0000-000000000002', 'f0000001-0000-0000-0000-000000000001', 2, 'C-2', 'Shell thickness measurement', 4.0, 50.00, 350.00),
  ('f1000001-0000-0000-0000-000000000003', 'f0000001-0000-0000-0000-000000000001', 3, 'C-3', 'Safety valve test and certification', 6.0, 200.00, 650.00),
  ('f1000001-0000-0000-0000-000000000004', 'f0000001-0000-0000-0000-000000000001', 4, 'B-1', 'Truck inspection and bearing check', 12.0, 800.00, 1800.00),
  ('f1000001-0000-0000-0000-000000000005', 'f0000001-0000-0000-0000-000000000001', 5, 'B-2', 'Brake system overhaul', 10.0, 600.00, 1400.00),
  ('f1000001-0000-0000-0000-000000000006', 'f0000001-0000-0000-0000-000000000001', 6, 'D-1', 'External paint and stencil', 8.5, 400.00, 1100.00),
  -- Lines for approved estimate (WORK_AUTHORIZED)
  ('f1000001-0000-0000-0000-000000000010', 'f0000001-0000-0000-0000-000000000002', 1, 'C-1', 'Interior cleaning, steam, gas-free', 12.0, 250.00, 1200.00),
  ('f1000001-0000-0000-0000-000000000011', 'f0000001-0000-0000-0000-000000000002', 2, 'C-2', 'Blast interior to white metal', 16.0, 400.00, 1700.00),
  ('f1000001-0000-0000-0000-000000000012', 'f0000001-0000-0000-0000-000000000002', 3, 'C-3', 'Apply high bake phenolic lining (2 coat)', 20.0, 1800.00, 3600.00),
  ('f1000001-0000-0000-0000-000000000013', 'f0000001-0000-0000-0000-000000000002', 4, 'C-4', 'Shell and head inspection/measurement', 8.0, 100.00, 750.00),
  ('f1000001-0000-0000-0000-000000000014', 'f0000001-0000-0000-0000-000000000002', 5, 'B-1', 'Running gear inspection', 8.0, 500.00, 1150.00),
  ('f1000001-0000-0000-0000-000000000015', 'f0000001-0000-0000-0000-000000000002', 6, 'D-1', 'External paint and stencil', 8.0, 450.00, 1100.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. PROJECTS
-- ============================================================================

INSERT INTO projects (id, project_number, project_name, project_type, scope_of_work, lessee_code, lessee_name, priority, status, estimated_total_cost, customer_billable, plan_version, last_plan_locked_at, last_communicated_at, locked_cars_count, planned_cars_count, created_by, created_at)
VALUES
  ('10000001-0000-0000-0000-000000000001', 'QUL-2602-0010', 'FY26 Q2 Tank Qualification Batch', 'qualification', 'Annual qualification of 10 general service tank cars per DOT/AAR requirements.', 'SHQX', 'GATX Financial', 1, 'active', 55000, true, 3, NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days', 4, 3, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '30 days'),
  ('10000001-0000-0000-0000-000000000002', 'ASN-2602-0010', 'Midwest Fleet Repositioning', 'assignment', 'Reposition 6 tank cars from Gulf Coast to Midwest for customer demand.', 'ACFX', 'American Car & Foundry', 2, 'active', 28000, false, 1, NULL, NULL, 0, 4, '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '20 days'),
  ('10000001-0000-0000-0000-000000000003', 'LIN-2602-0010', 'High Bake Relining Campaign', 'lining', 'Strip and reline 4 cars with high bake phenolic for food-grade service.', 'GATX', 'GATX Corporation', 1, 'in_progress', 38000, true, 2, NOW() - INTERVAL '30 days', NULL, 4, 0, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '45 days'),
  ('10000001-0000-0000-0000-000000000004', 'REL-2601-0010', 'End-of-Lease Release Q4 2025', 'release', 'Release 3 cars at end of lease term. Final inspection and disposition.', 'UTLX', 'Union Tank Car', 3, 'completed', 12000, false, 1, NULL, NULL, 0, 0, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', NOW() - INTERVAL '90 days'),
  ('10000001-0000-0000-0000-000000000005', 'INS-2603-0010', 'FY26 Q3 Pre-Lease Inspection', 'inspection', 'Pre-lease inspection of 8 cars for new customer onboarding.', 'CEFX', 'CIT Rail', 2, 'draft', 16000, true, 0, NULL, NULL, 0, 0, '7b15c7ba-1b51-4aef-a48c-338e0713405f', NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. PROJECT CARS (wrapped in exception handler — car_numbers may not exist without UMLER import)
-- ============================================================================

DO $$ BEGIN
INSERT INTO project_cars (id, project_id, car_number, status, added_by)
VALUES
  ('11000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', 'SHQX009712', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000001', 'SHQX009714', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000001', 'SHQX009715', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000001', 'SHQX009716', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000005', '10000001-0000-0000-0000-000000000001', 'SHQX009717', 'pending', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000006', '10000001-0000-0000-0000-000000000001', 'SHQX009718', 'pending', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000007', '10000001-0000-0000-0000-000000000001', 'SHQX009719', 'pending', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000008', '10000001-0000-0000-0000-000000000001', 'SHQX009720', 'completed', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000009', '10000001-0000-0000-0000-000000000001', 'SHQX009721', 'completed', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('11000001-0000-0000-0000-000000000010', '10000001-0000-0000-0000-000000000001', 'SHQX009722', 'completed', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

-- Project 2: 6 cars (assignment - all pending)
INSERT INTO project_cars (id, project_id, car_number, status, added_by)
VALUES
  ('12000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000002', 'ACFX095911', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('12000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000002', 'ACFX095940', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('12000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000002', 'ACFX095948', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('12000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000002', 'ACFX240082', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('12000001-0000-0000-0000-000000000005', '10000001-0000-0000-0000-000000000002', 'CLIX298086', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('12000001-0000-0000-0000-000000000006', '10000001-0000-0000-0000-000000000002', 'ACFX200539', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f')
ON CONFLICT (id) DO NOTHING;

-- Project 3: 4 cars (lining - all in_progress)
INSERT INTO project_cars (id, project_id, car_number, status, added_by)
VALUES
  ('13000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000003', 'GATX112233', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('13000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000003', 'GATX789012', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('13000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000003', 'PROX345678', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('13000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000003', 'TILX901234', 'in_progress', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

-- Project 4: 3 cars (release - all completed)
INSERT INTO project_cars (id, project_id, car_number, status, added_by)
VALUES
  ('14000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000004', 'UTLX567890', 'completed', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('14000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000004', 'UTLX123456', 'completed', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('14000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000004', 'ACFX778899', 'completed', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

-- Project 5: 2 cars (inspection - draft, pending)
INSERT INTO project_cars (id, project_id, car_number, status, added_by)
VALUES
  ('15000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000005', 'CEFX445566', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('15000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000005', 'SHQX009723', 'pending', '7b15c7ba-1b51-4aef-a48c-338e0713405f')
ON CONFLICT (id) DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'project_cars inserts skipped (UMLER data not loaded): %', SQLERRM;
END $$;

-- ============================================================================
-- 10. PROJECT ASSIGNMENTS (wrapped — depends on project_cars from section 9)
-- ============================================================================

DO $$ BEGIN
-- Project 1: 4 locked, 3 planned, 1 superseded
INSERT INTO project_assignments (id, project_id, project_car_id, car_number, shop_code, shop_name, target_month, plan_state, estimated_cost, locked_at, locked_by, lock_version, created_by)
VALUES
  ('20000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000001', 'SHQX009712', 'BNSF001', 'Alliance Repair Center', '2026-03', 'Locked', 5500, NOW() - INTERVAL '10 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('20000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000002', 'SHQX009714', 'BNSF001', 'Alliance Repair Center', '2026-03', 'Locked', 5200, NOW() - INTERVAL '10 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  -- Superseded row for SHQX009715 (was BNSF002, relocked to NS002)
  ('20000001-0000-0000-0000-000000000008', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000003', 'SHQX009715', 'BNSF002', 'Galesburg Tank Shop', '2026-03', 'Superseded', 5900, NOW() - INTERVAL '15 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  -- Current locked row for SHQX009715 (relocked to NS002)
  ('20000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000003', 'SHQX009715', 'NS002', 'Atlanta Terminal', '2026-04', 'Locked', 6100, NOW() - INTERVAL '8 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 2, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('20000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000004', 'SHQX009716', 'CSX001', 'Waycross Complex', '2026-04', 'Locked', 4800, NOW() - INTERVAL '8 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  -- Planned (not yet locked)
  ('20000001-0000-0000-0000-000000000005', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000005', 'SHQX009717', 'UP001', 'North Platte Facility', '2026-05', 'Planned', 4500, NULL, NULL, 0, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('20000001-0000-0000-0000-000000000006', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000006', 'SHQX009718', 'UP002', 'Roseville Yard', '2026-05', 'Planned', 4700, NULL, NULL, 0, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('20000001-0000-0000-0000-000000000007', '10000001-0000-0000-0000-000000000001', '11000001-0000-0000-0000-000000000007', 'SHQX009719', 'CPKC001', 'Kansas City Hub', '2026-06', 'Planned', 5800, NULL, NULL, 0, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

-- Link supersession chain
UPDATE project_assignments SET superseded_by_id = '20000001-0000-0000-0000-000000000003', superseded_at = NOW() - INTERVAL '8 days', supersede_reason = 'Galesburg capacity full, redirected to Atlanta' WHERE id = '20000001-0000-0000-0000-000000000008';

-- Project 3: 4 locked (lining)
INSERT INTO project_assignments (id, project_id, project_car_id, car_number, shop_code, shop_name, target_month, plan_state, estimated_cost, locked_at, locked_by, lock_version, created_by)
VALUES
  ('30000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000003', '13000001-0000-0000-0000-000000000001', 'GATX112233', 'BNSF001', 'Alliance Repair Center', '2026-02', 'Locked', 9500, NOW() - INTERVAL '30 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('30000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000003', '13000001-0000-0000-0000-000000000002', 'GATX789012', 'BNSF001', 'Alliance Repair Center', '2026-02', 'Locked', 9200, NOW() - INTERVAL '30 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('30000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000003', '13000001-0000-0000-0000-000000000003', 'PROX345678', 'NS001', 'Roanoke Heavy Repair', '2026-03', 'Locked', 9800, NOW() - INTERVAL '25 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('30000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000003', '13000001-0000-0000-0000-000000000004', 'TILX901234', 'NS001', 'Roanoke Heavy Repair', '2026-03', 'Locked', 9500, NOW() - INTERVAL '25 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 1, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'project_assignments inserts skipped (project_cars not loaded): %', SQLERRM;
END $$;

-- ============================================================================
-- 11. PROJECT COMMUNICATIONS
-- ============================================================================

INSERT INTO project_communications (id, project_id, communication_type, plan_version_snapshot, communicated_by, communicated_to, communication_method, subject, notes)
VALUES
  ('40000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', 'plan_shared', '{"plan_version":1,"total_cars":10,"planned_cars":7,"locked_cars":0,"completed_cars":0,"total_estimated_cost":36600}', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'john.smith@gatxfinancial.com', 'email', 'FY26 Q2 Qualification Plan - Initial', 'Shared initial plan with 7 cars planned across 4 shops. Awaiting customer confirmation to lock.'),
  ('40000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000001', 'lock_notification', '{"plan_version":2,"total_cars":10,"planned_cars":3,"locked_cars":4,"completed_cars":0,"total_estimated_cost":36600}', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'john.smith@gatxfinancial.com', 'email', 'FY26 Q2 Qualification - 4 Cars Locked', 'Locked 4 cars per approved plan. 3 remaining cars planned for May-June.'),
  ('40000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000001', 'relock_notification', '{"plan_version":3,"note":"SHQX009715 relocked from BNSF002 to NS002 due to capacity"}', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'john.smith@gatxfinancial.com', 'phone', 'SHQX009715 Redirected to Atlanta', 'Called customer to discuss redirect. Galesburg capacity full for March. Customer approved Atlanta as alternative.'),
  ('40000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000003', 'plan_shared', '{"plan_version":1,"total_cars":4,"planned_cars":0,"locked_cars":4,"completed_cars":0,"total_estimated_cost":38000}', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'relining@gatx.com', 'email', 'High Bake Relining Campaign - All Cars Locked', 'All 4 cars locked. 2 at Alliance, 2 at Roanoke. Estimated completion by end of March.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 12. PROJECT PLAN AUDIT EVENTS (wrapped — depends on project_assignments)
-- ============================================================================

DO $$ BEGIN
INSERT INTO project_plan_audit_events (id, project_id, project_assignment_id, car_number, actor_id, actor_email, action, before_state, after_state, reason, event_timestamp)
VALUES
  ('50000001-0000-0000-0000-000000000001', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000001', 'SHQX009712', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_created', NULL, 'Planned', NULL, NOW() - INTERVAL '20 days'),
  ('50000001-0000-0000-0000-000000000002', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000002', 'SHQX009714', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_created', NULL, 'Planned', NULL, NOW() - INTERVAL '20 days'),
  ('50000001-0000-0000-0000-000000000003', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000008', 'SHQX009715', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_created', NULL, 'Planned', NULL, NOW() - INTERVAL '20 days'),
  ('50000001-0000-0000-0000-000000000004', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000001', 'SHQX009712', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_locked', 'Planned', 'Locked', NULL, NOW() - INTERVAL '10 days'),
  ('50000001-0000-0000-0000-000000000005', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000002', 'SHQX009714', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_locked', 'Planned', 'Locked', NULL, NOW() - INTERVAL '10 days'),
  ('50000001-0000-0000-0000-000000000006', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000008', 'SHQX009715', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_locked', 'Planned', 'Locked', NULL, NOW() - INTERVAL '15 days'),
  ('50000001-0000-0000-0000-000000000007', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000008', 'SHQX009715', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_superseded', 'Locked', 'Superseded', 'Galesburg capacity full, redirected to Atlanta', NOW() - INTERVAL '8 days'),
  ('50000001-0000-0000-0000-000000000008', '10000001-0000-0000-0000-000000000001', '20000001-0000-0000-0000-000000000003', 'SHQX009715', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'plan_relocked', 'Locked', 'Locked', 'Galesburg capacity full, redirected to Atlanta', NOW() - INTERVAL '8 days'),
  ('50000001-0000-0000-0000-000000000009', '10000001-0000-0000-0000-000000000001', NULL, NULL, 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9', 'admin@railsync.com', 'communication_logged', NULL, NULL, NULL, NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'project_plan_audit_events inserts skipped (project_assignments not loaded): %', SQLERRM;
END $$;

-- ============================================================================
-- 13. INVOICE CASES
-- ============================================================================

INSERT INTO invoice_cases (id, case_number, invoice_type, workflow_state, vendor_name, shop_code, invoice_number, invoice_date, currency, total_amount, car_marks, lessee, received_at, created_by)
VALUES
  ('60000001-0000-0000-0000-000000000001', 'IC-2026-0001', 'SHOP', 'RECEIVED', 'BNSF Railway - Alliance Repair', 'BNSF001', 'BN-INV-20260115', '2026-01-15', 'USD', 5250.00, '{SHQX009720}', 'GATX Financial', NOW() - INTERVAL '20 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('60000001-0000-0000-0000-000000000002', 'IC-2026-0002', 'SHOP', 'APPROVER_REVIEW', 'Norfolk Southern - Atlanta Terminal', 'NS002', 'NS-INV-20260120', '2026-01-20', 'USD', 7800.00, '{ACFX095823}', 'American Car & Foundry', NOW() - INTERVAL '15 days', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('60000001-0000-0000-0000-000000000003', 'IC-2026-0003', 'SHOP', 'APPROVED', 'Union Pacific - Roseville', 'UP002', 'UP-INV-20251210', '2025-12-10', 'USD', 4700.00, '{ACFX095839}', 'American Car & Foundry', NOW() - INTERVAL '45 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('60000001-0000-0000-0000-000000000004', 'IC-2026-0004', 'MRU', 'BLOCKED', 'BNSF Railway - Alliance Repair', 'BNSF001', 'BN-INV-20260125', '2026-01-25', 'USD', 12500.00, '{GATX112233}', 'GATX Corporation', NOW() - INTERVAL '10 days', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('60000001-0000-0000-0000-000000000005', 'IC-2026-0005', 'MRU', 'PAID', 'Roanoke Heavy Repair', 'NS001', 'NS-INV-20251201', '2025-12-01', 'USD', 6300.00, '{ACFX095852}', 'American Car & Foundry', NOW() - INTERVAL '60 days', '7b15c7ba-1b51-4aef-a48c-338e0713405f')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 14. EMAIL QUEUE
-- ============================================================================

INSERT INTO email_queue (id, to_email, to_name, subject, html_body, text_body, status, attempts, sent_at)
VALUES
  ('70000001-0000-0000-0000-000000000001', 'admin@railsync.com', 'Admin', 'Capacity Warning: BNSF001 at 92%', '<h2>Capacity Warning</h2><p>Alliance Repair Center is at 92% capacity for March 2026.</p>', 'Alliance Repair Center at 92% for March 2026.', 'sent', 1, NOW() - INTERVAL '3 days'),
  ('70000001-0000-0000-0000-000000000002', 'operator@railsync.com', 'Operator', 'Project Relock: SHQX009715', '<h2>Plan Change</h2><p>SHQX009715 relocked from BNSF002 to NS002.</p>', 'SHQX009715 relocked from BNSF002 to NS002.', 'sent', 1, NOW() - INTERVAL '8 days'),
  ('70000001-0000-0000-0000-000000000003', 'admin@railsync.com', 'Admin', 'Daily Digest - Feb 5, 2026', '<h2>Daily Summary</h2><p>3 new alerts, 2 assignments updated.</p>', '3 new alerts, 2 assignments updated.', 'pending', 0, NULL),
  ('70000001-0000-0000-0000-000000000004', 'operator@railsync.com', 'Operator', 'Bad Order Alert: UTLX567890', '<h2>Bad Order</h2><p>UTLX567890 bad ordered at Shreveport.</p>', 'UTLX567890 bad ordered at Shreveport.', 'failed', 3, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE email_queue SET error_message = 'SMTP connection refused after 3 attempts' WHERE id = '70000001-0000-0000-0000-000000000004';

-- ============================================================================
-- 15. SERVICE PLANS
-- ============================================================================

INSERT INTO service_plans (id, customer_code, name, description, car_flow_rate, start_date, end_date, fiscal_year, status, created_by_id)
VALUES
  ('80000001-0000-0000-0000-000000000001', 'SHQX', 'GATX FY26 Annual Tank Qualification', 'Annual qualification plan for GATX general service tank fleet. 120 cars per year.', 10, '2026-01-01', '2026-12-31', 2026, 'approved', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9'),
  ('80000001-0000-0000-0000-000000000002', 'ACFX', 'ACFX Q1-Q2 Mechanical Maintenance', 'Scheduled mechanical maintenance for ACFX fleet.', 5, '2026-01-01', '2026-06-30', 2026, 'proposed', '7b15c7ba-1b51-4aef-a48c-338e0713405f'),
  ('80000001-0000-0000-0000-000000000003', 'GATX', 'GATX Relining Program 2026', 'High bake phenolic relining program for food-grade service cars.', 3, '2026-01-01', '2026-12-31', 2026, 'draft', 'de69920f-cdcb-4668-9f21-9c4dbccfb8c9')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 16. INTEGRATION SYNC LOG TEST DATA
-- ============================================================================

INSERT INTO integration_sync_log (id, system_name, operation, direction, entity_type, entity_ref, status, payload, response, error_message, retry_count, max_retries, started_at, completed_at)
VALUES
  ('90000001-0000-0000-0000-000000000001', 'sap', 'push_approved_costs', 'push', 'allocation', 'ALLOC-2026-001', 'success',
    '{"allocation_id":"test","amount":4500}', '{"sap_doc":"4900012345"}', NULL, 0, 3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
  ('90000001-0000-0000-0000-000000000002', 'sap', 'push_billing_trigger', 'push', 'outbound_invoice', 'INV-2026-0023', 'success',
    '{"invoice_id":"test","total":12500}', '{"sap_doc":"4900012346"}', NULL, 0, 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
  ('90000001-0000-0000-0000-000000000003', 'sap', 'push_mileage', 'push', 'mileage_record', 'GATX 23456 2026-01', 'failed',
    '{"car_number":"GATX 23456","period":"2026-01"}', NULL, 'Connection timeout after 30s', 3, 3, NOW() - INTERVAL '30 minutes', NULL),
  ('90000001-0000-0000-0000-000000000004', 'salesforce', 'pull_customers', 'pull', 'customer', NULL, 'success',
    '{}', '{"records_synced":47}', NULL, 0, 3, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
  ('90000001-0000-0000-0000-000000000005', 'salesforce', 'pull_contacts', 'pull', 'contact', NULL, 'retrying',
    '{}', NULL, 'API rate limit exceeded', 1, 3, NOW() - INTERVAL '20 minutes', NULL),
  ('90000001-0000-0000-0000-000000000006', 'clm', 'sync_car_locations', 'pull', 'car_location', NULL, 'success',
    '{}', '{"locations_updated":156}', NULL, 0, 3, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
  ('90000001-0000-0000-0000-000000000007', 'railinc', 'import_edi_file', 'pull', 'mileage_record', 'EDI-20260128', 'success',
    '{"file":"mileage_jan_2026.edi"}', '{"records_imported":234,"records_skipped":12}', NULL, 0, 3, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
  ('90000001-0000-0000-0000-000000000008', 'sap', 'push_approved_costs', 'push', 'allocation', 'ALLOC-2026-042', 'retrying',
    '{"allocation_id":"test2","amount":8200}', NULL, 'SAP system unavailable (503)', 2, 3, NOW() - INTERVAL '15 minutes', NULL)
ON CONFLICT (id) DO NOTHING;

-- Update next_retry_at for retrying entries
UPDATE integration_sync_log SET next_retry_at = NOW() + INTERVAL '5 minutes'
WHERE id IN ('90000001-0000-0000-0000-000000000005', '90000001-0000-0000-0000-000000000008');

-- ============================================================================
-- 17. CAR LOCATIONS TEST DATA (CLM)
-- ============================================================================

INSERT INTO car_locations (car_number, railroad, city, state, location_type, latitude, longitude, reported_at)
SELECT
  c.car_number,
  (ARRAY['BNSF', 'UP', 'CSX', 'NS', 'CN', 'CP', 'KCS'])[floor(random() * 7 + 1)],
  (ARRAY['Houston', 'Chicago', 'Kansas City', 'Memphis', 'Atlanta', 'Los Angeles', 'Dallas', 'St. Louis', 'New Orleans', 'Denver'])[floor(random() * 10 + 1)],
  (ARRAY['TX', 'IL', 'MO', 'TN', 'GA', 'CA', 'TX', 'MO', 'LA', 'CO'])[floor(random() * 10 + 1)],
  (ARRAY['at_yard', 'storage', 'in_transit', 'at_shop', 'at_customer'])[floor(random() * 5 + 1)],
  29.7 + random() * 12,
  -120 + random() * 30,
  NOW() - (random() * INTERVAL '7 days')
FROM cars c
WHERE c.car_number IN (
  SELECT car_number FROM cars ORDER BY car_number LIMIT 50
)
ON CONFLICT (car_number) DO UPDATE SET
  railroad = EXCLUDED.railroad,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  reported_at = EXCLUDED.reported_at;

-- ============================================================================
DO $$ BEGIN RAISE NOTICE 'Comprehensive test data seed completed successfully.'; END $$;
