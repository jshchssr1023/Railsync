import { Request, Response } from 'express';
import {
  submitEstimate as submitEstimateService,
  getEstimate as getEstimateService,
  listEstimateVersions as listEstimateVersionsService,
  recordLineDecision as recordLineDecisionService,
  getLineDecisions as getLineDecisionsService,
  updateEstimateStatus as updateEstimateStatusService,
  generateApprovalPacket as generateApprovalPacketService,
  getApprovalPacket as getApprovalPacketService,
  releaseApprovalPacket as releaseApprovalPacketService,
} from '../services/estimate-workflow.service';

// POST /api/shopping-events/:id/estimates
export async function submitEstimate(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const input = {
      shopping_event_id: req.params.id,
      ...req.body,
    };
    const estimate = await submitEstimateService(input, userId);
    res.status(201).json(estimate);
  } catch (error: any) {
    console.error('Error submitting estimate:', error);
    res.status(500).json({ error: error.message || 'Failed to submit estimate' });
  }
}

// GET /api/shopping-events/:id/estimates
export async function listEstimateVersions(req: Request, res: Response): Promise<void> {
  try {
    const versions = await listEstimateVersionsService(req.params.id);
    res.json(versions);
  } catch (error: any) {
    console.error('Error listing estimate versions:', error);
    res.status(500).json({ error: error.message || 'Failed to list estimate versions' });
  }
}

// GET /api/estimates/:id
export async function getEstimate(req: Request, res: Response): Promise<void> {
  try {
    const estimate = await getEstimateService(req.params.id);
    if (!estimate) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }
    res.json(estimate);
  } catch (error: any) {
    console.error('Error getting estimate:', error);
    res.status(500).json({ error: error.message || 'Failed to get estimate' });
  }
}

// POST /api/estimates/:id/decisions
export async function recordLineDecisions(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { decisions } = req.body;

    if (!Array.isArray(decisions) || decisions.length === 0) {
      res.status(400).json({ error: 'decisions array is required and must not be empty' });
      return;
    }

    const createdDecisions = [];
    for (const decisionInput of decisions) {
      const created = await recordLineDecisionService(decisionInput, userId);
      createdDecisions.push(created);
    }

    res.status(201).json(createdDecisions);
  } catch (error: any) {
    console.error('Error recording line decisions:', error);
    res.status(500).json({ error: error.message || 'Failed to record line decisions' });
  }
}

// GET /api/estimates/:id/decisions
export async function getEstimateDecisions(req: Request, res: Response): Promise<void> {
  try {
    // First get all lines for this estimate, then get decisions for each
    const estimate = await getEstimateService(req.params.id);
    if (!estimate) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    const allDecisions = [];
    for (const line of estimate.lines) {
      const lineDecisions = await getLineDecisionsService(line.id);
      allDecisions.push(
        ...lineDecisions.map((d) => ({
          ...d,
          line_number: line.line_number,
        }))
      );
    }

    res.json(allDecisions);
  } catch (error: any) {
    console.error('Error getting estimate decisions:', error);
    res.status(500).json({ error: error.message || 'Failed to get estimate decisions' });
  }
}

// PUT /api/estimates/:id/status
export async function updateEstimateStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const estimate = await updateEstimateStatusService(req.params.id, status);
    res.json(estimate);
  } catch (error: any) {
    console.error('Error updating estimate status:', error);
    res.status(500).json({ error: error.message || 'Failed to update estimate status' });
  }
}

// POST /api/estimates/:id/approval-packet
export async function generateApprovalPacket(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { overall_decision, line_decisions, notes } = req.body;
    const packet = await generateApprovalPacketService(
      req.params.id,
      overall_decision,
      line_decisions,
      notes,
      userId
    );
    res.status(201).json(packet);
  } catch (error: any) {
    console.error('Error generating approval packet:', error);
    res.status(500).json({ error: error.message || 'Failed to generate approval packet' });
  }
}

// GET /api/approval-packets/:id
export async function getApprovalPacket(req: Request, res: Response): Promise<void> {
  try {
    const packet = await getApprovalPacketService(req.params.id);
    if (!packet) {
      res.status(404).json({ error: 'Approval packet not found' });
      return;
    }
    res.json(packet);
  } catch (error: any) {
    console.error('Error getting approval packet:', error);
    res.status(500).json({ error: error.message || 'Failed to get approval packet' });
  }
}

// POST /api/approval-packets/:id/release
export async function releaseApprovalPacket(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const packet = await releaseApprovalPacketService(req.params.id, userId);
    res.json(packet);
  } catch (error: any) {
    console.error('Error releasing approval packet:', error);
    res.status(500).json({ error: error.message || 'Failed to release approval packet' });
  }
}
