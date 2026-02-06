import { query, queryOne, transaction } from '../config/database';
import { logTransition } from './transition-log.service';

// Types
type EstimateStatus = 'submitted' | 'under_review' | 'approved' | 'changes_required' | 'rejected';
type DecisionSource = 'ai' | 'human';
type Decision = 'approve' | 'review' | 'reject';
type Responsibility = 'lessor' | 'customer' | 'unknown';

interface EstimateSubmission {
  id: string;
  shopping_event_id: string;
  version_number: number;
  submitted_by: string | null;
  submitted_at: Date;
  status: EstimateStatus;
  total_labor_hours: number;
  total_material_cost: number;
  total_cost: number;
  notes: string | null;
  attachments: any | null;
  created_at: Date;
  updated_at: Date;
}

interface EstimateLine {
  id: string;
  estimate_submission_id: string;
  line_number: number;
  aar_code: string | null;
  job_code: string | null;
  description: string | null;
  labor_hours: number | null;
  material_cost: number | null;
  total_cost: number | null;
  sow_item_id: string | null;
  created_at: Date;
}

interface EstimateLineDecision {
  id: string;
  estimate_line_id: string;
  decision_source: DecisionSource;
  decision: Decision;
  confidence_score: number | null;
  responsibility: Responsibility | null;
  basis_type: string | null;
  basis_reference: string | null;
  decision_notes: string | null;
  model_version: string | null;
  policy_version: string | null;
  decided_by_id: string | null;
  decided_at: Date;
  created_at: Date;
}

interface ApprovalPacket {
  id: string;
  estimate_submission_id: string;
  overall_decision: string;
  approved_line_ids: string[];
  rejected_line_ids: string[];
  revision_required_line_ids: string[];
  notes: string | null;
  released_to_shop_at: Date | null;
  released_by_id: string | null;
  created_at: Date;
}

interface SubmitEstimateLineInput {
  aar_code?: string;
  job_code?: string;
  description?: string;
  labor_hours?: number;
  material_cost?: number;
  total_cost?: number;
  sow_item_id?: string;
}

interface SubmitEstimateInput {
  shopping_event_id: string;
  submitted_by?: string;
  lines: SubmitEstimateLineInput[];
  notes?: string;
  attachments?: any;
}

interface RecordDecisionInput {
  estimate_line_id: string;
  decision_source: DecisionSource;
  decision: Decision;
  confidence_score?: number;
  responsibility?: Responsibility;
  basis_type?: string;
  basis_reference?: string;
  decision_notes?: string;
  model_version?: string;
  policy_version?: string;
}

interface LineDecisionInput {
  line_id: string;
  decision: Decision;
}

