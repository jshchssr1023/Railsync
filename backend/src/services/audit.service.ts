import { query, queryOne } from '../config/database';
import { AuditLog, AuditAction } from '../types';
import { Request } from 'express';

export interface AuditLogInput {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<AuditLog> {
  const result = await queryOne<AuditLog>(
    `INSERT INTO audit_logs (
       user_id, user_email, action, entity_type, entity_id,
       old_value, new_value, ip_address, user_agent, request_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.userId || null,
      input.userEmail || null,
      input.action,
      input.entityType,
      input.entityId || null,
      input.oldValue ? JSON.stringify(input.oldValue) : null,
      input.newValue ? JSON.stringify(input.newValue) : null,
      input.ipAddress || null,
      input.userAgent || null,
      input.requestId || null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create audit log');
  }

  return result;
}

/**
 * Create audit log from Express request context
 */
export async function logFromRequest(
  req: Request,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>
): Promise<AuditLog> {
  return createAuditLog({
    userId: req.user?.id,
    userEmail: req.user?.email,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    requestId: req.requestId,
  });
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filters: {
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | Date | number)[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }

  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }

  if (filters.entityType) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(filters.entityType);
  }

  if (filters.entityId) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(filters.entityId);
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const logs = await query<AuditLog>(
    `SELECT * FROM audit_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
    params
  );
  const total = countResult ? parseInt(countResult.count, 10) : 0;

  return { logs, total };
}

/**
 * Get audit history for a specific entity
 */
export async function getEntityHistory(
  entityType: string,
  entityId: string
): Promise<AuditLog[]> {
  return query<AuditLog>(
    `SELECT * FROM audit_logs
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC`,
    [entityType, entityId]
  );
}
