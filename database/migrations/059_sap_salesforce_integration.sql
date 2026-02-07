-- ============================================================================
-- Migration 059: SAP + Salesforce Integration Enhancement
-- Sprint C — Real API client support, field mappings, document tracking
-- ============================================================================

-- ============================================================================
-- 1. SAP FIELD MAPPINGS (configurable mapping from RailSync fields to SAP)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sap_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(50) NOT NULL,         -- 'AP_INVOICE', 'AR_INVOICE', 'SPV_COST', 'MILEAGE'
    railsync_field VARCHAR(100) NOT NULL,       -- e.g., 'invoice_total', 'vendor_code'
    sap_field VARCHAR(100) NOT NULL,            -- e.g., 'BELNR', 'LIFNR', 'DMBTR'
    sap_structure VARCHAR(100),                 -- e.g., 'BKPF', 'BSEG', 'ACGL_ITEM'
    transform_rule VARCHAR(50) DEFAULT 'direct',-- 'direct', 'date_format', 'decimal_scale', 'lookup', 'concat'
    transform_config JSONB DEFAULT '{}',        -- e.g., {"format": "YYYYMMDD"}, {"scale": 2}, {"table": "cost_centers"}
    is_required BOOLEAN DEFAULT FALSE,
    default_value VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_type, railsync_field)
);

-- Seed AP Invoice mappings (vendor invoice posting → SAP FI-AP)
INSERT INTO sap_field_mappings (document_type, railsync_field, sap_field, sap_structure, transform_rule, is_required, sort_order) VALUES
    ('AP_INVOICE', 'company_code',    'BUKRS',  'BKPF', 'direct',       TRUE,  1),
    ('AP_INVOICE', 'document_date',   'BLDAT',  'BKPF', 'date_format',  TRUE,  2),
    ('AP_INVOICE', 'posting_date',    'BUDAT',  'BKPF', 'date_format',  TRUE,  3),
    ('AP_INVOICE', 'document_type',   'BLART',  'BKPF', 'direct',       TRUE,  4),
    ('AP_INVOICE', 'reference',       'XBLNR',  'BKPF', 'direct',       FALSE, 5),
    ('AP_INVOICE', 'header_text',     'BKTXT',  'BKPF', 'direct',       FALSE, 6),
    ('AP_INVOICE', 'currency',        'WAERS',  'BKPF', 'direct',       TRUE,  7),
    ('AP_INVOICE', 'vendor_code',     'LIFNR',  'BSEG', 'direct',       TRUE,  10),
    ('AP_INVOICE', 'posting_key',     'BSCHL',  'BSEG', 'direct',       TRUE,  11),
    ('AP_INVOICE', 'amount',          'WRBTR',  'BSEG', 'decimal_scale', TRUE, 12),
    ('AP_INVOICE', 'gl_account',      'HKONT',  'BSEG', 'direct',       FALSE, 13),
    ('AP_INVOICE', 'cost_center',     'KOSTL',  'BSEG', 'direct',       FALSE, 14),
    ('AP_INVOICE', 'profit_center',   'PRCTR',  'BSEG', 'direct',       FALSE, 15),
    ('AP_INVOICE', 'assignment',      'ZUONR',  'BSEG', 'direct',       FALSE, 16),
    ('AP_INVOICE', 'item_text',       'SGTXT',  'BSEG', 'direct',       FALSE, 17)
ON CONFLICT (document_type, railsync_field) DO NOTHING;

