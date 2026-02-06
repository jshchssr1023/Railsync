import { query, queryOne } from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetScenario {
  id: string;
  name: string;
  is_system: boolean;
  slider_assignment: number;
  slider_qualification: number;
  slider_commodity_conversion: number;
  slider_bad_orders: number;
  created_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface BudgetCategory {
  name: string;
  base: number;
  slider: number;
  impacted: number;
}

export interface ScenarioImpact {
  fiscal_year: number;
  scenario: {
    id: string;
    name: string;
    sliders: {
      assignment: number;
      qualification: number;
      commodity_conversion: number;
      bad_orders: number;
    };
  };
  running_repairs: { base: number };
  categories: BudgetCategory[];
  total: { base: number; impacted: number; delta: number };
}

export interface PipelineMetrics {
  fiscal_year: number;
  in_shop: number;
  enroute: number;
  completed: number;
  completed_qualifications: number;
  completed_assignments: number;
  completed_bad_orders: number;
}

// ============================================================================
// CRUD
// ============================================================================

export async function listScenarios(): Promise<BudgetScenario[]> {
  return query<BudgetScenario>(
    `SELECT * FROM budget_scenarios ORDER BY is_system DESC, name ASC`
  );
}

export async function getScenario(id: string): Promise<BudgetScenario | null> {
  return queryOne<BudgetScenario>(
    `SELECT * FROM budget_scenarios WHERE id = $1`,
    [id]
  );
}

export async function createCustomScenario(
  name: string,
  sliders: {
    assignment: number;
    qualification: number;
    commodity_conversion: number;
    bad_orders: number;
  },
  userId: string
): Promise<BudgetScenario | null> {
  return queryOne<BudgetScenario>(
    `INSERT INTO budget_scenarios (name, is_system, slider_assignment, slider_qualification, slider_commodity_conversion, slider_bad_orders, created_by)
     VALUES ($1, FALSE, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, sliders.assignment, sliders.qualification, sliders.commodity_conversion, sliders.bad_orders, userId]
  );
}

export async function updateCustomScenario(
  id: string,
  data: {
    name?: string;
    sliders?: {
      assignment: number;
      qualification: number;
      commodity_conversion: number;
      bad_orders: number;
    };
  },
  userId: string
): Promise<BudgetScenario | null> {
  // Verify it's not a system scenario
  const existing = await getScenario(id);
  if (!existing || existing.is_system) return null;

  const sets: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${paramIdx++}`);
    params.push(data.name);
  }
  if (data.sliders) {
    sets.push(`slider_assignment = $${paramIdx++}`);
    params.push(data.sliders.assignment);
    sets.push(`slider_qualification = $${paramIdx++}`);
    params.push(data.sliders.qualification);
    sets.push(`slider_commodity_conversion = $${paramIdx++}`);
    params.push(data.sliders.commodity_conversion);
    sets.push(`slider_bad_orders = $${paramIdx++}`);
    params.push(data.sliders.bad_orders);
  }

  sets.push(`updated_at = NOW()`);
  params.push(id);

  return queryOne<BudgetScenario>(
    `UPDATE budget_scenarios SET ${sets.join(', ')} WHERE id = $${paramIdx} AND is_system = FALSE RETURNING *`,
    params
  );
}

export async function deleteCustomScenario(id: string): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `DELETE FROM budget_scenarios WHERE id = $1 AND is_system = FALSE RETURNING id`,
    [id]
  );
  return !!result;
}

// ============================================================================
// IMPACT CALCULATION
// ============================================================================

export async function calculateImpact(scenarioId: string, fiscalYear: number): Promise<ScenarioImpact | null> {
  const scenario = await getScenario(scenarioId);
  if (!scenario) return null;

  // 1. Fetch base budgets from service_event_budget grouped by event_type
  const budgetRows = await query<{ event_type: string; total_budget: string }>(
    `SELECT event_type, SUM(total_budget) AS total_budget
     FROM service_event_budget
     WHERE fiscal_year = $1
     GROUP BY event_type`,
    [fiscalYear]
  );

  // Map event_types to our categories
  // event_type 'Assignment' → Assignment, 'Qualification' → Qualification, 'Return' → Commodity Conversion
  const baseBudgets: Record<string, number> = {
    'Assignment': 0,
    'Qualification': 0,
    'Commodity Conversion': 0,
    'Bad Orders': 0,
  };

  for (const row of budgetRows) {
    const budget = parseFloat(row.total_budget) || 0;
    if (row.event_type === 'Assignment') baseBudgets['Assignment'] = budget;
    else if (row.event_type === 'Qualification') baseBudgets['Qualification'] = budget;
    else if (row.event_type === 'Return') baseBudgets['Commodity Conversion'] = budget;
  }

  // Bad orders: no dedicated budget table, so derive from service_event_budget
  // where event_type captures bad order costs, or default to 0 if not tracked separately.
  // The 'Bad Orders' category exists for scenario modeling even if base is 0.

  // 2. Fetch running repairs total (static)
  const rrResult = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(monthly_budget), 0) AS total
     FROM running_repairs_budget
     WHERE fiscal_year = $1`,
    [fiscalYear]
  );
  const runningRepairsBase = parseFloat(rrResult?.total || '0');

  // 3. Calculate impacts per category
  const sliderMap: Record<string, number> = {
    'Assignment': Number(scenario.slider_assignment),
    'Qualification': Number(scenario.slider_qualification),
    'Commodity Conversion': Number(scenario.slider_commodity_conversion),
    'Bad Orders': Number(scenario.slider_bad_orders),
  };

  const categories: BudgetCategory[] = Object.keys(baseBudgets).map((name) => {
    const base = baseBudgets[name];
    const slider = sliderMap[name];
    const impacted = base * (1 + slider / 100);
    return { name, base, slider, impacted };
  });

  // 4. Totals
  const baseTotal = runningRepairsBase + categories.reduce((sum, c) => sum + c.base, 0);
  const impactedTotal = runningRepairsBase + categories.reduce((sum, c) => sum + c.impacted, 0);

  return {
    fiscal_year: fiscalYear,
    scenario: {
      id: scenario.id,
      name: scenario.name,
      sliders: {
        assignment: Number(scenario.slider_assignment),
        qualification: Number(scenario.slider_qualification),
        commodity_conversion: Number(scenario.slider_commodity_conversion),
        bad_orders: Number(scenario.slider_bad_orders),
      },
    },
    running_repairs: { base: runningRepairsBase },
    categories,
    total: {
      base: baseTotal,
      impacted: impactedTotal,
      delta: impactedTotal - baseTotal,
    },
  };
}

// ============================================================================
// PIPELINE METRICS
// ============================================================================

export async function getPipelineMetrics(fiscalYear: number): Promise<PipelineMetrics> {
  const result = await queryOne<{
    in_shop: string;
    enroute: string;
    completed: string;
    completed_qualifications: string;
    completed_assignments: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE a.status = 'Arrived') AS in_shop,
       COUNT(*) FILTER (WHERE a.status = 'Enroute') AS enroute,
       COUNT(*) FILTER (WHERE a.status IN ('Complete', 'Released')) AS completed,
       COUNT(*) FILTER (WHERE a.status IN ('Complete', 'Released') AND d.event_type = 'Qualification') AS completed_qualifications,
       COUNT(*) FILTER (WHERE a.status IN ('Complete', 'Released') AND d.event_type = 'Assignment') AS completed_assignments
     FROM allocations a
     LEFT JOIN demands d ON d.id = a.demand_id
     WHERE d.fiscal_year = $1`,
    [fiscalYear]
  );

  // Bad orders resolved count
  const boResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM bad_order_reports
     WHERE status = 'resolved'
       AND EXTRACT(YEAR FROM reported_date) = $1`,
    [fiscalYear]
  );

  return {
    fiscal_year: fiscalYear,
    in_shop: parseInt(result?.in_shop || '0'),
    enroute: parseInt(result?.enroute || '0'),
    completed: parseInt(result?.completed || '0'),
    completed_qualifications: parseInt(result?.completed_qualifications || '0'),
    completed_assignments: parseInt(result?.completed_assignments || '0'),
    completed_bad_orders: parseInt(boResult?.count || '0'),
  };
}
