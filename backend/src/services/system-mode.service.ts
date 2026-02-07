/**
 * System Mode Service
 *
 * Controls the operational mode of RailSync during cutover.
 * Modes: parallel (both systems active), cutover (RailSync primary, CIPROTS read-only), live (CIPROTS retired)
 */

import { query, queryOne } from '../config/database';

type SystemMode = 'parallel' | 'cutover' | 'live';

interface SystemModeInfo {
  mode: SystemMode;
  cutover_started_at: string | null;
  go_live_date: string | null;
  updated_at: string;
  updated_by: string | null;
}

export async function getSystemMode(): Promise<SystemModeInfo> {
  const mode = await queryOne<{ value: string; updated_at: string; updated_by: string }>(
    `SELECT value::text, updated_at::text, updated_by::text FROM system_settings WHERE key = 'system_mode'`
  );
  const cutoverStarted = await queryOne<{ value: string }>(
    `SELECT value::text FROM system_settings WHERE key = 'cutover_started_at'`
  );
  const goLiveDate = await queryOne<{ value: string }>(
    `SELECT value::text FROM system_settings WHERE key = 'go_live_date'`
  );

  const modeValue = mode?.value ? JSON.parse(mode.value) : 'parallel';

  return {
    mode: modeValue as SystemMode,
    cutover_started_at: cutoverStarted?.value ? JSON.parse(cutoverStarted.value) : null,
    go_live_date: goLiveDate?.value ? JSON.parse(goLiveDate.value) : null,
    updated_at: mode?.updated_at || new Date().toISOString(),
    updated_by: mode?.updated_by || null,
  };
}

export async function setSystemMode(mode: SystemMode, userId: string): Promise<SystemModeInfo> {
  // Validate transition
  const current = await getSystemMode();
  const validTransitions: Record<SystemMode, SystemMode[]> = {
    parallel: ['cutover'],
    cutover: ['live', 'parallel'],  // Allow rollback to parallel
    live: [],                        // No going back from live
  };

  if (!validTransitions[current.mode].includes(mode)) {
    throw new Error(`Cannot transition from '${current.mode}' to '${mode}'. Allowed: ${validTransitions[current.mode].join(', ') || 'none'}`);
  }

  await query(
    `UPDATE system_settings SET value = $1::jsonb, updated_by = $2, updated_at = NOW() WHERE key = 'system_mode'`,
    [JSON.stringify(mode), userId]
  );

  // Set cutover timestamp if transitioning to cutover
  if (mode === 'cutover') {
    await query(
      `UPDATE system_settings SET value = $1::jsonb, updated_by = $2, updated_at = NOW() WHERE key = 'cutover_started_at'`,
      [JSON.stringify(new Date().toISOString()), userId]
    );
  }

  // Set go-live date if transitioning to live
  if (mode === 'live') {
    await query(
      `UPDATE system_settings SET value = $1::jsonb, updated_by = $2, updated_at = NOW() WHERE key = 'go_live_date'`,
      [JSON.stringify(new Date().toISOString()), userId]
    );
  }

  return getSystemMode();
}

export async function getSystemSetting(key: string): Promise<any> {
  const result = await queryOne<{ value: string }>(
    `SELECT value::text FROM system_settings WHERE key = $1`,
    [key]
  );
  return result ? JSON.parse(result.value) : null;
}

export async function setSystemSetting(key: string, value: any, userId: string): Promise<void> {
  await query(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_by = $3, updated_at = NOW()`,
    [key, JSON.stringify(value), userId]
  );
}
