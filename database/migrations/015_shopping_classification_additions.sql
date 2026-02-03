-- ============================================================================
-- Migration 015: Additional Shopping Types & Reasons per Spec Section 8
-- ============================================================================

-- Add missing Shopping Types from spec
INSERT INTO shopping_types (code, name, description, is_planned, default_cost_owner, tier_preference, sort_order) VALUES
('UPMARKET', 'Upmarket / Commercial Upgrade', 'Upgrading car for higher-value service', TRUE, 'lessor', 1, 13),
('CLEANING', 'Cleaning / Decontamination', 'Standalone cleaning or decontamination', TRUE, 'lessee', 2, 14),
('INSPECTION', 'Inspection / Evaluation Only', 'Inspection without repair work', TRUE, 'lessor', 2, 15)
ON CONFLICT (code) DO NOTHING;

-- Add missing Bad Order reasons from spec Section 8.2
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_MANWAY_HATCH', 'Manway / Hatch Issue', 10 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_BRAKE_SYSTEM', 'Brake System Failure', 11 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_RUNNING_GEAR', 'Running Gear Defect', 12 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_COUPLER_DRAFT', 'Coupler / Draft Gear Issue', 13 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'BO_SHELL_HEAD', 'Shell / Head Damage', 14 FROM shopping_types WHERE code = 'BAD_ORDER'
ON CONFLICT (code) DO NOTHING;

-- Add reasons for new types
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'UP_LINING_UPGRADE', 'Lining Upgrade', 1 FROM shopping_types WHERE code = 'UPMARKET'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'UP_CAPACITY_MOD', 'Capacity Modification', 2 FROM shopping_types WHERE code = 'UPMARKET'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'UP_SAFETY_UPGRADE', 'Safety Feature Upgrade', 3 FROM shopping_types WHERE code = 'UPMARKET'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'CLEAN_ROUTINE', 'Routine Cleaning', 1 FROM shopping_types WHERE code = 'CLEANING'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'CLEAN_HAZMAT', 'Hazmat Decontamination', 2 FROM shopping_types WHERE code = 'CLEANING'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'CLEAN_HEEL_REMOVAL', 'Heel Removal', 3 FROM shopping_types WHERE code = 'CLEANING'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'INSP_PRE_LEASE', 'Pre-Lease Inspection', 1 FROM shopping_types WHERE code = 'INSPECTION'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'INSP_CONDITION', 'Condition Assessment', 2 FROM shopping_types WHERE code = 'INSPECTION'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'INSP_REGULATORY', 'Regulatory Inspection', 3 FROM shopping_types WHERE code = 'INSPECTION'
ON CONFLICT (code) DO NOTHING;
