-- ============================================================================
-- Migration 054: Performance Indexes + Missing invoice_delivery_log Table
-- Sprint 4 — Phase 1 Integration + Stabilization
-- ============================================================================

-- ============================================================================
-- 1. CREATE MISSING invoice_delivery_log TABLE
-- (Referenced by invoiceDistribution.service.ts but never created)
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES outbound_invoices(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    delivery_method VARCHAR(20) NOT NULL DEFAULT 'email',
    recipients TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'sending', 'sent', 'failed', 'bounced'
    )),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_invoice ON invoice_delivery_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_customer ON invoice_delivery_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON invoice_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_delivery_log_pending ON invoice_delivery_log(status, created_at)
    WHERE status IN ('pending', 'sending');

-- ============================================================================
-- 2. BILLING RUNS INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_billing_runs_period ON billing_runs(fiscal_year, fiscal_month);
CREATE INDEX IF NOT EXISTS idx_billing_runs_status ON billing_runs(status);
CREATE INDEX IF NOT EXISTS idx_billing_runs_created ON billing_runs(created_at DESC);

-- ============================================================================
-- 3. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Outbound invoices: customer + status (common filter combo)
CREATE INDEX IF NOT EXISTS idx_outbound_invoices_customer_status
    ON outbound_invoices(customer_id, status);

-- Outbound invoices: period + status (billing summary queries)
CREATE INDEX IF NOT EXISTS idx_outbound_invoices_period_status
    ON outbound_invoices(fiscal_year, fiscal_month, status);

-- Chargebacks: status + created date (review queue sorted by age)
CREATE INDEX IF NOT EXISTS idx_chargebacks_status_created
    ON chargebacks(status, created_at DESC);

-- Billing adjustments: status + requested date (approval queue)
CREATE INDEX IF NOT EXISTS idx_billing_adj_status_requested
    ON billing_adjustments(status, created_at DESC);

-- Mileage records: period + status (batch processing)
CREATE INDEX IF NOT EXISTS idx_mileage_records_period_status
    ON mileage_records(reporting_period, status);

-- Components: car_number + status (active components per car)
CREATE INDEX IF NOT EXISTS idx_components_car_active
    ON components(car_number, status) WHERE status = 'active';

-- Component history: component_id + date (recent history lookup)
CREATE INDEX IF NOT EXISTS idx_comp_history_component_date
    ON component_history(component_id, performed_at DESC);

-- Shopping requests: status + submitted date (review queue)
CREATE INDEX IF NOT EXISTS idx_shopping_req_status_submitted
    ON shopping_requests(status, submitted_at DESC);

-- ============================================================================
-- 4. PARTIAL INDEXES FOR HOT PATHS
-- ============================================================================

-- Pending invoices (frequently queried for review)
CREATE INDEX IF NOT EXISTS idx_outbound_invoices_pending
    ON outbound_invoices(created_at DESC)
    WHERE status IN ('draft', 'pending_review');

-- Overdue inspections (qualification + component alert queries)
CREATE INDEX IF NOT EXISTS idx_components_overdue_inspection
    ON components(next_inspection_due)
    WHERE status = 'active' AND next_inspection_due IS NOT NULL;
