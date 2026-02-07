import { Request, Response } from 'express';
import logger from '../config/logger';
import qualificationService from '../services/qualification.service';

// GET /api/qualifications/types
export async function listTypes(req: Request, res: Response): Promise<void> {
  try {
    const types = await qualificationService.listQualificationTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    logger.error({ err: error }, '[QualController] listTypes error');
    res.status(500).json({ success: false, error: 'Failed to list qualification types' });
  }
}

// GET /api/qualifications/stats
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await qualificationService.getQualificationStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error({ err: error }, '[QualController] getStats error');
    res.status(500).json({ success: false, error: 'Failed to get qualification stats' });
  }
}

// GET /api/qualifications/due-by-month
export async function getDueByMonth(req: Request, res: Response): Promise<void> {
  try {
    const data = await qualificationService.getDueByMonth();
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, '[QualController] getDueByMonth error');
    res.status(500).json({ success: false, error: 'Failed to get due-by-month data' });
  }
}

// GET /api/qualifications/alerts
export async function getAlerts(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      alert_type: req.query.alert_type as string | undefined,
      is_acknowledged: req.query.is_acknowledged !== undefined
        ? req.query.is_acknowledged === 'true'
        : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await qualificationService.getAlerts(filters);
    res.json({ success: true, data: result.alerts, total: result.total });
  } catch (error) {
    logger.error({ err: error }, '[QualController] getAlerts error');
    res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
}

// POST /api/qualifications/alerts/:id/acknowledge
export async function acknowledgeAlert(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const success = await qualificationService.acknowledgeAlert(req.params.id, userId);
    if (!success) {
      res.status(404).json({ success: false, error: 'Alert not found or already acknowledged' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, '[QualController] acknowledgeAlert error');
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
}

// POST /api/qualifications/recalculate
export async function recalculate(req: Request, res: Response): Promise<void> {
  try {
    const result = await qualificationService.recalculateAllStatuses();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, '[QualController] recalculate error');
    res.status(500).json({ success: false, error: 'Failed to recalculate statuses' });
  }
}

// POST /api/qualifications/generate-alerts
export async function generateAlerts(req: Request, res: Response): Promise<void> {
  try {
    const result = await qualificationService.generateAlerts();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ err: error }, '[QualController] generateAlerts error');
    res.status(500).json({ success: false, error: 'Failed to generate alerts' });
  }
}

// GET /api/qualifications
export async function listQualifications(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      car_id: req.query.car_id as string | undefined,
      qualification_type_id: req.query.qualification_type_id as string | undefined,
      type_code: req.query.type_code as string | undefined,
      status: req.query.status as string | undefined,
      lessee_code: req.query.lessee_code as string | undefined,
      current_region: req.query.current_region as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };
    const result = await qualificationService.listQualifications(filters);
    res.json({ success: true, data: result.qualifications, total: result.total });
  } catch (error) {
    logger.error({ err: error }, '[QualController] listQualifications error');
    res.status(500).json({ success: false, error: 'Failed to list qualifications' });
  }
}

// GET /api/qualifications/:id
export async function getQualification(req: Request, res: Response): Promise<void> {
  try {
    const qual = await qualificationService.getQualificationById(req.params.id);
    if (!qual) {
      res.status(404).json({ success: false, error: 'Qualification not found' });
      return;
    }
    res.json({ success: true, data: qual });
  } catch (error) {
    logger.error({ err: error }, '[QualController] getQualification error');
    res.status(500).json({ success: false, error: 'Failed to get qualification' });
  }
}

// GET /api/qualifications/:id/history
export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await qualificationService.getQualificationHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error({ err: error }, '[QualController] getHistory error');
    res.status(500).json({ success: false, error: 'Failed to get qualification history' });
  }
}

// POST /api/qualifications
export async function createQualification(req: Request, res: Response): Promise<void> {
  try {
    const { car_id, qualification_type_id } = req.body;
    if (!car_id || !qualification_type_id) {
      res.status(400).json({ success: false, error: 'car_id and qualification_type_id are required' });
      return;
    }
    const userId = req.user?.id;
    const qual = await qualificationService.createQualification(req.body, userId);
    res.status(201).json({ success: true, data: qual });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, error: 'Qualification already exists for this car and type' });
      return;
    }
    if (error.message?.startsWith('Invalid')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ err: error }, '[QualController] createQualification error');
    res.status(500).json({ success: false, error: 'Failed to create qualification' });
  }
}

// PUT /api/qualifications/:id
export async function updateQualification(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const qual = await qualificationService.updateQualification(req.params.id, req.body, userId);
    if (!qual) {
      res.status(404).json({ success: false, error: 'Qualification not found' });
      return;
    }
    res.json({ success: true, data: qual });
  } catch (error) {
    logger.error({ err: error }, '[QualController] updateQualification error');
    res.status(500).json({ success: false, error: 'Failed to update qualification' });
  }
}

// POST /api/qualifications/:id/complete
export async function completeQualification(req: Request, res: Response): Promise<void> {
  try {
    const { completed_date } = req.body;
    if (!completed_date) {
      res.status(400).json({ success: false, error: 'completed_date is required' });
      return;
    }
    const userId = req.user?.id;
    const qual = await qualificationService.completeQualification(req.params.id, req.body, userId);
    if (!qual) {
      res.status(404).json({ success: false, error: 'Qualification not found' });
      return;
    }
    res.json({ success: true, data: qual });
  } catch (error: any) {
    if (error.message?.startsWith('Invalid')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ err: error }, '[QualController] completeQualification error');
    res.status(500).json({ success: false, error: 'Failed to complete qualification' });
  }
}

// POST /api/qualifications/bulk-update
export async function bulkUpdate(req: Request, res: Response): Promise<void> {
  try {
    const { ids, status, next_due_date, notes } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'ids array is required' });
      return;
    }
    const userId = req.user?.id;
    const result = await qualificationService.bulkUpdateQualifications(ids, { status, next_due_date, notes }, userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes('limited to') || error.message?.startsWith('Invalid')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ err: error }, '[QualController] bulkUpdate error');
    res.status(500).json({ success: false, error: 'Failed to bulk update qualifications' });
  }
}

// GET /api/cars/:carId/qualifications
export async function getCarQualifications(req: Request, res: Response): Promise<void> {
  try {
    const qualifications = await qualificationService.getCarQualifications(req.params.carId);
    res.json({ success: true, data: qualifications });
  } catch (error) {
    logger.error({ err: error }, '[QualController] getCarQualifications error');
    res.status(500).json({ success: false, error: 'Failed to get car qualifications' });
  }
}
