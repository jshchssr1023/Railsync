import { Request, Response } from 'express';
import logger from '../config/logger';
import crypto from 'crypto';
import { z } from 'zod';
import {
  findByEmail,
  verifyPassword,
  createUser,
  updateLastLogin,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  findByIdPublic,
} from '../models/user.model';
import { generateAccessToken, REFRESH_TOKEN_EXPIRES_DAYS } from '../middleware/auth';
import { logFromRequest, createAuditLog } from '../services/audit.service';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  organization: z.string().optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parseResult.error.issues,
      });
      return;
    }

    const { email, password } = parseResult.data;

    // Find user
    const user = await findByEmail(email);
    if (!user) {
      // Log failed attempt
      await createAuditLog({
        userEmail: email,
        action: 'login_failed',
        entityType: 'user',
        ipAddress: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
      return;
    }

    // Verify password
    const isValid = await verifyPassword(user, password);
    if (!isValid) {
      await createAuditLog({
        userId: user.id,
        userEmail: email,
        action: 'login_failed',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshExpires = new Date();
    refreshExpires.setDate(refreshExpires.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
    const { token: refreshToken } = await createRefreshToken(user.id, refreshExpires);

    // Update last login
    await updateLastLogin(user.id);

    // Log successful login
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 15 * 60, // 15 minutes in seconds
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          organization: user.organization,
        },
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * POST /api/auth/register
 * Register a new user (viewer role by default)
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parseResult.error.issues,
      });
      return;
    }

    const { email, password, first_name, last_name, organization } = parseResult.data;

    // Check if email already exists
    const existingUser = await findByEmail(email);
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'Email already registered',
        message: 'An account with this email already exists',
      });
      return;
    }

    // Create user with viewer role
    const user = await createUser(email, password, first_name, last_name, 'viewer', organization);

    // Log registration
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'create',
      entityType: 'user',
      entityId: user.id,
      newValue: { email, first_name, last_name, role: 'viewer', organization },
      ipAddress: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Generate tokens for immediate login
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshExpires = new Date();
    refreshExpires.setDate(refreshExpires.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
    const { token: refreshToken } = await createRefreshToken(user.id, refreshExpires);

    res.status(201).json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 15 * 60,
        user,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Registration error');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    // Validate input
    const parseResult = refreshSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: parseResult.error.issues,
      });
      return;
    }

    const { refresh_token } = parseResult.data;

    // Hash the provided token to look it up
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    // Find valid refresh token
    const storedToken = await findRefreshToken(tokenHash);
    if (!storedToken) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        message: 'The refresh token is invalid or has expired',
      });
      return;
    }

    // Get user
    const user = await findByIdPublic(storedToken.user_id);
    if (!user || !user.is_active) {
      // Revoke the token if user not found/inactive
      await revokeRefreshToken(tokenHash);

      res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'The user associated with this token no longer exists or is inactive',
      });
      return;
    }

    // Revoke old refresh token (rotation)
    await revokeRefreshToken(tokenHash);

    // Generate new tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshExpires = new Date();
    refreshExpires.setDate(refreshExpires.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
    const { token: newRefreshToken } = await createRefreshToken(user.id, refreshExpires);

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_in: 15 * 60,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Refresh error');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * POST /api/auth/logout
 * Logout user and revoke all tokens
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    // Revoke all refresh tokens for this user
    await revokeAllUserTokens(req.user.id);

    // Log logout
    await logFromRequest(req, 'logout', 'user', req.user.id);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    logger.error({ err: error }, 'Logout error');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * GET /api/auth/me
 * Get current user info
 */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    logger.error({ err: error }, 'Me error');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
