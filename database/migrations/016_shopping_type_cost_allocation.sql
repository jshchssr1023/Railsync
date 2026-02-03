-- ============================================================================
-- Migration 016: Shopping Type Cost Allocation & New Types
-- ============================================================================

-- Add new Shopping Types for Quick Shop workflow
INSERT INTO shopping_types (code, name, description, is_planned, default_cost_owner, tier_preference, sort_order) VALUES
('LINING_INSPECTION', 'Lining Inspection', 'Interior lining inspection', TRUE, 'lessor', 2, 16),
('LINING_REMOVAL', 'Lining Removal', 'Lining removal or replacement', TRUE, 'lessor', 1, 17),
('PROJECT', 'Project', 'Project work requiring project number', TRUE, 'lessee', 1, 18)
ON CONFLICT (code) DO NOTHING;

-- Add estimated_cost column to shopping_types for budget building
ALTER TABLE shopping_types ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2) DEFAULT 0;

-- Add customer_billable flag for cost allocation
ALTER TABLE shopping_types ADD COLUMN IF NOT EXISTS customer_billable BOOLEAN DEFAULT FALSE;

-- Add project_required flag for project number requirement
ALTER TABLE shopping_types ADD COLUMN IF NOT EXISTS project_required BOOLEAN DEFAULT FALSE;

-- Set project_required for PROJECT type
UPDATE shopping_types SET project_required = TRUE WHERE code = 'PROJECT';

-- Set default estimated costs (can be overridden per instance)
UPDATE shopping_types SET estimated_cost = CASE code
  WHEN 'QUAL_REG' THEN 2500.00
  WHEN 'BAD_ORDER' THEN 5000.00
  WHEN 'LEASE_ASSIGN' THEN 1500.00
  WHEN 'LEASE_RETURN' THEN 1200.00
  WHEN 'LESSEE_REQ' THEN 3000.00
  WHEN 'COMMODITY_CONV' THEN 8000.00
  WHEN 'RUNNING_REPAIR' THEN 2000.00
  WHEN 'PREVENTIVE' THEN 1800.00
  WHEN 'STORAGE_PREP' THEN 800.00
  WHEN 'REACTIVATION' THEN 1000.00
  WHEN 'INSURANCE_CLAIM' THEN 7500.00
  WHEN 'UPMARKET' THEN 12000.00
  WHEN 'CLEANING' THEN 1500.00
  WHEN 'INSPECTION' THEN 500.00
  WHEN 'LINING_INSPECTION' THEN 750.00
  WHEN 'LINING_REMOVAL' THEN 4500.00
  WHEN 'PROJECT' THEN 0.00
  ELSE 1000.00
END;

-- Set customer_billable based on default_cost_owner = 'lessee'
UPDATE shopping_types SET customer_billable = (default_cost_owner = 'lessee');

-- Add reasons for new types
INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LI_VISUAL', 'Visual Inspection', 1 FROM shopping_types WHERE code = 'LINING_INSPECTION'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LI_THICKNESS', 'Thickness Measurement', 2 FROM shopping_types WHERE code = 'LINING_INSPECTION'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LR_FULL_REMOVAL', 'Full Lining Removal', 1 FROM shopping_types WHERE code = 'LINING_REMOVAL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LR_PARTIAL', 'Partial Lining Replacement', 2 FROM shopping_types WHERE code = 'LINING_REMOVAL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'LR_RELINE', 'Complete Reline', 3 FROM shopping_types WHERE code = 'LINING_REMOVAL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'PROJ_FLEET_MOD', 'Fleet Modification', 1 FROM shopping_types WHERE code = 'PROJECT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'PROJ_CUSTOMER', 'Customer Project', 2 FROM shopping_types WHERE code = 'PROJECT'
ON CONFLICT (code) DO NOTHING;

INSERT INTO shopping_reasons (shopping_type_id, code, name, sort_order)
SELECT id, 'PROJ_REGULATORY', 'Regulatory Compliance Project', 3 FROM shopping_types WHERE code = 'PROJECT'
ON CONFLICT (code) DO NOTHING;

-- Create view for shopping types with cost info
CREATE OR REPLACE VIEW v_shopping_types_with_costs AS
SELECT
  id,
  code,
  name,
  description,
  is_planned,
  default_cost_owner,
  tier_preference,
  sort_order,
  estimated_cost,
  customer_billable,
  project_required
FROM shopping_types
ORDER BY sort_order;
