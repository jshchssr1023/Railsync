/**
 * Notification Controller
 * API endpoints for notification preferences and email queue management
 */

import { Request, Response } from 'express';
import logger from '../config/logger';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getEmailQueueStatus,
  processEmailQueue,
} from '../services/email.service';

// Get current user's notification preferences
export async function getPreferences(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const prefs = await getNotificationPreferences(userId);

    // Return defaults if no preferences exist yet
    if (!prefs) {
      return res.json({
        success: true,
        data: {
          user_id: userId,
          email_bad_orders: true,
          email_capacity_warnings: true,
          email_allocation_updates: false,
          email_daily_digest: true,
        },
      });
    }

    res.json({ success: true, data: prefs });
  } catch (err) {
    logger.error({ err: err }, 'Error getting notification preferences');
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
}

// Update current user's notification preferences
export async function updatePreferences(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const {
      email_bad_orders,
      email_capacity_warnings,
      email_allocation_updates,
      email_daily_digest,
    } = req.body;

    const prefs = await updateNotificationPreferences(userId, {
      email_bad_orders,
      email_capacity_warnings,
      email_allocation_updates,
      email_daily_digest,
    });

    res.json({ success: true, data: prefs });
  } catch (err) {
    logger.error({ err: err }, 'Error updating notification preferences');
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
}

// Get email queue status (admin only)
export async function getQueueStatus(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const status = await getEmailQueueStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    logger.error({ err: err }, 'Error getting email queue status');
    res.status(500).json({ success: false, error: 'Failed to get queue status' });
  }
}

// Process email queue (admin only, for manual trigger)
export async function processQueue(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const batchSize = parseInt(req.query.batch_size as string) || 10;
    const result = await processEmailQueue(batchSize);

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error({ err: err }, 'Error processing email queue');
    res.status(500).json({ success: false, error: 'Failed to process queue' });
  }
}

export default {
  getPreferences,
  updatePreferences,
  getQueueStatus,
  processQueue,
};
