import { pool } from '../config/database';

// ---------------------------------------------------------------------------
// Customer / Lessee History for a Car
// ---------------------------------------------------------------------------
export async function getCustomerHistory(carNumber: string) {
  const result = await pool.query(
    `SELECT
       c.id AS customer_id,
       c.customer_code,
       c.customer_name,
       ml.lease_id AS lease_number,
       ml.lease_name,
       ml.status AS lease_status,
       lr.rider_id AS rider_number,
       lr.rider_name,
       lr.rate_per_car,
       rc.added_date,
       rc.removed_date,
       CASE WHEN rc.status NOT IN ('off_rent', 'cancelled') THEN 'Current' ELSE 'Historical' END AS assignment_status
     FROM rider_cars rc
     JOIN lease_riders lr ON lr.id = rc.rider_id
     JOIN master_leases ml ON ml.id = lr.master_lease_id
     JOIN customers c ON c.id = ml.customer_id
     WHERE rc.car_number = $1
     ORDER BY CASE WHEN rc.status NOT IN ('off_rent', 'cancelled') THEN 0 ELSE 1 END, rc.added_date DESC`,
    [carNumber]
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Profitability Aggregation for a Car
// ---------------------------------------------------------------------------
export async function getProfitability(carNumber: string) {
  // Revenue from outbound invoices
  const revenueResult = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN oil.line_type = 'rental' THEN oil.line_total ELSE 0 END), 0)::NUMERIC AS rental_revenue,
       COALESCE(SUM(CASE WHEN oil.line_type = 'mileage' THEN oil.line_total ELSE 0 END), 0)::NUMERIC AS mileage_revenue,
       COALESCE(SUM(CASE WHEN oil.line_type = 'chargeback' THEN oil.line_total ELSE 0 END), 0)::NUMERIC AS chargeback_revenue,
       COALESCE(SUM(oil.line_total), 0)::NUMERIC AS total_revenue,
       COUNT(DISTINCT oi.id)::INTEGER AS invoice_count,
       MIN(oi.billing_period_start)::TEXT AS earliest_billing_period,
       MAX(oi.billing_period_end)::TEXT AS latest_billing_period
     FROM outbound_invoice_lines oil
     JOIN outbound_invoices oi ON oi.id = oil.invoice_id
     WHERE oil.car_number = $1
       AND oi.status NOT IN ('void', 'draft')`,
    [carNumber]
  );

  // Repair costs from approved estimates on shopping events
  const repairResult = await pool.query(
    `SELECT
       COALESCE(SUM(es.total_cost), 0)::NUMERIC AS total_repair_cost,
       COUNT(DISTINCT se.id)::INTEGER AS shopping_event_count
     FROM shopping_events se
     JOIN estimate_submissions es ON es.shopping_event_id = se.id
       AND es.status = 'approved'
     WHERE se.car_number = $1`,
    [carNumber]
  );

  // Assignment costs
  const assignmentResult = await pool.query(
    `SELECT
       COALESCE(SUM(ca.actual_cost), 0)::NUMERIC AS total_assignment_cost
     FROM car_assignments ca
     WHERE ca.car_number = $1
       AND ca.status NOT IN ('Cancelled')`,
    [carNumber]
  );

  // Monthly revenue trend
  const trendResult = await pool.query(
    `SELECT
       oi.fiscal_year,
       oi.fiscal_month,
       COALESCE(SUM(oil.line_total), 0)::NUMERIC AS revenue
     FROM outbound_invoice_lines oil
     JOIN outbound_invoices oi ON oi.id = oil.invoice_id
     WHERE oil.car_number = $1
       AND oi.status NOT IN ('void', 'draft')
     GROUP BY oi.fiscal_year, oi.fiscal_month
     ORDER BY oi.fiscal_year, oi.fiscal_month`,
    [carNumber]
  );

  // Cost breakdown by shopping event
  const costBreakdownResult = await pool.query(
    `SELECT
       se.id AS event_id,
       se.event_number,
       COALESCE(s.name, se.assigned_shop_code) AS shop_name,
       es.total_cost AS approved_cost
     FROM shopping_events se
     JOIN estimate_submissions es ON es.shopping_event_id = se.id
       AND es.status = 'approved'
     LEFT JOIN shops s ON s.shop_code = se.assigned_shop_code
     WHERE se.car_number = $1
     ORDER BY es.submitted_at DESC`,
    [carNumber]
  );

  const rev = revenueResult.rows[0];
  const repair = repairResult.rows[0];
  const assignment = assignmentResult.rows[0];

  const totalRevenue = parseFloat(rev.total_revenue) || 0;
  const totalRepairCost = parseFloat(repair.total_repair_cost) || 0;
  const totalAssignmentCost = parseFloat(assignment.total_assignment_cost) || 0;
  const totalCost = totalRepairCost + totalAssignmentCost;
  const netMargin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

  const dataAvailable = totalRevenue > 0 || totalCost > 0;

  return {
    data_available: dataAvailable,
    total_revenue: totalRevenue,
    rental_revenue: parseFloat(rev.rental_revenue) || 0,
    mileage_revenue: parseFloat(rev.mileage_revenue) || 0,
    chargeback_revenue: parseFloat(rev.chargeback_revenue) || 0,
    total_repair_cost: totalRepairCost,
    total_assignment_cost: totalAssignmentCost,
    net_margin: netMargin,
    margin_pct: marginPct,
    invoice_count: rev.invoice_count || 0,
    shopping_event_count: repair.shopping_event_count || 0,
    earliest_billing_period: rev.earliest_billing_period,
    latest_billing_period: rev.latest_billing_period,
    monthly_trend: trendResult.rows.map(r => ({
      fiscal_year: r.fiscal_year,
      fiscal_month: r.fiscal_month,
      revenue: parseFloat(r.revenue) || 0,
    })),
    cost_breakdown: costBreakdownResult.rows.map(r => ({
      event_id: r.event_id,
      event_number: r.event_number,
      shop_name: r.shop_name,
      approved_cost: parseFloat(r.approved_cost) || 0,
    })),
  };
}
