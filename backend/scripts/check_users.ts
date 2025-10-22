import { PrismaClient } from '@prisma/client';
import { createComponentLogger } from '../src/utils/logger';

const prisma = new PrismaClient();
const logger = createComponentLogger('CheckUsers');

async function checkUserRoles() {
  try {
    console.log('� Checking user roles in database...\n');
    
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
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`Found ${users.length} user(s):`);
    console.log('='.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.name || 'No name'}`);
      console.log(`   Role: ${user.role || 'user'} ${user.role === 'superuser' ? '🔑' : user.role === 'admin' ? '👑' : '👤'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log(`   Failed Attempts: ${user.failedLoginAttempts}`);
      console.log(`   Locked: ${user.isManuallyLocked ? 'Yes (Manual)' : user.lockedUntil && user.lockedUntil > new Date() ? 'Yes (Auto)' : 'No'}`);
      console.log('');
    });
    
    const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'superuser');
    console.log(`Admin/Superuser accounts: ${adminUsers.length}`);
    
    if (adminUsers.length === 0) {
      console.log('⚠️  WARNING: No admin or superuser accounts found!');
      console.log('   Run: npm run create-superuser');
    } else {
      console.log('✅ Admin access available');
    }
    
  } catch (error) {
    logger.error('Error checking user roles', {}, error);
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkUserRoles();