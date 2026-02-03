-- ============================================================================
-- Migration 022: CCM (Customer Care Manual) Document Management
-- PDF documents per lessee containing lease details and shopping instructions
-- ============================================================================

-- CCM Documents table
CREATE TABLE IF NOT EXISTS ccm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lessee_code VARCHAR(20) NOT NULL,
  lessee_name VARCHAR(200),

  -- Document info
  document_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',

  -- Version tracking
  version INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_id UUID REFERENCES ccm_documents(id),

  -- Content description
  description TEXT,
  effective_date DATE,
  expiration_date DATE,

  -- Audit
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ccm_documents_lessee ON ccm_documents(lessee_code);
CREATE INDEX IF NOT EXISTS idx_ccm_documents_current ON ccm_documents(is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_ccm_documents_lessee_current ON ccm_documents(lessee_code, is_current) WHERE is_current = TRUE;

-- View: Current CCM documents per lessee
CREATE OR REPLACE VIEW v_current_ccm_documents AS
SELECT
  d.*,
  u.email AS uploaded_by_email,
  u.first_name || ' ' || u.last_name AS uploaded_by_name
FROM ccm_documents d
LEFT JOIN users u ON u.id = d.uploaded_by
WHERE d.is_current = TRUE
ORDER BY d.lessee_name, d.document_name;

-- View: CCM document history by lessee
CREATE OR REPLACE VIEW v_ccm_document_history AS
SELECT
  d.*,
  u.email AS uploaded_by_email,
  CASE WHEN d.is_current THEN 'Current' ELSE 'Superseded' END AS status
FROM ccm_documents d
LEFT JOIN users u ON u.id = d.uploaded_by
ORDER BY d.lessee_code, d.document_name, d.version DESC;

-- ============================================================================
-- Riders table (parsed from contract_number field)
-- ============================================================================

CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lessee_code VARCHAR(20) NOT NULL,
  lessee_name VARCHAR(200),

  -- Contract structure
  contract_base VARCHAR(20) NOT NULL,  -- Base contract number (e.g., "09027R")
  rider_number VARCHAR(20) NOT NULL,   -- Rider identifier (e.g., "0003")
  full_contract_number VARCHAR(50),    -- Original format (e.g., "09027R 0003")

  -- Terms
  effective_date DATE,
  expiration_date DATE,
  terms_summary TEXT,

  -- Counts (denormalized for performance)
  car_count INT DEFAULT 0,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_rider UNIQUE (lessee_code, contract_base, rider_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_riders_lessee ON riders(lessee_code);
CREATE INDEX IF NOT EXISTS idx_riders_contract ON riders(contract_base);
CREATE INDEX IF NOT EXISTS idx_riders_full ON riders(full_contract_number);

-- Link cars to riders
ALTER TABLE cars ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES riders(id);
CREATE INDEX IF NOT EXISTS idx_cars_rider ON cars(rider_id);

-- View: Riders with car counts and CCM status
CREATE OR REPLACE VIEW v_riders_summary AS
SELECT
  r.*,
  (SELECT COUNT(*) FROM cars c WHERE c.rider_id = r.id) AS active_car_count,
  (SELECT COUNT(*) FROM ccm_documents d WHERE d.lessee_code = r.lessee_code AND d.is_current = TRUE) AS ccm_document_count,
  CASE
    WHEN r.expiration_date IS NULL THEN 'Active'
    WHEN r.expiration_date < CURRENT_DATE THEN 'Expired'
    WHEN r.expiration_date < CURRENT_DATE + INTERVAL '90 days' THEN 'Expiring Soon'
    ELSE 'Active'
  END AS contract_status
FROM riders r
ORDER BY r.lessee_name, r.contract_base, r.rider_number;

-- Function to parse and create riders from existing car data
CREATE OR REPLACE FUNCTION populate_riders_from_cars() RETURNS INT AS $$
DECLARE
  inserted_count INT := 0;
BEGIN
  -- Insert unique riders from cars.contract_number
  INSERT INTO riders (lessee_code, lessee_name, contract_base, rider_number, full_contract_number)
  SELECT DISTINCT
    c.lessee_code,
    c.lessee_name,
    TRIM(SPLIT_PART(c.contract_number, ' ', 1)) AS contract_base,
    TRIM(SPLIT_PART(c.contract_number, ' ', 2)) AS rider_number,
    c.contract_number
  FROM cars c
  WHERE c.contract_number IS NOT NULL
    AND c.contract_number != ''
    AND POSITION(' ' IN c.contract_number) > 0
  ON CONFLICT (lessee_code, contract_base, rider_number) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- Update car_count on each rider
  UPDATE riders r
  SET car_count = (
    SELECT COUNT(*)
    FROM cars c
    WHERE c.contract_number = r.full_contract_number
  );

  -- Link cars to their riders
  UPDATE cars c
  SET rider_id = r.id
  FROM riders r
  WHERE c.contract_number = r.full_contract_number
    AND c.rider_id IS NULL;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Billable Items (Lessee Responsible Matrix)
-- ============================================================================

CREATE TABLE IF NOT EXISTS billable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lessee_code VARCHAR(20) NOT NULL,

  -- Scope (can be general or specific)
  rider_id UUID REFERENCES riders(id),           -- Optional: rider-specific
  commodity VARCHAR(100),                         -- Optional: commodity-specific
  car_type VARCHAR(100),                          -- Optional: car type-specific

  -- Item details
  item_code VARCHAR(50) NOT NULL,
  item_description TEXT NOT NULL,

  -- Billing
  is_customer_responsible BOOLEAN NOT NULL DEFAULT FALSE,
  billing_notes TEXT,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billable_items_lessee ON billable_items(lessee_code);
CREATE INDEX IF NOT EXISTS idx_billable_items_rider ON billable_items(rider_id);
CREATE INDEX IF NOT EXISTS idx_billable_items_customer ON billable_items(is_customer_responsible);

-- View: Billable items with lessee/rider info
CREATE OR REPLACE VIEW v_billable_items AS
SELECT
  bi.*,
  r.contract_base,
  r.rider_number,
  r.full_contract_number,
  COALESCE(r.lessee_name, (SELECT lessee_name FROM cars WHERE lessee_code = bi.lessee_code LIMIT 1)) AS lessee_name,
  u.email AS created_by_email
FROM billable_items bi
LEFT JOIN riders r ON r.id = bi.rider_id
LEFT JOIN users u ON u.id = bi.created_by
ORDER BY bi.lessee_code, bi.item_code;

-- View: Lessee billable summary
CREATE OR REPLACE VIEW v_lessee_billable_summary AS
SELECT
  bi.lessee_code,
  MAX(r.lessee_name) AS lessee_name,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE bi.is_customer_responsible) AS customer_responsible_count,
  COUNT(*) FILTER (WHERE NOT bi.is_customer_responsible) AS owner_responsible_count
FROM billable_items bi
LEFT JOIN riders r ON r.id = bi.rider_id
GROUP BY bi.lessee_code
ORDER BY customer_responsible_count DESC;
