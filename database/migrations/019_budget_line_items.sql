-- ============================================================================
-- Migration 019: Budget Line Items for Cost Tracking
-- ============================================================================

-- Create table to track individual budget line items per allocation
CREATE TABLE IF NOT EXISTS allocation_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  shopping_type_id UUID NOT NULL REFERENCES shopping_types(id),
  shopping_reason_id UUID REFERENCES shopping_reasons(id),
  description TEXT,
  estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  actual_cost DECIMAL(10,2),
  cost_owner VARCHAR(20) NOT NULL DEFAULT 'lessor', -- 'lessor' or 'lessee'
  customer_billable BOOLEAN NOT NULL DEFAULT FALSE,
  project_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_allocation_line_items_allocation ON allocation_line_items(allocation_id);
CREATE INDEX IF NOT EXISTS idx_allocation_line_items_type ON allocation_line_items(shopping_type_id);
CREATE INDEX IF NOT EXISTS idx_allocation_line_items_billable ON allocation_line_items(customer_billable);

-- Create budget summary view by month and cost owner
CREATE OR REPLACE VIEW v_budget_by_month AS
SELECT
  DATE_TRUNC('month', TO_DATE(a.target_month || '-01', 'YYYY-MM-DD')) AS budget_month,
  a.target_month,
  COUNT(DISTINCT a.id) AS allocation_count,
  COUNT(DISTINCT a.car_number) AS car_count,
  SUM(CASE WHEN li.cost_owner = 'lessor' THEN li.estimated_cost ELSE 0 END) AS owner_estimated,
  SUM(CASE WHEN li.cost_owner = 'lessee' OR li.customer_billable THEN li.estimated_cost ELSE 0 END) AS customer_estimated,
  SUM(li.estimated_cost) AS total_estimated,
  SUM(CASE WHEN li.cost_owner = 'lessor' THEN COALESCE(li.actual_cost, 0) ELSE 0 END) AS owner_actual,
  SUM(CASE WHEN li.cost_owner = 'lessee' OR li.customer_billable THEN COALESCE(li.actual_cost, 0) ELSE 0 END) AS customer_actual,
  SUM(COALESCE(li.actual_cost, 0)) AS total_actual
FROM allocations a
LEFT JOIN allocation_line_items li ON a.id = li.allocation_id
WHERE a.status NOT IN ('Cancelled', 'Rejected')
GROUP BY DATE_TRUNC('month', TO_DATE(a.target_month || '-01', 'YYYY-MM-DD')), a.target_month
ORDER BY budget_month;

-- Create budget summary view by shopping type
CREATE OR REPLACE VIEW v_budget_by_type AS
SELECT
  st.id AS shopping_type_id,
  st.code AS type_code,
  st.name AS type_name,
  a.target_month,
  COUNT(DISTINCT a.id) AS allocation_count,
  SUM(li.estimated_cost) AS total_estimated,
  SUM(CASE WHEN li.customer_billable THEN li.estimated_cost ELSE 0 END) AS customer_billable_amount,
  SUM(CASE WHEN NOT li.customer_billable THEN li.estimated_cost ELSE 0 END) AS owner_amount
FROM allocation_line_items li
JOIN shopping_types st ON li.shopping_type_id = st.id
JOIN allocations a ON li.allocation_id = a.id
WHERE a.status NOT IN ('Cancelled', 'Rejected')
GROUP BY st.id, st.code, st.name, a.target_month
ORDER BY st.sort_order, a.target_month;

-- Create budget summary by lessee (for customer billing)
CREATE OR REPLACE VIEW v_budget_by_lessee AS
SELECT
  c.lessee_name,
  c.lessee_code,
  a.target_month,
  COUNT(DISTINCT a.id) AS allocation_count,
  COUNT(DISTINCT a.car_number) AS car_count,
  SUM(CASE WHEN li.customer_billable THEN li.estimated_cost ELSE 0 END) AS customer_billable_estimated,
  SUM(CASE WHEN li.customer_billable THEN COALESCE(li.actual_cost, 0) ELSE 0 END) AS customer_billable_actual
FROM allocations a
JOIN cars c ON a.car_number = c.car_number
LEFT JOIN allocation_line_items li ON a.id = li.allocation_id
WHERE a.status NOT IN ('Cancelled', 'Rejected')
  AND li.customer_billable = TRUE
GROUP BY c.lessee_name, c.lessee_code, a.target_month
ORDER BY c.lessee_name, a.target_month;

-- Trigger to update allocation totals when line items change
CREATE OR REPLACE FUNCTION update_allocation_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE allocations
  SET estimated_cost = (
    SELECT COALESCE(SUM(estimated_cost), 0)
    FROM allocation_line_items
    WHERE allocation_id = COALESCE(NEW.allocation_id, OLD.allocation_id)
  ),
  estimated_cost_breakdown = (
    SELECT jsonb_agg(jsonb_build_object(
      'type_code', st.code,
      'type_name', st.name,
      'cost', li.estimated_cost,
      'customer_billable', li.customer_billable
    ))
    FROM allocation_line_items li
    JOIN shopping_types st ON li.shopping_type_id = st.id
    WHERE li.allocation_id = COALESCE(NEW.allocation_id, OLD.allocation_id)
  ),
  updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.allocation_id, OLD.allocation_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_allocation_totals ON allocation_line_items;
CREATE TRIGGER trg_update_allocation_totals
AFTER INSERT OR UPDATE OR DELETE ON allocation_line_items
FOR EACH ROW EXECUTE FUNCTION update_allocation_totals();
