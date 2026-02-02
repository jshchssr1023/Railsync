/**
 * Bad Order Controller - API endpoints for bad order reports
 */

import { Request, Response } from 'express';
import * as badOrderService from '../services/badOrder.service';
import { logFromRequest } from '../services/audit.service';

export async function createBadOrder(req: Request, res: Response): Promise<void> {
  try {
    const { car_number, issue_type, issue_description, severity, location, reported_by, reporter_contact } = req.body;

    if (!car_number || !issue_type || !issue_description || !severity) {
      res.status(400).json({
        success: false,
        error: 'car_number, issue_type, issue_description, and severity are required',
      });
      return;
    }

    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (!validSeverities.includes(severity)) {
      res.status(400).json({
        success: false,
        error: `severity must be one of: ${validSeverities.join(', ')}`,
      });
      return;
    }

    const badOrder = await badOrderService.createBadOrder({
      car_number,
      issue_type,
      issue_description,
      severity,
      location,
      reported_by,
      reporter_contact,
      created_by_id: req.user?.id,
    });

    await logFromRequest(req, 'create', 'bad_order_reports', badOrder.id, undefined, {
      car_number,
      severity,
      has_existing_plan: badOrder.had_existing_plan,
    });

    res.status(201).json({
      success: true,
      data: badOrder,
      has_existing_plan: badOrder.had_existing_plan,
    });
  } catch (error) {
    console.error('Create bad order error:', error);
    res.status(500).json({ success: false, error: 'Failed to create bad order' });
  }
}

export async function getBadOrder(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const badOrder = await badOrderService.getBadOrder(id);

    if (!badOrder) {
      res.status(404).json({ success: false, error: 'Bad order not found' });
      return;
    }

    res.json({ success: true, data: badOrder });
  } catch (error) {
    console.error('Get bad order error:', error);
    res.status(500).json({ success: false, error: 'Failed to get bad order' });
  }
}

export async function listBadOrders(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_number: req.query.car_number as string,
      status: req.query.status as badOrderService.BadOrderStatus,
      severity: req.query.severity as badOrderService.BadOrderSeverity,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await badOrderService.listBadOrders(filters);
    res.json({ success: true, data: result.reports, total: result.total });
  } catch (error) {
    console.error('List bad orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to list bad orders' });
  }
}

export async function resolveBadOrder(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { action, assignment_id, resolution_notes } = req.body;

    if (!action) {
      res.status(400).json({ success: false, error: 'action is required' });
      return;
    }

    const validActions = ['expedite_existing', 'new_shop_combined', 'repair_only', 'planning_review'];
    if (!validActions.includes(action)) {
      res.status(400).json({
        success: false,
        error: `action must be one of: ${validActions.join(', ')}`,
      });
      return;
    }

    const badOrder = await badOrderService.resolveBadOrder(id, {
      action,
      assignment_id,
      resolution_notes,
      resolved_by_id: req.user?.id,
    });

    if (!badOrder) {
      res.status(404).json({ success: false, error: 'Bad order not found' });
      return;
    }

    await logFromRequest(req, 'update', 'bad_order_reports', id, undefined, {
      action,
      assignment_id,
    });

    res.json({ success: true, data: badOrder });
  } catch (error) {
    console.error('Resolve bad order error:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve bad order' });
  }
}

export default {
  createBadOrder,
  getBadOrder,
  listBadOrders,
  resolveBadOrder,
};
