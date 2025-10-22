#!/usr/bin/env ts-node

/**
 * Simple Role Hierarchy Security Test
 * 
 * This test validates basic security controls using existing users or creates minimal test users.
 * It focuses on the core role hierarchy and authentication security.
 */

import axios from 'axios';
import { createComponentLogger } from '../src/utils/logger';

const logger = createComponentLogger('SimpleSecurityTest');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestResult {
  test: string;
  expected: 'success' | 'forbidden' | 'unauthorized';
  actual: 'success' | 'forbidden' | 'unauthorized' | 'error';
  passed: boolean;
  details?: string;
}

class SimpleSecurityTestRunner {
  private results: TestResult[] = [];
  private testUser = {
    email: 'simple-test@security.com',
    password: 'SecureTestPassword123!',
    name: 'Simple Test User',
    token: '',
    id: ''
  };

  async runTests(): Promise<void> {
    logger.info('🔐 Starting Simple Role Hierarchy Security Tests');
    
    try {
      await this.createTestUser();
      await this.authenticateTestUser();
      await this.testBasicSecurity();
      
      this.printResults();
      
      if (this.results.some(r => !r.passed)) {
        throw new Error('Some security tests failed');
      }
      
      logger.info('✅ All security tests passed!');
    } catch (error) {
      logger.error('❌ Security tests failed:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async createTestUser(): Promise<void> {
    logger.info('📝 Creating test user...');
    
    try {
      await axios.post(`${BASE_URL}/auth/signup`, {
        name: this.testUser.name,
        email: this.testUser.email,
        password: this.testUser.password
      });
      logger.info('✅ Test user created successfully');
    } catch (error: any) {
      if (error.response?.status === 409) {
        logger.info('ℹ️ Test user already exists');
      } else {
        logger.error('❌ Failed to create test user:', error.response?.data || error.message);
        throw error;
      }
    }
  }

  private async authenticateTestUser(): Promise<void> {
    logger.info('🔑 Authenticating test user...');
    
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: this.testUser.email,
        password: this.testUser.password
      });
      
      this.testUser.token = response.data.token;
      this.testUser.id = response.data.user.id;
      logger.info('✅ Test user authenticated successfully', {
        userId: this.testUser.id,
        userRole: response.data.user.role,
        hasToken: !!this.testUser.token
      });
    } catch (error: any) {
      logger.error('❌ Failed to authenticate test user:', error.response?.data || error.message);
      throw error;
    }
  }

  private async testBasicSecurity(): Promise<void> {
    logger.info('🛡️ Testing basic security controls...');

    // Test 1: Regular user cannot access admin endpoints
    await this.testEndpoint(
      'Regular user access to admin users endpoint',
      'GET',
      '/admin/users',
      this.testUser.token,
      'forbidden'  // This should be 403 if auth works, 401 if there's an auth issue
    );

    // Test 2: Invalid token is rejected
    await this.testEndpoint(
      'Invalid token access',
      'GET',
      '/admin/users',
      'invalid-token-12345',
      'unauthorized'
    );

    // Test 3: No token is rejected
    await this.testEndpoint(
      'No token access',
      'GET',
      '/admin/users',
      '',
      'unauthorized'
    );

    // Test 4: User can access their own profile
    await this.testEndpoint(
      'User access to own profile',
      'GET',
      '/auth/me',
      this.testUser.token,
      'success'
    );

    // Test 5: User cannot modify other users' roles (if endpoint exists)
    await this.testEndpoint(
      'User cannot modify roles',
      'PUT',
      `/admin/users/${this.testUser.id}/role`,
      this.testUser.token,
      'forbidden',
      { role: 'admin' }
    );
  }

  private async testEndpoint(
    testName: string,
    method: string,
    endpoint: string,
    token: string,
    expected: 'success' | 'forbidden' | 'unauthorized',
    data?: any
  ): Promise<void> {
    try {
      const config: any = {
        method: method.toLowerCase(),
        url: `${BASE_URL}${endpoint}`,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        validateStatus: () => true // Don't throw on non-2xx status codes
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      }

      const response = await axios(config);
      
      let actual: 'success' | 'forbidden' | 'unauthorized' | 'error';
      
      if (response.status >= 200 && response.status < 300) {
        actual = 'success';
      } else if (response.status === 401) {
        actual = 'unauthorized';
      } else if (response.status === 403) {
        actual = 'forbidden';
      } else {
        actual = 'error';
      }

      const passed = actual === expected;
      
      this.results.push({
        test: testName,
        expected,
        actual,
        passed,
        details: `Status: ${response.status}, Expected: ${expected}, Got: ${actual}`
      });

      const status = passed ? '✅' : '❌';
      logger.info(`${status} ${testName}: ${actual} (expected: ${expected})`);
      
      if (!passed) {
        logger.info(`   Response details: Status ${response.status}, Data:`, response.data);
      }
      
    } catch (error: any) {
      this.results.push({
        test: testName,
        expected,
        actual: 'error',
        passed: false,
        details: error.message
      });
      
      logger.error(`❌ ${testName}: Error - ${error.message}`);
    }
  }

  private printResults(): void {
    logger.info('📊 Test Results Summary:');
    logger.info('=====================================');
    
    let passed = 0;
    let total = this.results.length;
    
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      logger.info(`${index + 1}. ${status}: ${result.test}`);
      if (!result.passed) {
        logger.info(`   Details: ${result.details}`);
      }
      if (result.passed) passed++;
    });
    
    logger.info('=====================================');
    logger.info(`Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      logger.info('🎉 All security tests passed!');
    } else {
      logger.error(`⚠️ ${total - passed} security tests failed`);
    }
  }

  private async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up...');
    // In a real test environment, you might want to delete test users
    // For now, we'll leave them as they're harmless
  }
}

// Run the tests
const testRunner = new SimpleSecurityTestRunner();
testRunner.runTests().catch((error) => {
  console.error('Security tests failed:', error.message);
  process.exit(1);
});