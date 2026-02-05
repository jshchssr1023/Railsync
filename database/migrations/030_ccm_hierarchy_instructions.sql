-- ============================================================================
-- Migration 030: CCM Hierarchy-Level Instructions
-- Enables CCM instructions at 4 levels: Customer, Master Lease, Rider, Amendment
-- with cascade inheritance (child inherits parent, can override specific fields)
-- ============================================================================

-- ============================================================================
-- 1. CCM INSTRUCTIONS - Hierarchy-scoped CCM data
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hierarchy Scope (exactly one must be set - enforced by constraint)
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  master_lease_id UUID REFERENCES master_leases(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES lease_riders(id) ON DELETE CASCADE,
  amendment_id UUID REFERENCES lease_amendments(id) ON DELETE CASCADE,

  -- Scope level (for easier querying)
  scope_level VARCHAR(20) NOT NULL CHECK (scope_level IN ('customer', 'master_lease', 'rider', 'amendment')),

  -- Display name (denormalized for convenience)
  scope_name VARCHAR(255),

  -- Cleaning Requirements (nullable = inherit from parent)
  food_grade BOOLEAN,
  mineral_wipe BOOLEAN,
  kosher_wash BOOLEAN,
  kosher_wipe BOOLEAN,
  shop_oil_material BOOLEAN,
  oil_provider_contact TEXT,
  rinse_water_test_procedure TEXT,

  -- Primary Contact (nullable = inherit)
  primary_contact_name VARCHAR(200),
  primary_contact_email VARCHAR(200),
  primary_contact_phone VARCHAR(50),

  -- Estimate Approval Contact (nullable = inherit)
  estimate_approval_contact_name VARCHAR(200),
  estimate_approval_contact_email VARCHAR(200),
  estimate_approval_contact_phone VARCHAR(50),

  -- Dispo Contact (nullable = inherit)
  dispo_contact_name VARCHAR(200),
  dispo_contact_email VARCHAR(200),
  dispo_contact_phone VARCHAR(50),

  -- Outbound Dispo (nullable = inherit)
  decal_requirements TEXT,
  nitrogen_applied BOOLEAN,
  nitrogen_psi VARCHAR(50),
  outbound_dispo_contact_email VARCHAR(200),
  outbound_dispo_contact_phone VARCHAR(50),
  documentation_required_prior_to_release TEXT,

  -- Special Fittings
  special_fittings_vendor_requirements TEXT,

  -- Notes
  additional_notes TEXT,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_id UUID REFERENCES ccm_instructions(id),

  -- Audit
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure exactly one scope is set
  CONSTRAINT ccm_instructions_scope_check CHECK (
    (CASE WHEN customer_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN master_lease_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN rider_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN amendment_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

-- Indexes for hierarchy lookups
CREATE INDEX IF NOT EXISTS idx_ccm_instructions_customer ON ccm_instructions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ccm_instructions_lease ON ccm_instructions(master_lease_id) WHERE master_lease_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ccm_instructions_rider ON ccm_instructions(rider_id) WHERE rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ccm_instructions_amendment ON ccm_instructions(amendment_id) WHERE amendment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ccm_instructions_current ON ccm_instructions(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_ccm_instructions_scope_level ON ccm_instructions(scope_level);

-- Unique partial indexes: one current instruction per scope entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccm_instructions_unique_customer
  ON ccm_instructions(customer_id) WHERE customer_id IS NOT NULL AND is_current = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccm_instructions_unique_lease
  ON ccm_instructions(master_lease_id) WHERE master_lease_id IS NOT NULL AND is_current = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccm_instructions_unique_rider
  ON ccm_instructions(rider_id) WHERE rider_id IS NOT NULL AND is_current = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccm_instructions_unique_amendment
  ON ccm_instructions(amendment_id) WHERE amendment_id IS NOT NULL AND is_current = TRUE;

-- ============================================================================
-- 2. CCM INSTRUCTION SEALING - Per-commodity sealing at any level
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_instruction_sealing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccm_instruction_id UUID NOT NULL REFERENCES ccm_instructions(id) ON DELETE CASCADE,
  commodity VARCHAR(200) NOT NULL,

  -- Fields (nullable = inherit from parent level for this commodity)
  gasket_sealing_material VARCHAR(200),
  alternate_material VARCHAR(200),
  preferred_gasket_vendor VARCHAR(200),
  alternate_vendor VARCHAR(200),
  vsp_ride_tight BOOLEAN,
  sealing_requirements TEXT,

  -- Explicit inheritance marker (if TRUE, inherit this commodity from parent)
  inherit_from_parent BOOLEAN NOT NULL DEFAULT FALSE,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(ccm_instruction_id, commodity)
);

CREATE INDEX IF NOT EXISTS idx_ccm_instruction_sealing_instruction ON ccm_instruction_sealing(ccm_instruction_id);
CREATE INDEX IF NOT EXISTS idx_ccm_instruction_sealing_commodity ON ccm_instruction_sealing(commodity);

-- ============================================================================
-- 3. CCM INSTRUCTION LINING - Per-commodity lining at any level
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_instruction_lining (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccm_instruction_id UUID NOT NULL REFERENCES ccm_instructions(id) ON DELETE CASCADE,
  commodity VARCHAR(200) NOT NULL,

  -- Fields (nullable = inherit from parent level for this commodity)
  lining_required BOOLEAN,
  lining_inspection_interval VARCHAR(100),
  lining_type VARCHAR(200),
  lining_plan_on_file BOOLEAN,
  lining_requirements TEXT,

  -- Explicit inheritance marker
  inherit_from_parent BOOLEAN NOT NULL DEFAULT FALSE,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(ccm_instruction_id, commodity)
);

CREATE INDEX IF NOT EXISTS idx_ccm_instruction_lining_instruction ON ccm_instruction_lining(ccm_instruction_id);
CREATE INDEX IF NOT EXISTS idx_ccm_instruction_lining_commodity ON ccm_instruction_lining(commodity);

-- ============================================================================
-- 4. VIEWS
-- ============================================================================

-- View: Current CCM instructions with scope details
CREATE OR REPLACE VIEW v_ccm_instructions AS
SELECT
  ci.*,
  u.email AS created_by_email,
  u.first_name || ' ' || u.last_name AS created_by_name,
  c.customer_name,
  c.customer_code,
  ml.lease_id AS lease_code,
  ml.lease_name,
  lr.rider_id AS rider_code,
  lr.rider_name,
  la.amendment_id AS amendment_code,
  la.change_summary AS amendment_summary,
  (SELECT COUNT(*) FROM ccm_instruction_sealing s WHERE s.ccm_instruction_id = ci.id) AS sealing_count,
  (SELECT COUNT(*) FROM ccm_instruction_lining l WHERE l.ccm_instruction_id = ci.id) AS lining_count
FROM ccm_instructions ci
LEFT JOIN users u ON u.id = ci.created_by_id
LEFT JOIN customers c ON c.id = ci.customer_id
LEFT JOIN master_leases ml ON ml.id = ci.master_lease_id
LEFT JOIN lease_riders lr ON lr.id = ci.rider_id
LEFT JOIN lease_amendments la ON la.id = ci.amendment_id
WHERE ci.is_current = TRUE
ORDER BY ci.scope_level, COALESCE(c.customer_name, ml.lease_name, lr.rider_name, la.change_summary);

-- View: Hierarchy tree with CCM status
CREATE OR REPLACE VIEW v_ccm_hierarchy_tree AS
WITH customer_ccm AS (
  SELECT customer_id, TRUE AS has_ccm
  FROM ccm_instructions
  WHERE customer_id IS NOT NULL AND is_current = TRUE
),
lease_ccm AS (
  SELECT master_lease_id, TRUE AS has_ccm
  FROM ccm_instructions
  WHERE master_lease_id IS NOT NULL AND is_current = TRUE
),
rider_ccm AS (
  SELECT rider_id, TRUE AS has_ccm
  FROM ccm_instructions
  WHERE rider_id IS NOT NULL AND is_current = TRUE
),
amendment_ccm AS (
  SELECT amendment_id, TRUE AS has_ccm
  FROM ccm_instructions
  WHERE amendment_id IS NOT NULL AND is_current = TRUE
)
SELECT
  'customer' AS node_type,
  c.id,
  c.customer_name AS name,
  c.customer_code AS code,
  NULL::UUID AS parent_id,
  COALESCE(cc.has_ccm, FALSE) AS has_ccm,
  c.is_active
FROM customers c
LEFT JOIN customer_ccm cc ON cc.customer_id = c.id
WHERE c.is_active = TRUE

UNION ALL

SELECT
  'master_lease' AS node_type,
  ml.id,
  COALESCE(ml.lease_name, ml.lease_id) AS name,
  ml.lease_id AS code,
  ml.customer_id AS parent_id,
  COALESCE(lc.has_ccm, FALSE) AS has_ccm,
  ml.status = 'Active' AS is_active
FROM master_leases ml
LEFT JOIN lease_ccm lc ON lc.master_lease_id = ml.id
WHERE ml.status IN ('Active', 'Expiring')

UNION ALL

SELECT
  'rider' AS node_type,
  lr.id,
  COALESCE(lr.rider_name, lr.rider_id) AS name,
  lr.rider_id AS code,
  lr.master_lease_id AS parent_id,
  COALESCE(rc.has_ccm, FALSE) AS has_ccm,
  lr.status = 'Active' AS is_active
FROM lease_riders lr
LEFT JOIN rider_ccm rc ON rc.rider_id = lr.id
WHERE lr.status IN ('Active', 'Expiring Soon')

UNION ALL

SELECT
  'amendment' AS node_type,
  la.id,
  COALESCE(la.change_summary, la.amendment_id) AS name,
  la.amendment_id AS code,
  COALESCE(la.rider_id, la.master_lease_id) AS parent_id,
  COALESCE(ac.has_ccm, FALSE) AS has_ccm,
  la.effective_date <= CURRENT_DATE AS is_active
FROM lease_amendments la
LEFT JOIN amendment_ccm ac ON ac.amendment_id = la.id;

-- ============================================================================
-- 5. MIGRATION FROM EXISTING CCM_FORMS
-- ============================================================================

-- Migrate existing ccm_forms to ccm_instructions at customer level
-- Only run if ccm_forms has data and ccm_instructions is empty
DO $$
DECLARE
  form_count INT;
  instruction_count INT;
BEGIN
  SELECT COUNT(*) INTO form_count FROM ccm_forms WHERE is_current = TRUE;
  SELECT COUNT(*) INTO instruction_count FROM ccm_instructions;

  IF form_count > 0 AND instruction_count = 0 THEN
    INSERT INTO ccm_instructions (
      customer_id, scope_level, scope_name,
      food_grade, mineral_wipe, kosher_wash, kosher_wipe, shop_oil_material,
      oil_provider_contact, rinse_water_test_procedure,
      primary_contact_name, primary_contact_email, primary_contact_phone,
      estimate_approval_contact_name, estimate_approval_contact_email, estimate_approval_contact_phone,
      dispo_contact_name, dispo_contact_email, dispo_contact_phone,
      decal_requirements, nitrogen_applied, nitrogen_psi,
      outbound_dispo_contact_email, outbound_dispo_contact_phone,
      documentation_required_prior_to_release,
      special_fittings_vendor_requirements, additional_notes,
      version, is_current, created_by_id, created_at, updated_at
    )
    SELECT
      c.id, 'customer', c.customer_name,
      f.food_grade, f.mineral_wipe, f.kosher_wash, f.kosher_wipe, f.shop_oil_material,
      f.oil_provider_contact, f.rinse_water_test_procedure,
      f.primary_contact_name, f.primary_contact_email, f.primary_contact_phone,
      f.estimate_approval_contact_name, f.estimate_approval_contact_email, f.estimate_approval_contact_phone,
      f.dispo_contact_name, f.dispo_contact_email, f.dispo_contact_phone,
      f.decal_requirements, f.nitrogen_applied, f.nitrogen_psi,
      f.outbound_dispo_contact_email, f.outbound_dispo_contact_phone,
      f.documentation_required_prior_to_release,
      f.special_fittings_vendor_requirements, f.additional_notes,
      f.version, f.is_current, f.created_by_id, f.created_at, f.updated_at
    FROM ccm_forms f
    JOIN customers c ON c.customer_code = f.lessee_code
    WHERE f.is_current = TRUE;

    RAISE NOTICE 'Migrated % CCM forms to ccm_instructions', form_count;

    -- Migrate sealing sections
    INSERT INTO ccm_instruction_sealing (
      ccm_instruction_id, commodity,
      gasket_sealing_material, alternate_material, preferred_gasket_vendor, alternate_vendor,
      vsp_ride_tight, sealing_requirements, inherit_from_parent, sort_order, created_at, updated_at
    )
    SELECT
      ci.id, fs.commodity,
      fs.gasket_sealing_material, fs.alternate_material, fs.preferred_gasket_vendor, fs.alternate_vendor,
      fs.vsp_ride_tight, fs.sealing_requirements, FALSE, fs.sort_order, fs.created_at, fs.updated_at
    FROM ccm_form_sealing fs
    JOIN ccm_forms f ON f.id = fs.ccm_form_id AND f.is_current = TRUE
    JOIN customers c ON c.customer_code = f.lessee_code
    JOIN ccm_instructions ci ON ci.customer_id = c.id AND ci.is_current = TRUE;

    -- Migrate lining sections
    INSERT INTO ccm_instruction_lining (
      ccm_instruction_id, commodity,
      lining_required, lining_inspection_interval, lining_type, lining_plan_on_file,
      lining_requirements, inherit_from_parent, sort_order, created_at, updated_at
    )
    SELECT
      ci.id, fl.commodity,
      fl.lining_required, fl.lining_inspection_interval, fl.lining_type, fl.lining_plan_on_file,
      fl.lining_requirements, FALSE, fl.sort_order, fl.created_at, fl.updated_at
    FROM ccm_form_lining fl
    JOIN ccm_forms f ON f.id = fl.ccm_form_id AND f.is_current = TRUE
    JOIN customers c ON c.customer_code = f.lessee_code
    JOIN ccm_instructions ci ON ci.customer_id = c.id AND ci.is_current = TRUE;
  END IF;
END;
$$;

-- ============================================================================
-- 6. FUNCTION: Get effective CCM for a car (inheritance resolved)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_effective_ccm_for_car(p_car_number VARCHAR(20))
RETURNS TABLE (
  -- Effective values
  food_grade BOOLEAN,
  mineral_wipe BOOLEAN,
  kosher_wash BOOLEAN,
  kosher_wipe BOOLEAN,
  shop_oil_material BOOLEAN,
  oil_provider_contact TEXT,
  rinse_water_test_procedure TEXT,
  primary_contact_name VARCHAR(200),
  primary_contact_email VARCHAR(200),
  primary_contact_phone VARCHAR(50),
  estimate_approval_contact_name VARCHAR(200),
  estimate_approval_contact_email VARCHAR(200),
  estimate_approval_contact_phone VARCHAR(50),
  dispo_contact_name VARCHAR(200),
  dispo_contact_email VARCHAR(200),
  dispo_contact_phone VARCHAR(50),
  decal_requirements TEXT,
  nitrogen_applied BOOLEAN,
  nitrogen_psi VARCHAR(50),
  outbound_dispo_contact_email VARCHAR(200),
  outbound_dispo_contact_phone VARCHAR(50),
  documentation_required_prior_to_release TEXT,
  special_fittings_vendor_requirements TEXT,
  additional_notes TEXT,
  -- Source tracking (JSON)
  field_sources JSONB,
  -- Hierarchy path
  customer_id UUID,
  customer_name VARCHAR(200),
  master_lease_id UUID,
  lease_name VARCHAR(200),
  rider_id UUID,
  rider_name VARCHAR(200),
  amendment_id UUID,
  amendment_name VARCHAR(200)
) AS $$
DECLARE
  v_customer_id UUID;
  v_master_lease_id UUID;
  v_rider_id UUID;
  v_amendment_id UUID;
  v_customer_name VARCHAR(200);
  v_lease_name VARCHAR(200);
  v_rider_name VARCHAR(200);
  v_amendment_name VARCHAR(200);
  v_sources JSONB := '{}';
  v_cust_ccm RECORD;
  v_lease_ccm RECORD;
  v_rider_ccm RECORD;
  v_amend_ccm RECORD;
BEGIN
  -- Resolve hierarchy path for this car
  SELECT
    ml.customer_id, c.customer_name,
    lr.master_lease_id, COALESCE(ml.lease_name, ml.lease_id),
    rc.rider_id, COALESCE(lr.rider_name, lr.rider_id),
    la.id, COALESCE(la.change_summary, la.amendment_id)
  INTO
    v_customer_id, v_customer_name,
    v_master_lease_id, v_lease_name,
    v_rider_id, v_rider_name,
    v_amendment_id, v_amendment_name
  FROM rider_cars rc
  JOIN lease_riders lr ON rc.rider_id = lr.id
  JOIN master_leases ml ON lr.master_lease_id = ml.id
  JOIN customers c ON ml.customer_id = c.id
  LEFT JOIN lease_amendments la ON la.rider_id = lr.id AND la.effective_date <= CURRENT_DATE
  WHERE rc.car_number = p_car_number AND rc.is_active = TRUE
  ORDER BY la.effective_date DESC NULLS LAST
  LIMIT 1;

  -- If no hierarchy found, return nulls
  IF v_customer_id IS NULL THEN
    RETURN QUERY SELECT
      NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN,
      NULL::TEXT, NULL::TEXT,
      NULL::VARCHAR(200), NULL::VARCHAR(200), NULL::VARCHAR(50),
      NULL::VARCHAR(200), NULL::VARCHAR(200), NULL::VARCHAR(50),
      NULL::VARCHAR(200), NULL::VARCHAR(200), NULL::VARCHAR(50),
      NULL::TEXT, NULL::BOOLEAN, NULL::VARCHAR(50),
      NULL::VARCHAR(200), NULL::VARCHAR(50), NULL::TEXT, NULL::TEXT, NULL::TEXT,
      '{}'::JSONB,
      NULL::UUID, NULL::VARCHAR(200), NULL::UUID, NULL::VARCHAR(200),
      NULL::UUID, NULL::VARCHAR(200), NULL::UUID, NULL::VARCHAR(200);
    RETURN;
  END IF;

  -- Get CCM at each level
  SELECT * INTO v_cust_ccm FROM ccm_instructions WHERE customer_id = v_customer_id AND is_current = TRUE;
  SELECT * INTO v_lease_ccm FROM ccm_instructions WHERE master_lease_id = v_master_lease_id AND is_current = TRUE;
  SELECT * INTO v_rider_ccm FROM ccm_instructions WHERE rider_id = v_rider_id AND is_current = TRUE;
  IF v_amendment_id IS NOT NULL THEN
    SELECT * INTO v_amend_ccm FROM ccm_instructions WHERE amendment_id = v_amendment_id AND is_current = TRUE;
  END IF;

  -- Merge with inheritance (amendment > rider > lease > customer)
  -- Build sources as we go
  RETURN QUERY SELECT
    COALESCE(v_amend_ccm.food_grade, v_rider_ccm.food_grade, v_lease_ccm.food_grade, v_cust_ccm.food_grade),
    COALESCE(v_amend_ccm.mineral_wipe, v_rider_ccm.mineral_wipe, v_lease_ccm.mineral_wipe, v_cust_ccm.mineral_wipe),
    COALESCE(v_amend_ccm.kosher_wash, v_rider_ccm.kosher_wash, v_lease_ccm.kosher_wash, v_cust_ccm.kosher_wash),
    COALESCE(v_amend_ccm.kosher_wipe, v_rider_ccm.kosher_wipe, v_lease_ccm.kosher_wipe, v_cust_ccm.kosher_wipe),
    COALESCE(v_amend_ccm.shop_oil_material, v_rider_ccm.shop_oil_material, v_lease_ccm.shop_oil_material, v_cust_ccm.shop_oil_material),
    COALESCE(v_amend_ccm.oil_provider_contact, v_rider_ccm.oil_provider_contact, v_lease_ccm.oil_provider_contact, v_cust_ccm.oil_provider_contact),
    COALESCE(v_amend_ccm.rinse_water_test_procedure, v_rider_ccm.rinse_water_test_procedure, v_lease_ccm.rinse_water_test_procedure, v_cust_ccm.rinse_water_test_procedure),
    COALESCE(v_amend_ccm.primary_contact_name, v_rider_ccm.primary_contact_name, v_lease_ccm.primary_contact_name, v_cust_ccm.primary_contact_name),
    COALESCE(v_amend_ccm.primary_contact_email, v_rider_ccm.primary_contact_email, v_lease_ccm.primary_contact_email, v_cust_ccm.primary_contact_email),
    COALESCE(v_amend_ccm.primary_contact_phone, v_rider_ccm.primary_contact_phone, v_lease_ccm.primary_contact_phone, v_cust_ccm.primary_contact_phone),
    COALESCE(v_amend_ccm.estimate_approval_contact_name, v_rider_ccm.estimate_approval_contact_name, v_lease_ccm.estimate_approval_contact_name, v_cust_ccm.estimate_approval_contact_name),
    COALESCE(v_amend_ccm.estimate_approval_contact_email, v_rider_ccm.estimate_approval_contact_email, v_lease_ccm.estimate_approval_contact_email, v_cust_ccm.estimate_approval_contact_email),
    COALESCE(v_amend_ccm.estimate_approval_contact_phone, v_rider_ccm.estimate_approval_contact_phone, v_lease_ccm.estimate_approval_contact_phone, v_cust_ccm.estimate_approval_contact_phone),
    COALESCE(v_amend_ccm.dispo_contact_name, v_rider_ccm.dispo_contact_name, v_lease_ccm.dispo_contact_name, v_cust_ccm.dispo_contact_name),
    COALESCE(v_amend_ccm.dispo_contact_email, v_rider_ccm.dispo_contact_email, v_lease_ccm.dispo_contact_email, v_cust_ccm.dispo_contact_email),
    COALESCE(v_amend_ccm.dispo_contact_phone, v_rider_ccm.dispo_contact_phone, v_lease_ccm.dispo_contact_phone, v_cust_ccm.dispo_contact_phone),
    COALESCE(v_amend_ccm.decal_requirements, v_rider_ccm.decal_requirements, v_lease_ccm.decal_requirements, v_cust_ccm.decal_requirements),
    COALESCE(v_amend_ccm.nitrogen_applied, v_rider_ccm.nitrogen_applied, v_lease_ccm.nitrogen_applied, v_cust_ccm.nitrogen_applied),
    COALESCE(v_amend_ccm.nitrogen_psi, v_rider_ccm.nitrogen_psi, v_lease_ccm.nitrogen_psi, v_cust_ccm.nitrogen_psi),
    COALESCE(v_amend_ccm.outbound_dispo_contact_email, v_rider_ccm.outbound_dispo_contact_email, v_lease_ccm.outbound_dispo_contact_email, v_cust_ccm.outbound_dispo_contact_email),
    COALESCE(v_amend_ccm.outbound_dispo_contact_phone, v_rider_ccm.outbound_dispo_contact_phone, v_lease_ccm.outbound_dispo_contact_phone, v_cust_ccm.outbound_dispo_contact_phone),
    COALESCE(v_amend_ccm.documentation_required_prior_to_release, v_rider_ccm.documentation_required_prior_to_release, v_lease_ccm.documentation_required_prior_to_release, v_cust_ccm.documentation_required_prior_to_release),
    COALESCE(v_amend_ccm.special_fittings_vendor_requirements, v_rider_ccm.special_fittings_vendor_requirements, v_lease_ccm.special_fittings_vendor_requirements, v_cust_ccm.special_fittings_vendor_requirements),
    COALESCE(v_amend_ccm.additional_notes, v_rider_ccm.additional_notes, v_lease_ccm.additional_notes, v_cust_ccm.additional_notes),
    -- Build field sources JSON
    jsonb_build_object(
      'food_grade', CASE
        WHEN v_amend_ccm.food_grade IS NOT NULL THEN 'amendment'
        WHEN v_rider_ccm.food_grade IS NOT NULL THEN 'rider'
        WHEN v_lease_ccm.food_grade IS NOT NULL THEN 'master_lease'
        WHEN v_cust_ccm.food_grade IS NOT NULL THEN 'customer'
        ELSE NULL END,
      'mineral_wipe', CASE
        WHEN v_amend_ccm.mineral_wipe IS NOT NULL THEN 'amendment'
        WHEN v_rider_ccm.mineral_wipe IS NOT NULL THEN 'rider'
        WHEN v_lease_ccm.mineral_wipe IS NOT NULL THEN 'master_lease'
        WHEN v_cust_ccm.mineral_wipe IS NOT NULL THEN 'customer'
        ELSE NULL END,
      'nitrogen_applied', CASE
        WHEN v_amend_ccm.nitrogen_applied IS NOT NULL THEN 'amendment'
        WHEN v_rider_ccm.nitrogen_applied IS NOT NULL THEN 'rider'
        WHEN v_lease_ccm.nitrogen_applied IS NOT NULL THEN 'master_lease'
        WHEN v_cust_ccm.nitrogen_applied IS NOT NULL THEN 'customer'
        ELSE NULL END
    ),
    v_customer_id, v_customer_name,
    v_master_lease_id, v_lease_name,
    v_rider_id, v_rider_name,
    v_amendment_id, v_amendment_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. AUDIT TRIGGERS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_table_changes') THEN
    CREATE OR REPLACE TRIGGER trg_ccm_instructions_audit
      AFTER INSERT OR UPDATE OR DELETE ON ccm_instructions
      FOR EACH ROW EXECUTE FUNCTION log_table_changes();

    CREATE OR REPLACE TRIGGER trg_ccm_instruction_sealing_audit
      AFTER INSERT OR UPDATE OR DELETE ON ccm_instruction_sealing
      FOR EACH ROW EXECUTE FUNCTION log_table_changes();

    CREATE OR REPLACE TRIGGER trg_ccm_instruction_lining_audit
      AFTER INSERT OR UPDATE OR DELETE ON ccm_instruction_lining
      FOR EACH ROW EXECUTE FUNCTION log_table_changes();
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Audit triggers skipped: %', SQLERRM;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ccm_instructions IS 'CCM instructions at any hierarchy level (customer, lease, rider, amendment) with inheritance support';
COMMENT ON TABLE ccm_instruction_sealing IS 'Per-commodity sealing instructions linked to CCM instructions';
COMMENT ON TABLE ccm_instruction_lining IS 'Per-commodity lining instructions linked to CCM instructions';
COMMENT ON FUNCTION get_effective_ccm_for_car IS 'Resolves the effective CCM for a car by merging instructions from all hierarchy levels';
