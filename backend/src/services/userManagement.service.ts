import { query, queryOne } from '../config/database';
import bcrypt from 'bcrypt';

// =============================================================================
// USER MANAGEMENT
// =============================================================================

interface CreateUserParams {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: 'admin' | 'operator' | 'viewer';
  organization?: string;
  customer_id?: number;
  phone?: string;
  job_title?: string;
  department?: string;
}

interface UpdateUserParams {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: 'admin' | 'operator' | 'viewer';
  organization?: string;
  customer_id?: number | null;
  phone?: string;
  job_title?: string;
  department?: string;
  is_active?: boolean;
}

export async function listUsers(filters?: {
  role?: string;
  customer_id?: number;
  is_active?: boolean;
  search?: string;
}) {
  let sql = 'SELECT * FROM v_user_summary WHERE 1=1';
  const params: any[] = [];
  let paramCount = 0;

  if (filters?.role) {
    paramCount++;
    sql += ` AND role = $${paramCount}`;
    params.push(filters.role);
  }

  if (filters?.customer_id) {
    paramCount++;
    sql += ` AND customer_id = $${paramCount}`;
    params.push(filters.customer_id);
  }

  if (filters?.is_active !== undefined) {
    paramCount++;
    sql += ` AND is_active = $${paramCount}`;
    params.push(filters.is_active);
  }

  if (filters?.search) {
    paramCount++;
    sql += ` AND (email ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
  }

  sql += ' ORDER BY created_at DESC';

  return query(sql, params);
}

export async function getUserById(userId: string) {
  return queryOne('SELECT * FROM v_user_summary WHERE id = $1', [userId]);
}

export async function createUser(params: CreateUserParams) {
  const {
    email,
    password,
    first_name,
    last_name,
    role = 'viewer',
    organization,
    customer_id,
    phone,
    job_title,
    department,
  } = params;

  // Hash password
  const password_hash = await bcrypt.hash(password, 12);

  const result = await queryOne<{ id: string }>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, organization, customer_id, phone, job_title, department)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [email, password_hash, first_name, last_name, role, organization, customer_id, phone, job_title, department]
  );

  if (!result) throw new Error('Failed to create user');

  return getUserById(result.id);
}

export async function updateUser(userId: string, params: UpdateUserParams) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      paramCount++;
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getUserById(userId);

  // Add updated_at
  paramCount++;
  fields.push(`updated_at = NOW()`);

  paramCount++;
  values.push(userId);

  await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`,
    values
  );

  return getUserById(userId);
}

export async function updatePassword(userId: string, newPassword: string) {
  const password_hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [password_hash, userId]);
}

export async function deactivateUser(userId: string) {
  await query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [userId]);
}

export async function activateUser(userId: string) {
  await query('UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1', [userId]);
}

export async function deleteUser(userId: string) {
  // Soft delete by deactivating, or hard delete if needed
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

// =============================================================================
// PERMISSIONS
// =============================================================================

export async function listPermissions() {
  return query('SELECT * FROM permissions ORDER BY category, name');
}

export async function getUserPermissions(userId: string) {
  return query(
    `SELECT permission_code, has_permission
     FROM v_user_permissions
     WHERE user_id = $1 AND has_permission = true`,
    [userId]
  );
}

export async function checkUserPermission(userId: string, permissionCode: string): Promise<boolean> {
  const result = await queryOne<{ has_permission: boolean }>(
    `SELECT has_permission FROM v_user_permissions
     WHERE user_id = $1 AND permission_code = $2`,
    [userId, permissionCode]
  );
  return result?.has_permission ?? false;
}

export async function getRolePermissions(role: string) {
  return query(
    `SELECT p.* FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role = $1
     ORDER BY p.category, p.name`,
    [role]
  );
}

export async function grantUserPermission(userId: string, permissionCode: string, grantedBy?: string) {
  const permission = await queryOne<{ id: number }>('SELECT id FROM permissions WHERE code = $1', [permissionCode]);
  if (!permission) throw new Error(`Permission not found: ${permissionCode}`);

  await query(
    `INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
     VALUES ($1, $2, true, $3)
     ON CONFLICT (user_id, permission_id) DO UPDATE SET granted = true, granted_by = $3, granted_at = NOW()`,
    [userId, permission.id, grantedBy]
  );
}

export async function revokeUserPermission(userId: string, permissionCode: string) {
  const permission = await queryOne<{ id: number }>('SELECT id FROM permissions WHERE code = $1', [permissionCode]);
  if (!permission) throw new Error(`Permission not found: ${permissionCode}`);

  await query(
    'DELETE FROM user_permissions WHERE user_id = $1 AND permission_id = $2',
    [userId, permission.id]
  );
}

export async function denyUserPermission(userId: string, permissionCode: string, grantedBy?: string) {
  const permission = await queryOne<{ id: number }>('SELECT id FROM permissions WHERE code = $1', [permissionCode]);
  if (!permission) throw new Error(`Permission not found: ${permissionCode}`);

  await query(
    `INSERT INTO user_permissions (user_id, permission_id, granted, granted_by)
     VALUES ($1, $2, false, $3)
     ON CONFLICT (user_id, permission_id) DO UPDATE SET granted = false, granted_by = $3, granted_at = NOW()`,
    [userId, permission.id, grantedBy]
  );
}

// =============================================================================
// USER GROUPS
// =============================================================================

export async function listGroups(customerId?: number) {
  let sql = 'SELECT * FROM v_user_groups_summary';
  const params: any[] = [];

  if (customerId) {
    sql += ' WHERE customer_id = $1';
    params.push(customerId);
  }

  sql += ' ORDER BY name';
  return query(sql, params);
}

export async function getGroupById(groupId: number) {
  return queryOne('SELECT * FROM v_user_groups_summary WHERE id = $1', [groupId]);
}

export async function createGroup(name: string, description?: string, customerId?: number, createdBy?: string) {
  const result = await queryOne<{ id: number }>(
    `INSERT INTO user_groups (name, description, customer_id, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, description, customerId, createdBy]
  );

  if (!result) throw new Error('Failed to create group');
  return getGroupById(result.id);
}

export async function updateGroup(groupId: number, name?: string, description?: string) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  if (name) {
    paramCount++;
    fields.push(`name = $${paramCount}`);
    values.push(name);
  }

  if (description !== undefined) {
    paramCount++;
    fields.push(`description = $${paramCount}`);
    values.push(description);
  }

  if (fields.length > 0) {
    paramCount++;
    fields.push('updated_at = NOW()');
    values.push(groupId);

    await query(
      `UPDATE user_groups SET ${fields.join(', ')} WHERE id = $${paramCount}`,
      values
    );
  }

  return getGroupById(groupId);
}

export async function deleteGroup(groupId: number) {
  await query('DELETE FROM user_groups WHERE id = $1', [groupId]);
}

export async function getGroupMembers(groupId: number) {
  return query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, ugm.added_at
     FROM users u
     JOIN user_group_members ugm ON u.id = ugm.user_id
     WHERE ugm.group_id = $1
     ORDER BY u.email`,
    [groupId]
  );
}

export async function addUserToGroup(groupId: number, userId: string, addedBy?: string) {
  await query(
    `INSERT INTO user_group_members (group_id, user_id, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [groupId, userId, addedBy]
  );
}

export async function removeUserFromGroup(groupId: number, userId: string) {
  await query(
    'DELETE FROM user_group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
}

export async function getGroupPermissions(groupId: number) {
  return query(
    `SELECT p.* FROM permissions p
     JOIN group_permissions gp ON p.id = gp.permission_id
     WHERE gp.group_id = $1
     ORDER BY p.category, p.name`,
    [groupId]
  );
}

export async function setGroupPermissions(groupId: number, permissionCodes: string[]) {
  // Get permission IDs
  const permissions = await query<{ id: number; code: string }>(
    'SELECT id, code FROM permissions WHERE code = ANY($1)',
    [permissionCodes]
  );

  // Clear existing
  await query('DELETE FROM group_permissions WHERE group_id = $1', [groupId]);

  // Add new
  for (const p of permissions) {
    await query(
      'INSERT INTO group_permissions (group_id, permission_id) VALUES ($1, $2)',
      [groupId, p.id]
    );
  }
}

// =============================================================================
// CUSTOMER PORTAL
// =============================================================================

export async function getCustomerUsers(customerId: number) {
  return query(
    'SELECT * FROM v_user_summary WHERE customer_id = $1 ORDER BY email',
    [customerId]
  );
}

export async function assignUserToCustomer(userId: string, customerId: number | null) {
  await query(
    'UPDATE users SET customer_id = $1, updated_at = NOW() WHERE id = $2',
    [customerId, userId]
  );
  return getUserById(userId);
}

// =============================================================================
// ACTIVITY TRACKING
// =============================================================================

export async function updateLastActivity(userId: string) {
  await query(
    'UPDATE users SET last_activity_at = NOW() WHERE id = $1',
    [userId]
  );
}

export async function getActiveUsers(minutesAgo: number = 15) {
  return query(
    `SELECT id, email, first_name, last_name, last_activity_at
     FROM users
     WHERE last_activity_at > NOW() - INTERVAL '${minutesAgo} minutes'
     AND is_active = true
     ORDER BY last_activity_at DESC`
  );
}

export default {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updatePassword,
  deactivateUser,
  activateUser,
  deleteUser,
  listPermissions,
  getUserPermissions,
  checkUserPermission,
  getRolePermissions,
  grantUserPermission,
  revokeUserPermission,
  denyUserPermission,
  listGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addUserToGroup,
  removeUserFromGroup,
  getGroupPermissions,
  setGroupPermissions,
  getCustomerUsers,
  assignUserToCustomer,
  updateLastActivity,
  getActiveUsers,
};