-- Seed AR Invoice mappings (outbound billing → SAP FI-AR)
INSERT INTO sap_field_mappings (document_type, railsync_field, sap_field, sap_structure, transform_rule, is_required, sort_order) VALUES
    ('AR_INVOICE', 'company_code',    'BUKRS',  'BKPF', 'direct',       TRUE,  1),
    ('AR_INVOICE', 'document_date',   'BLDAT',  'BKPF', 'date_format',  TRUE,  2),
    ('AR_INVOICE', 'posting_date',    'BUDAT',  'BKPF', 'date_format',  TRUE,  3),
    ('AR_INVOICE', 'document_type',   'BLART',  'BKPF', 'direct',       TRUE,  4),
    ('AR_INVOICE', 'reference',       'XBLNR',  'BKPF', 'direct',       FALSE, 5),
    ('AR_INVOICE', 'currency',        'WAERS',  'BKPF', 'direct',       TRUE,  6),
    ('AR_INVOICE', 'customer_number', 'KUNNR',  'BSEG', 'direct',       TRUE,  10),
    ('AR_INVOICE', 'posting_key',     'BSCHL',  'BSEG', 'direct',       TRUE,  11),
    ('AR_INVOICE', 'amount',          'WRBTR',  'BSEG', 'decimal_scale', TRUE, 12),
    ('AR_INVOICE', 'gl_account',      'HKONT',  'BSEG', 'direct',       FALSE, 13),
    ('AR_INVOICE', 'profit_center',   'PRCTR',  'BSEG', 'direct',       FALSE, 14),
    ('AR_INVOICE', 'item_text',       'SGTXT',  'BSEG', 'direct',       FALSE, 15)
ON CONFLICT (document_type, railsync_field) DO NOTHING;

-- Seed SPV cost allocation mappings
INSERT INTO sap_field_mappings (document_type, railsync_field, sap_field, sap_structure, transform_rule, is_required, sort_order) VALUES
    ('SPV_COST', 'company_code',      'BUKRS',    'ACGL_ITEM', 'direct',        TRUE,  1),
    ('SPV_COST', 'fiscal_year',       'GJAHR',    'ACGL_ITEM', 'direct',        TRUE,  2),
    ('SPV_COST', 'fiscal_period',     'MONAT',    'ACGL_ITEM', 'direct',        TRUE,  3),
    ('SPV_COST', 'gl_account',        'HKONT',    'ACGL_ITEM', 'direct',        TRUE,  4),
    ('SPV_COST', 'cost_center',       'KOSTL',    'ACGL_ITEM', 'direct',        FALSE, 5),
    ('SPV_COST', 'amount',            'WRBTR',    'ACGL_ITEM', 'decimal_scale', TRUE,  6),
    ('SPV_COST', 'assignment_ref',    'ZUONR',    'ACGL_ITEM', 'direct',        FALSE, 7),
    ('SPV_COST', 'item_text',         'SGTXT',    'ACGL_ITEM', 'direct',        FALSE, 8)
ON CONFLICT (document_type, railsync_field) DO NOTHING;

-- ============================================================================
-- 2. SAP DOCUMENT TRACKING (track posted documents for reversal/reference)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sap_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(50) NOT NULL,          -- 'AP_INVOICE', 'AR_INVOICE', 'SPV_COST', 'MILEAGE'
    sap_document_number VARCHAR(30),             -- SAP BELNR
    sap_company_code VARCHAR(10),                -- SAP BUKRS
    sap_fiscal_year INTEGER,
    sap_posting_date DATE,
    railsync_entity_type VARCHAR(50) NOT NULL,   -- 'invoice', 'outbound_invoice', 'allocation', 'mileage_record'
    railsync_entity_id UUID NOT NULL,
    railsync_entity_ref VARCHAR(100),
    status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('posted', 'reversed', 'error', 'pending_reversal')),
    reversal_document_number VARCHAR(30),
    reversal_date DATE,
    sap_response JSONB,
    sync_log_id UUID REFERENCES integration_sync_log(id),
    posted_by UUID REFERENCES users(id),
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sap_docs_entity ON sap_documents(railsync_entity_type, railsync_entity_id);
CREATE INDEX IF NOT EXISTS idx_sap_docs_number ON sap_documents(sap_document_number, sap_company_code, sap_fiscal_year);
CREATE INDEX IF NOT EXISTS idx_sap_docs_status ON sap_documents(status) WHERE status != 'posted';

-- ============================================================================
-- 3. SALESFORCE FIELD MAPPINGS (configurable SF ↔ RailSync field map)
-- ============================================================================

