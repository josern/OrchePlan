#!/usr/bin/env ts-node

/**
 * Manual Role Hierarchy Security Test Script
 * 
 * This script tests the role hierarchy security system by making actual HTTP requests
 * to a running backend server. It validates that the proper access controls are in place.
 * 
 * Usage: npm run test-security-manual
 */

import axios, { AxiosResponse } from 'axios';
import { createComponentLogger } from '../src/utils/logger';

const logger = createComponentLogger('SecurityTest');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestUser {
  id?: string;
  email: string;
  name: string;
  password: string;
  role: string;
  token?: string;
}

class SecurityTestRunner {
  private testUsers: {
    superuser: TestUser;
    admin: TestUser;
    user: TestUser;
  };

  constructor() {
    this.testUsers = {
      superuser: {
        email: 'test-superuser@security-test.com',
        name: 'Test Superuser',
        password: 'SecurePassword123!',
        role: 'superuser'
      },
      admin: {
        email: 'test-admin@security-test.com',
        name: 'Test Admin',
        password: 'SecurePassword123!',
        role: 'admin'
      },
      user: {
        email: 'test-user@security-test.com',
        name: 'Test User',
        password: 'SecurePassword123!',
        role: 'user'
      }
    };
  }

  async runAllTests(): Promise<void> {
    logger.info('🚀 Starting Role Hierarchy Security Tests');
    
    try {
      await this.setupTestUsers();
      await this.authenticateUsers();
      
      await this.testSystemLevelPermissions();
      await this.testRoleHierarchyEnforcement();
      await this.testInputValidation();
      await this.testAuthentication();
      
      logger.info('✅ All security tests completed successfully!');
    } catch (error) {
      logger.error('❌ Security tests failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async setupTestUsers(): Promise<void> {
    logger.info('📝 Setting up test users...');
    
    // Create test users through signup endpoint
    for (const [role, user] of Object.entries(this.testUsers)) {
      try {
        const response = await axios.post(`${BASE_URL}/auth/signup`, {
          name: user.name,
          email: user.email,
          password: user.password
        });
        
        logger.info(`✅ Created ${role} user: ${user.email}`);
        
        // For non-user roles, we'll need to manually update their role
        // This would normally be done by an existing admin
        if (role !== 'user') {
          logger.info(`Note: ${role} role will need to be set manually or by existing admin`);
        }
      } catch (error: any) {
        if (error.response?.status === 409) {
          logger.info(`ℹ️ User ${user.email} already exists`);
        } else {
          logger.error(`❌ Failed to create ${role} user:`, error.response?.data || error.message);
          // Don't throw here - users might already exist
        }
      }
    }
  }

  private async authenticateUsers(): Promise<void> {
    logger.info('🔐 Authenticating test users...');
    
    for (const [role, user] of Object.entries(this.testUsers)) {
      try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
          email: user.email,
          password: user.password
        });
        
        user.token = response.data.token;
        user.id = response.data.user.id;
        logger.info(`✅ ${role} authenticated successfully`);
      } catch (error: any) {
        logger.error(`❌ Failed to authenticate ${role}:`, error.response?.data || error.message);
        throw new Error(`Authentication failed for ${role}`);
      }
    }
  }

  private async testSystemLevelPermissions(): Promise<void> {
    logger.info('🏛️ Testing system-level permissions...');
    
    // Test 1: Superuser can access admin endpoints
    await this.expectSuccess(
      () => this.makeRequest('GET', '/admin/users', this.testUsers.superuser.token!),
      'Superuser should access admin endpoints'
    );

    // Test 2: Admin can access admin endpoints
    await this.expectSuccess(
      () => this.makeRequest('GET', '/admin/users', this.testUsers.admin.token!),
      'Admin should access admin endpoints'
    );

    // Test 3: Regular user cannot access admin endpoints
    await this.expectFailure(
      () => this.makeRequest('GET', '/admin/users', this.testUsers.user.token!),
      403,
      'Regular user should NOT access admin endpoints'
    );
  }

  private async testRoleHierarchyEnforcement(): Promise<void> {
    logger.info('👑 Testing role hierarchy enforcement...');
    
    // Test 1: Admin cannot modify superuser
    await this.expectFailure(
      () => this.makeRequest('PUT', `/admin/users/${this.testUsers.superuser.id}/role`, this.testUsers.admin.token!, {
        role: 'user',
        reason: 'Testing hierarchy enforcement'
      }),
      403,
      'Admin should NOT modify superuser accounts'
    );

    // Test 2: Admin cannot promote to superuser
    await this.expectFailure(
      () => this.makeRequest('PUT', `/admin/users/${this.testUsers.user.id}/role`, this.testUsers.admin.token!, {
        role: 'superuser',
        reason: 'Testing promotion restrictions'
      }),
      403,
      'Admin should NOT promote users to superuser'
    );

    // Test 3: Users cannot change own role
    await this.expectFailure(
      () => this.makeRequest('PUT', `/admin/users/${this.testUsers.user.id}/role`, this.testUsers.user.token!, {
        role: 'admin',
        reason: 'Self-promotion attempt'
      }),
      403,
      'User should NOT access admin endpoints'
    );

    // Test 4: Superuser can modify admin
    await this.expectSuccess(
      () => this.makeRequest('PUT', `/admin/users/${this.testUsers.admin.id}/role`, this.testUsers.superuser.token!, {
        role: 'user',
        reason: 'Testing superuser privileges'
      }),
      'Superuser should modify admin accounts'
    );

    // Restore admin role
    await this.makeRequest('PUT', `/admin/users/${this.testUsers.admin.id}/role`, this.testUsers.superuser.token!, {
      role: 'admin',
      reason: 'Restoring admin role'
    });
  }

  private async testInputValidation(): Promise<void> {
    logger.info('🔍 Testing input validation...');
    
    // Test 1: Invalid role values
    await this.expectFailure(
      () => this.makeRequest('PUT', `/admin/users/${this.testUsers.user.id}/role`, this.testUsers.superuser.token!, {
        role: 'invalid_role',
        reason: 'Testing validation'
      }),
      400,
      'Invalid role values should be rejected'
    );

    // Test 2: Missing required fields
    await this.expectFailure(
      () => this.makeRequest('PUT', `/admin/users/${this.testUsers.user.id}/role`, this.testUsers.superuser.token!, {
        role: 'admin'
        // missing reason field
      }),
      400,
      'Missing required fields should be rejected'
    );

    // Test 3: Invalid user IDs
    await this.expectFailure(
      () => this.makeRequest('PUT', '/admin/users/invalid-uuid/role', this.testUsers.superuser.token!, {
        role: 'admin',
        reason: 'Testing validation'
      }),
      400,
      'Invalid user IDs should be rejected'
    );
  }

  private async testAuthentication(): Promise<void> {
    logger.info('🔒 Testing authentication security...');
    
    // Test 1: Invalid tokens
    await this.expectFailure(
      () => this.makeRequest('GET', '/admin/users', 'invalid-token'),
      401,
      'Invalid tokens should be rejected'
    );

    // Test 2: Missing tokens
    await this.expectFailure(
      () => this.makeRequest('GET', '/admin/users'),
      401,
      'Missing tokens should be rejected'
    );

    // Test 3: Malformed authorization headers
    await this.expectFailure(
      () => axios.get(`${BASE_URL}/admin/users`, {
        headers: { Authorization: 'InvalidFormat token' }
      }),
      401,
      'Malformed auth headers should be rejected'
    );
  }

  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    token?: string,
    data?: any
  ): Promise<AxiosResponse> {
    const config: any = {
      method: method.toLowerCase(),
      url: `${BASE_URL}${endpoint}`,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    };

    if (data) {
      config.data = data;
    }

    return axios(config);
  }

  private async expectSuccess(
    testFn: () => Promise<AxiosResponse>,
    testName: string
  ): Promise<void> {
    try {
      const response = await testFn();
      if (response.status >= 200 && response.status < 300) {
        logger.info(`✅ ${testName} - PASSED`);
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error: any) {
      logger.error(`❌ ${testName} - FAILED:`, error.response?.data || error.message);
      throw error;
    }
  }

  private async expectFailure(
    testFn: () => Promise<AxiosResponse>,
    expectedStatus: number,
    testName: string
  ): Promise<void> {
    try {
      const response = await testFn();
      logger.error(`❌ ${testName} - FAILED: Expected failure but got success (${response.status})`);
      throw new Error(`Expected failure but got success`);
    } catch (error: any) {
      if (error.response?.status === expectedStatus) {
        logger.info(`✅ ${testName} - PASSED (correctly rejected with ${expectedStatus})`);
      } else {
        logger.error(`❌ ${testName} - FAILED: Expected ${expectedStatus} but got ${error.response?.status || 'unknown'}`);
        throw error;
      }
    }
  }

  private async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up test data...');
    // In a real implementation, you would clean up test users and data here
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const testRunner = new SecurityTestRunner();
  testRunner.runAllTests().catch((error) => {
    console.error('Security tests failed:', error);
    process.exit(1);
  });
}

export { SecurityTestRunner };