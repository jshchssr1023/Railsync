/**
 * User Feedback Service
 *
 * Collects and manages user feedback for post go-live improvement.
 */

import { query, queryOne } from '../config/database';

interface Feedback {
  id: string;
  user_id: string | null;
  user_name?: string;
  page: string | null;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewer_name?: string;
  reviewed_at: string | null;
  created_at: string;
}

interface FeedbackStats {
  total: number;
  new_count: number;
  reviewed: number;
  planned: number;
  resolved: number;
  wontfix: number;
  bugs: number;
  features: number;
  usability: number;
}

export async function createFeedback(data: {
  user_id?: string;
  page?: string;
  category: string;
  severity?: string;
  title: string;
  description?: string;
}): Promise<Feedback> {
  const result = await queryOne<Feedback>(
    `INSERT INTO user_feedback (user_id, page, category, severity, title, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.user_id || null, data.page || null, data.category, data.severity || 'low', data.title, data.description || null]
  );
  return result!;
}

export async function listFeedback(filters?: {
  status?: string;
  category?: string;
  limit?: number;
}): Promise<Feedback[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filters?.status) {
    conditions.push(`f.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters?.category) {
    conditions.push(`f.category = $${idx++}`);
    params.push(filters.category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit || 100;
  params.push(limit);

  return query<Feedback>(
    `SELECT f.*,
       TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS user_name,
       TRIM(COALESCE(r.first_name, '') || ' ' || COALESCE(r.last_name, '')) AS reviewer_name
     FROM user_feedback f
     LEFT JOIN users u ON u.id = f.user_id
     LEFT JOIN users r ON r.id = f.reviewed_by
     ${where}
     ORDER BY
       CASE f.status WHEN 'new' THEN 1 WHEN 'reviewed' THEN 2 WHEN 'planned' THEN 3 ELSE 4 END,
       CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       f.created_at DESC
     LIMIT $${idx}`,
    params
  );
}

export async function updateFeedback(id: string, data: {
  status?: string;
  admin_notes?: string;
  reviewed_by?: string;
}): Promise<Feedback | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.status) { fields.push(`status = $${idx++}`); params.push(data.status); }
  if (data.admin_notes !== undefined) { fields.push(`admin_notes = $${idx++}`); params.push(data.admin_notes); }
  if (data.reviewed_by) {
    fields.push(`reviewed_by = $${idx++}`);
    params.push(data.reviewed_by);
    fields.push(`reviewed_at = COALESCE(reviewed_at, NOW())`);
  }

  fields.push('updated_at = NOW()');

  if (fields.length <= 1) return null;

  params.push(id);
  return queryOne<Feedback>(
    `UPDATE user_feedback SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
  const stats = await queryOne<{
    total: number;
    new_count: number;
    reviewed: number;
    planned: number;
    resolved: number;
    wontfix: number;
    bugs: number;
    features: number;
    usability: number;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'new')::int AS new_count,
       COUNT(*) FILTER (WHERE status = 'reviewed')::int AS reviewed,
       COUNT(*) FILTER (WHERE status = 'planned')::int AS planned,
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       COUNT(*) FILTER (WHERE status = 'wontfix')::int AS wontfix,
       COUNT(*) FILTER (WHERE category = 'bug')::int AS bugs,
       COUNT(*) FILTER (WHERE category = 'feature')::int AS features,
       COUNT(*) FILTER (WHERE category = 'usability')::int AS usability
     FROM user_feedback`
  );

  return {
    total: stats?.total || 0,
    new_count: stats?.new_count || 0,
    reviewed: stats?.reviewed || 0,
    planned: stats?.planned || 0,
    resolved: stats?.resolved || 0,
    wontfix: stats?.wontfix || 0,
    bugs: stats?.bugs || 0,
    features: stats?.features || 0,
    usability: stats?.usability || 0,
  };
}
