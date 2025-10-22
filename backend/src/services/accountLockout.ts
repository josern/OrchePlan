// Account lockout management for enhanced security
import { PrismaClient } from '@prisma/client';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('AccountLockout');

// Lockout configuration
const LOCKOUT_CONFIG = {
  maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS || '5', 10),
  lockoutDurationMs: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10) * 60 * 1000, // 15 minutes default
  attemptWindowMs: parseInt(process.env.ATTEMPT_WINDOW_MINUTES || '60', 10) * 60 * 1000, // 1 hour window
};

export interface LockoutStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil?: Date;
  lockoutReason?: string;
  canUnlock: boolean;
}

// Add lockout fields to user table (we'll need a migration for this)
export interface UserLockoutData {
  id: string;
  email: string;
  failedLoginAttempts: number;
  lastFailedAttempt?: Date;
  lockedUntil?: Date;
  lockoutReason?: string;
  isManuallyLocked: boolean;
}

// In-memory tracking for failed attempts (will be moved to database)
const failedAttempts = new Map<string, { count: number; firstAttempt: Date; attempts: Date[] }>();

export class AccountLockoutService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if an account is currently locked
   */
  async isAccountLocked(email: string): Promise<LockoutStatus> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          failedLoginAttempts: true,
          lastFailedAttempt: true,
          lockedUntil: true,
          lockoutReason: true,
          isManuallyLocked: true,
        }
      });

      if (!user) {
        return {
          isLocked: false,
          failedAttempts: 0,
          canUnlock: false
        };
      }

      const now = new Date();
      
      // Check if manually locked
      if (user.isManuallyLocked) {
        return {
          isLocked: true,
          failedAttempts: user.failedLoginAttempts || 0,
          lockedUntil: user.lockedUntil || undefined,
          lockoutReason: user.lockoutReason || 'Account manually locked by administrator',
          canUnlock: true
        };
      }

      // Check if automatically locked and still within lockout period
      if (user.lockedUntil && user.lockedUntil > now) {
        return {
          isLocked: true,
          failedAttempts: user.failedLoginAttempts || 0,
          lockedUntil: user.lockedUntil,
          lockoutReason: user.lockoutReason || 'Too many failed login attempts',
          canUnlock: true
        };
      }

      // Check if we need to reset expired lockout
      if (user.lockedUntil && user.lockedUntil <= now) {
        await this.unlockAccount(email, 'Automatic unlock - lockout period expired');
        return {
          isLocked: false,
          failedAttempts: 0,
          canUnlock: false
        };
      }

      return {
        isLocked: false,
        failedAttempts: user.failedLoginAttempts || 0,
        canUnlock: false
      };
    } catch (error) {
      logger.error('Error checking account lockout status', { email }, error);
      // Fail safe - don't lock out due to system errors
      return {
        isLocked: false,
        failedAttempts: 0,
        canUnlock: false
      };
    }
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedAttempt(email: string, ipAddress?: string, userAgent?: string): Promise<LockoutStatus> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          failedLoginAttempts: true,
          lastFailedAttempt: true,
          lockedUntil: true,
          isManuallyLocked: true,
        }
      });

      if (!user) {
        // Don't reveal if user exists - just return not locked
        return {
          isLocked: false,
          failedAttempts: 0,
          canUnlock: false
        };
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - LOCKOUT_CONFIG.attemptWindowMs);
      
      // Reset counter if last attempt was outside the window
      let newFailedAttempts = 1;
      if (user.lastFailedAttempt && user.lastFailedAttempt > windowStart) {
        newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
      }

      // Determine if account should be locked
      let lockedUntil: Date | null = null;
      let lockoutReason: string | null = null;
      
      if (newFailedAttempts >= LOCKOUT_CONFIG.maxFailedAttempts) {
        lockedUntil = new Date(now.getTime() + LOCKOUT_CONFIG.lockoutDurationMs);
        lockoutReason = `Account locked due to ${newFailedAttempts} failed login attempts`;
        
        logger.warn('Account locked due to failed attempts', {
          email,
          failedAttempts: newFailedAttempts,
          lockedUntil,
          ipAddress,
          userAgent,
          component: 'account-lockout'
        });
      }

      // Update user record
      await this.prisma.user.update({
        where: { email },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lastFailedAttempt: now,
          lockedUntil,
          lockoutReason,
        }
      });

      logger.info('Failed login attempt recorded', {
        email,
        failedAttempts: newFailedAttempts,
        maxAttempts: LOCKOUT_CONFIG.maxFailedAttempts,
        ipAddress,
        component: 'account-lockout'
      });

      return {
        isLocked: lockedUntil !== null,
        failedAttempts: newFailedAttempts,
        lockedUntil: lockedUntil || undefined,
        lockoutReason: lockoutReason || undefined,
        canUnlock: lockedUntil !== null
      };
    } catch (error) {
      logger.error('Error recording failed login attempt', { email }, error);
      // Fail safe - don't lock out due to system errors
      return {
        isLocked: false,
        failedAttempts: 0,
        canUnlock: false
      };
    }
  }

  /**
   * Record a successful login (clears failed attempts)
   */
  async recordSuccessfulLogin(email: string): Promise<void> {
    try {
      await this.prisma.user.updateMany({
        where: { email },
        data: {
          failedLoginAttempts: 0,
          lastFailedAttempt: null,
          lockedUntil: null,
          lockoutReason: null,
          // Don't clear manual locks on successful login
        }
      });

      logger.info('Successful login recorded - failed attempts cleared', {
        email,
        component: 'account-lockout'
      });
    } catch (error) {
      logger.error('Error recording successful login', { email }, error);
      // Non-critical error - don't throw
    }
  }

  /**
   * Manually unlock an account (admin function)
   */
  async unlockAccount(email: string, reason: string, unlockedBy?: string): Promise<boolean> {
    try {
      const result = await this.prisma.user.updateMany({
        where: { email },
        data: {
          failedLoginAttempts: 0,
          lastFailedAttempt: null,
          lockedUntil: null,
          lockoutReason: null,
          isManuallyLocked: false,
        }
      });

      if (result.count > 0) {
        logger.info('Account manually unlocked', {
          email,
          reason,
          unlockedBy,
          component: 'account-lockout'
        });
        return true;
      } else {
        logger.warn('Attempted to unlock non-existent account', {
          email,
          reason,
          unlockedBy,
          component: 'account-lockout'
        });
        return false;
      }
    } catch (error) {
      logger.error('Error unlocking account', { email, reason, unlockedBy }, error);
      return false;
    }
  }

  /**
   * Manually lock an account (admin function)
   */
  async lockAccount(email: string, reason: string, lockedBy: string, duration?: number): Promise<boolean> {
    try {
      const lockUntil = duration 
        ? new Date(Date.now() + duration)
        : null; // Permanent lock if no duration specified

      const result = await this.prisma.user.updateMany({
        where: { email },
        data: {
          isManuallyLocked: true,
          lockedUntil: lockUntil,
          lockoutReason: `Manually locked by ${lockedBy}: ${reason}`,
        }
      });

      if (result.count > 0) {
        logger.warn('Account manually locked', {
          email,
          reason,
          lockedBy,
          lockedUntil: lockUntil,
          component: 'account-lockout'
        });
        return true;
      } else {
        logger.warn('Attempted to lock non-existent account', {
          email,
          reason,
          lockedBy,
          component: 'account-lockout'
        });
        return false;
      }
    } catch (error) {
      logger.error('Error locking account', { email, reason, lockedBy }, error);
      return false;
    }
  }

  /**
   * Get lockout statistics for monitoring
   */
  async getLockoutStats(): Promise<{
    totalLocked: number;
    autoLocked: number;
    manuallyLocked: number;
    expiredLocks: number;
  }> {
    try {
      const now = new Date();
      
      const [totalLocked, manuallyLocked, autoLocked] = await Promise.all([
        this.prisma.user.count({
          where: {
            OR: [
              { isManuallyLocked: true },
              { lockedUntil: { gt: now } }
            ]
          }
        }),
        this.prisma.user.count({
          where: { isManuallyLocked: true }
        }),
        this.prisma.user.count({
          where: {
            lockedUntil: { gt: now },
            isManuallyLocked: false
          }
        })
      ]);

      const expiredLocks = await this.prisma.user.count({
        where: {
          lockedUntil: { lt: now },
          isManuallyLocked: false
        }
      });

      return {
        totalLocked,
        autoLocked,
        manuallyLocked,
        expiredLocks
      };
    } catch (error) {
      logger.error('Error getting lockout statistics', {}, error);
      return {
        totalLocked: 0,
        autoLocked: 0,
        manuallyLocked: 0,
        expiredLocks: 0
      };
    }
  }

  /**
   * Clean up expired automatic locks
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.prisma.user.updateMany({
        where: {
          lockedUntil: { lt: now },
          isManuallyLocked: false
        },
        data: {
          failedLoginAttempts: 0,
          lastFailedAttempt: null,
          lockedUntil: null,
          lockoutReason: null,
        }
      });

      if (result.count > 0) {
        logger.info('Expired automatic locks cleaned up', {
          count: result.count,
          component: 'account-lockout'
        });
      }

      return result.count;
    } catch (error) {
      logger.error('Error cleaning up expired locks', {}, error);
      return 0;
    }
  }
}