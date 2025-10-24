import { PrismaClient } from '@prisma/client';
import { createComponentLogger } from '../src/utils/logger';

const prisma = new PrismaClient();
const logger = createComponentLogger('CheckUsers');

async function checkUserRoles() {
  try {
  logger.info('Checking user roles in database...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        failedLoginAttempts: true,
        isManuallyLocked: true,
        lockedUntil: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (users.length === 0) {
      logger.warn('No users found in database');
      return;
    }

    logger.info(`Found ${users.length} user(s):`);
    logger.info('='.repeat(80));
    
    users.forEach((user, index) => {
  logger.info(`${index + 1}. ${user.email}`);
  logger.info(`   Name: ${user.name || 'No name'}`);
  logger.info(`   Role: ${user.role || 'user'} ${user.role === 'superuser' ? '🔑' : user.role === 'admin' ? '👑' : '👤'}`);
  logger.info(`   ID: ${user.id}`);
  logger.info(`   Created: ${user.createdAt.toISOString()}`);
  logger.info(`   Failed Attempts: ${user.failedLoginAttempts}`);
  logger.info(`   Locked: ${user.isManuallyLocked ? 'Yes (Manual)' : user.lockedUntil && user.lockedUntil > new Date() ? 'Yes (Auto)' : 'No'}`);
  logger.info('');
    });
    
    const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'superuser');
    logger.info(`Admin/Superuser accounts: ${adminUsers.length}`);

    if (adminUsers.length === 0) {
      logger.warn('WARNING: No admin or superuser accounts found!');
      logger.info('Run: npm run create-superuser');
    } else {
      logger.info('Admin access available');
    }
    
  } catch (error) {
  logger.error('Error checking user roles', {}, error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkUserRoles();