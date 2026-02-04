-- ============================================================================
-- Migration 018: Shopping Reason Cost Reallocation
-- ============================================================================

-- Add cost allocation override to shopping_reasons
ALTER TABLE shopping_reasons ADD COLUMN IF NOT EXISTS overrides_to_customer BOOLEAN DEFAULT FALSE;
ALTER TABLE shopping_reasons ADD COLUMN IF NOT EXISTS cost_multiplier DECIMAL(5,2) DEFAULT 1.0;
ALTER TABLE shopping_reasons ADD COLUMN IF NOT EXISTS description TEXT;

-- Set certain reasons to override cost to customer
-- Bad Order reasons that are lessee-caused
UPDATE shopping_reasons SET overrides_to_customer = TRUE, description = 'Damage caused by lessee operations'
WHERE code IN ('BO_LADING_DAMAGE', 'BO_OVERLOAD');

-- Lessee-requested reasons always bill customer
UPDATE shopping_reasons SET overrides_to_customer = TRUE
WHERE shopping_type_id = (SELECT id FROM shopping_types WHERE code = 'LESSEE_REQ');

-- Cleaning reasons bill to customer
UPDATE shopping_reasons SET overrides_to_customer = TRUE
WHERE shopping_type_id = (SELECT id FROM shopping_types WHERE code = 'CLEANING');

-- Project customer reasons bill to customer
UPDATE shopping_reasons SET overrides_to_customer = TRUE
WHERE code = 'PROJ_CUSTOMER';

-- Update view to include reason cost allocation
DROP VIEW IF EXISTS v_shopping_reasons CASCADE;
CREATE OR REPLACE VIEW v_shopping_reasons AS
SELECT
  r.id,
  r.code,
  r.name,
  r.description,
  r.sort_order,
  r.overrides_to_customer,
  r.cost_multiplier,
  t.id AS type_id,
  t.code AS type_code,
  t.name AS type_name,
  t.is_planned,
  t.default_cost_owner,
  t.tier_preference,
  t.estimated_cost,
  t.customer_billable AS type_customer_billable,
  -- Effective billable: reason override takes precedence over type default
  COALESCE(r.overrides_to_customer, t.customer_billable) AS effective_customer_billable
FROM shopping_reasons r
JOIN shopping_types t ON r.shopping_type_id = t.id
WHERE t.is_active = TRUE
ORDER BY t.sort_order, r.sort_order;
