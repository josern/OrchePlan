import { PrismaClient } from '@prisma/client';
import { createComponentLogger } from '../src/utils/logger';

const prisma = new PrismaClient();
const logger = createComponentLogger('RemoveTestUser');

async function removeTestUser() {
  try {
    console.log('🗑️  Removing test user...\n');
    
    // Remove the test user created during development
    const testEmail = 'admin@example.com';
    
    const user = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    
    if (user) {
      await prisma.user.delete({
        where: { email: testEmail }
      });
      
      console.log(`✅ Test user ${testEmail} has been removed`);
      logger.info('Test user removed', { email: testEmail, removedBy: 'script' });
    } else {
      console.log(`ℹ️  Test user ${testEmail} not found`);
    }
    
  } catch (error) {
    logger.error('Error removing test user', {}, error);
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the removal
removeTestUser();