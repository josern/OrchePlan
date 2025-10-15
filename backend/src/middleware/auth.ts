import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserByEmail } from '../services/sqlClient';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthedRequest extends Request {
  user?: any;
}

export async function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    // attach user id to request
    req.user = { id: payload.userId };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
