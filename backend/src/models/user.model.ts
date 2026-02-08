import { query, queryOne, transaction } from '../config/database';
import { User, UserPublic, RefreshToken } from '../types';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

/**
 * Find user by email
 */
export async function findByEmail(email: string): Promise<User | null> {
  return queryOne<User>(
    'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
    [email.toLowerCase()]
  );
}

/**
 * Find user by ID
 */
export async function findById(id: string): Promise<User | null> {
  return queryOne<User>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
}

/**
 * Find user by ID (public info only, no password hash)
 */
export async function findByIdPublic(id: string): Promise<UserPublic | null> {
  return queryOne<UserPublic>(
    `SELECT id, email, first_name, last_name, role, organization, is_active, last_login
     FROM users WHERE id = $1`,
    [id]
  );
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'operator' | 'viewer' = 'viewer',
  organization?: string
): Promise<UserPublic> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await queryOne<UserPublic>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, organization)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, first_name, last_name, role, organization, is_active, last_login`,
    [email.toLowerCase(), passwordHash, firstName, lastName, role, organization]
  );

  if (!result) {
    throw new Error('Failed to create user');
  }

  return result;
}

/**
 * Verify password
 */
export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [userId]
  );
}

/**
 * Update user password
 */
export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, userId]
  );
}

/**
 * List all users (admin only)
 */
export async function listUsers(
  limit: number = 50,
  offset: number = 0
): Promise<{ users: UserPublic[]; total: number }> {
  const users = await query<UserPublic>(
    `SELECT id, email, first_name, last_name, role, organization, is_active, last_login, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countResult = await queryOne<{ count: string }>('SELECT COUNT(*) FROM users', []);
  const total = countResult ? parseInt(countResult.count, 10) : 0;

  return { users, total };
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  role: 'admin' | 'operator' | 'viewer'
): Promise<UserPublic | null> {
  return queryOne<UserPublic>(
    `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, email, first_name, last_name, role, organization, is_active, last_login`,
    [role, userId]
  );
}

/**
 * Deactivate user (admin only)
 */
export async function deactivateUser(userId: string): Promise<void> {
  await transaction(async (client) => {
    // Deactivate user
    await client.query(
      'UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
    // Revoke all refresh tokens
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  });
}

// ============================================================================
// REFRESH TOKEN OPERATIONS
// ============================================================================

/**
 * Create refresh token
 */
export async function createRefreshToken(
  userId: string,
  expiresAt: Date
): Promise<{ token: string; tokenHash: string }> {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return { token, tokenHash };
}

/**
 * Find refresh token by hash
 */
export async function findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
  return queryOne<RefreshToken>(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP`,
    [tokenHash]
  );
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
    [tokenHash]
  );
}

/**
 * Revoke all user's refresh tokens
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

/**
 * Clean up expired tokens (maintenance)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await query(
    'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP RETURNING id',
    []
  );
  return result.length;
}
