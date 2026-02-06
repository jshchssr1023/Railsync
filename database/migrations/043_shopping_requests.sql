-- ============================================================================
-- Migration 043: Shopping Requests
-- Comprehensive intake form for car shopping requests.
-- A shopping_request captures full request context; on approval it spawns
-- a shopping_event in the REQUESTED state.
-- ============================================================================

-- ============================================================================
-- 1. SHOPPING REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) NOT NULL UNIQUE,

  -- STATUS LIFECYCLE: draft -> submitted -> under_review -> approved/rejected/cancelled
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled')),

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 1: CUSTOMER INFORMATION
  -- ═══════════════════════════════════════════════════════════════════
  customer_company VARCHAR(100) NOT NULL DEFAULT 'all_customers',
  customer_first_name VARCHAR(100),
  customer_last_name VARCHAR(100),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 2: CAR INFORMATION
  -- ═══════════════════════════════════════════════════════════════════
  car_number VARCHAR(20) NOT NULL,
  current_railroad VARCHAR(100),
  current_location_city VARCHAR(100),
  current_location_state VARCHAR(50),
  next_railroad VARCHAR(100),
  next_location_city VARCHAR(100),
  next_location_state VARCHAR(50),
  stcc_or_un_number VARCHAR(50),

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 3: CAR SHOPPING STATUS
  -- ═══════════════════════════════════════════════════════════════════
  residue_clean VARCHAR(10) NOT NULL DEFAULT 'unknown'
    CHECK (residue_clean IN ('unknown', 'yes', 'no')),
  gasket VARCHAR(10) NOT NULL DEFAULT 'unknown'
    CHECK (gasket IN ('unknown', 'yes', 'no')),
  o_rings VARCHAR(10) NOT NULL DEFAULT 'unknown'
    CHECK (o_rings IN ('unknown', 'yes', 'no')),
  last_known_commodity VARCHAR(255),
  lining_current VARCHAR(255),
  lining_alternative VARCHAR(255),
  preferred_shop_code VARCHAR(20),

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 5: MOBILE REPAIR UNIT
  -- ═══════════════════════════════════════════════════════════════════
  mobile_repair_unit BOOLEAN NOT NULL DEFAULT FALSE,

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 6: REASON FOR SHOPPING
  -- ═══════════════════════════════════════════════════════════════════
  shopping_type_code VARCHAR(50),
  shopping_reason_code VARCHAR(50),
  clean_grade VARCHAR(50),
  is_kosher BOOLEAN NOT NULL DEFAULT FALSE,
  is_food_grade BOOLEAN NOT NULL DEFAULT FALSE,
  dry_grade VARCHAR(50),

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 7: RETURN DISPOSITION
  -- ═══════════════════════════════════════════════════════════════════
  disposition_city VARCHAR(100),
  disposition_state VARCHAR(50),
  disposition_route VARCHAR(255),
  disposition_payer_of_freight VARCHAR(100),
  disposition_comment TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 9: ONE TIME MOVEMENT APPROVAL
  -- ═══════════════════════════════════════════════════════════════════
  one_time_movement_approval BOOLEAN NOT NULL DEFAULT FALSE,

  -- ═══════════════════════════════════════════════════════════════════
  -- SECTION 10: COMMENTS
  -- ═══════════════════════════════════════════════════════════════════
  comments TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- LINKED RECORDS
  -- ═══════════════════════════════════════════════════════════════════
  shopping_event_id UUID REFERENCES shopping_events(id),
  bad_order_report_id UUID REFERENCES bad_order_reports(id),

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_id UUID REFERENCES users(id),
  review_notes TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sr_car_number ON shopping_requests(car_number);
CREATE INDEX IF NOT EXISTS idx_sr_status ON shopping_requests(status);
CREATE INDEX IF NOT EXISTS idx_sr_created ON shopping_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sr_shopping_event ON shopping_requests(shopping_event_id) WHERE shopping_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sr_bad_order ON shopping_requests(bad_order_report_id) WHERE bad_order_report_id IS NOT NULL;

-- ============================================================================
-- 2. SHOPPING REQUEST ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_request_id UUID NOT NULL REFERENCES shopping_requests(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  document_type VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('sds', 'cleaning_certificate', 'other')),
  uploaded_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sra_request ON shopping_request_attachments(shopping_request_id);

-- ============================================================================
-- 3. REQUEST NUMBER GENERATOR
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  today_prefix VARCHAR;
  next_seq INT;
BEGIN
  today_prefix := 'SR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';

  SELECT COALESCE(MAX(SUBSTRING(request_number FROM LENGTH(today_prefix) + 1)::INT), 0) + 1
  INTO next_seq
  FROM shopping_requests
  WHERE request_number LIKE today_prefix || '%';

  RETURN today_prefix || LPAD(next_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE TRIGGER trg_shopping_requests_updated_at
  BEFORE UPDATE ON shopping_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_shopping_requests AS
SELECT
  sr.*,
  s.shop_name AS preferred_shop_name,
  TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')) AS created_by_name,
  cu.email AS created_by_email,
  TRIM(COALESCE(ru.first_name, '') || ' ' || COALESCE(ru.last_name, '')) AS reviewed_by_name,
  (SELECT COUNT(*)::INT FROM shopping_request_attachments sra WHERE sra.shopping_request_id = sr.id) AS attachment_count
FROM shopping_requests sr
LEFT JOIN shops s ON s.shop_code = sr.preferred_shop_code
LEFT JOIN users cu ON cu.id = sr.created_by_id
LEFT JOIN users ru ON ru.id = sr.reviewed_by_id;