CREATE TABLE IF NOT EXISTS salesforce_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sf_object VARCHAR(50) NOT NULL,               -- 'Account', 'Contact', 'Opportunity'
    sf_field VARCHAR(100) NOT NULL,               -- e.g., 'Name', 'BillingStreet', 'Phone'
    railsync_table VARCHAR(50) NOT NULL,          -- e.g., 'customers', 'contacts'
    railsync_field VARCHAR(100) NOT NULL,         -- e.g., 'customer_name', 'billing_address'
    sync_direction VARCHAR(20) DEFAULT 'pull',    -- 'pull', 'push', 'bidirectional'
    conflict_winner VARCHAR(20) DEFAULT 'salesforce', -- 'railsync' or 'salesforce'
    is_key_field BOOLEAN DEFAULT FALSE,           -- used for matching/upsert
    transform_rule VARCHAR(50) DEFAULT 'direct',  -- 'direct', 'date_format', 'lookup', 'concat', 'split'
    transform_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sf_object, sf_field, railsync_table)
);

-- Seed Account → customers mapping
INSERT INTO salesforce_field_mappings (sf_object, sf_field, railsync_table, railsync_field, sync_direction, conflict_winner, is_key_field, sort_order) VALUES
    ('Account', 'Account_Code__c',       'customers', 'customer_code',     'pull', 'salesforce', TRUE,  1),
    ('Account', 'Name',                  'customers', 'customer_name',     'pull', 'salesforce', FALSE, 2),
    ('Account', 'BillingStreet',         'customers', 'billing_address',   'pull', 'salesforce', FALSE, 3),
    ('Account', 'BillingCity',           'customers', 'billing_city',      'pull', 'salesforce', FALSE, 4),
    ('Account', 'BillingState',          'customers', 'billing_state',     'pull', 'salesforce', FALSE, 5),
    ('Account', 'BillingPostalCode',     'customers', 'billing_zip',       'pull', 'salesforce', FALSE, 6),
    ('Account', 'Phone',                 'customers', 'phone',             'pull', 'salesforce', FALSE, 7),
    ('Account', 'Industry',              'customers', 'industry',          'pull', 'salesforce', FALSE, 8),
    ('Account', 'Type',                  'customers', 'customer_type',     'pull', 'salesforce', FALSE, 9),
    ('Account', 'Active__c',            'customers', 'is_active',         'bidirectional', 'railsync', FALSE, 10),
    ('Account', 'Credit_Limit__c',      'customers', 'credit_limit',     'bidirectional', 'railsync', FALSE, 11),
    ('Account', 'Payment_Terms__c',     'customers', 'payment_terms',    'bidirectional', 'railsync', FALSE, 12)
ON CONFLICT (sf_object, sf_field, railsync_table) DO NOTHING;

-- Seed Contact → customer contacts mapping
INSERT INTO salesforce_field_mappings (sf_object, sf_field, railsync_table, railsync_field, sync_direction, conflict_winner, is_key_field, sort_order) VALUES
    ('Contact', 'Email',                'customer_contacts', 'email',          'pull', 'salesforce', TRUE,  1),
    ('Contact', 'FirstName',            'customer_contacts', 'first_name',     'pull', 'salesforce', FALSE, 2),
    ('Contact', 'LastName',             'customer_contacts', 'last_name',      'pull', 'salesforce', FALSE, 3),
    ('Contact', 'Title',                'customer_contacts', 'title',          'pull', 'salesforce', FALSE, 4),
    ('Contact', 'Phone',                'customer_contacts', 'phone',          'pull', 'salesforce', FALSE, 5),
    ('Contact', 'Department',           'customer_contacts', 'department',     'pull', 'salesforce', FALSE, 6)
ON CONFLICT (sf_object, sf_field, railsync_table) DO NOTHING;

-- Seed Opportunity → pipeline/deals mapping
INSERT INTO salesforce_field_mappings (sf_object, sf_field, railsync_table, railsync_field, sync_direction, conflict_winner, is_key_field, sort_order) VALUES
    ('Opportunity', 'Name',              'pipeline_deals', 'deal_name',       'pull', 'salesforce', FALSE, 1),
    ('Opportunity', 'StageName',         'pipeline_deals', 'stage',           'pull', 'salesforce', FALSE, 2),
    ('Opportunity', 'Amount',            'pipeline_deals', 'amount',          'pull', 'salesforce', FALSE, 3),
    ('Opportunity', 'CloseDate',         'pipeline_deals', 'expected_close',  'pull', 'salesforce', FALSE, 4),
    ('Opportunity', 'Probability',       'pipeline_deals', 'probability',     'pull', 'salesforce', FALSE, 5),
    ('Opportunity', 'Deal_Code__c',      'pipeline_deals', 'deal_code',       'pull', 'salesforce', TRUE,  6)
ON CONFLICT (sf_object, sf_field, railsync_table) DO NOTHING;

-- ============================================================================
-- 4. ADD SAP CONFIG COLUMNS TO integration_connection_status
-- ============================================================================

ALTER TABLE integration_connection_status
    ADD COLUMN IF NOT EXISTS api_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS auth_method VARCHAR(30),     -- 'oauth2', 'basic', 'api_key', 'certificate'
    ADD COLUMN IF NOT EXISTS last_token_refresh_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 5. SALESFORCE SYNC MAP ENHANCEMENTS
-- ============================================================================

ALTER TABLE salesforce_sync_map
    ADD COLUMN IF NOT EXISTS sf_object_type VARCHAR(50),  -- 'Account', 'Contact', 'Opportunity'
    ADD COLUMN IF NOT EXISTS field_hash VARCHAR(64),      -- SHA-256 of synced field values for change detection
    ADD COLUMN IF NOT EXISTS last_modified_in_sf TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS last_modified_in_rs TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- 6. ADD CUSTOMER CONTACTS TABLE (if not exists — for SF Contact sync target)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    title VARCHAR(100),
    phone VARCHAR(30),
    department VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    salesforce_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, email)
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_sf ON customer_contacts(salesforce_id) WHERE salesforce_id IS NOT NULL;

-- ============================================================================
-- 7. ADD PIPELINE DEALS TABLE (if not exists — for SF Opportunity sync target)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    deal_code VARCHAR(50) UNIQUE,
    deal_name VARCHAR(255) NOT NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'Prospecting',
    amount DECIMAL(14,2),
    expected_close DATE,
    probability INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
    car_count_estimate INTEGER,
    car_types TEXT,                              -- comma-separated car types
    notes TEXT,
    salesforce_id VARCHAR(50),
    owner_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pipeline_deals_customer ON pipeline_deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_stage ON pipeline_deals(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_sf ON pipeline_deals(salesforce_id) WHERE salesforce_id IS NOT NULL;

-- ============================================================================
-- 8. SYNC JOB SCHEDULES (scheduled integration sync jobs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_job_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(100) UNIQUE NOT NULL,
    system_name VARCHAR(50) NOT NULL,          -- 'sap', 'salesforce', 'system'
    operation VARCHAR(100) NOT NULL,           -- 'batch_push', 'full_sync', 'pull_customers', etc.
    cron_expression VARCHAR(50) NOT NULL DEFAULT '0 */6 * * *',
    is_enabled BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_status VARCHAR(20),                   -- 'success', 'failed', 'running'
    next_run_at TIMESTAMP WITH TIME ZONE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_schedules_system ON sync_job_schedules(system_name);
CREATE INDEX IF NOT EXISTS idx_sync_schedules_enabled ON sync_job_schedules(is_enabled, next_run_at) WHERE is_enabled = TRUE;

-- Seed default sync schedules
INSERT INTO sync_job_schedules (job_name, system_name, operation, cron_expression, config) VALUES
    ('SAP Batch Push',             'sap',        'batch_push',           '0 */6 * * *',   '{"batch_limit": 100, "document_types": ["AP_INVOICE", "AR_INVOICE", "SPV_COST"]}'),
    ('Salesforce Full Sync',       'salesforce',  'full_sync',           '0 */12 * * *',  '{"objects": ["Account", "Contact", "Opportunity"]}'),
    ('Salesforce Pull Customers',  'salesforce',  'pull_customers',      '0 2 * * *',     '{"upsert_strategy": "update_existing", "conflict_winner": "salesforce"}'),
    ('Salesforce Pull Deals',      'salesforce',  'pull_deals',          '0 3 * * *',     '{"stages": ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won"]}'),
    ('Retry Queue Process',        'system',      'process_retry_queue', '*/30 * * * *',  '{"max_retries": 5, "batch_limit": 50}')
ON CONFLICT (job_name) DO NOTHING;
