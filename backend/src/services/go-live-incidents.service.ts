/**
 * Go-Live Incidents Service
 *
 * Tracks and manages cutover-week incidents for the war room.
 */

import { query, queryOne } from '../config/database';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  category: string | null;
  assigned_to: string | null;
  assigned_name?: string;
  reported_by: string | null;
  reporter_name?: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  p1_open: number;
  p2_open: number;
  p3_open: number;
  avg_resolution_hours: number | null;
}

export async function listIncidents(filters?: {
  status?: string;
  severity?: string;
  limit?: number;
}): Promise<Incident[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters?.status) {
    conditions.push(`i.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters?.severity) {
    conditions.push(`i.severity = $${idx++}`);
    params.push(filters.severity);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit || 100;
  params.push(limit);

  return query<Incident>(
    `SELECT i.*,
       TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')) AS assigned_name,
       TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')) AS reporter_name
     FROM go_live_incidents i
     LEFT JOIN users a ON a.id = i.assigned_to
     LEFT JOIN users r ON r.id = i.reported_by
     ${where}
     ORDER BY
       CASE i.severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
       CASE i.status WHEN 'open' THEN 1 WHEN 'investigating' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END,
       i.created_at DESC
     LIMIT $${idx}`,
    params
  );
}

export async function getIncident(id: string): Promise<Incident | null> {
  return queryOne<Incident>(
    `SELECT i.*,
       TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')) AS assigned_name,
       TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')) AS reporter_name
     FROM go_live_incidents i
     LEFT JOIN users a ON a.id = i.assigned_to
     LEFT JOIN users r ON r.id = i.reported_by
     WHERE i.id = $1`,
    [id]
  );
}

export async function createIncident(data: {
  title: string;
  description?: string;
  severity: string;
  category?: string;
  assigned_to?: string;
  reported_by: string;
}): Promise<Incident> {
  const result = await queryOne<Incident>(
    `INSERT INTO go_live_incidents (title, description, severity, category, assigned_to, reported_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.title, data.description || null, data.severity, data.category || null, data.assigned_to || null, data.reported_by]
  );
  return result!;
}

export async function updateIncident(id: string, data: {
  status?: string;
  severity?: string;
  title?: string;
  description?: string;
  category?: string;
  assigned_to?: string;
  resolution_notes?: string;
}): Promise<Incident | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.status) { fields.push(`status = $${idx++}`); params.push(data.status); }
  if (data.severity) { fields.push(`severity = $${idx++}`); params.push(data.severity); }
  if (data.title) { fields.push(`title = $${idx++}`); params.push(data.title); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description); }
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); params.push(data.category); }
  if (data.assigned_to !== undefined) { fields.push(`assigned_to = $${idx++}`); params.push(data.assigned_to || null); }
  if (data.resolution_notes !== undefined) { fields.push(`resolution_notes = $${idx++}`); params.push(data.resolution_notes); }

  // Auto-set resolved_at when status changes to resolved
  if (data.status === 'resolved' || data.status === 'closed') {
    fields.push(`resolved_at = COALESCE(resolved_at, NOW())`);
  }

  fields.push('updated_at = NOW()');

  if (fields.length <= 1) return getIncident(id); // Only updated_at

  params.push(id);
  return queryOne<Incident>(
    `UPDATE go_live_incidents SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
}

export async function getIncidentStats(): Promise<IncidentStats> {
  const stats = await queryOne<{
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
    p1_open: number;
    p2_open: number;
    p3_open: number;
    avg_resolution_hours: number;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'open')::int AS open,
       COUNT(*) FILTER (WHERE status = 'investigating')::int AS investigating,
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
       COUNT(*) FILTER (WHERE severity = 'P1' AND status IN ('open', 'investigating'))::int AS p1_open,
       COUNT(*) FILTER (WHERE severity = 'P2' AND status IN ('open', 'investigating'))::int AS p2_open,
       COUNT(*) FILTER (WHERE severity = 'P3' AND status IN ('open', 'investigating'))::int AS p3_open,
       ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL))::int AS avg_resolution_hours
     FROM go_live_incidents`
  );

  return {
    total: stats?.total || 0,
    open: stats?.open || 0,
    investigating: stats?.investigating || 0,
    resolved: stats?.resolved || 0,
    closed: stats?.closed || 0,
    p1_open: stats?.p1_open || 0,
    p2_open: stats?.p2_open || 0,
    p3_open: stats?.p3_open || 0,
    avg_resolution_hours: stats?.avg_resolution_hours || null,
  };
}
