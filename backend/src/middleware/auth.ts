import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole, UserPublic } from '../types';
import { findByIdPublic } from '../models/user.model';

// Extend Express Request to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: UserPublic;
    requestId?: string;
  }
}

if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET environment variable is not set.');
  logger.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  logger.error('Set it in your .env file or environment before starting the server.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '7', 10);

export { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_DAYS };

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return null;

  return token;
}

/**
 * Authentication middleware - requires valid JWT
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please provide a valid Bearer token in the Authorization header',
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    // Fetch user from database to ensure they still exist and are active
    findByIdPublic(payload.userId)
      .then((user) => {
        if (!user) {
          res.status(401).json({
            success: false,
            error: 'User not found',
            message: 'The user associated with this token no longer exists',
          });
          return;
        }

        if (!user.is_active) {
          res.status(401).json({
            success: false,
            error: 'Account deactivated',
            message: 'This account has been deactivated',
          });
          return;
        }

        req.user = user;
        next();
      })
      .catch((err) => {
        logger.error({ err: err }, 'Auth middleware error');
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Your session has expired. Please refresh your token or log in again.',
      });
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'The provided token is invalid',
      });
      return;
    }

    logger.error({ err: err }, 'JWT verification error');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}

/**
 * Optional authentication - attaches user if token present, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    findByIdPublic(payload.userId)
      .then((user) => {
        if (user && user.is_active) {
          req.user = user;
        }
        next();
      })
      .catch(() => {
        // Silently continue without user on error
        next();
      });
  } catch {
    // Invalid token, continue without user
    next();
  }
}

/**
 * Authorization middleware factory - requires specific role(s)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Shop-scoped authorization middleware
 * For shop-role users, attaches their shop_code for downstream query filtering.
 * Non-shop users pass through unmodified.
 */
export function authorizeShop(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'You must be logged in to access this resource',
    });
    return;
  }

  // Non-shop users pass through — they can see all data
  if (req.user.role !== 'shop') {
    next();
    return;
  }

  // Shop users must have an assigned shop_code
  if (!req.user.shop_code) {
    res.status(403).json({
      success: false,
      error: 'No shop assigned',
      message: 'Your account does not have an assigned shop. Contact an administrator.',
    });
    return;
  }

  // Attach shop_code filter for downstream service calls
  (req as any).shopCodeFilter = req.user.shop_code;
  next();
}

/**
 * Request ID middleware - adds unique request ID for tracing
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = req.headers['x-request-id'] as string ||
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
}
