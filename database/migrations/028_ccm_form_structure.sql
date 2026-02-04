-- ============================================================================
-- Migration 028: Structured CCM Form (mirrors AITX Customer Care Manual Form V5)
-- Digitizes the CCM template into structured, queryable data
-- ============================================================================

-- ============================================================================
-- 1. CCM FORMS — One per customer, structured fields matching AITX template
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lessee_code VARCHAR(20) NOT NULL,
  lessee_name VARCHAR(200),

  -- Document header
  company_name VARCHAR(255),
  form_date DATE,
  revision_date DATE,

  -- Primary Contact
  primary_contact_name VARCHAR(200),
  primary_contact_email VARCHAR(200),
  primary_contact_phone VARCHAR(50),

  -- Estimate Approval Contact
  estimate_approval_contact_name VARCHAR(200),
  estimate_approval_contact_email VARCHAR(200),
  estimate_approval_contact_phone VARCHAR(50),

  -- Dispo Contact (header-level)
  dispo_contact_name VARCHAR(200),
  dispo_contact_email VARCHAR(200),
  dispo_contact_phone VARCHAR(50),

  -- Cleaning Requirements (boolean flags)
  food_grade BOOLEAN NOT NULL DEFAULT FALSE,
  mineral_wipe BOOLEAN NOT NULL DEFAULT FALSE,
  kosher_wash BOOLEAN NOT NULL DEFAULT FALSE,
  kosher_wipe BOOLEAN NOT NULL DEFAULT FALSE,
  shop_oil_material BOOLEAN NOT NULL DEFAULT FALSE,
  oil_provider_contact TEXT,               -- "If customer provides own oil, address/contact"
  rinse_water_test_procedure TEXT,          -- "If external rinse water test required, address/procedure"

  -- Outbound Dispo Requirements
  decal_requirements TEXT,
  nitrogen_applied BOOLEAN NOT NULL DEFAULT FALSE,
  nitrogen_psi VARCHAR(50),
  outbound_dispo_contact_email VARCHAR(200),
  outbound_dispo_contact_phone VARCHAR(50),
  documentation_required_prior_to_release TEXT,

  -- Special Fittings
  special_fittings_vendor_requirements TEXT,

  -- Additional Notes
  additional_notes TEXT,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_id UUID REFERENCES ccm_forms(id),

  -- Audit
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccm_forms_lessee ON ccm_forms(lessee_code);
CREATE INDEX IF NOT EXISTS idx_ccm_forms_current ON ccm_forms(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_ccm_forms_lessee_current ON ccm_forms(lessee_code, is_current) WHERE is_current = TRUE;

-- ============================================================================
-- 2. CCM FORM SEALING — Commodity-specific sealing sections (repeatable)
-- "Copy Section for Multiple Commodities"
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_form_sealing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccm_form_id UUID NOT NULL REFERENCES ccm_forms(id) ON DELETE CASCADE,
  commodity VARCHAR(200) NOT NULL,
  gasket_sealing_material VARCHAR(200),
  alternate_material VARCHAR(200),
  preferred_gasket_vendor VARCHAR(200),
  alternate_vendor VARCHAR(200),
  vsp_ride_tight BOOLEAN NOT NULL DEFAULT FALSE,
  sealing_requirements TEXT,               -- Free text sealing requirements for this commodity
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccm_form_sealing_form ON ccm_form_sealing(ccm_form_id);

-- ============================================================================
-- 3. CCM FORM LINING — Commodity-specific lining sections (repeatable)
-- "Copy Section for Multiple Commodities"
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_form_lining (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccm_form_id UUID NOT NULL REFERENCES ccm_forms(id) ON DELETE CASCADE,
  commodity VARCHAR(200) NOT NULL,
  lining_required BOOLEAN NOT NULL DEFAULT FALSE,
  lining_inspection_interval VARCHAR(100), -- Dropdown: "Choose an item"
  lining_type VARCHAR(200),
  lining_plan_on_file BOOLEAN NOT NULL DEFAULT FALSE,
  lining_requirements TEXT,                -- Free text lining requirements for this commodity
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccm_form_lining_form ON ccm_form_lining(ccm_form_id);

-- ============================================================================
-- 4. CCM FORM ATTACHMENTS — Files attached to a CCM form
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_form_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccm_form_id UUID NOT NULL REFERENCES ccm_forms(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  mfiles_id VARCHAR(200),
  mfiles_url VARCHAR(500),
  uploaded_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccm_form_attachments_form ON ccm_form_attachments(ccm_form_id);

-- ============================================================================
-- 5. VIEWS
-- ============================================================================

-- Current CCM forms per lessee
CREATE OR REPLACE VIEW v_ccm_forms AS
SELECT
  f.*,
  u.email AS created_by_email,
  u.first_name || ' ' || u.last_name AS created_by_name,
  (SELECT COUNT(*) FROM ccm_form_sealing s WHERE s.ccm_form_id = f.id) AS sealing_commodity_count,
  (SELECT COUNT(*) FROM ccm_form_lining l WHERE l.ccm_form_id = f.id) AS lining_commodity_count,
  (SELECT COUNT(*) FROM ccm_form_attachments a WHERE a.ccm_form_id = f.id) AS attachment_count
FROM ccm_forms f
LEFT JOIN users u ON u.id = f.created_by_id
WHERE f.is_current = TRUE
ORDER BY f.lessee_name, f.company_name;

-- CCM form sections as SOW-injectable items (bridges to ccm_sections pattern)
-- This view presents CCM form data as checkable sections for SOW inclusion
CREATE OR REPLACE VIEW v_ccm_form_sow_sections AS
SELECT
  f.id AS ccm_form_id,
  f.lessee_code,
  f.lessee_name,
  'cleaning' AS section_category,
  'Food Grade' AS section_name,
  CASE WHEN f.food_grade THEN 'Food grade cleaning required' ELSE 'Food grade cleaning not required' END AS content,
  f.food_grade AS is_applicable
FROM ccm_forms f WHERE f.is_current = TRUE AND f.food_grade = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'cleaning', 'Mineral Wipe',
  'Mineral wipe cleaning required', f.mineral_wipe
FROM ccm_forms f WHERE f.is_current = TRUE AND f.mineral_wipe = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'cleaning', 'Kosher Wash',
  'Kosher wash cleaning required', f.kosher_wash
FROM ccm_forms f WHERE f.is_current = TRUE AND f.kosher_wash = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'cleaning', 'Kosher Wipe',
  'Kosher wipe cleaning required', f.kosher_wipe
FROM ccm_forms f WHERE f.is_current = TRUE AND f.kosher_wipe = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'cleaning', 'Shop Oil Material',
  CASE WHEN f.oil_provider_contact IS NOT NULL AND f.oil_provider_contact != ''
    THEN 'Shop oil material required. Provider: ' || f.oil_provider_contact
    ELSE 'Shop oil material required'
  END, f.shop_oil_material
FROM ccm_forms f WHERE f.is_current = TRUE AND f.shop_oil_material = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'cleaning', 'Rinse Water Test',
  'External rinse water test required. Procedure: ' || COALESCE(f.rinse_water_test_procedure, 'See CCM'),
  TRUE
FROM ccm_forms f WHERE f.is_current = TRUE AND f.rinse_water_test_procedure IS NOT NULL AND f.rinse_water_test_procedure != ''
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'sealing', 'Sealing — ' || s.commodity,
  'Commodity: ' || s.commodity ||
    CASE WHEN s.gasket_sealing_material IS NOT NULL THEN '. Gasket Material: ' || s.gasket_sealing_material ELSE '' END ||
    CASE WHEN s.preferred_gasket_vendor IS NOT NULL THEN '. Preferred Vendor: ' || s.preferred_gasket_vendor ELSE '' END ||
    CASE WHEN s.vsp_ride_tight THEN '. VSP Ride Tight: Yes' ELSE '' END ||
    CASE WHEN s.sealing_requirements IS NOT NULL AND s.sealing_requirements != '' THEN '. Requirements: ' || s.sealing_requirements ELSE '' END,
  TRUE
FROM ccm_forms f
JOIN ccm_form_sealing s ON s.ccm_form_id = f.id
WHERE f.is_current = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'lining', 'Lining — ' || l.commodity,
  'Commodity: ' || l.commodity ||
    CASE WHEN l.lining_required THEN '. Lining Required: Yes' ELSE '. Lining Required: No' END ||
    CASE WHEN l.lining_type IS NOT NULL THEN '. Lining Type: ' || l.lining_type ELSE '' END ||
    CASE WHEN l.lining_inspection_interval IS NOT NULL THEN '. Inspection Interval: ' || l.lining_inspection_interval ELSE '' END ||
    CASE WHEN l.lining_plan_on_file THEN '. Lining Plan on File: Yes' ELSE '' END ||
    CASE WHEN l.lining_requirements IS NOT NULL AND l.lining_requirements != '' THEN '. Requirements: ' || l.lining_requirements ELSE '' END,
  l.lining_required
FROM ccm_forms f
JOIN ccm_form_lining l ON l.ccm_form_id = f.id
WHERE f.is_current = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'dispo', 'Nitrogen Application',
  'Nitrogen applied to car. PSI Required: ' || COALESCE(f.nitrogen_psi, 'See CCM'),
  f.nitrogen_applied
FROM ccm_forms f WHERE f.is_current = TRUE AND f.nitrogen_applied = TRUE
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'dispo', 'Decal Requirements',
  'Decal Requirements: ' || f.decal_requirements,
  TRUE
FROM ccm_forms f WHERE f.is_current = TRUE AND f.decal_requirements IS NOT NULL AND f.decal_requirements != ''
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'dispo', 'Documentation Required Prior to Release',
  'Documentation Required: ' || f.documentation_required_prior_to_release,
  TRUE
FROM ccm_forms f WHERE f.is_current = TRUE AND f.documentation_required_prior_to_release IS NOT NULL AND f.documentation_required_prior_to_release != ''
UNION ALL
SELECT f.id, f.lessee_code, f.lessee_name,
  'special_fittings', 'Special Fittings Vendor Requirements',
  f.special_fittings_vendor_requirements,
  TRUE
FROM ccm_forms f WHERE f.is_current = TRUE AND f.special_fittings_vendor_requirements IS NOT NULL AND f.special_fittings_vendor_requirements != '';

-- ============================================================================
-- 6. AUDIT TRACKING
-- ============================================================================

-- Add ccm_forms tables to the audit trigger list
DO $$
BEGIN
  -- Create triggers for audit logging on CCM form tables
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_table_changes') THEN
    CREATE OR REPLACE TRIGGER trg_ccm_forms_audit
      AFTER INSERT OR UPDATE OR DELETE ON ccm_forms
      FOR EACH ROW EXECUTE FUNCTION log_table_changes();

    CREATE OR REPLACE TRIGGER trg_ccm_form_sealing_audit
      AFTER INSERT OR UPDATE OR DELETE ON ccm_form_sealing
      FOR EACH ROW EXECUTE FUNCTION log_table_changes();

    CREATE OR REPLACE TRIGGER trg_ccm_form_lining_audit
      AFTER INSERT OR UPDATE OR DELETE ON ccm_form_lining
      FOR EACH ROW EXECUTE FUNCTION log_table_changes();
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- log_table_changes may not exist; skip audit triggers
  RAISE NOTICE 'Audit triggers skipped: %', SQLERRM;
END;
$$;
