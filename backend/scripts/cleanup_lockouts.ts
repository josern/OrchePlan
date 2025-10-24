import { PrismaClient } from '@prisma/client';
import { AccountLockoutService } from '../src/services/accountLockout';
import { createComponentLogger } from '../src/utils/logger';

const prisma = new PrismaClient();
const logger = createComponentLogger('LockoutCleanup');

async function cleanupExpiredLocks() {
  try {
    logger.info('Starting scheduled lockout cleanup...');
    
    const lockoutService = new AccountLockoutService(prisma);
    const cleanedCount = await lockoutService.cleanupExpiredLocks();
    
  logger.info('Lockout cleanup completed', { cleanedCount });
    
    process.exit(0);
  } catch (error) {
    logger.error('Lockout cleanup failed', {}, error);
    console.error('Lockout cleanup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupExpiredLocks();