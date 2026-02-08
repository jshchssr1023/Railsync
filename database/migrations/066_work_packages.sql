-- ============================================================================
-- Migration 066: Work Packages & Shop Role
-- Introduces the Work Package as the single deliverable unit sent to shops,
-- composing cover sheet + SOW + CCM snapshot + drawings + project context.
-- Also adds 'shop' user role for shop portal access.
-- ============================================================================

-- ============================================================================
-- 1. EXTEND USERS TABLE — Shop Role + Shop Code
-- ============================================================================

-- Widen role CHECK constraint to include 'shop'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'operator', 'viewer', 'shop'));

-- Add shop_code for shop-role users (nullable for non-shop users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_code VARCHAR(10)
  REFERENCES shops(shop_code);

CREATE INDEX IF NOT EXISTS idx_users_shop_code
  ON users(shop_code) WHERE shop_code IS NOT NULL;

-- ============================================================================
-- 2. WORK PACKAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_packages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source lineage (one or both can be set)
  project_id              UUID REFERENCES projects(id),
  shopping_event_id       UUID,
  allocation_id           UUID,
  shopping_packet_id      UUID REFERENCES shopping_packets(id),

  -- Identity & versioning
  package_number          VARCHAR(50) NOT NULL,
  version                 INT NOT NULL DEFAULT 1,
  status                  VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'assembled', 'issued', 'superseded')),

  -- Denormalized snapshot (captured at creation, immutable for historical record)
  car_number              VARCHAR(20) NOT NULL,
  shop_code               VARCHAR(10) NOT NULL,
  shop_name               VARCHAR(100),
  lessee_code             VARCHAR(20),
  lessee_name             VARCHAR(200),

  -- Linked content references (live, pre-issuance)
  scope_of_work_id        UUID,
  ccm_instruction_id      UUID,

  -- Cover sheet content
  special_instructions    TEXT,
  project_context         JSONB,       -- { project_name, project_type, due_date, mc_name, ec_name, ... }

  -- Issuance snapshot (frozen at issue time — immutable record of what was sent)
  sow_snapshot            JSONB,       -- Full SOW items + job codes at time of issuance
  ccm_snapshot            JSONB,       -- Resolved CCM values + sources at time of issuance
  billable_items_snapshot JSONB,       -- Billable items matrix at time of issuance
  documents_snapshot      JSONB,       -- Document list at time of issuance

  -- Version chain
  supersedes_id           UUID REFERENCES work_packages(id),
  reissue_reason          TEXT,

  -- Delivery tracking
  issued_at               TIMESTAMPTZ,
  issued_by               UUID REFERENCES users(id),

  -- Assembly tracking
  assembled_by            UUID REFERENCES users(id),
  assembled_at            TIMESTAMPTZ,

  -- Audit
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wp_project    ON work_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_wp_car        ON work_packages(car_number);
CREATE INDEX IF NOT EXISTS idx_wp_shop       ON work_packages(shop_code);
CREATE INDEX IF NOT EXISTS idx_wp_status     ON work_packages(status);
CREATE INDEX IF NOT EXISTS idx_wp_issued     ON work_packages(issued_at);
CREATE INDEX IF NOT EXISTS idx_wp_packet     ON work_packages(shopping_packet_id);

-- Only one active (non-superseded) work package per car+shop combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_wp_active_car_shop
  ON work_packages(car_number, shop_code)
  WHERE status NOT IN ('superseded');

-- ============================================================================
-- 3. WORK PACKAGE DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_package_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_package_id   UUID NOT NULL REFERENCES work_packages(id) ON DELETE CASCADE,
  document_type     VARCHAR(50) NOT NULL,    -- 'drawing', 'engineering', 'photo', 'specification', 'other'
  document_name     VARCHAR(255) NOT NULL,
  file_path         VARCHAR(500),
  file_size_bytes   INT,
  mime_type         VARCHAR(100),
  mfiles_id         VARCHAR(100),
  mfiles_url        VARCHAR(500),
  sort_order        INT DEFAULT 0,
  uploaded_by_id    UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wpd_package ON work_package_documents(work_package_id);

-- ============================================================================
-- 4. WORK PACKAGE CCM OVERRIDES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_package_ccm_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_package_id   UUID NOT NULL REFERENCES work_packages(id) ON DELETE CASCADE,
  field_name        VARCHAR(100) NOT NULL,
  original_value    TEXT,             -- The hierarchy-resolved value before override
  override_value    TEXT NOT NULL,    -- The EC's override for this package
  override_reason   TEXT,             -- Why the override was applied
  overridden_by     UUID REFERENCES users(id),
  overridden_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(work_package_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_wpco_package ON work_package_ccm_overrides(work_package_id);

-- ============================================================================
-- 5. WORK PACKAGE AUDIT EVENTS TABLE (IMMUTABLE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS work_package_audit_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_package_id   UUID NOT NULL REFERENCES work_packages(id),
  event_timestamp   TIMESTAMPTZ DEFAULT NOW(),
  actor_id          UUID REFERENCES users(id),
  actor_email       VARCHAR(255),
  action            VARCHAR(50) NOT NULL,    -- 'created', 'assembled', 'issued', 'reissued', 'superseded', 'document_added', 'document_removed', 'ccm_overridden', 'ccm_override_removed', 'updated'
  before_state      VARCHAR(20),
  after_state       VARCHAR(20),
  details           JSONB
);

-- Immutability trigger — prevent update or delete on audit events
CREATE OR REPLACE FUNCTION prevent_wp_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Work package audit events are immutable — updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wp_audit_immutable
  BEFORE UPDATE OR DELETE ON work_package_audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_wp_audit_modification();

CREATE INDEX IF NOT EXISTS idx_wpae_package ON work_package_audit_events(work_package_id);
CREATE INDEX IF NOT EXISTS idx_wpae_action  ON work_package_audit_events(action);

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- Main list view (internal users)
CREATE OR REPLACE VIEW v_work_packages AS
SELECT
  wp.*,
  p.project_number,
  p.project_name,
  p.project_type,
  u_issued.email    AS issued_by_email,
  u_created.email   AS created_by_email,
  u_assembled.email AS assembled_by_email,
  (SELECT COUNT(*) FROM work_package_documents d WHERE d.work_package_id = wp.id)    AS document_count,
  (SELECT COUNT(*) FROM work_package_ccm_overrides o WHERE o.work_package_id = wp.id) AS override_count
FROM work_packages wp
LEFT JOIN projects p              ON p.id = wp.project_id
LEFT JOIN users u_issued          ON u_issued.id = wp.issued_by
LEFT JOIN users u_created         ON u_created.id = wp.created_by
LEFT JOIN users u_assembled       ON u_assembled.id = wp.assembled_by
ORDER BY wp.created_at DESC;

-- Shop-facing view (only issued packages, no internal fields)
CREATE OR REPLACE VIEW v_shop_work_packages AS
SELECT
  wp.id,
  wp.package_number,
  wp.version,
  wp.status,
  wp.car_number,
  wp.shop_code,
  wp.shop_name,
  wp.lessee_code,
  wp.lessee_name,
  wp.special_instructions,
  wp.sow_snapshot,
  wp.ccm_snapshot,
  wp.billable_items_snapshot,
  wp.documents_snapshot,
  wp.issued_at,
  wp.project_context,
  p.project_name,
  p.project_type,
  (SELECT COUNT(*) FROM work_package_documents d WHERE d.work_package_id = wp.id) AS document_count
FROM work_packages wp
LEFT JOIN projects p ON p.id = wp.project_id
WHERE wp.status = 'issued'
ORDER BY wp.issued_at DESC;

-- Version history view
CREATE OR REPLACE VIEW v_work_package_history AS
SELECT
  wp.id,
  wp.package_number,
  wp.version,
  wp.status,
  wp.car_number,
  wp.shop_code,
  wp.shop_name,
  wp.issued_at,
  wp.reissue_reason,
  wp.created_at,
  u.email AS created_by_email
FROM work_packages wp
LEFT JOIN users u ON u.id = wp.created_by
ORDER BY wp.package_number, wp.version DESC;

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Generate unique package number
CREATE OR REPLACE FUNCTION generate_package_number() RETURNS VARCHAR(50) AS $$
BEGIN
  RETURN 'WPK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
         LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamp trigger (reuses existing update_updated_at if available)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at'
  ) THEN
    CREATE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END;
$$;

CREATE TRIGGER trg_wp_updated_at
  BEFORE UPDATE ON work_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 8. DATA MIGRATION — Existing shopping_packets → work_packages
-- ============================================================================

-- Backfill: create work_package records for all existing shopping packets
INSERT INTO work_packages (
  shopping_packet_id,
  allocation_id,
  package_number,
  version,
  status,
  car_number,
  shop_code,
  shop_name,
  lessee_code,
  lessee_name,
  scope_of_work_id,
  special_instructions,
  sow_snapshot,
  ccm_snapshot,
  billable_items_snapshot,
  issued_at,
  issued_by,
  created_by,
  created_at
)
SELECT
  sp.id,
  sp.allocation_id,
  'WPK-MIG-' || sp.packet_number,
  sp.version,
  CASE
    WHEN sp.status IN ('issued', 'reissued', 'acknowledged') THEN 'issued'
    WHEN sp.status = 'superseded' THEN 'superseded'
    ELSE 'draft'
  END,
  sp.car_number,
  sp.shop_code,
  sp.shop_name,
  sp.lessee_code,
  sp.lessee_name,
  sp.scope_of_work_id,
  sp.special_instructions,
  CASE WHEN sp.scope_of_work IS NOT NULL
    THEN jsonb_build_object('text', sp.scope_of_work)
    ELSE NULL
  END,
  CASE WHEN sp.ccm_document_id IS NOT NULL
    THEN jsonb_build_object('ccm_document_id', sp.ccm_document_id, 'ccm_document_name', sp.ccm_document_name)
    ELSE NULL
  END,
  sp.billable_items,
  sp.issued_at,
  sp.issued_by,
  sp.created_by,
  sp.created_at
FROM shopping_packets sp
ON CONFLICT DO NOTHING;

-- Migrate packet_documents → work_package_documents
INSERT INTO work_package_documents (
  work_package_id,
  document_type,
  document_name,
  file_path,
  file_size_bytes,
  mime_type,
  mfiles_id,
  mfiles_url,
  uploaded_by_id,
  created_at
)
SELECT
  wp.id,
  pd.document_type,
  pd.document_name,
  pd.file_path,
  pd.file_size_bytes,
  pd.mime_type,
  pd.mfiles_id,
  pd.mfiles_url,
  pd.uploaded_by_id,
  pd.created_at
FROM packet_documents pd
JOIN work_packages wp ON wp.shopping_packet_id = pd.packet_id
ON CONFLICT DO NOTHING;

-- Create migration audit events for backfilled packages
INSERT INTO work_package_audit_events (
  work_package_id,
  action,
  after_state,
  details
)
SELECT
  wp.id,
  'migrated',
  wp.status,
  jsonb_build_object(
    'source', 'migration_066',
    'original_packet_id', wp.shopping_packet_id,
    'original_packet_number', sp.packet_number
  )
FROM work_packages wp
JOIN shopping_packets sp ON sp.id = wp.shopping_packet_id
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. DEMO SHOP USER
-- ============================================================================

-- Create a demo shop user for testing (password: 'shop123')
-- Using same bcrypt pattern as existing seed data
INSERT INTO users (email, password_hash, first_name, last_name, role, organization, shop_code)
VALUES (
  'shop@demo.railsync.com',
  '$2b$12$LJ3m4ys3Lk8nFmHpEj5JcOQwzRqXBjmNhVzPfGqFzVqJ5y5FvDKu6',
  'Shop',
  'Portal Demo',
  'shop',
  'BNSF Railway Repair',
  NULL  -- Set to a valid shop_code after verifying available shops
)
ON CONFLICT (email) DO NOTHING;
