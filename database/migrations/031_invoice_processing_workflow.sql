-- Migration 031: Invoice Processing Workflow
-- Implements InvoiceCase, Attachments, AuditEvents, and Workflow State Machine
-- Per spec: docs/design/Railsync_Invoice_Processing_Complete_Spec.md

-- ==============================================================================
-- SECTION 1: Workflow States Enum
-- ==============================================================================

-- Drop existing enum if it exists (for idempotency)
DO $$ BEGIN
    CREATE TYPE invoice_workflow_state AS ENUM (
        'RECEIVED',
        'ASSIGNED',
        'WAITING_ON_SHOPPING',
        'WAITING_ON_CUSTOMER_APPROVAL',
        'READY_FOR_IMPORT',
        'IMPORTED',
        'ADMIN_REVIEW',
        'SUBMITTED',
        'APPROVER_REVIEW',
        'APPROVED',
        'BILLING_REVIEW',
        'BILLING_APPROVED',
        'SAP_STAGED',
        'SAP_POSTED',
        'PAID',
        'CLOSED',
        'BLOCKED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Invoice type enum
DO $$ BEGIN
    CREATE TYPE invoice_type AS ENUM (
        'SHOP',
        'MRU'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Attachment type enum
DO $$ BEGIN
    CREATE TYPE attachment_type AS ENUM (
        'PDF',
        'TXT',
        'SUPPORT',
        'BRC'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Validation decision type
DO $$ BEGIN
    CREATE TYPE validation_decision AS ENUM (
        'BLOCK',
        'WARN',
        'PASS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- SECTION 2: Special Lessees Reference Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS special_lessees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lessee_code VARCHAR(50) UNIQUE NOT NULL,
    lessee_name VARCHAR(255) NOT NULL,
    requires_maintenance_approval BOOLEAN DEFAULT true,
    approval_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed special lessees per spec
INSERT INTO special_lessees (lessee_code, lessee_name, requires_maintenance_approval, approval_notes)
VALUES
    ('EXXON', 'ExxonMobil', true, 'Requires Maintenance confirmation before processing'),
    ('IMPOIL', 'Imperial Oil', true, 'Requires Maintenance confirmation before processing'),
    ('MARATHON', 'Marathon', true, 'Requires Maintenance confirmation before processing')
ON CONFLICT (lessee_code) DO NOTHING;

-- ==============================================================================
-- SECTION 3: Invoice Cases Table (extends invoices with case management)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to base invoice (optional - can create case before invoice parsed)
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

    -- Case identification
    case_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_type invoice_type NOT NULL DEFAULT 'SHOP',

    -- Workflow state
    workflow_state invoice_workflow_state NOT NULL DEFAULT 'RECEIVED',
    previous_state invoice_workflow_state,
    state_changed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Assignment
    assigned_admin_id UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,

    -- Vendor/Shop info (denormalized for quick access)
    vendor_name VARCHAR(255),
    shop_id UUID,
    shop_code VARCHAR(20),

    -- Invoice details
    invoice_number VARCHAR(100),
    invoice_date DATE,
    currency VARCHAR(3) DEFAULT 'USD',
    total_amount DECIMAL(14,2),

    -- Car marks (array of car numbers on this invoice)
    car_marks TEXT[],

    -- Lessee info
    lessee VARCHAR(100),
    special_lessee_approval_confirmed BOOLEAN DEFAULT false,
    special_lessee_approved_by UUID REFERENCES users(id),
    special_lessee_approved_at TIMESTAMPTZ,

    -- FMS integration
    fms_shopping_id VARCHAR(100),
    fms_workflow_id VARCHAR(100),

    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- Indexes for invoice_cases
CREATE INDEX IF NOT EXISTS idx_invoice_cases_workflow_state ON invoice_cases(workflow_state);
CREATE INDEX IF NOT EXISTS idx_invoice_cases_assigned_admin ON invoice_cases(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_invoice_cases_invoice_id ON invoice_cases(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_cases_case_number ON invoice_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_invoice_cases_lessee ON invoice_cases(lessee);
CREATE INDEX IF NOT EXISTS idx_invoice_cases_shop_code ON invoice_cases(shop_code);

-- ==============================================================================
-- SECTION 4: Invoice Attachments Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_case_id UUID NOT NULL REFERENCES invoice_cases(id) ON DELETE CASCADE,

    -- Attachment type
    attachment_type attachment_type NOT NULL,

    -- File info
    filename_original VARCHAR(500) NOT NULL,
    filename_canonical VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size_bytes INTEGER,
    mime_type VARCHAR(100),

    -- Integrity
    file_hash VARCHAR(64), -- SHA-256

    -- Status
    is_required BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,

    -- Timestamps
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_case ON invoice_attachments(invoice_case_id);
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_type ON invoice_attachments(attachment_type);

-- ==============================================================================
-- SECTION 5: Invoice Audit Events (Immutable Log)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_case_id UUID NOT NULL REFERENCES invoice_cases(id) ON DELETE CASCADE,

    -- Event details
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id UUID REFERENCES users(id),
    actor_email VARCHAR(255),
    actor_role VARCHAR(50),

    -- Action
    action VARCHAR(100) NOT NULL,

    -- State change
    before_state invoice_workflow_state,
    after_state invoice_workflow_state,

    -- Data
    event_data JSONB,
    notes TEXT,

    -- Validation context (if action was blocked/warned)
    validation_result JSONB,

    -- Request context
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100)
);

-- Make audit events append-only (no updates or deletes)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Invoice audit events are immutable and cannot be modified or deleted';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_update ON invoice_audit_events;
CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE OR DELETE ON invoice_audit_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- Indexes for audit events
CREATE INDEX IF NOT EXISTS idx_invoice_audit_case ON invoice_audit_events(invoice_case_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_timestamp ON invoice_audit_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_action ON invoice_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_actor ON invoice_audit_events(actor_id);

-- ==============================================================================
-- SECTION 6: Validation Results Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_case_id UUID NOT NULL REFERENCES invoice_cases(id) ON DELETE CASCADE,

    -- Validation run
    validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_by UUID REFERENCES users(id),
    target_state invoice_workflow_state,

    -- Results
    can_transition BOOLEAN NOT NULL DEFAULT false,
    blocking_errors JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',

    -- Full validation context
    validation_context JSONB,

    -- Expiry (validation results may become stale)
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_validation_results_case ON invoice_validation_results(invoice_case_id);

-- ==============================================================================
-- SECTION 7: State Transition Rules Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_state invoice_workflow_state NOT NULL,
    to_state invoice_workflow_state NOT NULL,
    required_role VARCHAR(50),
    requires_validation BOOLEAN DEFAULT true,
    is_allowed BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(from_state, to_state)
);

-- Seed valid state transitions per spec
INSERT INTO invoice_state_transitions (from_state, to_state, required_role, requires_validation, notes) VALUES
    -- Initial flow
    ('RECEIVED', 'ASSIGNED', 'admin', true, 'Admin assigns case to themselves or another admin'),
    ('ASSIGNED', 'WAITING_ON_SHOPPING', 'admin', true, 'Shopping required before processing'),
    ('ASSIGNED', 'WAITING_ON_CUSTOMER_APPROVAL', 'admin', true, 'Special lessee requires approval'),
    ('ASSIGNED', 'READY_FOR_IMPORT', 'admin', true, 'All validations pass'),

    -- Shopping flow
    ('WAITING_ON_SHOPPING', 'ASSIGNED', 'admin', true, 'Shopping completed, return to admin'),
    ('WAITING_ON_SHOPPING', 'BLOCKED', 'system', false, 'Shopping blocked the invoice'),

    -- Customer approval flow
    ('WAITING_ON_CUSTOMER_APPROVAL', 'ASSIGNED', 'admin', true, 'Approval received'),
    ('WAITING_ON_CUSTOMER_APPROVAL', 'BLOCKED', 'system', false, 'Customer rejected'),

    -- Import flow
    ('READY_FOR_IMPORT', 'IMPORTED', 'admin', true, 'Invoice imported to system'),
    ('IMPORTED', 'ADMIN_REVIEW', 'admin', true, 'Admin reviews imported data'),
    ('ADMIN_REVIEW', 'SUBMITTED', 'admin', true, 'Admin submits for approval'),

    -- Approval flow
    ('SUBMITTED', 'APPROVER_REVIEW', 'approver', true, 'Approver begins review'),
    ('APPROVER_REVIEW', 'APPROVED', 'approver', true, 'Approver approves'),
    ('APPROVER_REVIEW', 'ADMIN_REVIEW', 'approver', false, 'Approver returns to admin'),

    -- Billing flow
    ('APPROVED', 'BILLING_REVIEW', 'billing', true, 'Billing review begins'),
    ('BILLING_REVIEW', 'BILLING_APPROVED', 'billing', true, 'Billing approves'),
    ('BILLING_REVIEW', 'APPROVER_REVIEW', 'billing', false, 'Billing returns to approver'),

    -- SAP flow
    ('BILLING_APPROVED', 'SAP_STAGED', 'system', true, 'Staged for SAP posting'),
    ('SAP_STAGED', 'SAP_POSTED', 'system', true, 'Posted to SAP'),
    ('SAP_POSTED', 'PAID', 'system', true, 'Payment confirmed'),
    ('PAID', 'CLOSED', 'admin', false, 'Case closed'),

    -- Block flow (any state can go to blocked)
    ('RECEIVED', 'BLOCKED', 'system', false, 'Validation blocked'),
    ('ASSIGNED', 'BLOCKED', 'system', false, 'Validation blocked'),
    ('ADMIN_REVIEW', 'BLOCKED', 'system', false, 'Validation blocked'),
    ('SUBMITTED', 'BLOCKED', 'system', false, 'Validation blocked'),
    ('APPROVER_REVIEW', 'BLOCKED', 'system', false, 'Validation blocked'),
    ('BILLING_REVIEW', 'BLOCKED', 'system', false, 'Validation blocked'),

    -- Unblock flow
    ('BLOCKED', 'ASSIGNED', 'admin', true, 'Block resolved, return to admin')
ON CONFLICT (from_state, to_state) DO NOTHING;

-- ==============================================================================
-- SECTION 8: Responsibility Code Normalization Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS responsibility_code_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code VARCHAR(10) NOT NULL,
    normalized_code VARCHAR(10) NOT NULL,
    description TEXT,
    UNIQUE(source_code)
);

-- Seed responsibility mappings per spec
INSERT INTO responsibility_code_mappings (source_code, normalized_code, description) VALUES
    ('7', '1', 'Code 7 normalizes to Lessor (1)'),
    ('4', '1', 'Code 4 normalizes to Lessor (1)'),
    ('0', '1', 'Code 0 normalizes to Lessor (1)'),
    ('W', '1', 'Code W normalizes to Lessor (1)'),
    ('8', '9', 'Code 8 equivalent to Code 9'),
    ('9', '9', 'Code 9 stays as 9')
ON CONFLICT (source_code) DO NOTHING;

-- ==============================================================================
-- SECTION 9: Month-End Cutoff Dates Table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS invoice_cutoff_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
    entry_cutoff_date DATE NOT NULL,
    approval_cutoff_date DATE NOT NULL,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(fiscal_year, fiscal_month)
);

-- ==============================================================================
-- SECTION 10: State Transition Enforcement Trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION enforce_invoice_state_transition()
RETURNS TRIGGER AS $$
DECLARE
    transition_allowed BOOLEAN;
    transition_role VARCHAR(50);
BEGIN
    -- Skip if state hasn't changed
    IF OLD.workflow_state = NEW.workflow_state THEN
        RETURN NEW;
    END IF;

    -- Check if transition is allowed
    SELECT is_allowed, required_role INTO transition_allowed, transition_role
    FROM invoice_state_transitions
    WHERE from_state = OLD.workflow_state AND to_state = NEW.workflow_state;

    IF transition_allowed IS NULL THEN
        RAISE EXCEPTION 'Invalid state transition from % to %', OLD.workflow_state, NEW.workflow_state;
    END IF;

    IF NOT transition_allowed THEN
        RAISE EXCEPTION 'State transition from % to % is not allowed', OLD.workflow_state, NEW.workflow_state;
    END IF;

    -- Update state tracking fields
    NEW.previous_state := OLD.workflow_state;
    NEW.state_changed_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_state_transition ON invoice_cases;
CREATE TRIGGER enforce_state_transition
    BEFORE UPDATE ON invoice_cases
    FOR EACH ROW
    EXECUTE FUNCTION enforce_invoice_state_transition();

-- ==============================================================================
-- SECTION 11: Auto-generate Case Number Trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_case_number()
RETURNS TRIGGER AS $$
DECLARE
    year_prefix VARCHAR(4);
    seq_num INTEGER;
BEGIN
    year_prefix := TO_CHAR(NOW(), 'YYYY');

    -- Get next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 6) AS INTEGER)), 0) + 1
    INTO seq_num
    FROM invoice_cases
    WHERE case_number LIKE year_prefix || '-%';

    NEW.case_number := year_prefix || '-' || LPAD(seq_num::TEXT, 6, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_case_number ON invoice_cases;
CREATE TRIGGER auto_case_number
    BEFORE INSERT ON invoice_cases
    FOR EACH ROW
    WHEN (NEW.case_number IS NULL OR NEW.case_number = '')
    EXECUTE FUNCTION generate_invoice_case_number();

-- ==============================================================================
-- SECTION 12: Views
-- ==============================================================================

-- Invoice case summary view
CREATE OR REPLACE VIEW v_invoice_case_summary AS
SELECT
    ic.id,
    ic.case_number,
    ic.invoice_type,
    ic.workflow_state,
    ic.previous_state,
    ic.state_changed_at,
    ic.vendor_name,
    ic.shop_code,
    ic.invoice_number,
    ic.invoice_date,
    ic.total_amount,
    ic.currency,
    ic.lessee,
    ic.car_marks,
    ic.received_at,
    ic.created_at,
    -- Assigned admin
    ic.assigned_admin_id,
    u.email AS assigned_admin_email,
    u.display_name AS assigned_admin_name,
    -- Special lessee status
    ic.special_lessee_approval_confirmed,
    sl.lessee_name AS special_lessee_name,
    sl.requires_maintenance_approval AS special_lessee_requires_approval,
    -- Attachment counts
    (SELECT COUNT(*) FROM invoice_attachments ia WHERE ia.invoice_case_id = ic.id AND ia.attachment_type = 'PDF') AS pdf_count,
    (SELECT COUNT(*) FROM invoice_attachments ia WHERE ia.invoice_case_id = ic.id AND ia.attachment_type = 'TXT') AS txt_count,
    -- Has required files
    EXISTS(SELECT 1 FROM invoice_attachments ia WHERE ia.invoice_case_id = ic.id AND ia.attachment_type = 'PDF') AS has_pdf,
    EXISTS(SELECT 1 FROM invoice_attachments ia WHERE ia.invoice_case_id = ic.id AND ia.attachment_type = 'TXT') AS has_txt,
    -- Latest validation result
    (SELECT can_transition FROM invoice_validation_results ivr
     WHERE ivr.invoice_case_id = ic.id
     ORDER BY validated_at DESC LIMIT 1) AS last_validation_passed
FROM invoice_cases ic
LEFT JOIN users u ON ic.assigned_admin_id = u.id
LEFT JOIN special_lessees sl ON ic.lessee = sl.lessee_code;

-- Audit trail view
CREATE OR REPLACE VIEW v_invoice_audit_trail AS
SELECT
    iae.id,
    iae.invoice_case_id,
    ic.case_number,
    iae.event_timestamp,
    iae.actor_email,
    iae.actor_role,
    iae.action,
    iae.before_state,
    iae.after_state,
    iae.notes,
    iae.validation_result
FROM invoice_audit_events iae
JOIN invoice_cases ic ON iae.invoice_case_id = ic.id
ORDER BY iae.event_timestamp DESC;

-- Cases by state view (for dashboard)
CREATE OR REPLACE VIEW v_invoice_cases_by_state AS
SELECT
    workflow_state,
    COUNT(*) AS case_count,
    SUM(total_amount) AS total_amount,
    MIN(received_at) AS oldest_case
FROM invoice_cases
GROUP BY workflow_state
ORDER BY workflow_state;

-- ==============================================================================
-- SECTION 13: Update timestamp trigger for invoice_cases
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_invoice_case_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_case_timestamp ON invoice_cases;
CREATE TRIGGER update_invoice_case_timestamp
    BEFORE UPDATE ON invoice_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_case_timestamp();

-- ==============================================================================
-- SECTION 14: Grants
-- ==============================================================================

-- Grant permissions (adjust as needed for your roles)
GRANT SELECT, INSERT, UPDATE ON invoice_cases TO railsync_app;
GRANT SELECT, INSERT ON invoice_attachments TO railsync_app;
GRANT SELECT, INSERT ON invoice_audit_events TO railsync_app;
GRANT SELECT, INSERT ON invoice_validation_results TO railsync_app;
GRANT SELECT ON invoice_state_transitions TO railsync_app;
GRANT SELECT ON special_lessees TO railsync_app;
GRANT SELECT ON responsibility_code_mappings TO railsync_app;
GRANT SELECT, INSERT, UPDATE ON invoice_cutoff_dates TO railsync_app;
GRANT SELECT ON v_invoice_case_summary TO railsync_app;
GRANT SELECT ON v_invoice_audit_trail TO railsync_app;
GRANT SELECT ON v_invoice_cases_by_state TO railsync_app;

-- ==============================================================================
-- Migration complete
-- ==============================================================================
