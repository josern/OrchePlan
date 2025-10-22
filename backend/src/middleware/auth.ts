import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById } from '../services/sqlClient';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthedRequest extends Request {
  user?: { id: string; role?: string };
  // populated by authMiddleware/ensureUser
  userId?: string;
  userRole?: string;
}

export async function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  let token: string | undefined | null = undefined;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) token = auth.split(' ')[1];
  // fallback to cookie
  if (!token && (req as any).cookies) token = (req as any).cookies['orcheplan_token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    
    // Fetch user to get role information
    const user = await findUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // attach user id and role to request
    req.user = { id: payload.userId, role: user.role };
    req.userId = payload.userId;
    req.userRole = user.role;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Role-based middleware factory
export function requireRole(requiredRole: string | string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const userRole = req.userRole;
    
    if (!userRole) {
      return res.status(401).json({ error: 'Unauthorized - role not found' });
    }
    
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Superuser has access to everything
    if (userRole === 'superuser') {
      return next();
    }
    
    // Check if user has required role
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Access denied - insufficient privileges',
        required: allowedRoles,
        current: userRole
      });
    }
    
    return next();
  };
}

// Specific role middlewares for convenience
export const requireAdmin = requireRole(['admin', 'superuser']);
export const requireSuperuser = requireRole('superuser');

// Helper to check if user has a specific role
export function hasRole(req: AuthedRequest, role: string | string[]): boolean {
  const userRole = req.userRole;
  if (!userRole) return false;
  
  // Superuser has all roles
  if (userRole === 'superuser') return true;
  
  const allowedRoles = Array.isArray(role) ? role : [role];
  return allowedRoles.includes(userRole);
}

// Helper to safely retrieve the authenticated user id or throw a 401 response
export function getReqUserId(req: AuthedRequest): string {
  const uid = req.user?.id;
  if (!uid) {
    // This function is used after authMiddleware, but in case of misuse return 401 by throwing a special error
    const e: any = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
  return uid;
}

// Wrapper to simplify route handlers that need the authenticated user id.
// Usage: router.get('/', ensureUser(async (req, res, next, userId) => { ... }))
// Middleware variant: attach userId to req and call next(); if missing, forward an Unauthorized error.
export function ensureUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
  const uid = getReqUserId(req);
  // add a convenient top-level property for handlers
  req.userId = uid;
    return next();
  } catch (err) {
    return next(err);
  }
}
