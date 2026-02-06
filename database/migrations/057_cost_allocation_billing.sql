-- ============================================================================
-- Migration 057: Cost Allocation to Billing Linkage
-- Links maintenance allocations/BRC costs to outbound customer invoices.
-- Adds billing run approval workflow + enhanced tracking.
-- ============================================================================

-- ============================================================================
-- 1. COST ALLOCATION ENTRIES — line-level linkage from allocations to invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_allocation_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    car_number VARCHAR(20) NOT NULL,

    -- Cost breakdown
    labor_cost DECIMAL(14,2) DEFAULT 0,
    material_cost DECIMAL(14,2) DEFAULT 0,
    freight_cost DECIMAL(14,2) DEFAULT 0,
    total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,

    -- Responsibility split (for SPV / multi-entity billing)
    billing_entity VARCHAR(50) DEFAULT 'owner',      -- 'owner', 'lessee', 'spv', 'shared'
    lessee_share_pct DECIMAL(5,2) DEFAULT 0,          -- % charged to customer
    owner_share_pct DECIMAL(5,2) DEFAULT 100,          -- % absorbed by owner
    lessee_amount DECIMAL(14,2) DEFAULT 0,             -- calculated: total_cost * lessee_share_pct / 100
    owner_amount DECIMAL(14,2) DEFAULT 0,              -- calculated: total_cost * owner_share_pct / 100

    -- Invoice linkage
    applied_to_invoice_id UUID REFERENCES outbound_invoices(id),
    applied_at TIMESTAMP WITH TIME ZONE,

    -- Source references
    brc_number VARCHAR(50),
    shopping_event_id UUID,
    scope_of_work_id UUID,

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'allocated', 'invoiced', 'void'
    )),

    -- Audit
    allocated_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cost_alloc_entries_allocation ON cost_allocation_entries(allocation_id);
CREATE INDEX IF NOT EXISTS idx_cost_alloc_entries_customer ON cost_allocation_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_cost_alloc_entries_car ON cost_allocation_entries(car_number);
CREATE INDEX IF NOT EXISTS idx_cost_alloc_entries_invoice ON cost_allocation_entries(applied_to_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cost_alloc_entries_status ON cost_allocation_entries(status);

-- ============================================================================
-- 2. INVOICE DISTRIBUTION CONFIG + DELIVERY LOG tables (if not created by 051)
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_distribution_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    delivery_method VARCHAR(20) DEFAULT 'email' CHECK (delivery_method IN ('email', 'portal', 'mail', 'edi')),
    email_recipients TEXT[] DEFAULT '{}',
    cc_recipients TEXT[] DEFAULT '{}',
    template_name VARCHAR(50) DEFAULT 'standard',
    include_line_detail BOOLEAN DEFAULT TRUE,
    include_pdf BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dist_config_customer_active
    ON invoice_distribution_config(customer_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS invoice_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES outbound_invoices(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    delivery_method VARCHAR(20) NOT NULL,
    recipients TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_log_invoice ON invoice_delivery_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_status ON invoice_delivery_log(status);

-- ============================================================================
-- 3. ENHANCE BILLING RUNS — add step tracking for orchestration UI
-- ============================================================================

-- Add step tracking columns to billing_runs (idempotent)
ALTER TABLE billing_runs ADD COLUMN IF NOT EXISTS current_step VARCHAR(30) DEFAULT 'preflight';
ALTER TABLE billing_runs ADD COLUMN IF NOT EXISTS step_progress JSONB DEFAULT '{}';
ALTER TABLE billing_runs ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- ============================================================================
-- 4. VIEWS — Cost allocation summaries
-- ============================================================================

-- Cost allocation summary by customer and period
CREATE OR REPLACE VIEW v_cost_allocation_summary AS
SELECT
    c.id AS customer_id,
    c.customer_code,
    c.customer_name,
    DATE_TRUNC('month', a.target_month::date) AS billing_month,
    COUNT(cae.id) AS allocation_count,
    SUM(cae.total_cost) AS total_cost,
    SUM(cae.labor_cost) AS labor_total,
    SUM(cae.material_cost) AS material_total,
    SUM(cae.freight_cost) AS freight_total,
    SUM(cae.lessee_amount) AS lessee_billable,
    SUM(cae.owner_amount) AS owner_absorbed,
    COUNT(CASE WHEN cae.status = 'pending' THEN 1 END) AS pending_count,
    COUNT(CASE WHEN cae.status = 'allocated' THEN 1 END) AS allocated_count,
    COUNT(CASE WHEN cae.status = 'invoiced' THEN 1 END) AS invoiced_count
FROM cost_allocation_entries cae
JOIN allocations a ON a.id = cae.allocation_id
JOIN customers c ON c.id = cae.customer_id
GROUP BY c.id, c.customer_code, c.customer_name, DATE_TRUNC('month', a.target_month::date);

-- Billing run detail with step status
CREATE OR REPLACE VIEW v_billing_run_detail AS
SELECT
    br.*,
    u.first_name || ' ' || u.last_name AS initiated_by_name,
    ua.first_name || ' ' || ua.last_name AS approved_by_name,
    COUNT(oi.id) FILTER (WHERE oi.status = 'draft') AS draft_invoices,
    COUNT(oi.id) FILTER (WHERE oi.status = 'approved') AS approved_invoices,
    COUNT(oi.id) FILTER (WHERE oi.status IN ('sent', 'sent_to_sap')) AS sent_invoices,
    COUNT(oi.id) FILTER (WHERE oi.status = 'paid') AS paid_invoices,
    COALESCE(SUM(oi.invoice_total), 0) AS actual_total
FROM billing_runs br
LEFT JOIN users u ON u.id = br.initiated_by
LEFT JOIN users ua ON ua.id = br.approved_by
LEFT JOIN outbound_invoices oi ON oi.fiscal_year = br.fiscal_year
    AND oi.fiscal_month = br.fiscal_month
    AND oi.status != 'void'
GROUP BY br.id, u.first_name, u.last_name, ua.first_name, ua.last_name;

-- ============================================================================
-- DONE
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 057: Cost allocation billing linkage created successfully';
END $$;
