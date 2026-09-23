import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'agrinex_super_secure_jwt_secret_change_in_production_2026';
}

const SALT_ROUNDS = 10;

export interface AuthUserPayload {
  id: string;
  email?: string;
  phone?: string;
  role: 'FARMER' | 'BUYER' | 'TRANSPORTER' | 'DELIVERY_PERSON' | 'ADMIN' | string;
  name: string;
  organization?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

/**
 * Hash plain-text password using bcrypt
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText) return '';
  return await bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Compare plain-text password against bcrypt hash
 */
export async function comparePassword(plainText: string, hashed: string): Promise<boolean> {
  if (!plainText || !hashed) return false;
  // Support legacy plain text match if seeded before hashing, then gracefully upgrade
  if (hashed === plainText) return true;
  try {
    return await bcrypt.compare(plainText, hashed);
  } catch {
    return false;
  }
}

/**
 * Generate secure JWT token
 */
export function generateToken(user: { id: string; email?: string; phone?: string; role: string; name: string; organization?: string }): string {
  const payload: AuthUserPayload = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    name: user.name,
    organization: user.organization,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): AuthUserPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthUserPayload;
  } catch {
    return null;
  }
}

/**
 * Authentication middleware: populates req.user if Bearer token is provided
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = undefined;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (decoded) {
    req.user = decoded;
  } else {
    req.user = undefined;
  }
  next();
}

/**
 * Strict Auth guard: returns 401 if not authenticated
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication token required. Please sign in to continue.',
    });
  }
  next();
}

/**
 * Role-Based Access Control guard
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication token required.',
      });
    }

    const userRole = (req.user.role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

    const hasRoleMatch =
      normalizedAllowed.includes(userRole) ||
      (userRole === 'DELIVERY_PERSON' && normalizedAllowed.includes('TRANSPORTER')) ||
      (userRole === 'TRANSPORTER' && normalizedAllowed.includes('DELIVERY_PERSON'));

    if (!hasRoleMatch && userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Access denied. Role '${req.user.role}' does not have permission for this operation.`,
      });
    }

    next();
  };
}

/**
 * Strip sensitive credentials (passwords, OTP secrets) from user objects
 */
export function sanitizeUser(user: any): any {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : { ...user };
  delete u.password;
  delete u.__v;
  if (u.fpoLeader && u.fpoLeader.password) {
    delete u.fpoLeader.password;
  }
  return u;
}

/**
 * In-memory IP/identifier Rate Limiter
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

export function createRateLimiter(options: { windowMs: number; max: number; message: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}_${req.path}`;
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (!record || now > record.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > options.max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: options.message || 'Too many requests. Please try again later.',
        retryAfterSec,
      });
    }

    next();
  };
}
