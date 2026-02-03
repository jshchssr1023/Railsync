-- Migration 024: Invoice Management Module
-- Handles shop invoice ingestion, BRC comparison, and approval workflow

-- Invoice header
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL,
    vendor_code VARCHAR(20),
    shop_code VARCHAR(20) REFERENCES shops(shop_code),
    invoice_date DATE NOT NULL,
    received_date DATE DEFAULT CURRENT_DATE,

    -- Amounts
    invoice_total DECIMAL(12,2) NOT NULL,
    brc_total DECIMAL(12,2),
    variance_amount DECIMAL(12,2),
    variance_pct DECIMAL(5,2),

    -- Status workflow: pending → auto_approved/manual_review → approved/rejected → sent_to_sap
    status VARCHAR(20) NOT NULL DEFAULT 'pending',

    -- Matching summary
    match_count INTEGER DEFAULT 0,
    exact_match_count INTEGER DEFAULT 0,
    close_match_count INTEGER DEFAULT 0,
    unmatched_count INTEGER DEFAULT 0,

    -- Approval
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    approval_notes TEXT,

    -- SAP Integration
    sap_document_id VARCHAR(50),
    sent_to_sap_at TIMESTAMP,
    sap_response JSONB,

    -- File info
    original_filename VARCHAR(255),
    file_format VARCHAR(10),  -- 'pdf' or 'edi500'
    file_path VARCHAR(500),
    file_size_bytes INTEGER,

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_invoice_status CHECK (status IN (
        'pending', 'auto_approved', 'manual_review',
        'approved', 'rejected', 'sent_to_sap'
    )),
    CONSTRAINT chk_invoice_format CHECK (file_format IN ('pdf', 'edi500'))
);

-- Invoice line items (parsed from invoice)
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    -- Identifiers
    car_number VARCHAR(20),
    brc_number VARCHAR(50),

    -- Codes for matching
    job_code VARCHAR(10),
    why_made_code VARCHAR(10),

    -- Amounts
    labor_amount DECIMAL(10,2) DEFAULT 0,
    material_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,

    -- Description (from PDF parsing)
    description TEXT,

    -- Matching status: pending, exact_match, close_match, no_match, manually_matched
    match_status VARCHAR(20) DEFAULT 'pending',
    matched_allocation_id UUID REFERENCES allocations(id),
    match_confidence DECIMAL(5,2),
    match_notes TEXT,

    -- Manual verification
    manually_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP,

    CONSTRAINT chk_line_match_status CHECK (match_status IN (
        'pending', 'exact_match', 'close_match', 'no_match', 'manually_matched'
    ))
);

-- Invoice to BRC/Allocation mapping (many-to-many for partial payments)
CREATE TABLE IF NOT EXISTS invoice_brc_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    allocation_id UUID NOT NULL REFERENCES allocations(id),
    brc_number VARCHAR(50),
    brc_total DECIMAL(10,2),
    invoice_amount DECIMAL(10,2),  -- Amount from this invoice toward this BRC
    match_type VARCHAR(20),  -- exact, close, manual
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_match_type CHECK (match_type IN ('exact', 'close', 'manual'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_shop ON invoices(shop_code);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_car ON invoice_line_items(car_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_match ON invoice_line_items(match_status);
CREATE INDEX IF NOT EXISTS idx_invoice_brc_invoice ON invoice_brc_matches(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_brc_allocation ON invoice_brc_matches(allocation_id);

-- View for invoice summary with match stats
CREATE OR REPLACE VIEW v_invoice_summary AS
SELECT
    i.*,
    s.shop_name,
    u.email as created_by_email,
    u.first_name || ' ' || u.last_name as created_by_name,
    r.email as reviewed_by_email,
    r.first_name || ' ' || r.last_name as reviewed_by_name,
    (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = i.id) as line_count
FROM invoices i
LEFT JOIN shops s ON i.shop_code = s.shop_code
LEFT JOIN users u ON i.created_by = u.id
LEFT JOIN users r ON i.reviewed_by = r.id;

-- View for invoice line items with BRC comparison data
CREATE OR REPLACE VIEW v_invoice_line_comparison AS
SELECT
    li.*,
    i.invoice_number,
    i.shop_code,
    a.id as brc_allocation_id,
    a.actual_cost as brc_total,
    a.actual_cost_breakdown as brc_breakdown,
    a.brc_number as allocation_brc_number,
    CASE
        WHEN li.matched_allocation_id IS NOT NULL THEN 'matched'
        WHEN a.id IS NOT NULL THEN 'candidate'
        ELSE 'unmatched'
    END as comparison_status
FROM invoice_line_items li
JOIN invoices i ON li.invoice_id = i.id
LEFT JOIN allocations a ON (
    li.matched_allocation_id = a.id
    OR (li.car_number = a.car_number AND a.brc_number IS NOT NULL)
);

-- View for pending invoices requiring review
CREATE OR REPLACE VIEW v_invoices_pending_review AS
SELECT * FROM v_invoice_summary
WHERE status IN ('pending', 'manual_review')
ORDER BY received_date ASC;

-- View for invoice approval queue
CREATE OR REPLACE VIEW v_invoice_approval_queue AS
SELECT
    status,
    COUNT(*) as count,
    SUM(invoice_total) as total_amount,
    AVG(variance_pct) as avg_variance_pct
FROM invoices
GROUP BY status;

-- Trigger to update invoice timestamp
CREATE OR REPLACE FUNCTION update_invoice_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_update ON invoices;
CREATE TRIGGER trg_invoice_update
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_invoice_timestamp();

-- Function to calculate invoice variance
CREATE OR REPLACE FUNCTION calculate_invoice_variance(p_invoice_id UUID)
RETURNS TABLE (
    brc_total DECIMAL(12,2),
    variance_amount DECIMAL(12,2),
    variance_pct DECIMAL(5,2),
    within_tolerance BOOLEAN
) AS $$
DECLARE
    v_invoice_total DECIMAL(12,2);
    v_brc_total DECIMAL(12,2);
    v_variance DECIMAL(12,2);
    v_variance_pct DECIMAL(5,2);
BEGIN
    -- Get invoice total
    SELECT invoice_total INTO v_invoice_total
    FROM invoices WHERE id = p_invoice_id;

    -- Calculate BRC total from matched allocations
    SELECT COALESCE(SUM(a.actual_cost), 0) INTO v_brc_total
    FROM invoice_brc_matches ibm
    JOIN allocations a ON ibm.allocation_id = a.id
    WHERE ibm.invoice_id = p_invoice_id;

    -- Calculate variance
    v_variance = v_invoice_total - v_brc_total;
    v_variance_pct = CASE
        WHEN v_brc_total > 0 THEN (v_variance / v_brc_total) * 100
        ELSE 0
    END;

    RETURN QUERY SELECT
        v_brc_total,
        v_variance,
        v_variance_pct,
        ABS(v_variance_pct) <= 3.0;  -- 3% tolerance
END;
$$ LANGUAGE plpgsql;
