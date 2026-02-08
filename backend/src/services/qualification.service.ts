import { query, queryOne } from '../config/database';
import logger from '../config/logger';
import { pool } from '../config/database';

// ============================================================================
// Types
// ============================================================================

export interface QualificationType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  regulatory_body: string;
  default_interval_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Qualification {
  id: string;
  car_id: string;
  qualification_type_id: string;
  status: string;
  last_completed_date: string | null;
  next_due_date: string | null;
  expiry_date: string | null;
  interval_months: number | null;
  completed_by: string | null;
  completion_shop_code: string | null;
  certificate_number: string | null;
  notes: string | null;
  is_exempt: boolean;
  exempt_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  type_code?: string;
  type_name?: string;
  regulatory_body?: string;
  car_number?: string;
  car_mark?: string;
  lessee_name?: string;
  lessee_code?: string;
  current_region?: string;
}

export interface QualificationHistory {
  id: string;
  qualification_id: string;
  action: string;
  performed_by: string | null;
  performed_date: string;
  old_status: string | null;
  new_status: string | null;
  old_due_date: string | null;
  new_due_date: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface QualificationAlert {
  id: string;
  qualification_id: string;
  car_id: string;
  qualification_type_id: string;
  alert_type: string;
  alert_date: string;
  due_date: string;
  days_until_due: number | null;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  // Joined fields
  car_number?: string;
  car_mark?: string;
  type_name?: string;
  type_code?: string;
  lessee_name?: string;
}

export interface QualificationStats {
  total_cars: number;
  overdue_count: number;
  due_count: number;
  due_soon_count: number;
  current_count: number;
  exempt_count: number;
  unknown_count: number;
  overdue_cars: number;
  due_cars: number;
  unacked_alerts: number;
}

export interface DueByMonth {
  month: string;
  count: number;
  by_type: { type_code: string; type_name: string; count: number }[];
}

// ============================================================================
// Qualification Types
// ============================================================================

export async function listQualificationTypes(): Promise<QualificationType[]> {
  return query<QualificationType>(
    'SELECT * FROM qualification_types WHERE is_active = TRUE ORDER BY name'
  );
}

// ============================================================================
// Qualifications CRUD
// ============================================================================

export async function listQualifications(filters: {
  car_id?: string;
  qualification_type_id?: string;
  type_code?: string;
  status?: string;
  lessee_code?: string;
  current_region?: string;
  limit?: number;
  offset?: number;
}): Promise<{ qualifications: Qualification[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.car_id) {
    conditions.push(`q.car_id = $${paramIndex++}`);
    params.push(filters.car_id);
  }
  if (filters.qualification_type_id) {
    conditions.push(`q.qualification_type_id = $${paramIndex++}`);
    params.push(filters.qualification_type_id);
  }
  if (filters.type_code) {
    conditions.push(`qt.code = $${paramIndex++}`);
    params.push(filters.type_code);
  }
  if (filters.status) {
    conditions.push(`q.status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.lessee_code) {
    conditions.push(`c.lessee_code = $${paramIndex++}`);
    params.push(filters.lessee_code);
  }
  if (filters.current_region) {
    conditions.push(`c.current_region = $${paramIndex++}`);
    params.push(filters.current_region);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM qualifications q
     JOIN qualification_types qt ON qt.id = q.qualification_type_id
     JOIN cars c ON c.id = q.car_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const qualifications = await query<Qualification>(
    `SELECT q.*,
       qt.code as type_code, qt.name as type_name, qt.regulatory_body,
       c.car_number, c.car_mark, c.lessee_name, c.lessee_code, c.current_region
     FROM qualifications q
     JOIN qualification_types qt ON qt.id = q.qualification_type_id
     JOIN cars c ON c.id = q.car_id
     ${whereClause}
     ORDER BY
       CASE q.status
         WHEN 'overdue' THEN 1
         WHEN 'due' THEN 2
         WHEN 'due_soon' THEN 3
         WHEN 'unknown' THEN 4
         WHEN 'current' THEN 5
         WHEN 'exempt' THEN 6
       END,
       q.next_due_date NULLS LAST
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { qualifications, total };
}

export async function getQualificationById(id: string): Promise<Qualification | null> {
  return queryOne<Qualification>(
    `SELECT q.*,
       qt.code as type_code, qt.name as type_name, qt.regulatory_body,
       c.car_number, c.car_mark, c.lessee_name, c.lessee_code, c.current_region
     FROM qualifications q
     JOIN qualification_types qt ON qt.id = q.qualification_type_id
     JOIN cars c ON c.id = q.car_id
     WHERE q.id = $1`,
    [id]
  );
}

export async function getCarQualifications(carId: string): Promise<Qualification[]> {
  return query<Qualification>(
    `SELECT q.*,
       qt.code as type_code, qt.name as type_name, qt.regulatory_body
     FROM qualifications q
     JOIN qualification_types qt ON qt.id = q.qualification_type_id
     WHERE q.car_id = $1
     ORDER BY qt.name`,
    [carId]
  );
}

export async function createQualification(data: {
  car_id: string;
  qualification_type_id: string;
  status?: string;
  last_completed_date?: string;
  next_due_date?: string;
  expiry_date?: string;
  interval_months?: number;
  completed_by?: string;
  completion_shop_code?: string;
  certificate_number?: string;
  notes?: string;
  is_exempt?: boolean;
  exempt_reason?: string;
}, userId?: string): Promise<Qualification> {
  // Validate dates if provided
  if (data.last_completed_date && isNaN(new Date(data.last_completed_date).getTime())) {
    throw new Error('Invalid last_completed_date: must be a valid date string');
  }
  if (data.next_due_date && isNaN(new Date(data.next_due_date).getTime())) {
    throw new Error('Invalid next_due_date: must be a valid date string');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO qualifications (
         car_id, qualification_type_id, status,
         last_completed_date, next_due_date, expiry_date,
         interval_months, completed_by, completion_shop_code,
         certificate_number, notes, is_exempt, exempt_reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        data.car_id,
        data.qualification_type_id,
        data.status || 'unknown',
        data.last_completed_date || null,
        data.next_due_date || null,
        data.expiry_date || null,
        data.interval_months || null,
        data.completed_by || null,
        data.completion_shop_code || null,
        data.certificate_number || null,
        data.notes || null,
        data.is_exempt || false,
        data.exempt_reason || null,
      ]
    );

    const created = result.rows[0];
    if (created) {
      await client.query(
        `INSERT INTO qualification_history (qualification_id, action, performed_by, old_status, new_status, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [created.id, 'created', userId || null, null, created.status, null]
      );
    }

    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateQualification(
  id: string,
  data: Partial<{
    status: string;
    last_completed_date: string;
    next_due_date: string;
    expiry_date: string;
    interval_months: number;
    completed_by: string;
    completion_shop_code: string;
    certificate_number: string;
    notes: string;
    is_exempt: boolean;
    exempt_reason: string;
  }>,
  userId?: string
): Promise<Qualification | null> {
  const current = await getQualificationById(id);
  if (!current) return null;

  const updates: string[] = [];
  const params: unknown[] = [id];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updates.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }
  }

  if (updates.length === 0) return current;
  updates.push('updated_at = NOW()');

  const rows = await query<Qualification>(
    `UPDATE qualifications SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );

  const updated = rows[0] || null;

  // Log if status changed
  if (updated && data.status && data.status !== current.status) {
    await logHistory(id, 'status_changed', userId, current.status, data.status, current.next_due_date || undefined, data.next_due_date);
  }

  return updated;
}

// ============================================================================
// Complete a qualification (mark as done, advance due date)
// ============================================================================

export async function completeQualification(
  id: string,
  data: {
    completed_date: string;
    completed_by?: string;
    completion_shop_code?: string;
    certificate_number?: string;
    notes?: string;
  },
  userId?: string
): Promise<Qualification | null> {
  // Validate completed_date is a real date
  const completedDate = new Date(data.completed_date);
  if (isNaN(completedDate.getTime())) {
    throw new Error('Invalid completed_date: must be a valid date string');
  }

  const current = await getQualificationById(id);
  if (!current) return null;

  // Calculate next due date from completion date + interval
  const intervalMonths = current.interval_months || 120; // default 10 years
  const nextDueDate = new Date(completedDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + intervalMonths);
  // Expiry is end of the year that next_due_date falls in
  const expiryDate = new Date(nextDueDate.getFullYear(), 11, 31);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE qualifications SET
         status = 'current',
         last_completed_date = $2,
         next_due_date = $3,
         expiry_date = $4,
         completed_by = COALESCE($5, completed_by),
         completion_shop_code = COALESCE($6, completion_shop_code),
         certificate_number = COALESCE($7, certificate_number),
         notes = COALESCE($8, notes),
         is_exempt = FALSE,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.completed_date,
        nextDueDate.toISOString().split('T')[0],
        expiryDate.toISOString().split('T')[0],
        data.completed_by || null,
        data.completion_shop_code || null,
        data.certificate_number || null,
        data.notes || null,
      ]
    );

    const updated = result.rows[0] || null;

    if (updated) {
      await client.query(
        `INSERT INTO qualification_history (qualification_id, action, performed_by, old_status, new_status, old_due_date, new_due_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, 'completed', userId || null, current.status, 'current', current.next_due_date || null, nextDueDate.toISOString().split('T')[0], data.notes || null]
      );
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// Bulk Update — update multiple qualifications at once
// ============================================================================

const BULK_UPDATE_MAX = 500;

export async function bulkUpdateQualifications(
  ids: string[],
  data: {
    status?: string;
    next_due_date?: string;
    notes?: string;
  },
  userId?: string
): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  if (ids.length > BULK_UPDATE_MAX) {
    throw new Error(`Bulk update limited to ${BULK_UPDATE_MAX} records per request. Received ${ids.length}.`);
  }

  // Validate date if provided
  if (data.next_due_date && isNaN(new Date(data.next_due_date).getTime())) {
    throw new Error('Invalid next_due_date: must be a valid date string');
  }

  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (data.status) {
    updates.push(`status = $${paramIndex++}`);
    params.push(data.status);
  }
  if (data.next_due_date) {
    updates.push(`next_due_date = $${paramIndex++}`);
    params.push(data.next_due_date);
  }
  if (data.notes) {
    updates.push(`notes = $${paramIndex++}`);
    params.push(data.notes);
  }
  updates.push('updated_at = NOW()');

  const placeholders = ids.map((_, i) => `$${paramIndex + i}`).join(',');
  params.push(...ids);

  const result = await pool.query(
    `UPDATE qualifications SET ${updates.join(', ')} WHERE id IN (${placeholders})`,
    params
  );

  // Log history for each
  for (const id of ids) {
    await logHistory(id, 'updated', userId, null, data.status || null, undefined, data.next_due_date, data.notes);
  }

  return { updated: result.rowCount || 0 };
}

// ============================================================================
// Fleet Stats (KPIs)
// ============================================================================

export async function getQualificationStats(): Promise<QualificationStats> {
  const result = await queryOne<{
    total_cars: string;
    overdue_count: string;
    due_count: string;
    due_soon_count: string;
    current_count: string;
    exempt_count: string;
    unknown_count: string;
    overdue_cars: string;
    due_cars: string;
    unacked_alerts: string;
  }>('SELECT * FROM v_qual_dashboard');

  return {
    total_cars: parseInt(result?.total_cars || '0', 10),
    overdue_count: parseInt(result?.overdue_count || '0', 10),
    due_count: parseInt(result?.due_count || '0', 10),
    due_soon_count: parseInt(result?.due_soon_count || '0', 10),
    current_count: parseInt(result?.current_count || '0', 10),
    exempt_count: parseInt(result?.exempt_count || '0', 10),
    unknown_count: parseInt(result?.unknown_count || '0', 10),
    overdue_cars: parseInt(result?.overdue_cars || '0', 10),
    due_cars: parseInt(result?.due_cars || '0', 10),
    unacked_alerts: parseInt(result?.unacked_alerts || '0', 10),
  };
}

// ============================================================================
// Due By Month (next 12 months aggregation)
// ============================================================================

export async function getDueByMonth(): Promise<DueByMonth[]> {
  const rows = await query<{
    month: string;
    count: string;
    by_type: { type_code: string; type_name: string; count: number }[];
  }>(
    `SELECT
       TO_CHAR(q.next_due_date, 'YYYY-MM') as month,
       COUNT(*)::text as count,
       json_agg(json_build_object(
         'type_code', qt.code,
         'type_name', qt.name,
         'count', 1
       )) as by_type
     FROM qualifications q
     JOIN qualification_types qt ON qt.id = q.qualification_type_id
     WHERE q.next_due_date IS NOT NULL
       AND q.next_due_date >= CURRENT_DATE
       AND q.next_due_date < CURRENT_DATE + INTERVAL '12 months'
       AND q.status != 'exempt'
     GROUP BY TO_CHAR(q.next_due_date, 'YYYY-MM')
     ORDER BY month`
  );

  return rows.map(r => ({
    month: r.month,
    count: parseInt(r.count, 10),
    by_type: r.by_type,
  }));
}

// ============================================================================
// Alerts
// ============================================================================

export async function getAlerts(filters: {
  alert_type?: string;
  is_acknowledged?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: QualificationAlert[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.alert_type) {
    conditions.push(`qa.alert_type = $${paramIndex++}`);
    params.push(filters.alert_type);
  }
  if (filters.is_acknowledged !== undefined) {
    conditions.push(`qa.is_acknowledged = $${paramIndex++}`);
    params.push(filters.is_acknowledged);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM qualification_alerts qa ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count || '0', 10);

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const alerts = await query<QualificationAlert>(
    `SELECT qa.*,
       c.car_number, c.car_mark, c.lessee_name,
       qt.name as type_name, qt.code as type_code
     FROM qualification_alerts qa
     JOIN cars c ON c.id = qa.car_id
     JOIN qualification_types qt ON qt.id = qa.qualification_type_id
     ${whereClause}
     ORDER BY qa.days_until_due NULLS LAST, qa.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return { alerts, total };
}

export async function acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE qualification_alerts SET is_acknowledged = TRUE, acknowledged_by = $2, acknowledged_at = NOW()
     WHERE id = $1 AND is_acknowledged = FALSE`,
    [alertId, userId]
  );
  return (result.rowCount || 0) > 0;
}

// ============================================================================
// Batch Status Calculation (fleet-wide recalculation)
// ============================================================================

export async function recalculateAllStatuses(): Promise<{ updated: number }> {
  const result = await pool.query(`
    UPDATE qualifications SET
      status = CASE
        WHEN is_exempt = TRUE THEN 'exempt'
        WHEN next_due_date IS NULL THEN 'unknown'
        WHEN next_due_date < CURRENT_DATE THEN 'overdue'
        WHEN next_due_date < CURRENT_DATE + INTERVAL '30 days' THEN 'due'
        WHEN next_due_date < CURRENT_DATE + INTERVAL '90 days' THEN 'due_soon'
        ELSE 'current'
      END,
      updated_at = NOW()
    WHERE status != CASE
        WHEN is_exempt = TRUE THEN 'exempt'
        WHEN next_due_date IS NULL THEN 'unknown'
        WHEN next_due_date < CURRENT_DATE THEN 'overdue'
        WHEN next_due_date < CURRENT_DATE + INTERVAL '30 days' THEN 'due'
        WHEN next_due_date < CURRENT_DATE + INTERVAL '90 days' THEN 'due_soon'
        ELSE 'current'
      END
  `);

  return { updated: result.rowCount || 0 };
}

// ============================================================================
// Generate Alerts (batch job)
// ============================================================================

export async function generateAlerts(): Promise<{ created: number }> {
  // Recalculate statuses first
  await recalculateAllStatuses();

  // Shared rule applicability clause: when applies_to_car_types is non-empty,
  // only match cars whose aar_type appears in the rule's JSONB array.
  // Same pattern for applies_to_commodities.
  const ruleApplicabilityClause = `
    AND (jsonb_array_length(qr.applies_to_car_types) = 0 OR c.aar_type IN (SELECT jsonb_array_elements_text(qr.applies_to_car_types)))
    AND (jsonb_array_length(qr.applies_to_commodities) = 0 OR c.commodity IN (SELECT jsonb_array_elements_text(qr.applies_to_commodities)))
  `;

  // Generate 90-day warnings
  const result90 = await pool.query(`
    INSERT INTO qualification_alerts (qualification_id, car_id, qualification_type_id, alert_type, alert_date, due_date, days_until_due)
    SELECT q.id, q.car_id, q.qualification_type_id, 'warning_90', CURRENT_DATE, q.next_due_date,
      (q.next_due_date - CURRENT_DATE)
    FROM qualifications q
    JOIN qualification_rules qr ON qr.qualification_type_id = q.qualification_type_id AND qr.is_active = TRUE AND qr.warning_days_90 = TRUE
    JOIN cars c ON c.id = q.car_id
    WHERE q.next_due_date IS NOT NULL
      AND q.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      AND q.status != 'exempt'
      ${ruleApplicabilityClause}
      AND NOT EXISTS (
        SELECT 1 FROM qualification_alerts qa
        WHERE qa.qualification_id = q.id AND qa.alert_type = 'warning_90'
          AND qa.alert_date >= CURRENT_DATE - INTERVAL '7 days'
      )
  `);

  // Generate 60-day warnings
  const result60 = await pool.query(`
    INSERT INTO qualification_alerts (qualification_id, car_id, qualification_type_id, alert_type, alert_date, due_date, days_until_due)
    SELECT q.id, q.car_id, q.qualification_type_id, 'warning_60', CURRENT_DATE, q.next_due_date,
      (q.next_due_date - CURRENT_DATE)
    FROM qualifications q
    JOIN qualification_rules qr ON qr.qualification_type_id = q.qualification_type_id AND qr.is_active = TRUE AND qr.warning_days_60 = TRUE
    JOIN cars c ON c.id = q.car_id
    WHERE q.next_due_date IS NOT NULL
      AND q.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
      AND q.status != 'exempt'
      ${ruleApplicabilityClause}
      AND NOT EXISTS (
        SELECT 1 FROM qualification_alerts qa
        WHERE qa.qualification_id = q.id AND qa.alert_type = 'warning_60'
          AND qa.alert_date >= CURRENT_DATE - INTERVAL '7 days'
      )
  `);

  // Generate 30-day warnings
  const result30 = await pool.query(`
    INSERT INTO qualification_alerts (qualification_id, car_id, qualification_type_id, alert_type, alert_date, due_date, days_until_due)
    SELECT q.id, q.car_id, q.qualification_type_id, 'warning_30', CURRENT_DATE, q.next_due_date,
      (q.next_due_date - CURRENT_DATE)
    FROM qualifications q
    JOIN qualification_rules qr ON qr.qualification_type_id = q.qualification_type_id AND qr.is_active = TRUE AND qr.warning_days_30 = TRUE
    JOIN cars c ON c.id = q.car_id
    WHERE q.next_due_date IS NOT NULL
      AND q.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      AND q.status != 'exempt'
      ${ruleApplicabilityClause}
      AND NOT EXISTS (
        SELECT 1 FROM qualification_alerts qa
        WHERE qa.qualification_id = q.id AND qa.alert_type = 'warning_30'
          AND qa.alert_date >= CURRENT_DATE - INTERVAL '7 days'
      )
  `);

  // Generate overdue alerts (always fires, no rule gating needed)
  const resultOverdue = await pool.query(`
    INSERT INTO qualification_alerts (qualification_id, car_id, qualification_type_id, alert_type, alert_date, due_date, days_until_due)
    SELECT q.id, q.car_id, q.qualification_type_id, 'overdue', CURRENT_DATE, q.next_due_date,
      (q.next_due_date - CURRENT_DATE)
    FROM qualifications q
    WHERE q.next_due_date IS NOT NULL
      AND q.next_due_date < CURRENT_DATE
      AND q.status != 'exempt'
      AND NOT EXISTS (
        SELECT 1 FROM qualification_alerts qa
        WHERE qa.qualification_id = q.id AND qa.alert_type = 'overdue'
          AND qa.alert_date >= CURRENT_DATE - INTERVAL '7 days'
      )
  `);

  // Generate expired alerts (expiry_date has passed)
  const resultExpired = await pool.query(`
    INSERT INTO qualification_alerts (qualification_id, car_id, qualification_type_id, alert_type, alert_date, due_date, days_until_due)
    SELECT q.id, q.car_id, q.qualification_type_id, 'expired', CURRENT_DATE, q.expiry_date,
      (q.expiry_date - CURRENT_DATE)
    FROM qualifications q
    WHERE q.expiry_date IS NOT NULL
      AND q.expiry_date < CURRENT_DATE
      AND q.status != 'exempt'
      AND NOT EXISTS (
        SELECT 1 FROM qualification_alerts qa
        WHERE qa.qualification_id = q.id AND qa.alert_type = 'expired'
          AND qa.alert_date >= CURRENT_DATE - INTERVAL '7 days'
      )
  `);

  const total = (result90.rowCount || 0) + (result60.rowCount || 0) + (result30.rowCount || 0)
    + (resultOverdue.rowCount || 0) + (resultExpired.rowCount || 0);
  return { created: total };
}

// ============================================================================
// History
// ============================================================================

export async function getQualificationHistory(qualificationId: string): Promise<QualificationHistory[]> {
  return query<QualificationHistory>(
    `SELECT qh.*
     FROM qualification_history qh
     WHERE qh.qualification_id = $1
     ORDER BY qh.performed_date DESC`,
    [qualificationId]
  );
}

// ============================================================================
// Internal helpers
// ============================================================================

async function logHistory(
  qualificationId: string,
  action: string,
  userId?: string | null,
  oldStatus?: string | null,
  newStatus?: string | null,
  oldDueDate?: string,
  newDueDate?: string,
  notes?: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO qualification_history (qualification_id, action, performed_by, old_status, new_status, old_due_date, new_due_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [qualificationId, action, userId || null, oldStatus || null, newStatus || null, oldDueDate || null, newDueDate || null, notes || null]
  ).catch(err => logger.error({ err: err }, '[QualHistory] Failed to log'));
}

// ============================================================================
// Qualification-to-Scheduling Priority Integration
// Returns a recommended assignment priority (1-4) based on qualification urgency
// Used by demand planning and assignment creation to boost priority for
// cars with urgent qualification needs.
// ============================================================================

export async function getQualificationPriority(carId: string): Promise<{
  recommended_priority: number; // 1=Critical, 2=High, 3=Medium, 4=Low
  reason: string;
  overdue_count: number;
  due_soon_count: number;
}> {
  const result = await queryOne<{
    overdue_count: string;
    due_count: string;
    due_soon_count: string;
    earliest_due: string | null;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'overdue')::text as overdue_count,
       COUNT(*) FILTER (WHERE status = 'due')::text as due_count,
       COUNT(*) FILTER (WHERE status = 'due_soon')::text as due_soon_count,
       MIN(next_due_date) as earliest_due
     FROM qualifications
     WHERE car_id = $1 AND status != 'exempt'`,
    [carId]
  );

  const overdue = parseInt(result?.overdue_count || '0', 10);
  const due = parseInt(result?.due_count || '0', 10);
  const dueSoon = parseInt(result?.due_soon_count || '0', 10);

  if (overdue > 0) {
    return {
      recommended_priority: 1,
      reason: `${overdue} qualification(s) overdue`,
      overdue_count: overdue,
      due_soon_count: dueSoon + due,
    };
  }

  if (due > 0) {
    return {
      recommended_priority: 2,
      reason: `${due} qualification(s) due within 30 days`,
      overdue_count: 0,
      due_soon_count: dueSoon + due,
    };
  }

  if (dueSoon > 0) {
    return {
      recommended_priority: 3,
      reason: `${dueSoon} qualification(s) due within 90 days`,
      overdue_count: 0,
      due_soon_count: dueSoon,
    };
  }

  return {
    recommended_priority: 4,
    reason: 'No urgent qualification needs',
    overdue_count: 0,
    due_soon_count: 0,
  };
}

export default {
  listQualificationTypes,
  listQualifications,
  getQualificationById,
  getCarQualifications,
  createQualification,
  updateQualification,
  completeQualification,
  bulkUpdateQualifications,
  getQualificationStats,
  getDueByMonth,
  getAlerts,
  acknowledgeAlert,
  recalculateAllStatuses,
  generateAlerts,
  getQualificationHistory,
  getQualificationPriority,
};
