import { Request, Response } from 'express';
import logger from '../config/logger';
import * as alertsService from '../services/alerts.service';
import { manualTriggers } from '../services/scheduler.service';

// Get active alerts for current user
export async function getAlerts(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const alerts = await alertsService.getActiveAlerts(userId, role, limit);

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    logger.error({ err: error }, 'Get alerts error');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts',
    });
  }
}

// Get unread alert count
export async function getAlertCount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    const count = await alertsService.countUnreadAlerts(userId, role);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get alert count error');
    res.status(500).json({
      success: false,
      error: 'Failed to get alert count',
    });
  }
}

// Mark alert as read
export async function markRead(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;

    const alert = await alertsService.markAlertRead(alertId);

    if (!alert) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
      return;
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    logger.error({ err: error }, 'Mark alert read error');
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as read',
    });
  }
}

// Dismiss alert
export async function dismissAlert(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const alert = await alertsService.dismissAlert(alertId, userId);

    if (!alert) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
      return;
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    logger.error({ err: error }, 'Dismiss alert error');
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss alert',
    });
  }
}

// Dismiss all alerts of a type (admin only)
export async function dismissByType(req: Request, res: Response): Promise<void> {
  try {
    const { alertType } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const count = await alertsService.dismissAlertsByType(
      alertType as alertsService.AlertType,
      userId
    );

    res.json({
      success: true,
      data: { dismissed: count },
    });
  } catch (error) {
    logger.error({ err: error }, 'Dismiss alerts by type error');
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss alerts',
    });
  }
}

// Trigger manual scans (admin only)
export async function triggerScan(req: Request, res: Response): Promise<void> {
  try {
    const { scanType } = req.params;

    switch (scanType) {
      case 'qualification':
        await manualTriggers.scanQualificationDue();
        break;
      case 'capacity':
        await manualTriggers.scanCapacityWarnings();
        break;
      case 'cleanup':
        await manualTriggers.runCleanup();
        break;
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid scan type. Use: qualification, capacity, or cleanup',
        });
        return;
    }

    res.json({
      success: true,
      message: `${scanType} scan triggered successfully`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Trigger scan error');
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scan',
    });
  }
}

export default {
  getAlerts,
  getAlertCount,
  markRead,
  dismissAlert,
  dismissByType,
  triggerScan,
};