export async function submitEstimate(
  input: SubmitEstimateInput,
  userId?: string
): Promise<EstimateSubmission & { lines: EstimateLine[] }> {
  return transaction(async (client) => {
    // Get next version number
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM estimate_submissions
       WHERE shopping_event_id = $1`,
      [input.shopping_event_id]
    );
    const versionNumber = versionResult.rows[0].next_version;

    // Calculate totals from lines
    let totalLaborHours = 0;
    let totalMaterialCost = 0;
    let totalCost = 0;

    for (const line of input.lines) {
      totalLaborHours += line.labor_hours || 0;
      totalMaterialCost += line.material_cost || 0;
      totalCost += line.total_cost || 0;
    }

    // Insert estimate submission
    const submittedBy = input.submitted_by || userId || null;
    const submissionResult = await client.query(
      `INSERT INTO estimate_submissions (
        shopping_event_id,
        version_number,
        submitted_by,
        submitted_at,
        status,
        total_labor_hours,
        total_material_cost,
        total_cost,
        notes,
        attachments
      ) VALUES ($1, $2, $3, NOW(), 'submitted', $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        input.shopping_event_id,
        versionNumber,
        submittedBy,
        totalLaborHours,
        totalMaterialCost,
        totalCost,
        input.notes || null,
        input.attachments ? JSON.stringify(input.attachments) : null,
      ]
    );
    const submission = submissionResult.rows[0] as EstimateSubmission;

    // Insert estimate lines with auto-numbered line_number
    const lines: EstimateLine[] = [];
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      const lineResult = await client.query(
        `INSERT INTO estimate_lines (
          estimate_submission_id,
          line_number,
          aar_code,
          job_code,
          description,
          labor_hours,
          material_cost,
          total_cost,
          sow_item_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          submission.id,
          i + 1,
          line.aar_code || null,
          line.job_code || null,
          line.description || null,
          line.labor_hours || null,
          line.material_cost || null,
          line.total_cost || null,
          line.sow_item_id || null,
        ]
      );
      lines.push(lineResult.rows[0] as EstimateLine);
    }

    return { ...submission, lines };
  });
}

export async function getEstimate(
  id: string
): Promise<(EstimateSubmission & { lines: (EstimateLine & { latest_decision?: EstimateLineDecision })[] }) | null> {
  const submission = await queryOne<EstimateSubmission>(
    `SELECT * FROM estimate_submissions WHERE id = $1`,
    [id]
  );

  if (!submission) {
    return null;
  }

  const lines = await query<EstimateLine>(
    `SELECT * FROM estimate_lines WHERE estimate_submission_id = $1 ORDER BY line_number`,
    [id]
  );

  const linesWithDecisions = await Promise.all(
    lines.map(async (line) => {
      const latestDecision = await queryOne<EstimateLineDecision>(
        `SELECT * FROM estimate_line_decisions
         WHERE estimate_line_id = $1
         ORDER BY decided_at DESC
         LIMIT 1`,
        [line.id]
      );
      return {
        ...line,
        latest_decision: latestDecision || undefined,
      };
    })
  );

  return { ...submission, lines: linesWithDecisions };
}

export async function listEstimateVersions(
  shoppingEventId: string
): Promise<EstimateSubmission[]> {
  const result = await query<EstimateSubmission>(
    `SELECT * FROM estimate_submissions
     WHERE shopping_event_id = $1
     ORDER BY version_number DESC`,
    [shoppingEventId]
  );
  return result;
}

export async function recordLineDecision(
  input: RecordDecisionInput,
  userId?: string
): Promise<EstimateLineDecision & { is_override?: boolean; overridden_decision?: any }> {
  // --- DoD #4: Override detection ---
  // If this is a human decision, check if there is a prior AI decision on the same line
  let isOverride = false;
  let overriddenDecision: any = null;

  if (input.decision_source === 'human') {
    const priorAI = await queryOne<EstimateLineDecision>(
      `SELECT * FROM estimate_line_decisions
       WHERE estimate_line_id = $1 AND decision_source = 'ai'
       ORDER BY decided_at DESC LIMIT 1`,
      [input.estimate_line_id]
    );
    if (priorAI && priorAI.decision !== input.decision) {
      isOverride = true;
      overriddenDecision = priorAI;
    }
  }

  // Build notes that include override context when applicable
  let finalNotes = input.decision_notes || null;
  if (isOverride && overriddenDecision) {
    const overrideContext = `[OVERRIDE] Human overrode AI decision '${overriddenDecision.decision}' (confidence: ${overriddenDecision.confidence_score}) to '${input.decision}'.`;
    finalNotes = finalNotes
      ? `${overrideContext} ${finalNotes}`
      : overrideContext;
  }

  const result = await queryOne<EstimateLineDecision>(
    `INSERT INTO estimate_line_decisions (
      estimate_line_id,
      decision_source,
      decision,
      confidence_score,
      responsibility,
      basis_type,
      basis_reference,
      decision_notes,
      model_version,
      policy_version,
      decided_by_id,
      decided_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    RETURNING *`,
    [
      input.estimate_line_id,
      input.decision_source,
      input.decision,
      input.confidence_score || null,
      input.responsibility || null,
      input.basis_type || null,
      input.basis_reference || null,
      finalNotes,
      input.model_version || null,
      input.policy_version || null,
      userId || null,
    ]
  );

  return { ...result!, is_override: isOverride, overridden_decision: overriddenDecision };
}

export async function getLineDecisions(
  estimateLineId: string
): Promise<EstimateLineDecision[]> {
  const result = await query<EstimateLineDecision>(
    `SELECT * FROM estimate_line_decisions
     WHERE estimate_line_id = $1
     ORDER BY decided_at DESC`,
    [estimateLineId]
  );
  return result;
}

export async function updateEstimateStatus(
  id: string,
  status: EstimateStatus
): Promise<EstimateSubmission> {
  const result = await queryOne<EstimateSubmission>(
    `UPDATE estimate_submissions
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return result!;
}

export async function generateApprovalPacket(
  estimateId: string,
  overallDecision: string,
  lineDecisions: LineDecisionInput[],
  notes?: string,
  userId?: string
): Promise<ApprovalPacket> {
  // Validate overall_decision (DoD #5 — closed-loop: exactly one of these)
  const validDecisions = ['approved', 'changes_required', 'rejected'];
  if (!validDecisions.includes(overallDecision)) {
    throw new Error(
      `Invalid overall_decision '${overallDecision}'. Must be one of: ${validDecisions.join(', ')}`
    );
  }

  // Capture prior status for transition log
  const priorEstimate = await queryOne<{ status: EstimateStatus }>(
    `SELECT status FROM estimate_submissions WHERE id = $1`,
    [estimateId]
  );
  const fromState = priorEstimate?.status || 'submitted';

  const packet = await transaction(async (client) => {
    const approvedLineIds: string[] = [];
    const rejectedLineIds: string[] = [];
    const revisionRequiredLineIds: string[] = [];

    for (const ld of lineDecisions) {
      switch (ld.decision) {
        case 'approve':
          approvedLineIds.push(ld.line_id);
          break;
        case 'reject':
          rejectedLineIds.push(ld.line_id);
          break;
        case 'review':
          revisionRequiredLineIds.push(ld.line_id);
          break;
      }
    }

    // DoD #5: Update the estimate submission status to match the packet decision
    const statusMap: Record<string, EstimateStatus> = {
      approved: 'approved',
      changes_required: 'changes_required',
      rejected: 'rejected',
    };
    await client.query(
      `UPDATE estimate_submissions SET status = $2, updated_at = NOW() WHERE id = $1`,
      [estimateId, statusMap[overallDecision]]
    );

    // Postgres UUID[] columns need proper array format, not JSON strings
    const toUuidArray = (ids: string[]) => ids.length > 0 ? `{${ids.join(',')}}` : null;

    const packetResult = await client.query(
      `INSERT INTO approval_packets (
        estimate_submission_id,
        overall_decision,
        approved_line_ids,
        rejected_line_ids,
        revision_required_line_ids,
        notes
      ) VALUES ($1, $2, $3::uuid[], $4::uuid[], $5::uuid[], $6)
      RETURNING *`,
      [
        estimateId,
        overallDecision,
        toUuidArray(approvedLineIds),
        toUuidArray(rejectedLineIds),
        toUuidArray(revisionRequiredLineIds),
        notes || null,
      ]
    );

    return packetResult.rows[0] as ApprovalPacket;
  });

  // Log the estimate submission state transition (non-blocking)
  await logTransition({
    processType: 'estimate_submission',
    entityId: estimateId,
    fromState,
    toState: overallDecision, // 'approved' | 'changes_required' | 'rejected'
    isReversible: false, // estimate_line_decisions are immutable
    actorId: userId,
  }).catch(() => {}); // non-blocking

  return packet;
}

export async function releaseApprovalPacket(
  packetId: string,
  userId: string
): Promise<ApprovalPacket> {
  const result = await queryOne<ApprovalPacket>(
    `UPDATE approval_packets
     SET released_to_shop_at = NOW(),
         released_by_id = $2
     WHERE id = $1
     RETURNING *`,
    [packetId, userId]
  );
  return result!;
}

export async function getApprovalPacket(id: string): Promise<(ApprovalPacket & { estimate_submission?: EstimateSubmission }) | null> {
  const result = await queryOne<ApprovalPacket & { estimate_submission_id: string }>(
    `SELECT * FROM approval_packets WHERE id = $1`,
    [id]
  );

  if (!result) {
    return null;
  }

  const estimateSubmission = await queryOne<EstimateSubmission>(
    `SELECT * FROM estimate_submissions WHERE id = $1`,
    [result.estimate_submission_id]
  );

  return {
    ...result,
    estimate_submission: estimateSubmission || undefined,
  };
}
