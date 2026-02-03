-- ============================================================================
-- Migration 017: Additional Car Detail Fields for Car Card View
-- ============================================================================

-- Add staff/contact fields
ALTER TABLE cars ADD COLUMN IF NOT EXISTS csr_name VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS csl_name VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS commercial_contact VARCHAR(100);

-- Add region fields
ALTER TABLE cars ADD COLUMN IF NOT EXISTS past_region VARCHAR(50);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS current_region VARCHAR(50);

-- Add FMS lessee number
ALTER TABLE cars ADD COLUMN IF NOT EXISTS fms_lessee_number VARCHAR(20);

-- Add qualification details
ALTER TABLE cars ADD COLUMN IF NOT EXISTS full_partial_qual VARCHAR(20);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS reason_shopped VARCHAR(100);
ALTER TABLE cars ADD COLUMN IF NOT EXISTS perform_tank_qual BOOLEAN DEFAULT FALSE;

-- Add scheduling info
ALTER TABLE cars ADD COLUMN IF NOT EXISTS scheduled_status VARCHAR(50);

-- Create comprehensive car detail view for the card
CREATE OR REPLACE VIEW v_car_details AS
SELECT
  c.car_number,
  c.car_mark,
  c.car_id,
  c.car_type,
  c.product_code,
  c.material_type,
  c.stencil_class,
  -- Lessee/Contract Info
  c.lessee_name,
  c.lessee_code,
  c.fms_lessee_number,
  c.contract_number,
  c.contract_expiration,
  c.portfolio_status,
  -- Commodity/Physical
  c.commodity,
  c.commodity_cin,
  c.is_jacketed,
  c.is_lined,
  c.lining_type,
  c.car_age,
  c.has_asbestos,
  c.asbestos_abatement_required,
  c.nitrogen_pad_stage,
  -- Qualification Due Dates (years)
  c.min_no_lining_year,
  c.min_lining_year,
  c.interior_lining_year,
  c.rule_88b_year,
  c.safety_relief_year,
  c.service_equipment_year,
  c.stub_sill_year,
  c.tank_thickness_year,
  c.tank_qual_year,
  c.qual_exp_date,
  -- Staff/Contacts
  c.csr_name,
  c.csl_name,
  c.commercial_contact,
  -- Region
  c.past_region,
  c.current_region,
  -- Status
  c.current_status,
  c.adjusted_status,
  c.plan_status,
  c.scheduled_status,
  c.full_partial_qual,
  c.reason_shopped,
  c.perform_tank_qual,
  -- Shop Assignment
  c.assigned_shop_code,
  c.assigned_date,
  s.shop_name AS assigned_shop_name,
  -- Repair History
  c.last_repair_date,
  c.last_repair_shop,
  ls.shop_name AS last_repair_shop_name,
  -- Metadata
  c.created_at,
  c.updated_at,
  c.is_active,
  -- Calculated fields
  CASE
    WHEN c.tank_qual_year <= EXTRACT(YEAR FROM CURRENT_DATE) THEN 'Overdue'
    WHEN c.tank_qual_year = EXTRACT(YEAR FROM CURRENT_DATE) + 1 THEN 'Due Next Year'
    ELSE 'Current'
  END AS qual_status,
  CASE
    WHEN c.contract_expiration < CURRENT_DATE THEN 'Expired'
    WHEN c.contract_expiration < CURRENT_DATE + INTERVAL '90 days' THEN 'Expiring Soon'
    ELSE 'Active'
  END AS contract_status
FROM cars c
LEFT JOIN shops s ON c.assigned_shop_code = s.shop_code
LEFT JOIN shops ls ON c.last_repair_shop = ls.shop_code
WHERE c.is_active = TRUE;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cars_csr ON cars(csr_name);
CREATE INDEX IF NOT EXISTS idx_cars_region ON cars(current_region);
