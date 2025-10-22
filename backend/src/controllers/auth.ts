import { Request, Response } from 'express';
import { createUser, findUserByEmail, findUserById, findUserByIdWithPassword, updateUserPassword } from '../services/sqlClient';
import { AccountLockoutService } from '../services/accountLockout';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createComponentLogger } from '../utils/logger';
import prisma from '../services/sqlClient';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
// Cookie configuration: allow overriding in preview environments
// For HTTPS cross-origin (like Coder), we need sameSite: 'none' and secure: true
const isHTTPS = process.env.AUTH_COOKIE_SECURE === 'true' || 
  process.env.NODE_ENV === 'production' ||
  process.env.CODER_HOST !== undefined;

const COOKIE_SAMESITE: 'none' | 'lax' | 'strict' = (process.env.AUTH_COOKIE_SAMESITE as any) || (isHTTPS ? 'none' : 'lax');
const COOKIE_SECURE = isHTTPS;

const logger = createComponentLogger('AuthController');

// Initialize account lockout service
const lockoutService = new AccountLockoutService(prisma);

export async function signup(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    
    const user = await createUser(email, password, name);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    // set HttpOnly cookie (configurable SameSite / Secure)
    res.cookie('orcheplan_token', token, { httpOnly: true, sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE });
    // Return the token in the JSON body for API clients (needed for testing and API access)
    res.json({ 
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    
    // Check if account is locked before attempting login
    const lockoutStatus = await lockoutService.isAccountLocked(email);
    if (lockoutStatus.isLocked) {
      logger.warn('Login attempt on locked account', { 
        email,
        action: 'login',
        lockoutReason: lockoutStatus.lockoutReason,
        lockedUntil: lockoutStatus.lockedUntil
      });
      
      return res.status(423).json({ 
        error: 'Account is temporarily locked due to too many failed login attempts',
        lockedUntil: lockoutStatus.lockedUntil,
        reason: lockoutStatus.lockoutReason
      });
    }
    
    const user = await findUserByEmail(email);
    if (!user) {
      // Record failed attempt even for non-existent users (don't reveal user existence)
      await lockoutService.recordFailedAttempt(email, req.ip, req.get('User-Agent'));
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      // Record failed login attempt
      await lockoutService.recordFailedAttempt(email, req.ip, req.get('User-Agent'));
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Clear failed attempts on successful login
    await lockoutService.recordSuccessfulLogin(email);
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    // set HttpOnly cookie (configurable SameSite / Secure)
    res.cookie('orcheplan_token', token, { httpOnly: true, sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE });
    // Return the token in the JSON body for API clients (needed for testing and API access)
    logger.info('User login successful', { 
      userId: user.id, 
      email: user.email,
      action: 'login'
    });
    
    res.json({ 
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role } 
    });
  } catch (err) {
    logger.error('Login error', { action: 'login', email: req.body.email }, err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    res.clearCookie('orcheplan_token', { sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE });
    
    logger.info('User logout successful', { 
      userId,
      action: 'logout'
    });
    
    res.json({ ok: true });
  } catch (err) {
    logger.error('Logout error', { action: 'logout' }, err);
    res.status(500).json({ error: 'internal' });
  }
}

export async function me(req: Request, res: Response) {
  try {
    // authMiddleware attaches req.user = { id }
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      logger.warn('Unauthorized access attempt to /me endpoint', { action: 'me' });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const user = await findUserById(userId);
    if (!user) {
      logger.warn('User not found for valid token', { userId, action: 'me' });
      return res.status(404).json({ error: 'User not found' });
    }
    
    logger.debug('User profile retrieved', { userId, action: 'me' });
    return res.json({ user });
  } catch (err) {
    logger.error('Error retrieving user profile', { action: 'me' }, err);
    return res.status(500).json({ error: 'internal' });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    // authMiddleware should be applied to this endpoint to ensure user is authenticated
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      logger.warn('Unauthorized access attempt to change password', { action: 'change_password' });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate new password strength (basic validation)
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current user with password for verification
    const user = await findUserByIdWithPassword(userId);
    if (!user) {
      logger.warn('User not found for password change', { userId, action: 'change_password' });
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if account is locked before verifying password
    const lockoutStatus = await lockoutService.isAccountLocked(user.email);
    if (lockoutStatus.isLocked) {
      logger.warn('Password change attempt on locked account', { 
        userId,
        email: user.email,
        action: 'change_password',
        lockoutReason: lockoutStatus.lockoutReason,
        lockedUntil: lockoutStatus.lockedUntil
      });
      
      return res.status(423).json({ 
        error: 'Account is temporarily locked. Please try again later.',
        lockedUntil: lockoutStatus.lockedUntil,
        reason: lockoutStatus.lockoutReason
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      // Record failed password verification attempt
      await lockoutService.recordFailedAttempt(user.email, req.ip, req.get('User-Agent'));
      logger.warn('Invalid current password for password change', { userId, email: user.email, action: 'change_password' });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    await updateUserPassword(userId, hashedNewPassword);

    // Clear any failed attempts since password change was successful
    await lockoutService.recordSuccessfulLogin(user.email);

    logger.info('Password changed successfully', { userId, email: user.email, action: 'change_password' });
    res.json({ success: true, message: 'Password changed successfully' });
    
  } catch (err) {
    logger.error('Error changing password', { action: 'change_password' }, err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
