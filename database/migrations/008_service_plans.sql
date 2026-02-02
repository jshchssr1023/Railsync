-- Migration 008: Service Plans
-- Service Plans allow customers to review multi-option proposals for their car fleet servicing

-- ============================================================================
-- SERVICE PLANS TABLE (Customer Proposals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- CUSTOMER & NAME
  -- ═══════════════════════════════════════════════════════════════════
  customer_id UUID,
  customer_code VARCHAR(20),  -- Denormalized for queries
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- PLAN PARAMETERS
  -- ═══════════════════════════════════════════════════════════════════
  car_flow_rate INTEGER NOT NULL DEFAULT 0,  -- Cars per month
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,

  -- ═══════════════════════════════════════════════════════════════════
  -- STATUS & APPROVAL
  -- ═══════════════════════════════════════════════════════════════════
  status VARCHAR(20) DEFAULT 'Draft',
  -- 'draft'             = Being created
  -- 'proposed'          = Sent to customer
  -- 'awaiting_response' = Waiting for customer decision
  -- 'approved'          = Customer approved an option
  -- 'rejected'          = Customer rejected all options
  -- 'expired'           = Response deadline passed

  approved_option_id UUID,  -- Which option was approved
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(100),
  approval_notes TEXT,

  -- Response deadline
  response_deadline DATE,

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_id UUID,

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT chk_sp_status CHECK (status IN ('draft', 'proposed', 'awaiting_response', 'approved', 'rejected', 'expired')),
  CONSTRAINT chk_sp_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_sp_customer ON service_plans(customer_code);
CREATE INDEX IF NOT EXISTS idx_sp_status ON service_plans(status);
CREATE INDEX IF NOT EXISTS idx_sp_fiscal_year ON service_plans(fiscal_year);

-- ============================================================================
-- SERVICE PLAN OPTIONS TABLE (Multiple Options per Plan)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_plan_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- REFERENCE
  -- ═══════════════════════════════════════════════════════════════════
  service_plan_id UUID NOT NULL REFERENCES service_plans(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════════════════════════
  -- OPTION DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  option_name VARCHAR(10) NOT NULL,  -- 'A', 'B', 'C'
  description TEXT,

  -- ═══════════════════════════════════════════════════════════════════
  -- COST & TIME ESTIMATES
  -- ═══════════════════════════════════════════════════════════════════
  total_estimated_cost DECIMAL(12,2),
  avg_cost_per_car DECIMAL(10,2),
  avg_turn_time INTEGER,  -- Days

  -- Shop distribution summary
  shop_count INTEGER DEFAULT 0,
  primary_shop_code VARCHAR(20),

  -- ═══════════════════════════════════════════════════════════════════
  -- STATUS
  -- ═══════════════════════════════════════════════════════════════════
  status VARCHAR(20) DEFAULT 'Draft',
  -- 'draft', 'finalized', 'selected', 'rejected'

  is_recommended BOOLEAN DEFAULT FALSE,

  -- ═══════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT chk_spo_status CHECK (status IN ('draft', 'finalized', 'selected', 'rejected')),
  CONSTRAINT uq_plan_option_name UNIQUE (service_plan_id, option_name)
);

CREATE INDEX IF NOT EXISTS idx_spo_plan ON service_plan_options(service_plan_id);

-- ============================================================================
-- SERVICE PLAN OPTION CARS TABLE (Cars in Each Option)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_plan_option_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════
  -- REFERENCES
  -- ═══════════════════════════════════════════════════════════════════
  option_id UUID NOT NULL REFERENCES service_plan_options(id) ON DELETE CASCADE,
  car_id UUID,
  car_number VARCHAR(20) NOT NULL,

  -- ═══════════════════════════════════════════════════════════════════
  -- ASSIGNMENT DETAILS
  -- ═══════════════════════════════════════════════════════════════════
  shop_code VARCHAR(20) NOT NULL,
  target_month VARCHAR(7),  -- YYYY-MM
  estimated_cost DECIMAL(10,2),

  -- Service options to include
  service_options JSONB DEFAULT '[]',

  -- ═══════════════════════════════════════════════════════════════════
  -- CONSTRAINTS
  -- ═══════════════════════════════════════════════════════════════════
  CONSTRAINT fk_spoc_shop FOREIGN KEY (shop_code) REFERENCES shops(shop_code)
);

CREATE INDEX IF NOT EXISTS idx_spoc_option ON service_plan_option_cars(option_id);
CREATE INDEX IF NOT EXISTS idx_spoc_car ON service_plan_option_cars(car_number);
CREATE INDEX IF NOT EXISTS idx_spoc_shop ON service_plan_option_cars(shop_code);

-- ============================================================================
-- UPDATE FOREIGN KEY ON service_plans.approved_option_id
-- ============================================================================
ALTER TABLE service_plans
  DROP CONSTRAINT IF EXISTS fk_sp_approved_option;

ALTER TABLE service_plans
  ADD CONSTRAINT fk_sp_approved_option
  FOREIGN KEY (approved_option_id)
  REFERENCES service_plan_options(id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Service plan summary view
CREATE OR REPLACE VIEW v_service_plan_summary AS
SELECT
  sp.id,
  sp.name,
  sp.customer_code,
  sp.fiscal_year,
  sp.start_date,
  sp.end_date,
  sp.car_flow_rate,
  sp.status,
  sp.response_deadline,
  sp.approved_option_id,
  sp.approved_at,
  sp.created_at,
  (SELECT COUNT(*) FROM service_plan_options spo WHERE spo.service_plan_id = sp.id) as option_count,
  (SELECT COUNT(DISTINCT spoc.car_number)
   FROM service_plan_options spo
   JOIN service_plan_option_cars spoc ON spoc.option_id = spo.id
   WHERE spo.service_plan_id = sp.id) as total_car_count,
  (SELECT COALESCE(SUM(spo.total_estimated_cost), 0) / NULLIF(COUNT(*), 0)
   FROM service_plan_options spo
   WHERE spo.service_plan_id = sp.id) as avg_option_cost
FROM service_plans sp;

-- Option comparison view
CREATE OR REPLACE VIEW v_service_plan_option_comparison AS
SELECT
  spo.id,
  spo.service_plan_id,
  sp.name as plan_name,
  sp.customer_code,
  spo.option_name,
  spo.description,
  spo.total_estimated_cost,
  spo.avg_cost_per_car,
  spo.avg_turn_time,
  spo.shop_count,
  spo.is_recommended,
  spo.status,
  (SELECT COUNT(*) FROM service_plan_option_cars spoc WHERE spoc.option_id = spo.id) as car_count,
  (SELECT json_agg(DISTINCT shop_code) FROM service_plan_option_cars spoc WHERE spoc.option_id = spo.id) as shops
FROM service_plan_options spo
JOIN service_plans sp ON sp.id = spo.service_plan_id;

-- ============================================================================
-- TRIGGER: Update service_plans.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_service_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_plan_update ON service_plans;
CREATE TRIGGER trg_service_plan_update
  BEFORE UPDATE ON service_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_service_plan_timestamp();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 008 complete: Service Plans tables created';
END $$;
