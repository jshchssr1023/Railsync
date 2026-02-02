/**
 * Assignment Controller - API endpoints for SSOT car assignments
 */

import { Request, Response } from 'express';
import * as assignmentService from '../services/assignment.service';
import * as serviceOptionService from '../services/serviceOption.service';
import { logFromRequest } from '../services/audit.service';

// ============================================================================
// ASSIGNMENTS
// ============================================================================

export async function listAssignments(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_number: req.query.car_number as string,
      shop_code: req.query.shop_code as string,
      target_month: req.query.target_month as string,
      status: req.query.status as assignmentService.AssignmentStatus,
      source: req.query.source as assignmentService.AssignmentSource,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await assignmentService.listAssignments(filters);
    res.json({ success: true, data: result.assignments, total: result.total });
  } catch (error) {
    console.error('List assignments error:', error);
    res.status(500).json({ success: false, error: 'Failed to list assignments' });
  }
}

export async function getAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const assignment = await assignmentService.getAssignment(id);

    if (!assignment) {
      res.status(404).json({ success: false, error: 'Assignment not found' });
      return;
    }

    // Include service options
    const serviceOptions = await serviceOptionService.getServiceOptionsForAssignment(id);

    res.json({ success: true, data: { ...assignment, service_options: serviceOptions } });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ success: false, error: 'Failed to get assignment' });
  }
}

export async function createAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { car_number, shop_code, target_month, target_date, priority, estimated_cost, source, service_options } = req.body;

    if (!car_number || !shop_code || !target_month || !source) {
      res.status(400).json({ success: false, error: 'car_number, shop_code, target_month, and source are required' });
      return;
    }

    // Check for conflicts first
    const conflict = await assignmentService.checkConflicts(car_number);
    if (conflict) {
      res.status(409).json({
        success: false,
        error: 'Conflict detected',
        conflict,
      });
      return;
    }

    const assignment = await assignmentService.createAssignment({
      car_number,
      shop_code,
      target_month,
      target_date,
      priority,
      estimated_cost,
      source,
      created_by_id: req.user?.id,
    });

    // Add service options if provided
    if (service_options && Array.isArray(service_options)) {
      await serviceOptionService.bulkCreateServiceOptions(assignment.id, service_options);
    }

    await logFromRequest(req, 'create', 'car_assignment', assignment.id, undefined, { car_number, shop_code });

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error('Create assignment error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create assignment';
    res.status(400).json({ success: false, error: message });
  }
}

export async function updateAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const assignment = await assignmentService.updateAssignment(id, {
      ...updates,
      updated_by_id: req.user?.id,
    });

    await logFromRequest(req, 'update', 'car_assignment', id, undefined, updates);

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Update assignment error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update assignment';
    res.status(400).json({ success: false, error: message });
  }
}

export async function updateAssignmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ success: false, error: 'status is required' });
      return;
    }

    const assignment = await assignmentService.updateStatus(id, status, req.user?.id);
    await logFromRequest(req, 'update', 'car_assignment', id, undefined, { status });

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(400).json({ success: false, error: 'Failed to update status' });
  }
}

export async function cancelAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: 'reason is required' });
      return;
    }

    const assignment = await assignmentService.cancelAssignment(id, reason, req.user?.id);
    await logFromRequest(req, 'delete', 'car_assignment', id, undefined, { reason });

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Cancel assignment error:', error);
    res.status(400).json({ success: false, error: 'Failed to cancel assignment' });
  }
}

export async function expediteAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: 'reason is required' });
      return;
    }

    const assignment = await assignmentService.expediteAssignment(id, reason, req.user?.id);
    await logFromRequest(req, 'update', 'car_assignment', id, undefined, { action: 'expedite', reason });

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Expedite assignment error:', error);
    res.status(400).json({ success: false, error: 'Failed to expedite assignment' });
  }
}

export async function checkConflicts(req: Request, res: Response): Promise<void> {
  try {
    const { car_number } = req.query;

    if (!car_number) {
      res.status(400).json({ success: false, error: 'car_number is required' });
      return;
    }

    const conflict = await assignmentService.checkConflicts(car_number as string);
    res.json({ success: true, data: { has_conflict: !!conflict, conflict } });
  } catch (error) {
    console.error('Check conflicts error:', error);
    res.status(500).json({ success: false, error: 'Failed to check conflicts' });
  }
}

// ============================================================================
// SERVICE OPTIONS
// ============================================================================

export async function getServiceOptions(req: Request, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params;
    const options = await serviceOptionService.getServiceOptionsForAssignment(assignmentId);
    res.json({ success: true, data: options });
  } catch (error) {
    console.error('Get service options error:', error);
    res.status(500).json({ success: false, error: 'Failed to get service options' });
  }
}

export async function addServiceOption(req: Request, res: Response): Promise<void> {
  try {
    const { assignmentId } = req.params;
    const input = { ...req.body, assignment_id: assignmentId, added_by_id: req.user?.id };

    const option = await serviceOptionService.createServiceOption(input);
    await logFromRequest(req, 'create', 'service_option', option.id, undefined, { assignment_id: assignmentId });

    res.status(201).json({ success: true, data: option });
  } catch (error) {
    console.error('Add service option error:', error);
    res.status(400).json({ success: false, error: 'Failed to add service option' });
  }
}

export async function updateServiceOption(req: Request, res: Response): Promise<void> {
  try {
    const { optionId } = req.params;
    const option = await serviceOptionService.updateServiceOption(optionId, req.body);
    res.json({ success: true, data: option });
  } catch (error) {
    console.error('Update service option error:', error);
    res.status(400).json({ success: false, error: 'Failed to update service option' });
  }
}

export async function deleteServiceOption(req: Request, res: Response): Promise<void> {
  try {
    const { optionId } = req.params;
    await serviceOptionService.deleteServiceOption(optionId);
    res.json({ success: true, message: 'Service option deleted' });
  } catch (error) {
    console.error('Delete service option error:', error);
    res.status(400).json({ success: false, error: 'Failed to delete service option' });
  }
}

export async function suggestServiceOptions(req: Request, res: Response): Promise<void> {
  try {
    const { car_number } = req.params;
    const targetDate = req.query.target_date
      ? new Date(req.query.target_date as string)
      : new Date();

    const suggestions = await serviceOptionService.suggestServiceOptions(car_number, targetDate);

    // Calculate summary
    const selected = suggestions.filter(s => s.is_selected);
    const summary = {
      total_options: suggestions.length,
      selected_count: selected.length,
      required_count: suggestions.filter(s => s.is_required).length,
      estimated_total: selected.reduce((sum, s) => sum + (s.estimated_cost || 0), 0),
      estimated_hours: selected.reduce((sum, s) => sum + (s.estimated_hours || 0), 0),
    };

    res.json({ success: true, data: { options: suggestions, summary } });
  } catch (error) {
    console.error('Suggest service options error:', error);
    res.status(500).json({ success: false, error: 'Failed to suggest service options' });
  }
}

export default {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  updateAssignmentStatus,
  cancelAssignment,
  expediteAssignment,
  checkConflicts,
  getServiceOptions,
  addServiceOption,
  updateServiceOption,
  deleteServiceOption,
  suggestServiceOptions,
};
