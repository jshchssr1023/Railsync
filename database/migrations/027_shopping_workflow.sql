-- ============================================================================
-- Migration 027: Shopping Event Workflow
-- Shopping events, SOW library, structured CCM sections, estimates, approvals
-- ============================================================================

-- ============================================================================
-- 1. JOB CODES — Master list of AAR + internal job codes
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('aar', 'internal')),
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_codes_type ON job_codes(code_type);
CREATE INDEX IF NOT EXISTS idx_job_codes_category ON job_codes(category);
CREATE INDEX IF NOT EXISTS idx_job_codes_active ON job_codes(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. SCOPE LIBRARY — Reusable SOW templates (builds organically)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scope_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  car_type VARCHAR(100),
  shopping_type_code VARCHAR(50),
  shopping_reason_code VARCHAR(50),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scope_library_lookup
  ON scope_library(car_type, shopping_type_code, shopping_reason_code);
CREATE INDEX IF NOT EXISTS idx_scope_library_active
  ON scope_library(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_scope_library_usage
  ON scope_library(usage_count DESC);

-- ============================================================================
-- 3. SCOPE LIBRARY ITEMS — Line items in a scope template
-- ============================================================================

CREATE TABLE IF NOT EXISTS scope_library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_library_id UUID NOT NULL REFERENCES scope_library(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  instruction_text TEXT NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'engineering'
    CHECK (source IN ('engineering', 'ccm', 'manual')),
  ccm_section_id UUID,  -- populated if source = 'ccm'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (scope_library_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_scope_library_items_parent
  ON scope_library_items(scope_library_id);

-- ============================================================================
-- 4. SCOPE LIBRARY ITEM CODES — Job codes associated with template items
-- ============================================================================

CREATE TABLE IF NOT EXISTS scope_library_item_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_library_item_id UUID NOT NULL REFERENCES scope_library_items(id) ON DELETE CASCADE,
  job_code_id UUID NOT NULL REFERENCES job_codes(id),
  is_expected BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  UNIQUE (scope_library_item_id, job_code_id)
);

-- ============================================================================
-- 5. SCOPE OF WORK — Instance SOW attached to shopping event(s)
-- ============================================================================

CREATE TABLE IF NOT EXISTS scope_of_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_library_id UUID REFERENCES scope_library(id),  -- template used (nullable)
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'finalized', 'sent')),
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by_id UUID REFERENCES users(id),
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sow_status ON scope_of_work(status);
CREATE INDEX IF NOT EXISTS idx_sow_library ON scope_of_work(scope_library_id);

-- ============================================================================
-- 6. SCOPE OF WORK ITEMS — Line items in an instance SOW
-- ============================================================================

CREATE TABLE IF NOT EXISTS scope_of_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_of_work_id UUID NOT NULL REFERENCES scope_of_work(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  instruction_text TEXT NOT NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('engineering', 'ccm', 'manual', 'library')),
  ccm_section_id UUID,  -- if source = 'ccm'
  scope_library_item_id UUID REFERENCES scope_library_items(id),  -- if source = 'library'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (scope_of_work_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_sow_items_parent ON scope_of_work_items(scope_of_work_id);

-- ============================================================================
-- 7. SCOPE OF WORK ITEM CODES — Job codes on instance SOW items
-- ============================================================================

CREATE TABLE IF NOT EXISTS scope_of_work_item_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_item_id UUID NOT NULL REFERENCES scope_of_work_items(id) ON DELETE CASCADE,
  job_code_id UUID NOT NULL REFERENCES job_codes(id),
  is_expected BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  UNIQUE (sow_item_id, job_code_id)
);

-- ============================================================================
-- 8. CCM SECTIONS — Structured sections within a CCM document
-- Extends existing ccm_documents table with structured, checkable sections
-- ============================================================================

CREATE TABLE IF NOT EXISTS ccm_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccm_document_id UUID NOT NULL REFERENCES ccm_documents(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  content TEXT,
  section_type VARCHAR(50) NOT NULL DEFAULT 'specification'
    CHECK (section_type IN ('specification', 'instruction', 'lessee_matrix', 'special_requirement')),
  can_include_in_sow BOOLEAN NOT NULL DEFAULT TRUE,
  is_lessee_matrix_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (ccm_document_id, section_number)
);

CREATE INDEX IF NOT EXISTS idx_ccm_sections_parent ON ccm_sections(ccm_document_id);
CREATE INDEX IF NOT EXISTS idx_ccm_sections_sow ON ccm_sections(can_include_in_sow) WHERE can_include_in_sow = TRUE;

-- ============================================================================
-- 9. SHOPPING BATCHES — Groups of cars shopped together
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  shop_code VARCHAR(10) REFERENCES shops(shop_code),
  shopping_type_code VARCHAR(50),
  shopping_reason_code VARCHAR(50),
  scope_of_work_id UUID REFERENCES scope_of_work(id),
  notes TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 10. SHOPPING EVENTS — Individual car shop visit tracking (core record)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_number VARCHAR(50) NOT NULL UNIQUE,

  -- Car reference
  car_id UUID,
  car_number VARCHAR(20) NOT NULL,

  -- Shop reference
  shop_code VARCHAR(10) NOT NULL REFERENCES shops(shop_code),

  -- Batch (nullable — for batch-created events)
  batch_id UUID REFERENCES shopping_batches(id),

  -- Link to SSOT assignment (nullable — may be created before or after)
  car_assignment_id UUID REFERENCES car_assignments(id),

  -- State machine
  state VARCHAR(30) NOT NULL DEFAULT 'REQUESTED'
    CHECK (state IN (
      'REQUESTED',
      'ASSIGNED_TO_SHOP',
      'INBOUND',
      'INSPECTION',
      'ESTIMATE_SUBMITTED',
      'ESTIMATE_UNDER_REVIEW',
      'ESTIMATE_APPROVED',
      'CHANGES_REQUIRED',
      'WORK_AUTHORIZED',
      'IN_REPAIR',
      'QA_COMPLETE',
      'FINAL_ESTIMATE_SUBMITTED',
      'FINAL_ESTIMATE_APPROVED',
      'READY_FOR_RELEASE',
      'RELEASED',
      'CANCELLED'
    )),

  -- Shopping classification (references existing shopping_types/reasons)
  shopping_type_code VARCHAR(50),
  shopping_reason_code VARCHAR(50),

  -- Scope of work
  scope_of_work_id UUID REFERENCES scope_of_work(id),

  -- Cancellation
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by_id UUID REFERENCES users(id),
  cancellation_reason TEXT,

  -- Audit
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_se_car ON shopping_events(car_number);
CREATE INDEX IF NOT EXISTS idx_se_car_id ON shopping_events(car_id);
CREATE INDEX IF NOT EXISTS idx_se_shop ON shopping_events(shop_code);
CREATE INDEX IF NOT EXISTS idx_se_state ON shopping_events(state);
CREATE INDEX IF NOT EXISTS idx_se_batch ON shopping_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_se_event_number ON shopping_events(event_number);
CREATE INDEX IF NOT EXISTS idx_se_assignment ON shopping_events(car_assignment_id);
CREATE INDEX IF NOT EXISTS idx_se_created ON shopping_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_se_type_reason ON shopping_events(shopping_type_code, shopping_reason_code);

-- One active (non-terminal) shopping event per car
CREATE UNIQUE INDEX IF NOT EXISTS idx_se_one_active_per_car
  ON shopping_events(car_number)
  WHERE state NOT IN ('RELEASED', 'CANCELLED');

-- ============================================================================
-- 11. SHOPPING EVENT STATE HISTORY — Immutable state transition log
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_event_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_event_id UUID NOT NULL REFERENCES shopping_events(id) ON DELETE CASCADE,
  from_state VARCHAR(30),
  to_state VARCHAR(30) NOT NULL,
  changed_by_id UUID REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sesh_event ON shopping_event_state_history(shopping_event_id);
CREATE INDEX IF NOT EXISTS idx_sesh_changed ON shopping_event_state_history(changed_at DESC);

-- ============================================================================
-- 12. PACKET DOCUMENTS — Files/MFiles links attached to shopping packets
-- Extends existing shopping_packets with structured document tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS packet_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID NOT NULL REFERENCES shopping_packets(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL
    CHECK (document_type IN ('coc', 'drawing', 'ccm', 'scope', 'other')),
  document_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  -- MFiles integration
  mfiles_id VARCHAR(255),
  mfiles_url VARCHAR(500),
  uploaded_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pd_packet ON packet_documents(packet_id);
CREATE INDEX IF NOT EXISTS idx_pd_type ON packet_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_pd_mfiles ON packet_documents(mfiles_id) WHERE mfiles_id IS NOT NULL;

-- ============================================================================
-- 13. ESTIMATE SUBMISSIONS — Versioned shop estimates
-- ============================================================================

CREATE TABLE IF NOT EXISTS estimate_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_event_id UUID NOT NULL REFERENCES shopping_events(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  submitted_by VARCHAR(255),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(30) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'changes_required', 'rejected')),
  total_labor_hours DECIMAL(10,2),
  total_material_cost DECIMAL(12,2),
  total_cost DECIMAL(12,2),
  notes TEXT,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (shopping_event_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_es_event ON estimate_submissions(shopping_event_id);
CREATE INDEX IF NOT EXISTS idx_es_status ON estimate_submissions(status);

-- ============================================================================
-- 14. ESTIMATE LINES — Individual estimate line items
-- ============================================================================

CREATE TABLE IF NOT EXISTS estimate_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_submission_id UUID NOT NULL REFERENCES estimate_submissions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  aar_code VARCHAR(50),
  job_code VARCHAR(50),
  description TEXT,
  labor_hours DECIMAL(8,2),
  material_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  -- Link back to SOW instruction this line addresses
  sow_item_id UUID REFERENCES scope_of_work_items(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (estimate_submission_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_el_submission ON estimate_lines(estimate_submission_id);
CREATE INDEX IF NOT EXISTS idx_el_sow_item ON estimate_lines(sow_item_id) WHERE sow_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_el_job_code ON estimate_lines(job_code);

-- ============================================================================
-- 15. ESTIMATE LINE DECISIONS — IMMUTABLE decision records
-- Never overwritten. Each decision is a new INSERT.
-- ============================================================================

CREATE TABLE IF NOT EXISTS estimate_line_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_line_id UUID NOT NULL REFERENCES estimate_lines(id) ON DELETE CASCADE,

  -- Source
  decision_source VARCHAR(10) NOT NULL CHECK (decision_source IN ('ai', 'human')),

  -- Decision
  decision VARCHAR(10) NOT NULL CHECK (decision IN ('approve', 'review', 'reject')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Responsibility allocation
  responsibility VARCHAR(10) NOT NULL DEFAULT 'unknown'
    CHECK (responsibility IN ('lessor', 'customer', 'unknown')),
  basis_type VARCHAR(30) CHECK (basis_type IN ('cri_table', 'lease_clause', 'policy', 'manual')),
  basis_reference VARCHAR(255),

  -- Notes & context
  decision_notes TEXT,
  model_version VARCHAR(50),   -- AI model version (nullable for human)
  policy_version VARCHAR(50),  -- policy version reference

  -- Who decided
  decided_by_id UUID REFERENCES users(id),
  decided_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Created = decided (for consistency with other tables)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eld_line ON estimate_line_decisions(estimate_line_id);
CREATE INDEX IF NOT EXISTS idx_eld_source ON estimate_line_decisions(decision_source);
CREATE INDEX IF NOT EXISTS idx_eld_decision ON estimate_line_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_eld_decided ON estimate_line_decisions(decided_at DESC);

-- ============================================================================
-- 16. APPROVAL PACKETS — Official decision sent back to shop
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_submission_id UUID NOT NULL REFERENCES estimate_submissions(id),
  overall_decision VARCHAR(20) NOT NULL
    CHECK (overall_decision IN ('approved', 'changes_required', 'rejected')),
  approved_line_ids UUID[],
  rejected_line_ids UUID[],
  revision_required_line_ids UUID[],
  notes TEXT,
  released_to_shop_at TIMESTAMP WITH TIME ZONE,
  released_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ap_estimate ON approval_packets(estimate_submission_id);
CREATE INDEX IF NOT EXISTS idx_ap_decision ON approval_packets(overall_decision);

-- ============================================================================
-- LINK: Add shopping_event_id to existing shopping_packets table
-- Shopping packets can now reference shopping events directly
-- ============================================================================

ALTER TABLE shopping_packets ADD COLUMN IF NOT EXISTS shopping_event_id UUID REFERENCES shopping_events(id);
ALTER TABLE shopping_packets ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES shopping_batches(id);
ALTER TABLE shopping_packets ADD COLUMN IF NOT EXISTS scope_of_work_id UUID REFERENCES scope_of_work(id);

CREATE INDEX IF NOT EXISTS idx_sp_shopping_event ON shopping_packets(shopping_event_id);
CREATE INDEX IF NOT EXISTS idx_sp_batch ON shopping_packets(batch_id);

-- ============================================================================
-- STATE MACHINE ENFORCEMENT — Trigger to validate transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_shopping_event_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "REQUESTED": ["ASSIGNED_TO_SHOP", "CANCELLED"],
    "ASSIGNED_TO_SHOP": ["INBOUND", "CANCELLED"],
    "INBOUND": ["INSPECTION", "CANCELLED"],
    "INSPECTION": ["ESTIMATE_SUBMITTED", "CANCELLED"],
    "ESTIMATE_SUBMITTED": ["ESTIMATE_UNDER_REVIEW", "CANCELLED"],
    "ESTIMATE_UNDER_REVIEW": ["ESTIMATE_APPROVED", "CHANGES_REQUIRED", "CANCELLED"],
    "CHANGES_REQUIRED": ["ESTIMATE_SUBMITTED", "CANCELLED"],
    "ESTIMATE_APPROVED": ["WORK_AUTHORIZED", "CANCELLED"],
    "WORK_AUTHORIZED": ["IN_REPAIR", "CANCELLED"],
    "IN_REPAIR": ["QA_COMPLETE", "CANCELLED"],
    "QA_COMPLETE": ["FINAL_ESTIMATE_SUBMITTED", "CANCELLED"],
    "FINAL_ESTIMATE_SUBMITTED": ["FINAL_ESTIMATE_APPROVED", "CANCELLED"],
    "FINAL_ESTIMATE_APPROVED": ["READY_FOR_RELEASE", "CANCELLED"],
    "READY_FOR_RELEASE": ["RELEASED", "CANCELLED"]
  }'::JSONB;
  allowed_next JSONB;
BEGIN
  -- Skip if state not changing
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;

  -- Cannot transition from terminal states
  IF OLD.state IN ('RELEASED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state: %', OLD.state;
  END IF;

  -- Cancellation requires a reason
  IF NEW.state = 'CANCELLED' AND (NEW.cancellation_reason IS NULL OR NEW.cancellation_reason = '') THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  -- Check valid transitions
  allowed_next := valid_transitions -> OLD.state;
  IF allowed_next IS NULL OR NOT allowed_next ? NEW.state THEN
    RAISE EXCEPTION 'Invalid state transition: % -> %', OLD.state, NEW.state;
  END IF;

  -- Auto-set timestamps
  IF NEW.state = 'CANCELLED' THEN
    NEW.cancelled_at := NOW();
  END IF;

  -- Increment version
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_shopping_event_state
  BEFORE UPDATE OF state ON shopping_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_shopping_event_state_transition();

-- ============================================================================
-- STATE HISTORY LOGGING — Auto-log state transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION log_shopping_event_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM NEW.state THEN
    INSERT INTO shopping_event_state_history (
      shopping_event_id, from_state, to_state, changed_by_id, notes
    ) VALUES (
      NEW.id, OLD.state, NEW.state, NEW.updated_by_id, NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_shopping_event_state_log
  AFTER UPDATE OF state ON shopping_events
  FOR EACH ROW
  EXECUTE FUNCTION log_shopping_event_state_change();

-- Log initial state on insert
CREATE OR REPLACE FUNCTION log_shopping_event_initial_state()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO shopping_event_state_history (
    shopping_event_id, from_state, to_state, changed_by_id
  ) VALUES (
    NEW.id, NULL, NEW.state, NEW.created_by_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_shopping_event_initial_state
  AFTER INSERT ON shopping_events
  FOR EACH ROW
  EXECUTE FUNCTION log_shopping_event_initial_state();

-- ============================================================================
-- IMMUTABILITY GUARD — Prevent updates on estimate_line_decisions
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_decision_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'estimate_line_decisions records are immutable and cannot be updated';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_prevent_decision_update
  BEFORE UPDATE ON estimate_line_decisions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_decision_update();

-- ============================================================================
-- SOW FINALIZATION GUARD — Prevent modifications to finalized SOWs
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_finalized_sow_item_change()
RETURNS TRIGGER AS $$
DECLARE
  sow_status VARCHAR;
BEGIN
  SELECT status INTO sow_status FROM scope_of_work
  WHERE id = COALESCE(NEW.scope_of_work_id, OLD.scope_of_work_id);

  IF sow_status IN ('finalized', 'sent') THEN
    RAISE EXCEPTION 'Cannot modify items on a finalized scope of work';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sow_item_finalized_guard
  BEFORE INSERT OR UPDATE OR DELETE ON scope_of_work_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_finalized_sow_item_change();

-- ============================================================================
-- BATCH NUMBER GENERATOR
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS VARCHAR(50) AS $$
BEGIN
  RETURN 'BATCH-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(
    (SELECT COALESCE(MAX(SUBSTRING(batch_number FROM '\d{4}$')::INT), 0) + 1
     FROM shopping_batches
     WHERE batch_number LIKE 'BATCH-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%')::TEXT,
    4, '0'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EVENT NUMBER GENERATOR
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_event_number()
RETURNS VARCHAR(50) AS $$
BEGIN
  RETURN 'SE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(
    (SELECT COALESCE(MAX(SUBSTRING(event_number FROM '\d{5}$')::INT), 0) + 1
     FROM shopping_events
     WHERE event_number LIKE 'SE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%')::TEXT,
    5, '0'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Shopping events with car and shop details
CREATE OR REPLACE VIEW v_shopping_events AS
SELECT
  se.*,
  s.shop_name,
  s.region AS shop_region,
  c.material_type AS car_material_type,
  c.car_type AS car_car_type,
  c.lessee_code,
  c.lessee_name,
  c.commodity,
  st.name AS shopping_type_name,
  sr.name AS shopping_reason_name,
  sb.batch_number,
  (SELECT COUNT(*) FROM estimate_submissions es WHERE es.shopping_event_id = se.id) AS estimate_count,
  (SELECT MAX(version_number) FROM estimate_submissions es WHERE es.shopping_event_id = se.id) AS latest_estimate_version,
  u.email AS created_by_email
FROM shopping_events se
LEFT JOIN shops s ON s.shop_code = se.shop_code
LEFT JOIN cars c ON c.car_number = se.car_number
LEFT JOIN shopping_types st ON st.code = se.shopping_type_code
LEFT JOIN shopping_reasons sr ON sr.code = se.shopping_reason_code
LEFT JOIN shopping_batches sb ON sb.id = se.batch_id
LEFT JOIN users u ON u.id = se.created_by_id;

-- Active shopping events (non-terminal)
CREATE OR REPLACE VIEW v_active_shopping_events AS
SELECT * FROM v_shopping_events
WHERE state NOT IN ('RELEASED', 'CANCELLED')
ORDER BY created_at DESC;

-- Shopping events by car (history)
CREATE OR REPLACE VIEW v_car_shopping_history AS
SELECT
  se.car_number,
  se.id AS shopping_event_id,
  se.event_number,
  se.shop_code,
  s.shop_name,
  se.state,
  se.shopping_type_code,
  se.shopping_reason_code,
  st.name AS shopping_type_name,
  sr.name AS shopping_reason_name,
  se.scope_of_work_id,
  se.created_at,
  se.updated_at,
  (SELECT COUNT(*) FROM estimate_submissions es WHERE es.shopping_event_id = se.id) AS estimate_count,
  (SELECT es.total_cost FROM estimate_submissions es
   WHERE es.shopping_event_id = se.id AND es.status = 'approved'
   ORDER BY es.version_number DESC LIMIT 1) AS approved_cost
FROM shopping_events se
LEFT JOIN shops s ON s.shop_code = se.shop_code
LEFT JOIN shopping_types st ON st.code = se.shopping_type_code
LEFT JOIN shopping_reasons sr ON sr.code = se.shopping_reason_code
ORDER BY se.car_number, se.created_at DESC;

-- Estimate review view with decisions
CREATE OR REPLACE VIEW v_estimate_review AS
SELECT
  el.id AS line_id,
  el.estimate_submission_id,
  el.line_number,
  el.aar_code,
  el.job_code,
  el.description,
  el.labor_hours,
  el.material_cost,
  el.total_cost,
  el.sow_item_id,
  sowi.instruction_text AS sow_instruction,
  es.shopping_event_id,
  es.version_number AS estimate_version,
  es.status AS estimate_status,
  -- Latest decision for this line
  eld.decision AS latest_decision,
  eld.decision_source AS latest_decision_source,
  eld.responsibility AS latest_responsibility,
  eld.confidence_score AS latest_confidence,
  eld.decided_at AS latest_decided_at,
  -- Decision counts
  (SELECT COUNT(*) FROM estimate_line_decisions d WHERE d.estimate_line_id = el.id) AS decision_count,
  (SELECT COUNT(*) FROM estimate_line_decisions d WHERE d.estimate_line_id = el.id AND d.decision_source = 'ai') AS ai_decision_count,
  (SELECT COUNT(*) FROM estimate_line_decisions d WHERE d.estimate_line_id = el.id AND d.decision_source = 'human') AS human_decision_count
FROM estimate_lines el
JOIN estimate_submissions es ON es.id = el.estimate_submission_id
LEFT JOIN scope_of_work_items sowi ON sowi.id = el.sow_item_id
LEFT JOIN LATERAL (
  SELECT * FROM estimate_line_decisions d
  WHERE d.estimate_line_id = el.id
  ORDER BY d.decided_at DESC
  LIMIT 1
) eld ON TRUE;

-- Scope library with item counts
CREATE OR REPLACE VIEW v_scope_library AS
SELECT
  sl.*,
  st.name AS shopping_type_name,
  sr.name AS shopping_reason_name,
  (SELECT COUNT(*) FROM scope_library_items sli WHERE sli.scope_library_id = sl.id) AS item_count,
  u.email AS created_by_email
FROM scope_library sl
LEFT JOIN shopping_types st ON st.code = sl.shopping_type_code
LEFT JOIN shopping_reasons sr ON sr.code = sl.shopping_reason_code
LEFT JOIN users u ON u.id = sl.created_by_id
WHERE sl.is_active = TRUE
ORDER BY sl.usage_count DESC, sl.name;

-- CCM sections available for SOW inclusion
CREATE OR REPLACE VIEW v_ccm_sections_for_sow AS
SELECT
  cs.*,
  cd.lessee_code,
  cd.lessee_name,
  cd.document_name AS ccm_document_name
FROM ccm_sections cs
JOIN ccm_documents cd ON cd.id = cs.ccm_document_id
WHERE cs.can_include_in_sow = TRUE
  AND cd.is_current = TRUE
ORDER BY cd.lessee_code, cs.section_number;

-- ============================================================================
-- SEED DATA: Common AAR Job Codes
-- ============================================================================

INSERT INTO job_codes (code, code_type, description, category) VALUES
-- Tank car work
('T01', 'aar', 'Tank Interior Cleaning', 'Cleaning'),
('T02', 'aar', 'Tank Interior Blast', 'Cleaning'),
('T03', 'aar', 'Tank Interior Lining - Apply', 'Lining'),
('T04', 'aar', 'Tank Interior Lining - Remove', 'Lining'),
('T05', 'aar', 'Tank Exterior Paint', 'Paint'),
('T06', 'aar', 'Tank Shell Repair', 'Structural'),
('T07', 'aar', 'Tank Head Repair', 'Structural'),
('T08', 'aar', 'Tank Qualification Test', 'Qualification'),
('T09', 'aar', 'Hydrostatic Test', 'Qualification'),
('T10', 'aar', 'Ultrasonic Test', 'Qualification'),
-- Valve and fittings
('V01', 'aar', 'Bottom Outlet Valve - Repair', 'Valves'),
('V02', 'aar', 'Bottom Outlet Valve - Replace', 'Valves'),
('V03', 'aar', 'Safety Relief Valve - Test', 'Valves'),
('V04', 'aar', 'Safety Relief Valve - Replace', 'Valves'),
('V05', 'aar', 'Top Fittings Overhaul', 'Valves'),
('V06', 'aar', 'Manway Gasket Replace', 'Valves'),
-- Running gear
('R01', 'aar', 'Truck Overhaul', 'Running Gear'),
('R02', 'aar', 'Wheel Set Replace', 'Running Gear'),
('R03', 'aar', 'Coupler Repair', 'Running Gear'),
('R04', 'aar', 'Draft Gear Replace', 'Running Gear'),
('R05', 'aar', 'Air Brake Overhaul', 'Running Gear'),
-- Miscellaneous
('M01', 'aar', 'Stenciling', 'Miscellaneous'),
('M02', 'aar', 'Asbestos Abatement', 'Miscellaneous'),
('M03', 'aar', 'Insulation Repair', 'Miscellaneous'),
('M04', 'aar', 'Heater Coil Repair', 'Miscellaneous'),
('M05', 'aar', 'Thermal Protection Repair', 'Miscellaneous')
ON CONFLICT (code) DO NOTHING;

-- Sample internal codes
INSERT INTO job_codes (code, code_type, description, category) VALUES
('INT-CLEAN-STD', 'internal', 'Standard Interior Cleaning', 'Cleaning'),
('INT-CLEAN-KOSHER', 'internal', 'Kosher Cleaning Protocol', 'Cleaning'),
('INT-CLEAN-HAZMAT', 'internal', 'Hazmat Decontamination', 'Cleaning'),
('INT-INSP-PRE', 'internal', 'Pre-Work Inspection', 'Inspection'),
('INT-INSP-POST', 'internal', 'Post-Work Inspection', 'Inspection'),
('INT-INSP-QA', 'internal', 'QA Final Inspection', 'Inspection'),
('INT-DOC-PHOTO', 'internal', 'Photo Documentation', 'Documentation'),
('INT-DOC-REPORT', 'internal', 'Repair Report Generation', 'Documentation'),
('INT-FREIGHT-IN', 'internal', 'Inbound Freight / Switching', 'Freight'),
('INT-FREIGHT-OUT', 'internal', 'Outbound Freight / Switching', 'Freight')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SEED DATA: Sample Scope Library Entries
-- ============================================================================

INSERT INTO scope_library (name, car_type, shopping_type_code, shopping_reason_code, description, created_by_id)
SELECT
  'Tank Car 10-Year Qualification',
  'Tank',
  'QUAL_REG',
  'QUAL_TANK_10YR',
  'Standard scope for 10-year tank qualification including hydrostatic test, valve overhaul, exterior paint, and stenciling.',
  u.id
FROM users u WHERE u.email = 'admin@railsync.com'
LIMIT 1;

INSERT INTO scope_library_items (scope_library_id, line_number, instruction_text, source)
SELECT sl.id, items.line_number, items.instruction_text, 'engineering'
FROM scope_library sl
CROSS JOIN (VALUES
  (1, 'Receive car and perform pre-work inspection. Document condition with photos.'),
  (2, 'Clean tank interior per commodity requirements.'),
  (3, 'Perform interior blast to white metal per SSPC-SP5.'),
  (4, 'Inspect shell and heads for defects. UT test minimum thickness per AAR.'),
  (5, 'Perform hydrostatic test per 49 CFR 180.509.'),
  (6, 'Overhaul all valves and fittings. Replace gaskets.'),
  (7, 'Test and recertify safety relief valve.'),
  (8, 'Apply interior lining per specification (if required).'),
  (9, 'Blast and paint exterior per customer specification.'),
  (10, 'Apply stenciling and markings per AAR and customer requirements.'),
  (11, 'Perform final QA inspection and generate qualification documentation.'),
  (12, 'Outbound freight coordination.')
) AS items(line_number, instruction_text)
WHERE sl.name = 'Tank Car 10-Year Qualification';

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all new tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'job_codes', 'scope_library', 'scope_library_items',
    'scope_of_work', 'scope_of_work_items', 'ccm_sections',
    'shopping_batches', 'estimate_submissions'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I; CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;
