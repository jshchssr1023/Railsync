/**
 * Email Service
 * Handles email notifications for alerts, status changes, and system events
 */

import { query, queryOne } from '../config/database';

// Email configuration (use environment variables in production)
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'noreply@railsync.com',
  smtp_host: process.env.SMTP_HOST || 'localhost',
  smtp_port: parseInt(process.env.SMTP_PORT || '587'),
  enabled: process.env.EMAIL_ENABLED === 'true',
};

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationPreferences {
  user_id: string;
  email_bad_orders: boolean;
  email_capacity_warnings: boolean;
  email_allocation_updates: boolean;
  email_daily_digest: boolean;
}

export interface QueuedEmail {
  id: string;
  to_email: string;
  to_name?: string;
  subject: string;
  html_body: string;
  text_body: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  error_message?: string;
  created_at: Date;
  sent_at?: Date;
}

// Email templates
const templates = {
  badOrderCreated: (data: { car_number: string; shop_code: string; issue: string; reporter: string }): EmailTemplate => ({
    subject: `🚨 Bad Order Reported: ${data.car_number}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Bad Order Alert</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p><strong>Car:</strong> ${data.car_number}</p>
          <p><strong>Shop:</strong> ${data.shop_code}</p>
          <p><strong>Issue:</strong> ${data.issue}</p>
          <p><strong>Reported by:</strong> ${data.reporter}</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/bad-orders"
               style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Bad Orders
            </a>
          </p>
        </div>
      </div>
    `,
    text: `Bad Order Alert\n\nCar: ${data.car_number}\nShop: ${data.shop_code}\nIssue: ${data.issue}\nReported by: ${data.reporter}`,
  }),

  capacityWarning: (data: { shop_code: string; month: string; utilization: number; available: number }): EmailTemplate => ({
    subject: `⚠️ Capacity Warning: ${data.shop_code} at ${data.utilization}%`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Capacity Warning</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p><strong>Shop:</strong> ${data.shop_code}</p>
          <p><strong>Month:</strong> ${data.month}</p>
          <p><strong>Utilization:</strong> ${data.utilization}%</p>
          <p><strong>Slots Available:</strong> ${data.available}</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/planning?tab=monthly-load"
               style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Capacity
            </a>
          </p>
        </div>
      </div>
    `,
    text: `Capacity Warning\n\nShop: ${data.shop_code}\nMonth: ${data.month}\nUtilization: ${data.utilization}%\nAvailable: ${data.available}`,
  }),

  allocationStatusChange: (data: { car_number: string; shop_code: string; old_status: string; new_status: string; changed_by: string }): EmailTemplate => ({
    subject: `📦 Allocation Update: ${data.car_number} → ${data.new_status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Allocation Update</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p><strong>Car:</strong> ${data.car_number}</p>
          <p><strong>Shop:</strong> ${data.shop_code}</p>
          <p><strong>Status Change:</strong> ${data.old_status} → ${data.new_status}</p>
          <p><strong>Changed by:</strong> ${data.changed_by}</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/pipeline"
               style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              View Pipeline
            </a>
          </p>
        </div>
      </div>
    `,
    text: `Allocation Update\n\nCar: ${data.car_number}\nShop: ${data.shop_code}\nStatus: ${data.old_status} → ${data.new_status}\nChanged by: ${data.changed_by}`,
  }),

  dailyDigest: (data: { user_name: string; date: string; stats: { bad_orders: number; completed: number; capacity_warnings: number } }): EmailTemplate => ({
    subject: `📊 Railsync Daily Digest - ${data.date}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Daily Digest</h1>
          <p style="margin: 5px 0 0 0;">${data.date}</p>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          <p>Hello ${data.user_name},</p>
          <p>Here's your daily summary:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">Bad Orders</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: ${data.stats.bad_orders > 0 ? '#dc2626' : '#16a34a'};">
                ${data.stats.bad_orders}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">Completed Today</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #16a34a;">
                ${data.stats.completed}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">Capacity Warnings</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: ${data.stats.capacity_warnings > 0 ? '#f59e0b' : '#16a34a'};">
                ${data.stats.capacity_warnings}
              </td>
            </tr>
          </table>
          <p style="margin-top: 20px;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}"
               style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Open Railsync
            </a>
          </p>
        </div>
      </div>
    `,
    text: `Daily Digest - ${data.date}\n\nHello ${data.user_name},\n\nBad Orders: ${data.stats.bad_orders}\nCompleted: ${data.stats.completed}\nCapacity Warnings: ${data.stats.capacity_warnings}`,
  }),
};

// Queue an email for sending
export async function queueEmail(
  toEmail: string,
  toName: string | undefined,
  template: EmailTemplate
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO email_queue (to_email, to_name, subject, html_body, text_body, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id`,
    [toEmail, toName || null, template.subject, template.html, template.text]
  );
  return result[0].id;
}

// Get user notification preferences
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  return queryOne<NotificationPreferences>(
    `SELECT * FROM notification_preferences WHERE user_id = $1`,
    [userId]
  );
}

// Update notification preferences
export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<Omit<NotificationPreferences, 'user_id'>>
): Promise<NotificationPreferences> {
  const result = await query<NotificationPreferences>(
    `INSERT INTO notification_preferences (user_id, email_bad_orders, email_capacity_warnings, email_allocation_updates, email_daily_digest)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       email_bad_orders = COALESCE($2, notification_preferences.email_bad_orders),
       email_capacity_warnings = COALESCE($3, notification_preferences.email_capacity_warnings),
       email_allocation_updates = COALESCE($4, notification_preferences.email_allocation_updates),
       email_daily_digest = COALESCE($5, notification_preferences.email_daily_digest),
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      prefs.email_bad_orders ?? true,
      prefs.email_capacity_warnings ?? true,
      prefs.email_allocation_updates ?? false,
      prefs.email_daily_digest ?? true,
    ]
  );
  return result[0];
}

// Get users subscribed to a notification type
export async function getSubscribedUsers(notificationType: keyof Omit<NotificationPreferences, 'user_id'>): Promise<{ id: string; email: string; first_name: string }[]> {
  return query<{ id: string; email: string; first_name: string }>(
    `SELECT u.id, u.email, u.first_name
     FROM users u
     JOIN notification_preferences np ON u.id = np.user_id
     WHERE np.${notificationType} = true AND u.is_active = true`,
    []
  );
}

// Notification trigger functions
export async function notifyBadOrder(data: { car_number: string; shop_code: string; issue: string; reporter: string }): Promise<void> {
  const users = await getSubscribedUsers('email_bad_orders');
  const template = templates.badOrderCreated(data);

  for (const user of users) {
    await queueEmail(user.email, user.first_name, template);
  }

  console.log(`[Email] Queued bad order notification for ${users.length} users`);
}

export async function notifyCapacityWarning(data: { shop_code: string; month: string; utilization: number; available: number }): Promise<void> {
  const users = await getSubscribedUsers('email_capacity_warnings');
  const template = templates.capacityWarning(data);

  for (const user of users) {
    await queueEmail(user.email, user.first_name, template);
  }

  console.log(`[Email] Queued capacity warning for ${users.length} users`);
}

export async function notifyAllocationChange(data: { car_number: string; shop_code: string; old_status: string; new_status: string; changed_by: string }): Promise<void> {
  const users = await getSubscribedUsers('email_allocation_updates');
  const template = templates.allocationStatusChange(data);

  for (const user of users) {
    await queueEmail(user.email, user.first_name, template);
  }

  console.log(`[Email] Queued allocation update for ${users.length} users`);
}

// Process email queue (call this from a cron job or worker)
export async function processEmailQueue(batchSize: number = 10): Promise<{ sent: number; failed: number }> {
  if (!EMAIL_CONFIG.enabled) {
    console.log('[Email] Email sending disabled');
    return { sent: 0, failed: 0 };
  }

  const pending = await query<QueuedEmail>(
    `SELECT * FROM email_queue
     WHERE status = 'pending' AND attempts < 3
     ORDER BY created_at ASC
     LIMIT $1`,
    [batchSize]
  );

  let sent = 0;
  let failed = 0;

  for (const email of pending) {
    try {
      // In production, use nodemailer or similar
      // For now, just log and mark as sent
      console.log(`[Email] Would send to ${email.to_email}: ${email.subject}`);

      await query(
        `UPDATE email_queue SET status = 'sent', sent_at = NOW(), attempts = attempts + 1 WHERE id = $1`,
        [email.id]
      );
      sent++;
    } catch (err) {
      console.error(`[Email] Failed to send to ${email.to_email}:`, err);
      await query(
        `UPDATE email_queue SET status = 'failed', attempts = attempts + 1, error_message = $2 WHERE id = $1`,
        [email.id, (err as Error).message]
      );
      failed++;
    }
  }

  return { sent, failed };
}

// Get email queue status
export async function getEmailQueueStatus(): Promise<{ pending: number; sent_today: number; failed_today: number }> {
  const result = await queryOne<{ pending: string; sent_today: string; failed_today: string }>(`
    SELECT
      (SELECT COUNT(*) FROM email_queue WHERE status = 'pending')::text as pending,
      (SELECT COUNT(*) FROM email_queue WHERE status = 'sent' AND sent_at >= CURRENT_DATE)::text as sent_today,
      (SELECT COUNT(*) FROM email_queue WHERE status = 'failed' AND created_at >= CURRENT_DATE)::text as failed_today
  `, []);

  return {
    pending: parseInt(result?.pending || '0'),
    sent_today: parseInt(result?.sent_today || '0'),
    failed_today: parseInt(result?.failed_today || '0'),
  };
}

export default {
  queueEmail,
  getNotificationPreferences,
  updateNotificationPreferences,
  notifyBadOrder,
  notifyCapacityWarning,
  notifyAllocationChange,
  processEmailQueue,
  getEmailQueueStatus,
};
