-- Migration 032: Fix v_invoice_case_summary view and create railsync_app role
-- Fixes errors from migration 031:
--   1. u.display_name → first_name || last_name (users table has no display_name column)
--   2. railsync_app role did not exist → create it conditionally
--   3. v_invoice_case_summary view failed → recreate with correct column reference
--   4. All GRANT statements failed → re-run after role + view exist

-- ==============================================================================
-- SECTION 1: Create railsync_app role (if it doesn't exist)
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'railsync_app') THEN
        CREATE ROLE railsync_app WITH LOGIN;
        RAISE NOTICE 'Created role railsync_app';
    ELSE
        RAISE NOTICE 'Role railsync_app already exists';
    END IF;
END $$;

-- ==============================================================================
-- SECTION 2: Fix v_invoice_case_summary view
-- ==============================================================================

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
    -- Assigned admin (fixed: use first_name || last_name instead of display_name)
    ic.assigned_admin_id,
    u.email AS assigned_admin_email,
    TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS assigned_admin_name,
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

-- ==============================================================================
-- SECTION 3: Re-run all GRANT statements (now that role + view exist)
-- ==============================================================================

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
-- Migration 032 complete
-- ==============================================================================
