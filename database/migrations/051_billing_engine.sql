-- ============================================================================
-- Migration 051: Outbound Billing Engine
-- Monthly rental invoicing, mileage billing, chargebacks, rate management
-- ============================================================================

-- ============================================================================
-- 1. RATE MANAGEMENT — History and escalation tracking
-- ============================================================================

-- Rate escalation history (tracks changes to rider rates)
CREATE TABLE IF NOT EXISTS rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES lease_riders(id) ON DELETE CASCADE,
    previous_rate DECIMAL(10,2),
    new_rate DECIMAL(10,2) NOT NULL,
    effective_date DATE NOT NULL,
    change_type VARCHAR(30) NOT NULL CHECK (change_type IN (
        'initial', 'escalation', 'abatement', 'correction', 'renewal', 'amendment'
    )),
    change_reason TEXT,
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_history_rider ON rate_history(rider_id);
CREATE INDEX IF NOT EXISTS idx_rate_history_effective ON rate_history(effective_date);

-- ============================================================================
-- 2. MILEAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS mileage_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) DEFAULT 'railinc' CHECK (file_type IN ('railinc', 'manual', 'csv')),
    reporting_period DATE NOT NULL,            -- first of month
    record_count INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN (
        'uploaded', 'processing', 'processed', 'reconciled', 'error'
    )),
    uploaded_by UUID REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mileage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mileage_file_id UUID REFERENCES mileage_files(id) ON DELETE SET NULL,
    car_number VARCHAR(20) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    rider_id UUID REFERENCES lease_riders(id),
    reporting_period DATE NOT NULL,            -- first of month
    miles INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(30) DEFAULT 'railinc',      -- railinc, manual
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'verified', 'disputed', 'billed'
    )),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(car_number, reporting_period)
);

CREATE INDEX IF NOT EXISTS idx_mileage_records_car ON mileage_records(car_number);
CREATE INDEX IF NOT EXISTS idx_mileage_records_customer ON mileage_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_mileage_records_period ON mileage_records(reporting_period);
CREATE INDEX IF NOT EXISTS idx_mileage_records_status ON mileage_records(status);

-- ============================================================================
-- 3. OUTBOUND INVOICES (Customer-facing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS outbound_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    fiscal_year INTEGER NOT NULL,
    fiscal_month INTEGER NOT NULL,

    -- Invoice type
    invoice_type VARCHAR(30) NOT NULL CHECK (invoice_type IN (
        'rental', 'mileage', 'chargeback', 'combined', 'credit_memo'
    )),

    -- Totals
    rental_total DECIMAL(14,2) DEFAULT 0,
    mileage_total DECIMAL(14,2) DEFAULT 0,
    chargeback_total DECIMAL(14,2) DEFAULT 0,
    adjustment_total DECIMAL(14,2) DEFAULT 0,
    tax_total DECIMAL(14,2) DEFAULT 0,
    invoice_total DECIMAL(14,2) NOT NULL DEFAULT 0,

    -- Status workflow
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_review', 'approved', 'sent', 'sent_to_sap',
        'posted', 'paid', 'void', 'credit_applied'
    )),

    -- SAP integration
    sap_document_id VARCHAR(50),
    sap_posted_at TIMESTAMP WITH TIME ZONE,

    -- Delivery
    sent_to_customer_at TIMESTAMP WITH TIME ZONE,
    sent_via VARCHAR(20),                      -- email, portal, mail
    payment_due_date DATE,
    payment_received_date DATE,
    payment_reference VARCHAR(100),

    -- Audit
    generated_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbound_invoices_customer ON outbound_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_outbound_invoices_period ON outbound_invoices(fiscal_year, fiscal_month);
CREATE INDEX IF NOT EXISTS idx_outbound_invoices_status ON outbound_invoices(status);
CREATE INDEX IF NOT EXISTS idx_outbound_invoices_type ON outbound_invoices(invoice_type);

-- Invoice line items
CREATE TABLE IF NOT EXISTS outbound_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES outbound_invoices(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    line_type VARCHAR(30) NOT NULL CHECK (line_type IN (
        'rental', 'mileage', 'chargeback', 'adjustment', 'credit', 'tax'
    )),
    description TEXT NOT NULL,
    rider_id UUID REFERENCES lease_riders(id),
    car_number VARCHAR(20),
    quantity DECIMAL(12,4) DEFAULT 1,          -- car-days, miles, count
    unit_rate DECIMAL(12,4),
    line_total DECIMAL(14,2) NOT NULL,
    reference_id UUID,                         -- FK to source record (mileage, chargeback, etc.)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invoice_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_outbound_lines_invoice ON outbound_invoice_lines(invoice_id);

-- ============================================================================
-- 4. BILLING ADJUSTMENTS (Credits, corrections, abatements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    rider_id UUID REFERENCES lease_riders(id),
    car_number VARCHAR(20),
    adjustment_type VARCHAR(30) NOT NULL CHECK (adjustment_type IN (
        'credit', 'debit', 'abatement', 'rate_correction', 'proration',
        'release_credit', 'renewal_adjustment', 'shop_credit'
    )),
    amount DECIMAL(14,2) NOT NULL,
    description TEXT NOT NULL,
    source_event VARCHAR(50),                  -- e.g., 'release', 'renewal', 'shop_entry'
    source_event_id UUID,                      -- FK to source record

    -- Status workflow
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'applied', 'void'
    )),

    -- Approval
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Application
    applied_to_invoice_id UUID REFERENCES outbound_invoices(id),
    applied_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_adj_customer ON billing_adjustments(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_adj_status ON billing_adjustments(status);

-- ============================================================================
-- 5. CHARGEBACKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS chargebacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    car_number VARCHAR(20) NOT NULL,
    rider_id UUID REFERENCES lease_riders(id),
    allocation_id UUID,                        -- link to cost allocation / BRC

    chargeback_type VARCHAR(30) NOT NULL CHECK (chargeback_type IN (
        'lessee_responsibility', 'damage', 'excess_wear', 'cleaning',
        'modification', 'regulatory', 'other'
    )),
    amount DECIMAL(14,2) NOT NULL,
    description TEXT NOT NULL,

    -- BRC attachment
    brc_file_path VARCHAR(500),
    brc_500byte_data TEXT,                     -- generated 500-byte chargeback BRC

    -- Status workflow
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_review', 'approved', 'invoiced', 'disputed',
        'resolved', 'void'
    )),

    -- Approval
    submitted_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    -- Invoice linkage
    applied_to_invoice_id UUID REFERENCES outbound_invoices(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chargebacks_customer ON chargebacks(customer_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks(status);
CREATE INDEX IF NOT EXISTS idx_chargebacks_car ON chargebacks(car_number);

-- ============================================================================
-- 6. BILLING RUNS (Month-end orchestration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    fiscal_month INTEGER NOT NULL,
    run_type VARCHAR(20) NOT NULL CHECK (run_type IN (
        'rental', 'mileage', 'chargeback', 'full'
    )),

    -- Pre-flight
    preflight_passed BOOLEAN DEFAULT FALSE,
    preflight_results JSONB,                   -- detailed check results

    -- Execution
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'preflight', 'generating', 'review', 'approved',
        'posting', 'completed', 'failed'
    )),
    invoices_generated INTEGER DEFAULT 0,
    total_amount DECIMAL(16,2) DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB,

    -- Audit
    initiated_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(fiscal_year, fiscal_month, run_type)
);

-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- Monthly billing summary by customer
CREATE OR REPLACE VIEW v_billing_summary AS
SELECT
    c.id AS customer_id,
    c.customer_code,
    c.customer_name,
    oi.fiscal_year,
    oi.fiscal_month,
    COUNT(oi.id) AS invoice_count,
    SUM(oi.rental_total) AS total_rental,
    SUM(oi.mileage_total) AS total_mileage,
    SUM(oi.chargeback_total) AS total_chargebacks,
    SUM(oi.adjustment_total) AS total_adjustments,
    SUM(oi.invoice_total) AS grand_total,
    COUNT(CASE WHEN oi.status = 'draft' THEN 1 END) AS drafts,
    COUNT(CASE WHEN oi.status = 'approved' THEN 1 END) AS approved,
    COUNT(CASE WHEN oi.status = 'sent_to_sap' THEN 1 END) AS sent_to_sap,
    COUNT(CASE WHEN oi.status = 'paid' THEN 1 END) AS paid
FROM outbound_invoices oi
JOIN customers c ON c.id = oi.customer_id
GROUP BY c.id, c.customer_code, c.customer_name, oi.fiscal_year, oi.fiscal_month;

-- Pending adjustments requiring approval
CREATE OR REPLACE VIEW v_pending_adjustments AS
SELECT
    ba.id,
    ba.adjustment_type,
    ba.amount,
    ba.description,
    ba.source_event,
    ba.status,
    c.customer_code,
    c.customer_name,
    ba.car_number,
    u.first_name || ' ' || u.last_name AS requested_by_name,
    ba.created_at
FROM billing_adjustments ba
JOIN customers c ON c.id = ba.customer_id
LEFT JOIN users u ON u.id = ba.requested_by
WHERE ba.status = 'pending'
ORDER BY ba.created_at;

-- Active rider billing rates
CREATE OR REPLACE VIEW v_rider_billing AS
SELECT
    lr.id AS rider_id,
    lr.rider_id AS rider_code,
    lr.rider_name,
    ml.lease_id,
    ml.lease_name,
    c.customer_code,
    c.customer_name,
    lr.rate_per_car,
    lr.car_count,
    lr.effective_date,
    lr.expiration_date,
    COALESCE(lr.rate_per_car * lr.car_count, 0) AS monthly_revenue,
    lr.status AS rider_status,
    ml.status AS lease_status
FROM lease_riders lr
JOIN master_leases ml ON ml.id = lr.master_lease_id
JOIN customers c ON c.id = ml.customer_id
WHERE lr.status = 'Active' AND ml.status = 'Active';

-- Chargeback pipeline
CREATE OR REPLACE VIEW v_chargeback_pipeline AS
SELECT
    cb.id,
    cb.chargeback_type,
    cb.amount,
    cb.status,
    cb.car_number,
    c.customer_code,
    c.customer_name,
    cb.description,
    cb.created_at,
    u.first_name || ' ' || u.last_name AS submitted_by_name
FROM chargebacks cb
JOIN customers c ON c.id = cb.customer_id
LEFT JOIN users u ON u.id = cb.submitted_by
ORDER BY
    CASE cb.status
        WHEN 'pending_review' THEN 1
        WHEN 'draft' THEN 2
        WHEN 'approved' THEN 3
        WHEN 'invoiced' THEN 4
        ELSE 5
    END,
    cb.created_at DESC;

-- ============================================================================
-- 8. SEED DATA — Billing run for demo
-- ============================================================================

-- Insert rate history for existing riders
INSERT INTO rate_history (rider_id, previous_rate, new_rate, effective_date, change_type, change_reason)
SELECT
    lr.id,
    NULL,
    lr.rate_per_car,
    lr.effective_date,
    'initial',
    'Initial rate from lease creation'
FROM lease_riders lr
WHERE lr.rate_per_car IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 051: Billing engine schema created successfully';
END $$;
