import { Router, Response, NextFunction } from 'express';
import { authMiddleware, AuthedRequest, requireAdmin } from '../middleware/auth';
import { AccountLockoutService } from '../services/accountLockout';
import { findUserByEmail, findUserById, deleteProject } from '../services/sqlClient';
import { createSecureValidation } from '../middleware/validation';
import { createComponentLogger } from '../utils/logger';
import prisma from '../services/sqlClient';

const router = Router();
const logger = createComponentLogger('AdminController');
const lockoutService = new AccountLockoutService(prisma);

// Middleware to check if user is admin (for now, we'll check if they're the first user)
// In production, you'd want a proper role-based system
const requireAdminOld = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, consider the first user as admin
    // In production, implement proper role-based access control
    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Simple admin check - in production, use proper roles
    const allUsers = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    const isFirstUser = allUsers.length > 0 && allUsers[0].id === userId;
    
    if (!isFirstUser) {
      logger.warn('Non-admin user attempted admin action', {
        userId,
        action: 'admin_access_attempt',
        component: 'admin'
      });
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error('Error checking admin permissions', { userId: req.userId }, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Validation middleware (updated to secure validation)
const handleValidationErrors = (req: AuthedRequest, res: Response, next: NextFunction) => {
  // Replaced express-validator with secure validation for security
  // TODO: Implement proper validation with createSecureValidation
  next();
};

// Apply authentication and admin role check to all admin routes
router.use(authMiddleware);
router.use(requireAdmin);

// GET /admin/lockouts - Get lockout statistics
router.get('/lockouts', async (req: AuthedRequest, res: Response) => {
  try {
    
    // Temporary hardcoded response to test routing
    const stats = {
      totalLocked: 0,
      autoLocked: 0,
      manuallyLocked: 0,
      expiredLocks: 0
    };
    
    
    logger.info('Admin retrieved lockout statistics', {
      adminId: req.userId,
      stats,
      component: 'admin'
    });
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error in admin lockouts endpoint:', error);
    logger.error('Error retrieving lockout statistics', { adminId: req.userId }, error);
    res.status(500).json({ error: 'Failed to retrieve lockout statistics' });
  }
});

// GET /admin/lockouts/locked-accounts - List all currently locked accounts (MUST come before :email route)
router.get('/lockouts/locked-accounts',
  async (req: AuthedRequest, res: Response) => {
    try {
      
      // Temporary hardcoded response to test routing
      const lockedAccounts: any[] = [];
      
      
      logger.info('Admin retrieved locked accounts', {
        adminId: req.userId,
        count: lockedAccounts.length,
        component: 'admin'
      });
      
      res.json({
        success: true,
        lockedAccounts
      });
    } catch (error) {
      console.error('Error in admin locked-accounts endpoint:', error);
      logger.error('Error retrieving locked accounts', { adminId: req.userId }, error);
      res.status(500).json({ error: 'Failed to retrieve locked accounts' });
    }
  }
);

// POST /admin/lockouts/cleanup - Clean up expired locks (MUST come before :email route)
router.post('/lockouts/cleanup',
  async (req: AuthedRequest, res: Response) => {
    try {
      const cleanedCount = await lockoutService.cleanupExpiredLocks();
      
      logger.info('Admin cleaned up expired locks', {
        adminId: req.userId,
        cleanedCount,
        component: 'admin'
      });
      
      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired locks`,
        cleanedCount
      });
    } catch (error) {
      logger.error('Error cleaning up expired locks', { adminId: req.userId }, error);
      res.status(500).json({ error: 'Failed to cleanup expired locks' });
    }
  }
);

// GET /admin/lockouts/:email - Check specific account lockout status
router.get('/lockouts/:email', 
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { email } = req.params;
      const status = await lockoutService.isAccountLocked(email);
      
      logger.info('Admin checked account lockout status', {
        adminId: req.userId,
        targetEmail: email,
        status,
        component: 'admin'
      });
      
      res.json({
        success: true,
        email,
        lockoutStatus: status
      });
    } catch (error) {
      logger.error('Error checking account lockout status', { 
        adminId: req.userId,
        email: req.params.email 
      }, error);
      res.status(500).json({ error: 'Failed to check account status' });
    }
  }
);

// POST /admin/lockouts/:email/unlock - Unlock an account
router.post('/lockouts/:email/unlock',
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { email } = req.params;
      const { reason } = req.body;
      const adminId = req.userId!;
      
      // Get admin user info for logging
      const admin = await findUserById(adminId);
      const adminEmail = admin?.email || adminId;
      
      const success = await lockoutService.unlockAccount(email, reason, adminEmail);
      
      if (success) {
        logger.warn('Admin unlocked account', {
          adminId,
          adminEmail,
          targetEmail: email,
          reason,
          component: 'admin'
        });
        
        res.json({
          success: true,
          message: `Account ${email} has been unlocked`,
          reason
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Account not found or already unlocked'
        });
      }
    } catch (error) {
      logger.error('Error unlocking account', { 
        adminId: req.userId,
        email: req.params.email,
        reason: req.body.reason
      }, error);
      res.status(500).json({ error: 'Failed to unlock account' });
    }
  }
);

// POST /admin/lockouts/:email/lock - Manually lock an account
router.post('/lockouts/:email/lock',
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { email } = req.params;
      const { reason, duration } = req.body;
      const adminId = req.userId!;
      
      // Get admin user info for logging
      const admin = await findUserById(adminId);
      const adminEmail = admin?.email || adminId;
      
      // Get target user to check their role
      const targetUser = await findUserByEmail(email);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }
      
      // Prevent admins from locking superuser accounts
      if (admin?.role === 'admin' && targetUser.role === 'superuser') {
        logger.warn('Admin attempted to lock superuser account', {
          adminId,
          adminEmail,
          targetEmail: email,
          targetRole: targetUser.role,
          component: 'admin'
        });
        return res.status(403).json({
          error: 'Admins cannot modify superuser accounts'
        });
      }
      
      // Convert duration from minutes to milliseconds if provided
      const durationMs = duration ? duration * 60 * 1000 : undefined;
      
      const success = await lockoutService.lockAccount(email, reason, adminEmail, durationMs);
      
      if (success) {
        logger.warn('Admin locked account', {
          adminId,
          adminEmail,
          targetEmail: email,
          reason,
          duration: durationMs,
          component: 'admin'
        });
        
        res.json({
          success: true,
          message: `Account ${email} has been locked`,
          reason,
          duration: duration ? `${duration} minutes` : 'indefinite'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }
    } catch (error) {
      logger.error('Error locking account', { 
        adminId: req.userId,
        email: req.params.email,
        reason: req.body.reason
      }, error);
      res.status(500).json({ error: 'Failed to lock account' });
    }
  }
);

// User Management Endpoints

// GET /admin/stats - Return system-wide statistics: total users, projects, tasks and per-user counts
router.get('/stats', async (req: AuthedRequest, res: Response) => {
  try {
    // total counts
    const [totalUsers, totalProjects, totalTasks] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.task.count()
    ]);

    // per-user counts: tasks and projects owned/created
    const usersResult = await prisma.user.findMany({
      select: { id: true, name: true, email: true }
    });
    const users: { id: string; name: string | null; email: string }[] = usersResult;

  // fetch counts grouped by user (use _all to be compatible across prisma versions)
  const taskCounts = await prisma.task.groupBy({ by: ['assigneeId'], _count: { _all: true } }) as Array<{ assigneeId: string | null; _count: { _all: number } }>;
  const projectCounts = await prisma.project.groupBy({ by: ['ownerId'], _count: { _all: true } }) as Array<{ ownerId: string | null; _count: { _all: number } }>;

    const taskMap: Record<string, number> = {};
  taskCounts.forEach((tc) => { if (tc.assigneeId) taskMap[tc.assigneeId] = tc._count._all; });
    const projectMap: Record<string, number> = {};
    projectCounts.forEach((pc) => { if (pc.ownerId) projectMap[pc.ownerId] = pc._count._all; });

    // Dev-only debug info to help diagnose missing counts
    if (process.env.NODE_ENV !== 'production') {
      try {
        logger.info('admin.stats debug', { taskCountsSample: taskCounts.slice(0,10), projectCountsSample: projectCounts.slice(0,10) });
      } catch (e) {
        // ignore logging errors
      }
    }

    const perUser = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      taskCount: taskMap[u.id] || 0,
      projectCount: projectMap[u.id] || 0
    }));

    const resp: any = {
      success: true,
      // keep nested totals for backward compatibility
      totals: { users: totalUsers, projects: totalProjects, tasks: totalTasks },
      // also include flat totals which the frontend expects
      totalUsers,
      totalProjects,
      totalTasks,
      perUser
    };

    // In non-production include raw aggregation data to aid debugging
    if (process.env.NODE_ENV !== 'production') {
      resp.debug = {
        taskCountsRaw: taskCounts,
        projectCountsRaw: projectCounts,
        taskMap,
        projectMap
      };
    }

    res.json(resp);
  } catch (error) {
    logger.error('Error fetching admin stats', { adminId: req.userId }, error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});


// GET /admin/users - List all users with filtering and pagination
router.get('/users',
  async (req: AuthedRequest, res: Response) => {
    try {
      const { 
        page = '1', 
        limit = '50', 
        search, 
        role, 
        status 
      } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      
      const where: any = {};
      
      // Search filter
      if (search) {
        where.OR = [
          { email: { contains: search as string, mode: 'insensitive' } },
          { name: { contains: search as string, mode: 'insensitive' } }
        ];
      }
      
      // Role filter
      if (role) {
        where.role = role;
      }
      
      // Status filter (active/disabled/locked)
      if (status === 'disabled') {
        where.isDisabled = true;
      } else if (status === 'locked') {
        const now = new Date();
        where.OR = [
          { isManuallyLocked: true },
          { lockedUntil: { gt: now } }
        ];
      } else if (status === 'active') {
        const now = new Date();
        where.AND = [
          { OR: [{ isDisabled: false }, { isDisabled: null }] },
          { isManuallyLocked: false },
          { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }
        ];
      }
      
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isDisabled: true,
            isManuallyLocked: true,
            lockedUntil: true,
            lockoutReason: true,
            failedLoginAttempts: true,
            lastFailedAttempt: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limitNum
        }),
        prisma.user.count({ where })
      ]);
      
      logger.info('Admin retrieved users list', {
        adminId: req.userId,
        userCount: users.length,
        totalCount,
        filters: { search, role, status },
        component: 'admin'
      });
      
      res.json({
        success: true,
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount
        }
      });
    } catch (error) {
      logger.error('Error retrieving users list', { adminId: req.userId }, error);
      res.status(500).json({ error: 'Failed to retrieve users' });
    }
  }
);

// PUT /admin/users/:id/disable - Disable a user account
router.put('/users/:id/disable',
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.userId!;
      
      // Don't allow disabling self
      if (id === adminId) {
        return res.status(400).json({ error: 'Cannot disable your own account' });
      }
      
      // Get current admin user and target user
      const adminUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true, email: true }
      });
      
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true, email: true }
      });
      
      if (!adminUser || !targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Admins cannot disable superuser accounts
      if (adminUser.role === 'admin' && targetUser.role === 'superuser') {
        return res.status(403).json({ 
          error: 'Admins cannot disable superuser accounts. Only superusers can manage other superusers.' 
        });
      }
      
      const user = await prisma.user.update({
        where: { id },
        data: { 
          isDisabled: true,
          updatedAt: new Date()
        },
        select: { id: true, email: true, name: true }
      });
      
      logger.warn('Admin disabled user account', {
        adminId,
        targetUserId: id,
        targetEmail: user.email,
        reason,
        component: 'admin'
      });
      
      res.json({
        success: true,
        message: `User ${user.email} has been disabled`,
        user
      });
    } catch (error) {
      logger.error('Error disabling user', { 
        adminId: req.userId,
        userId: req.params.id 
      }, error);
      res.status(500).json({ error: 'Failed to disable user' });
    }
  }
);

// PUT /admin/users/:id/enable - Enable a user account
router.put('/users/:id/enable',
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.userId!;
      
      // Get current admin user and target user
      const adminUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true, email: true }
      });
      
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true, email: true }
      });
      
      if (!adminUser || !targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Admins cannot enable superuser accounts (though they shouldn't be able to disable them either)
      if (adminUser.role === 'admin' && targetUser.role === 'superuser') {
        return res.status(403).json({ 
          error: 'Admins cannot enable superuser accounts. Only superusers can manage other superusers.' 
        });
      }
      
      const user = await prisma.user.update({
        where: { id },
        data: { 
          isDisabled: false,
          updatedAt: new Date()
        },
        select: { id: true, email: true, name: true }
      });
      
      logger.info('Admin enabled user account', {
        adminId: req.userId,
        targetUserId: id,
        targetEmail: user.email,
        reason,
        component: 'admin'
      });
      
      res.json({
        success: true,
        message: `User ${user.email} has been enabled`,
        user
      });
    } catch (error) {
      logger.error('Error enabling user', { 
        adminId: req.userId,
        userId: req.params.id 
      }, error);
      res.status(500).json({ error: 'Failed to enable user' });
    }
  }
);

// PUT /admin/users/:id/role - Update user role
router.put('/users/:id/role',
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { role, reason } = req.body;
      const adminId = req.userId!;
      
      // Don't allow changing own role
      if (id === adminId) {
        return res.status(400).json({ error: 'Cannot change your own role' });
      }
      
      // Get current admin user and target user
      const adminUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true, email: true }
      });
      
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true, email: true }
      });
      
      if (!adminUser || !targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Role hierarchy checks
      if (adminUser.role === 'admin') {
        // Admins cannot modify superuser accounts
        if (targetUser.role === 'superuser') {
          return res.status(403).json({ 
            error: 'Admins cannot modify superuser accounts. Only superusers can manage other superusers.' 
          });
        }
        
        // Admins cannot promote users to superuser
        if (role === 'superuser') {
          return res.status(403).json({ 
            error: 'Admins cannot promote users to superuser role. Only superusers can create other superusers.' 
          });
        }
      }
      
      const user = await prisma.user.update({
        where: { id },
        data: { 
          role,
          updatedAt: new Date()
        },
        select: { id: true, email: true, name: true, role: true }
      });
      
      logger.warn('Admin changed user role', {
        adminId,
        adminRole: adminUser.role,
        adminEmail: adminUser.email,
        targetUserId: id,
        targetEmail: user.email,
        previousRole: targetUser.role,
        newRole: role,
        reason,
        component: 'admin'
      });
      
      res.json({
        success: true,
        message: `User ${user.email} role changed to ${role}`,
        user
      });
    } catch (error) {
      logger.error('Error updating user role', { 
        adminId: req.userId,
        userId: req.params.id,
        role: req.body.role
      }, error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

// DELETE /admin/users/:id - Delete a user account (with confirmation)
router.delete('/users/:id',
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason, confirmEmail } = req.body;
      const adminId = req.userId!;
      
      // Don't allow deleting self
      if (id === adminId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }
      
      // Get user details first
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, role: true }
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify confirmation email matches
      if (user.email !== confirmEmail) {
        return res.status(400).json({ error: 'Confirmation email does not match user email' });
      }
      
      // Don't allow deleting superusers unless requester is also superuser
      const admin = await findUserById(adminId);
      if (user.role === 'superuser' && admin?.role !== 'superuser') {
        return res.status(403).json({ error: 'Only superusers can delete other superuser accounts' });
      }
        // Handle projects owned by the user. For each project:
        // - if there are no other members with role 'owner', delete the project automatically
        // - if there are other owners, collect them as blocking projects and return an error
        const ownedProjects = await prisma.project.findMany({ where: { ownerId: id }, select: { id: true, name: true } });
        const blocking: Array<{ id: string; name: string; otherOwners: any[] }> = [];

        for (const proj of ownedProjects) {
          // find project members with role 'owner' excluding the target user
          const otherOwners = await prisma.projectMember.findMany({ where: { projectId: proj.id, role: 'owner', userId: { not: id } }, select: { userId: true } });
          if (otherOwners.length === 0) {
            // no other owners - delete the project (safe transaction in deleteProject)
            try {
              await deleteProject(proj.id);
            } catch (e) {
              logger.error('Failed to delete owned project during user deletion', { projectId: proj.id, adminId, error: e });
              blocking.push({ id: proj.id, name: proj.name, otherOwners: [] });
            }
          } else {
            blocking.push({ id: proj.id, name: proj.name, otherOwners });
          }
        }

        if (blocking.length > 0) {
          return res.status(400).json({
            error: 'User owns projects that require reassignment',
            projects: blocking,
            message: 'Some projects have other owners and need reassignment before deleting the user. Projects with no other owners were deleted automatically.'
          });
        }

        // Safe to delete (all owned projects either deleted or none existed)
        await prisma.user.delete({ where: { id } });
      
      logger.error('Admin deleted user account', {
        adminId,
        targetUserId: id,
        targetEmail: user.email,
        targetRole: user.role,
        reason,
        component: 'admin'
      });
      
      res.json({
        success: true,
        message: `User ${user.email} has been permanently deleted`
      });
    } catch (error) {
      logger.error('Error deleting user', { 
        adminId: req.userId,
        userId: req.params.id 
      }, error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// System Logs Endpoints

// GET /admin/logs - Retrieve system logs with filtering
router.get('/logs',
  async (req: AuthedRequest, res: Response) => {
    try {
      const {
        page = '1',
        limit = '100',
        level,
        component,
        startDate,
        endDate,
        search
      } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 1000); // Max 1000 logs per request
      
      // Read logs from the log directory
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join(process.cwd(), 'logs');
      
      let allLogs: any[] = [];
      
      try {
        // Get list of log files
        const logFiles = fs.readdirSync(logsDir)
          .filter((file: string) => file.endsWith('.log'))
          .sort((a: string, b: string) => b.localeCompare(a)); // Newest first
        
        // Read logs from files (start with most recent)
        for (const file of logFiles.slice(0, 10)) { // Limit to last 10 files
          const filePath = path.join(logsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          const lines = fileContent.split('\n').filter((line: string) => line.trim());
          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line);
              allLogs.push({
                ...logEntry,
                file: file
              });
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
        
        // Sort by timestamp (newest first)
        allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        // Apply filters
        let filteredLogs = allLogs;
        
        if (level) {
          filteredLogs = filteredLogs.filter(log => log.level === level);
        }
        
        if (component) {
          filteredLogs = filteredLogs.filter(log => 
            log.component === component || 
            (log.context && log.context.component === component)
          );
        }
        
        if (startDate) {
          const start = new Date(startDate as string);
          filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
        }
        
        if (endDate) {
          const end = new Date(endDate as string);
          filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
        }
        
        if (search) {
          const searchLower = (search as string).toLowerCase();
          filteredLogs = filteredLogs.filter(log => 
            JSON.stringify(log).toLowerCase().includes(searchLower)
          );
        }
        
        // Paginate
        const totalCount = filteredLogs.length;
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedLogs = filteredLogs.slice(startIndex, startIndex + limitNum);
        
        logger.info('Admin retrieved system logs', {
          adminId: req.userId,
          logCount: paginatedLogs.length,
          totalCount,
          filters: { level, component, startDate, endDate, search },
          component: 'admin'
        });
        
        res.json({
          success: true,
          logs: paginatedLogs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount
          }
        });
        
      } catch (fileError: unknown) {
        logger.warn('No log files found or error reading logs', {
          adminId: req.userId,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
          component: 'admin'
        });
        
        res.json({
          success: true,
          logs: [],
          pagination: {
            page: 1,
            limit: limitNum,
            totalPages: 0,
            totalCount: 0
          },
          message: 'No log files found'
        });
      }
      
    } catch (error) {
      logger.error('Error retrieving system logs', { adminId: req.userId }, error);
      res.status(500).json({ error: 'Failed to retrieve system logs' });
    }
  }
);

// GET /admin/logs/components - Get list of available log components
router.get('/logs/components',
  async (req: AuthedRequest, res: Response) => {
    try {
      // Read recent logs to extract component names
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join(process.cwd(), 'logs');
      
      const components = new Set<string>();
      
      try {
        const logFiles = fs.readdirSync(logsDir)
          .filter((file: string) => file.endsWith('.log'))
          .sort((a: string, b: string) => b.localeCompare(a))
          .slice(0, 3); // Check last 3 files only
        
        for (const file of logFiles) {
          const filePath = path.join(logsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          const lines = fileContent.split('\n').filter((line: string) => line.trim()).slice(-500); // Last 500 lines only
          
          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line);
              if (logEntry.component) {
                components.add(logEntry.component);
              }
              if (logEntry.context && logEntry.context.component) {
                components.add(logEntry.context.component);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } catch (fileError) {
        // No log files found
      }
      
      res.json({
        success: true,
        components: Array.from(components).sort()
      });
      
    } catch (error) {
      logger.error('Error retrieving log components', { adminId: req.userId }, error);
      res.status(500).json({ error: 'Failed to retrieve log components' });
    }
  }
);

// GET /admin/logs/stats - Get log statistics
router.get('/logs/stats',
  async (req: AuthedRequest, res: Response) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join(process.cwd(), 'logs');
      
      const stats = {
        totalLogs: 0,
        logsByLevel: {} as Record<string, number>,
        logsByComponent: {} as Record<string, number>,
        dateRange: { start: null as string | null, end: null as string | null }
      };
      
      try {
        const logFiles = fs.readdirSync(logsDir)
          .filter((file: string) => file.endsWith('.log'))
          .slice(0, 5); // Check last 5 files only for performance
        
        let earliest: Date | null = null;
        let latest: Date | null = null;
        
        for (const file of logFiles) {
          const filePath = path.join(logsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          const lines = fileContent.split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line);
              stats.totalLogs++;
              
              // Count by level
              if (logEntry.level) {
                stats.logsByLevel[logEntry.level] = (stats.logsByLevel[logEntry.level] || 0) + 1;
              }
              
              // Count by component
              const component = logEntry.component || (logEntry.context && logEntry.context.component) || 'unknown';
              stats.logsByComponent[component] = (stats.logsByComponent[component] || 0) + 1;
              
              // Track date range
              if (logEntry.timestamp) {
                const date = new Date(logEntry.timestamp);
                if (!earliest || date < earliest) earliest = date;
                if (!latest || date > latest) latest = date;
              }
              
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
        
        if (earliest) stats.dateRange.start = earliest.toISOString();
        if (latest) stats.dateRange.end = latest.toISOString();
        
      } catch (fileError) {
        // No log files found
      }
      
      res.json({
        success: true,
        stats
      });
      
    } catch (error) {
      logger.error('Error retrieving log stats', { adminId: req.userId }, error);
      res.status(500).json({ error: 'Failed to retrieve log statistics' });
    }
  }
);

// GET /admin/threats/stats - Get threat detection statistics
router.get('/threats/stats', async (req: AuthedRequest, res: Response) => {
  try {
    const { threatDetectionService } = await import('../services/threatDetection');
    const stats = await threatDetectionService.getThreatStats();
    
    logger.info('Admin retrieved threat stats', {
      adminId: req.userId,
      component: 'admin'
    });
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error retrieving threat stats', { adminId: req.userId }, error);
    res.status(500).json({ error: 'Failed to retrieve threat statistics' });
  }
});

// POST /admin/threats/unblock - Unblock an IP address
router.post('/threats/unblock',
  handleValidationErrors,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { ip, reason } = req.body;
      const { threatDetectionService } = await import('../services/threatDetection');
      
      threatDetectionService.unblockIP(ip);
      
      logger.warn('Admin unblocked IP address', {
        adminId: req.userId,
        unblocked_ip: ip,
        reason,
        component: 'admin'
      });
      
      res.json({
        success: true,
        message: `IP ${ip} has been unblocked`
      });
    } catch (error) {
      logger.error('Error unblocking IP', { adminId: req.userId }, error);
      res.status(500).json({ error: 'Failed to unblock IP address' });
    }
  }
);

// GET /admin/threats/blocked - Get list of blocked IPs
router.get('/threats/blocked', async (req: AuthedRequest, res: Response) => {
  try {
    const { threatDetectionService } = await import('../services/threatDetection');
    const stats = await threatDetectionService.getThreatStats();
    
    // In a full implementation, you'd return actual blocked IPs with details
    // For now, return basic stats
    res.json({
      success: true,
      blocked: {
        count: stats.blockedIPs,
        suspicious: stats.suspiciousIPs,
        lastUpdate: stats.lastUpdate
      }
    });
  } catch (error) {
    logger.error('Error retrieving blocked IPs', { adminId: req.userId }, error);
    res.status(500).json({ error: 'Failed to retrieve blocked IPs' });
  }
});

// POST /admin/threats/clear-all - Clear all blocked and suspicious IPs
router.post('/threats/clear-all', async (req: AuthedRequest, res: Response) => {
  try {
    const { threatDetectionService } = await import('../services/threatDetection');
    
    // Clear all blocks
    threatDetectionService.clearAllBlocks();
    
    logger.info('All threat detection blocks cleared', {
      adminId: req.userId,
      timestamp: new Date().toISOString(),
      component: 'admin'
    });
    
    res.json({
      success: true,
      message: 'All blocked and suspicious IPs have been cleared'
    });
  } catch (error) {
    logger.error('Error clearing all blocks', { adminId: req.userId }, error);
    res.status(500).json({ error: 'Failed to clear blocks' });
  }
});

export default router;