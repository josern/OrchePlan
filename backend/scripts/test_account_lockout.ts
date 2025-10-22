import { PrismaClient } from '@prisma/client';
import { AccountLockoutService } from '../src/services/accountLockout';
import { createComponentLogger } from '../src/utils/logger';
import { createUser, findUserByEmail } from '../src/services/sqlClient';

const prisma = new PrismaClient();
const logger = createComponentLogger('LockoutTest');

async function testAccountLockout() {
  try {
    console.log('🧪 Starting Account Lockout System Test...\n');
    
    const lockoutService = new AccountLockoutService(prisma);
    const testEmail = 'lockout-test@example.com';
    
    // Cleanup any existing test user
    try {
      await prisma.user.delete({ where: { email: testEmail } });
      console.log('🧹 Cleaned up existing test user');
    } catch (error) {
      // User doesn't exist, that's fine
    }
    
    // Create test user
    console.log('👤 Creating test user...');
    await createUser(testEmail, 'testpassword123', 'Test User');
    
    // Test 1: Check initial lockout status
    console.log('\n📋 Test 1: Initial lockout status');
    let status = await lockoutService.isAccountLocked(testEmail);
    console.log(`Initial status: ${JSON.stringify(status, null, 2)}`);
    
    // Test 2: Record failed attempts
    console.log('\n📋 Test 2: Recording failed login attempts');
    for (let i = 1; i <= 6; i++) {
      console.log(`Attempt ${i}:`);
      const result = await lockoutService.recordFailedAttempt(
        testEmail, 
        '127.0.0.1', 
        'Test User Agent'
      );
      console.log(`  Failed attempts: ${result.failedAttempts}, Locked: ${result.isLocked}`);
      
      if (result.isLocked) {
        console.log(`  🔒 Account locked until: ${result.lockedUntil}`);
        console.log(`  Reason: ${result.lockoutReason}`);
        break;
      }
    }
    
    // Test 3: Verify account is locked
    console.log('\n📋 Test 3: Verify account lockout');
    status = await lockoutService.isAccountLocked(testEmail);
    console.log(`Lockout status: ${JSON.stringify(status, null, 2)}`);
    
    // Test 4: Try to unlock account
    // console.log('\n📋 Test 4: Manual account unlock');
    // const unlocked = await lockoutService.unlockAccount(
      // testEmail, 
      // 'Administrative unlock for testing', 
      // 'admin@example.com'
    // );
    // console.log(`Unlock successful: ${unlocked}`);
    
    // Test 5: Verify account is unlocked
    // console.log('\n📋 Test 5: Verify account unlock');
    // status = await lockoutService.isAccountLocked(testEmail);
    // console.log(`Post-unlock status: ${JSON.stringify(status, null, 2)}`);
    
    // Test 6: Test manual lock
    // console.log('\n📋 Test 6: Manual account lock');
    // const locked = await lockoutService.lockAccount(
      // testEmail,
      // 'Manual lock for testing',
      // 'admin@example.com',
      // 5 * 60 * 1000 // 5 minutes
    // );
    // console.log(`Manual lock successful: ${locked}`);

    status = await lockoutService.isAccountLocked(testEmail);
    console.log(`Manual lock status: ${JSON.stringify(status, null, 2)}`);
    
    // Test 7: Get lockout statistics
    console.log('\n📋 Test 7: Lockout statistics');
    const stats = await lockoutService.getLockoutStats();
    console.log(`Statistics: ${JSON.stringify(stats, null, 2)}`);
    
    // Test 8: Successful login clears attempts
    // console.log('\n📋 Test 8: Successful login clearing');
    // await lockoutService.unlockAccount(testEmail, 'Unlock for successful login test', 'admin@example.com');
    // await lockoutService.recordFailedAttempt(testEmail, '127.0.0.1', 'Test');
    // await lockoutService.recordFailedAttempt(testEmail, '127.0.0.1', 'Test');
    
    // console.log('Failed attempts recorded, now testing successful login...');
    // await lockoutService.recordSuccessfulLogin(testEmail);
    
    // const user = await findUserByEmail(testEmail);
    // console.log(`Failed attempts after successful login: ${user?.failedLoginAttempts || 0}`);
    
    // Test 9: Cleanup expired locks
    // console.log('\n📋 Test 9: Cleanup expired locks');
    // const cleanedCount = await lockoutService.cleanupExpiredLocks();
    // console.log(`Cleaned up ${cleanedCount} expired locks`);
    
    // console.log('\n✅ All tests completed successfully!');
    
    // Cleanup test user
    // await prisma.user.delete({ where: { email: testEmail } });
    // console.log('🧹 Test user cleaned up');
    
  } catch (error) {
    logger.error('Account lockout test failed', {}, error);
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAccountLockout();