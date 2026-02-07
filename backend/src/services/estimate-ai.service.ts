/**
 * Estimate AI Pre-Review Service
 *
 * Rule-based pre-review for estimate line items. Assigns confidence scores
 * and approve/review/reject decisions based on historical data and policy rules.
 *
 * Phase 1: Rules only (no ML). Rules check:
 *   1. Cost within historical range for job code
 *   2. Labor hours within bounds for job code
 *   3. Material markup within policy threshold
 *   4. Total cost sanity check (not abnormally high/low)
 */

import { query, queryOne } from '../config/database';

// Types
type Decision = 'approve' | 'review' | 'reject';

interface PreReviewRule {
  name: string;
  weight: number;
  evaluate: (line: EstimateLine, context: ReviewContext) => RuleResult;
}

interface RuleResult {
  passed: boolean;
  confidence: number; // 0-1
  note: string;
}

interface EstimateLine {
  id: string;
  line_number: number;
  aar_code: string | null;
  job_code: string | null;
  description: string | null;
  labor_hours: number | null;
  material_cost: number | null;
  total_cost: number | null;
}

interface ReviewContext {
  historical: HistoricalStats | null;
  policyMaxMaterialMarkup: number;
  policyMaxLineTotal: number;
  policyMinLineTotal: number;
}

interface HistoricalStats {
  job_code: string;
  avg_total_cost: number;
  stddev_total_cost: number;
  avg_labor_hours: number;
  stddev_labor_hours: number;
  avg_material_cost: number;
  sample_count: number;
}

interface LinePreReview {
  estimate_line_id: string;
  line_number: number;
  decision: Decision;
  confidence_score: number;
  rule_results: { rule: string; passed: boolean; confidence: number; note: string }[];
  basis_type: string;
  basis_reference: string;
}

interface PreReviewResult {
  submission_id: string;
  lines_reviewed: number;
  auto_approved: number;
  needs_review: number;
  auto_rejected: number;
  overall_confidence: number;
  line_reviews: LinePreReview[];
}

// =============================================================================
// POLICY CONSTANTS
// =============================================================================

const POLICY_MAX_MATERIAL_MARKUP = 1.5;   // Material cost shouldn't be >150% of historical avg
const POLICY_MAX_LINE_TOTAL = 50000;       // Flag any single line over $50k
const POLICY_MIN_LINE_TOTAL = 10;          // Flag suspiciously low totals
const CONFIDENCE_AUTO_APPROVE = 0.85;      // >= 85% confidence = auto-approve
const CONFIDENCE_REVIEW = 0.50;            // >= 50% but < 85% = needs review
                                            // < 50% = reject/flag
const MODEL_VERSION = 'rules-v1.0';
const POLICY_VERSION = 'policy-2026-01';

// =============================================================================
// RULES
// =============================================================================

const RULES: PreReviewRule[] = [
  {
    name: 'cost_within_historical_range',
    weight: 0.35,
    evaluate: (line, ctx) => {
      if (!ctx.historical || ctx.historical.sample_count < 3) {
        return { passed: true, confidence: 0.5, note: 'Insufficient historical data for comparison' };
      }
      const cost = line.total_cost || 0;
      const { avg_total_cost, stddev_total_cost } = ctx.historical;
      const deviation = stddev_total_cost > 0 ? Math.abs(cost - avg_total_cost) / stddev_total_cost : 0;

      if (deviation <= 1) return { passed: true, confidence: 0.95, note: `Cost within 1 std dev of historical avg ($${avg_total_cost.toFixed(0)})` };
      if (deviation <= 2) return { passed: true, confidence: 0.7, note: `Cost within 2 std devs — slightly elevated vs avg ($${avg_total_cost.toFixed(0)})` };
      if (deviation <= 3) return { passed: false, confidence: 0.3, note: `Cost 2-3 std devs from avg ($${avg_total_cost.toFixed(0)}). Review recommended.` };
      return { passed: false, confidence: 0.1, note: `Cost >3 std devs from historical avg ($${avg_total_cost.toFixed(0)}). Likely outlier.` };
    },
  },
  {
    name: 'labor_hours_within_bounds',
    weight: 0.25,
    evaluate: (line, ctx) => {
      if (!line.labor_hours || line.labor_hours === 0) {
        return { passed: true, confidence: 0.6, note: 'No labor hours specified' };
      }
      if (!ctx.historical || ctx.historical.sample_count < 3) {
        return { passed: true, confidence: 0.5, note: 'Insufficient historical labor data' };
      }
      const { avg_labor_hours, stddev_labor_hours } = ctx.historical;
      if (avg_labor_hours === 0) return { passed: true, confidence: 0.5, note: 'No historical labor data' };

      const deviation = stddev_labor_hours > 0 ? Math.abs(line.labor_hours - avg_labor_hours) / stddev_labor_hours : 0;

      if (deviation <= 1.5) return { passed: true, confidence: 0.9, note: `Labor hours within normal range (avg: ${avg_labor_hours.toFixed(1)}h)` };
      if (deviation <= 2.5) return { passed: false, confidence: 0.4, note: `Labor hours elevated vs avg (${avg_labor_hours.toFixed(1)}h)` };
      return { passed: false, confidence: 0.15, note: `Labor hours significantly exceed historical average (${avg_labor_hours.toFixed(1)}h)` };
    },
  },
  {
    name: 'material_markup_check',
    weight: 0.2,
    evaluate: (line, ctx) => {
      if (!line.material_cost || line.material_cost === 0) {
        return { passed: true, confidence: 0.7, note: 'No material cost' };
      }
      if (!ctx.historical || ctx.historical.avg_material_cost === 0) {
        return { passed: true, confidence: 0.5, note: 'No historical material data' };
      }
      const ratio = line.material_cost / ctx.historical.avg_material_cost;
      if (ratio <= 1.2) return { passed: true, confidence: 0.95, note: `Material cost within 20% of historical avg` };
      if (ratio <= ctx.policyMaxMaterialMarkup) return { passed: true, confidence: 0.65, note: `Material cost elevated (${Math.round(ratio * 100)}% of avg) but within policy limit` };
      return { passed: false, confidence: 0.2, note: `Material cost exceeds policy limit (${Math.round(ratio * 100)}% of avg, max ${ctx.policyMaxMaterialMarkup * 100}%)` };
    },
  },
  {
    name: 'total_cost_sanity',
    weight: 0.2,
    evaluate: (line, ctx) => {
      const cost = line.total_cost || 0;
      if (cost < ctx.policyMinLineTotal) {
        return { passed: false, confidence: 0.3, note: `Total cost ($${cost}) below minimum threshold ($${ctx.policyMinLineTotal})` };
      }
      if (cost > ctx.policyMaxLineTotal) {
        return { passed: false, confidence: 0.2, note: `Total cost ($${cost.toLocaleString()}) exceeds single-line limit ($${ctx.policyMaxLineTotal.toLocaleString()})` };
      }
      return { passed: true, confidence: 0.9, note: 'Cost within sanity bounds' };
    },
  },
];

// =============================================================================
// HISTORICAL DATA LOOKUP
// =============================================================================

async function getHistoricalStats(jobCode: string): Promise<HistoricalStats | null> {
  if (!jobCode) return null;

  const result = await queryOne<any>(`
    SELECT
      eli.job_code,
      AVG(eli.total_cost) as avg_total_cost,
      STDDEV_POP(eli.total_cost) as stddev_total_cost,
      AVG(eli.labor_hours) as avg_labor_hours,
      STDDEV_POP(eli.labor_hours) as stddev_labor_hours,
      AVG(eli.material_cost) as avg_material_cost,
      COUNT(*) as sample_count
    FROM estimate_line_items eli
    JOIN estimate_submissions es ON es.id = eli.estimate_submission_id
    WHERE eli.job_code = $1
      AND es.status = 'approved'
      AND es.submitted_at >= CURRENT_DATE - INTERVAL '2 years'
    GROUP BY eli.job_code
  `, [jobCode]);

  if (!result || parseInt(result.sample_count) === 0) return null;

  return {
    job_code: result.job_code,
    avg_total_cost: parseFloat(result.avg_total_cost) || 0,
    stddev_total_cost: parseFloat(result.stddev_total_cost) || 0,
    avg_labor_hours: parseFloat(result.avg_labor_hours) || 0,
    stddev_labor_hours: parseFloat(result.stddev_labor_hours) || 0,
    avg_material_cost: parseFloat(result.avg_material_cost) || 0,
    sample_count: parseInt(result.sample_count),
  };
}

// =============================================================================
// PRE-REVIEW ENGINE
// =============================================================================

export async function preReviewEstimate(submissionId: string): Promise<PreReviewResult> {
  // Get submission + lines
  const submission = await queryOne<any>(
    `SELECT id, status FROM estimate_submissions WHERE id = $1`,
    [submissionId]
  );
  if (!submission) throw new Error('Estimate submission not found');

  const lines = await query<EstimateLine>(
    `SELECT id, line_number, aar_code, job_code, description, labor_hours, material_cost, total_cost
     FROM estimate_line_items
     WHERE estimate_submission_id = $1
     ORDER BY line_number`,
    [submissionId]
  );

  const lineReviews: LinePreReview[] = [];
  let autoApproved = 0;
  let needsReview = 0;
  let autoRejected = 0;

  for (const line of lines) {
    const codeForLookup = line.job_code || line.aar_code || '';
    const historical = await getHistoricalStats(codeForLookup);

    const context: ReviewContext = {
      historical,
      policyMaxMaterialMarkup: POLICY_MAX_MATERIAL_MARKUP,
      policyMaxLineTotal: POLICY_MAX_LINE_TOTAL,
      policyMinLineTotal: POLICY_MIN_LINE_TOTAL,
    };

    // Run all rules
    const ruleResults = RULES.map(rule => {
      const result = rule.evaluate(line, context);
      return { rule: rule.name, weight: rule.weight, ...result };
    });

    // Calculate weighted confidence
    const totalWeight = ruleResults.reduce((sum, r) => sum + r.weight, 0);
    const weightedConfidence = ruleResults.reduce((sum, r) => sum + r.confidence * r.weight, 0) / totalWeight;

    // Determine decision
    let decision: Decision;
    if (weightedConfidence >= CONFIDENCE_AUTO_APPROVE && ruleResults.every(r => r.passed || r.confidence >= 0.6)) {
      decision = 'approve';
      autoApproved++;
    } else if (weightedConfidence >= CONFIDENCE_REVIEW) {
      decision = 'review';
      needsReview++;
    } else {
      decision = 'reject';
      autoRejected++;
    }

    // Record decision in database
    await query(
      `INSERT INTO estimate_line_decisions
         (estimate_line_id, decision_source, decision, confidence_score,
          basis_type, basis_reference, decision_notes, model_version, policy_version, decided_at)
       VALUES ($1, 'ai', $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        line.id,
        decision,
        Math.round(weightedConfidence * 100) / 100,
        'rule_engine',
        historical ? `historical:${historical.sample_count} samples` : 'no_historical_data',
        ruleResults.map(r => `${r.rule}: ${r.passed ? 'PASS' : 'FAIL'} (${Math.round(r.confidence * 100)}%) - ${r.note}`).join('; '),
        MODEL_VERSION,
        POLICY_VERSION,
      ]
    );

    lineReviews.push({
      estimate_line_id: line.id,
      line_number: line.line_number,
      decision,
      confidence_score: Math.round(weightedConfidence * 100) / 100,
      rule_results: ruleResults.map(r => ({ rule: r.rule, passed: r.passed, confidence: r.confidence, note: r.note })),
      basis_type: 'rule_engine',
      basis_reference: historical ? `${historical.sample_count} historical samples` : 'no data',
    });
  }

  // Update submission status to under_review
  await query(
    `UPDATE estimate_submissions SET status = 'under_review', updated_at = NOW() WHERE id = $1`,
    [submissionId]
  );

  const overallConfidence = lineReviews.length > 0
    ? Math.round((lineReviews.reduce((sum, r) => sum + r.confidence_score, 0) / lineReviews.length) * 100) / 100
    : 0;

  return {
    submission_id: submissionId,
    lines_reviewed: lines.length,
    auto_approved: autoApproved,
    needs_review: needsReview,
    auto_rejected: autoRejected,
    overall_confidence: overallConfidence,
    line_reviews: lineReviews,
  };
}

/**
 * Get historical cost stats for a job code (for UI display).
 */
export async function getJobCodeStats(jobCode: string): Promise<HistoricalStats | null> {
  return getHistoricalStats(jobCode);
}
