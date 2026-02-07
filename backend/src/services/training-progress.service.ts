/**
 * Training Progress Service
 *
 * Tracks user training module completion, certifications, and
 * organization-wide readiness for go-live.
 */

import { query, queryOne, transaction } from '../config/database';

// =============================================================================
// TYPES
// =============================================================================

interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  sort_order: number;
  content_url: string | null;
  is_required: boolean;
  prerequisites: string[];
  created_at: string;
  updated_at: string;
}

interface UserModuleProgress {
  module_id: string;
  title: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  sort_order: number;
  is_required: boolean;
  content_url: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  time_spent_minutes: number;
  notes: string | null;
}

interface UserProgressSummary {
  modules: UserModuleProgress[];
  total_modules: number;
  completed_modules: number;
  in_progress_modules: number;
  not_started_modules: number;
  completion_percentage: number;
  total_time_spent_minutes: number;
}

interface Certification {
  id: string;
  user_id: string;
  certification_type: string;
  earned_at: string;
  expires_at: string | null;
  granted_by: string | null;
  grantor_name: string | null;
  notes: string | null;
}

interface DashboardRow {
  module_id: string;
  title: string;
  category: string;
  duration_minutes: number;
  is_required: boolean;
  sort_order: number;
  completed_count: number;
  in_progress_count: number;
  total_users: number;
  completion_rate: number;
}

interface OrganizationProgress {
  modules: DashboardRow[];
  total_users: number;
  total_certifications: number;
  overall_completion_rate: number;
}

interface ReadinessAssessment {
  totalUsers: number;
  readyUsers: number;
  requiredModulesCompleted: number;
  certifications: number;
  overallReadiness: boolean;
}

// =============================================================================
// MODULE LISTING
// =============================================================================

/**
 * Returns all training modules ordered by sort_order.
 */
export async function listModules(): Promise<TrainingModule[]> {
  return query<TrainingModule>(
    `SELECT id, title, description, category, duration_minutes, sort_order,
            content_url, is_required, prerequisites, created_at, updated_at
     FROM training_modules
     ORDER BY sort_order`
  );
}

// =============================================================================
// USER PROGRESS
// =============================================================================

/**
 * Returns a user's progress across all training modules.
 * Includes module info merged with user status/dates and an overall
 * completion percentage.
 */
export async function getUserProgress(userId: string): Promise<UserProgressSummary> {
  const modules = await query<UserModuleProgress>(
    `SELECT
       tm.id AS module_id,
       tm.title,
       tm.description,
       tm.category,
       tm.duration_minutes,
       tm.sort_order,
       tm.is_required,
       tm.content_url,
       COALESCE(utp.status, 'not_started') AS status,
       utp.started_at,
       utp.completed_at,
       utp.score,
       COALESCE(utp.time_spent_minutes, 0) AS time_spent_minutes,
       utp.notes
     FROM training_modules tm
     LEFT JOIN user_training_progress utp
       ON utp.module_id = tm.id AND utp.user_id = $1
     ORDER BY tm.sort_order`,
    [userId]
  );

  const totalModules = modules.length;
  const completedModules = modules.filter(m => m.status === 'completed').length;
  const inProgressModules = modules.filter(m => m.status === 'in_progress').length;
  const notStartedModules = modules.filter(m => m.status === 'not_started').length;
  const totalTimeSpent = modules.reduce((sum, m) => sum + (m.time_spent_minutes || 0), 0);
  const completionPercentage = totalModules > 0
    ? Math.round((completedModules / totalModules) * 100 * 10) / 10
    : 0;

  return {
    modules,
    total_modules: totalModules,
    completed_modules: completedModules,
    in_progress_modules: inProgressModules,
    not_started_modules: notStartedModules,
    completion_percentage: completionPercentage,
    total_time_spent_minutes: totalTimeSpent,
  };
}

// =============================================================================
// START MODULE
// =============================================================================

/**
 * Start a training module for a user.
 * If the user already has a row for this module, updates status to in_progress
 * while preserving the original started_at timestamp.
 */
export async function startModule(userId: string, moduleId: string): Promise<UserModuleProgress> {
  const row = await queryOne<UserModuleProgress>(
    `INSERT INTO user_training_progress (user_id, module_id, status, started_at)
     VALUES ($1, $2, 'in_progress', NOW())
     ON CONFLICT (user_id, module_id)
     DO UPDATE SET
       status = 'in_progress',
       started_at = COALESCE(user_training_progress.started_at, NOW()),
       updated_at = NOW()
     RETURNING *`,
    [userId, moduleId]
  );

  return row!;
}

// =============================================================================
// COMPLETE MODULE
// =============================================================================

/**
 * Mark a training module as completed for a user.
 * If all required modules are now completed, automatically grants
 * the 'basic_operator' certification.
 */
export async function completeModule(
  userId: string,
  moduleId: string,
  score?: number
): Promise<UserModuleProgress> {
  return transaction(async (client) => {
    // Update the progress record to completed
    const result = await client.query(
      `INSERT INTO user_training_progress (user_id, module_id, status, started_at, completed_at, score)
       VALUES ($1, $2, 'completed', NOW(), NOW(), $3)
       ON CONFLICT (user_id, module_id)
       DO UPDATE SET
         status = 'completed',
         completed_at = NOW(),
         score = COALESCE($3, user_training_progress.score),
         updated_at = NOW()
       RETURNING *`,
      [userId, moduleId, score ?? null]
    );
    const progress = result.rows[0] as UserModuleProgress;

    // Check if all required modules are now completed
    const incomplete = await client.query(
      `SELECT COUNT(*)::int AS cnt
       FROM training_modules tm
       LEFT JOIN user_training_progress utp
         ON utp.module_id = tm.id AND utp.user_id = $1
       WHERE tm.is_required = true
         AND (utp.status IS NULL OR utp.status != 'completed')`,
      [userId]
    );

    if (incomplete.rows[0].cnt === 0) {
      // All required modules completed -- auto-grant basic_operator cert if not already earned
      const existing = await client.query(
        `SELECT id FROM training_certifications
         WHERE user_id = $1 AND certification_type = 'basic_operator'`,
        [userId]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO training_certifications (user_id, certification_type, notes)
           VALUES ($1, 'basic_operator', 'Auto-granted: all required training modules completed')`,
          [userId]
        );
      }
    }

    return progress;
  });
}

// =============================================================================
// UPDATE PROGRESS (TIME SPENT)
// =============================================================================

/**
 * Increment the time spent on a training module.
 */
export async function updateProgress(
  userId: string,
  moduleId: string,
  timeSpent: number
): Promise<void> {
  await queryOne(
    `UPDATE user_training_progress
     SET time_spent_minutes = time_spent_minutes + $3,
         updated_at = NOW()
     WHERE user_id = $1 AND module_id = $2`,
    [userId, moduleId, timeSpent]
  );
}

// =============================================================================
// CERTIFICATIONS
// =============================================================================

/**
 * Get all certifications earned by a user.
 */
export async function getUserCertifications(userId: string): Promise<Certification[]> {
  return query<Certification>(
    `SELECT
       tc.id,
       tc.user_id,
       tc.certification_type,
       tc.earned_at,
       tc.expires_at,
       tc.granted_by,
       TRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')) AS grantor_name,
       tc.notes
     FROM training_certifications tc
     LEFT JOIN users g ON g.id = tc.granted_by
     WHERE tc.user_id = $1
     ORDER BY tc.earned_at DESC`,
    [userId]
  );
}

/**
 * Manually grant a certification to a user.
 */
export async function grantCertification(
  userId: string,
  certType: string,
  grantedBy: string,
  notes?: string
): Promise<Certification> {
  const result = await queryOne<Certification>(
    `INSERT INTO training_certifications (user_id, certification_type, granted_by, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, certType, grantedBy, notes ?? null]
  );
  return result!;
}

// =============================================================================
// ORGANIZATION PROGRESS (ADMIN VIEW)
// =============================================================================

/**
 * Returns organization-wide training stats from the v_training_dashboard view,
 * plus total users, total certifications, and an overall completion rate.
 */
export async function getOrganizationProgress(): Promise<OrganizationProgress> {
  const [modules, userStats, certStats] = await Promise.all([
    query<DashboardRow>(`SELECT * FROM v_training_dashboard ORDER BY sort_order`),
    queryOne<{ total_users: number }>(
      `SELECT COUNT(*)::int AS total_users FROM users WHERE is_active = true`
    ),
    queryOne<{ total_certifications: number }>(
      `SELECT COUNT(*)::int AS total_certifications FROM training_certifications`
    ),
  ]);

  const totalUsers = userStats?.total_users || 0;
  const totalCertifications = certStats?.total_certifications || 0;

  // Overall completion rate: average of each module's completion rate
  const overallCompletionRate = modules.length > 0
    ? Math.round(
        (modules.reduce((sum, m) => sum + (Number(m.completion_rate) || 0), 0) / modules.length) * 10
      ) / 10
    : 0;

  return {
    modules,
    total_users: totalUsers,
    total_certifications: totalCertifications,
    overall_completion_rate: overallCompletionRate,
  };
}

// =============================================================================
// GO-LIVE READINESS ASSESSMENT (TRAINING)
// =============================================================================

/**
 * Assess organization-wide training readiness for go-live.
 * - Count users who completed ALL required modules
 * - Count users with 'go_live_ready' certification
 * - Return overall readiness boolean (true if >= 80% of active users
 *   have completed all required modules)
 */
export async function getReadinessAssessment(): Promise<ReadinessAssessment> {
  const [totalResult, readyResult, certResult] = await Promise.all([
    // Total active users
    queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt FROM users WHERE is_active = true`
    ),

    // Users who completed ALL required modules
    queryOne<{ cnt: number }>(
      `SELECT COUNT(*)::int AS cnt
       FROM (
         SELECT utp.user_id
         FROM training_modules tm
         JOIN user_training_progress utp
           ON utp.module_id = tm.id AND utp.status = 'completed'
         JOIN users u ON u.id = utp.user_id AND u.is_active = true
         WHERE tm.is_required = true
         GROUP BY utp.user_id
         HAVING COUNT(*) = (
           SELECT COUNT(*) FROM training_modules WHERE is_required = true
         )
       ) AS ready_users`
    ),

    // Users with go_live_ready certification
    queryOne<{ cnt: number }>(
      `SELECT COUNT(DISTINCT user_id)::int AS cnt
       FROM training_certifications
       WHERE certification_type = 'go_live_ready'`
    ),
  ]);

  const totalUsers = totalResult?.cnt || 0;
  const readyUsers = readyResult?.cnt || 0;
  const certifications = certResult?.cnt || 0;

  // Overall readiness: at least 80% of active users completed all required modules
  const overallReadiness = totalUsers > 0 && (readyUsers / totalUsers) >= 0.8;

  return {
    totalUsers,
    readyUsers,
    requiredModulesCompleted: readyUsers,
    certifications,
    overallReadiness,
  };
}
