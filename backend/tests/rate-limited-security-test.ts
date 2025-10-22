#!/usr/bin/env ts-node

/**
 * Rate-Limited Security Test
 * 
 * This test works around rate limiting by using delays and token reuse.
 * It validates the core role hierarchy security without hitting rate limits.
 */

import axios from 'axios';
import { createComponentLogger } from '../src/utils/logger';

const logger = createComponentLogger('RateLimitedSecurityTest');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestResult {
  test: string;
  expected: 'success' | 'forbidden' | 'unauthorized';
  actual: 'success' | 'forbidden' | 'unauthorized' | 'error';
  passed: boolean;
  details?: string;
}

class RateLimitedSecurityTestRunner {
  private results: TestResult[] = [];
  private testUser = {
    email: 'rate-limit-test@security.com',
    password: 'RateLimitTestPassword123!',
    name: 'Rate Limited Test User',
    token: '',
    id: ''
  };

  async runTests(): Promise<void> {
    logger.info('🔐 Starting Rate-Limited Role Hierarchy Security Tests');
    
    try {
      await this.createAndAuthenticateUser();
      await this.testCoreSecurityControls();
      
      this.printResults();
      
      if (this.results.some(r => !r.passed)) {
        throw new Error('Some security tests failed');
      }
      
      logger.info('✅ All security tests passed!');
    } catch (error) {
      logger.error('❌ Security tests failed:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async createAndAuthenticateUser(): Promise<void> {
    logger.info('📝 Creating and authenticating test user...');
    
    try {
      // Try to create user (might already exist)
      await axios.post(`${BASE_URL}/auth/signup`, {
        name: this.testUser.name,
        email: this.testUser.email,
        password: this.testUser.password
      });
      logger.info('✅ Test user created successfully');
    } catch (error: any) {
      if (error.response?.status === 409) {
        logger.info('ℹ️ Test user already exists');
      } else if (error.response?.status === 429) {
        logger.warn('⚠️ Rate limited during signup, user might already exist');
      } else {
        logger.error('❌ Failed to create test user:', error.response?.data || error.message);
        throw error;
      }
    }

    // Add delay to avoid rate limiting
    logger.info('⏱️ Waiting to avoid rate limiting...');
    await this.delay(2000);

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
      if (error.response?.status === 429) {
        logger.error('❌ Rate limited during authentication. Please wait 15 minutes or restart the server to reset rate limits.');
        throw new Error('Rate limited - please wait or restart server');
      }
      logger.error('❌ Failed to authenticate test user:', error.response?.data || error.message);
      throw error;
    }
  }

  private async testCoreSecurityControls(): Promise<void> {
    logger.info('🛡️ Testing core security controls...');

    // Test 1: User can access their own profile
    await this.testEndpoint(
      'User access to own profile',
      'GET',
      '/auth/me',
      this.testUser.token,
      'success'
    );

    // Add delay between tests
    await this.delay(1000);

    // Test 2: Regular user cannot access admin endpoints
    await this.testEndpoint(
      'Regular user access to admin users endpoint',
      'GET',
      '/admin/users',
      this.testUser.token,
      'forbidden'
    );

    // Add delay between tests
    await this.delay(1000);

    // Test 3: Invalid token is rejected
    await this.testEndpoint(
      'Invalid token access',
      'GET',
      '/admin/users',
      'invalid-token-12345',
      'unauthorized'
    );

    // Add delay between tests
    await this.delay(1000);

    // Test 4: No token is rejected
    await this.testEndpoint(
      'No token access',
      'GET',
      '/admin/users',
      '',
      'unauthorized'
    );

    // Add delay between tests
    await this.delay(1000);

    // Test 5: User cannot modify roles (if endpoint exists)
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
    logger.info(`🔍 Testing: ${testName}`);
    
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
        logger.info(`   Details: Status ${response.status}, Response:`, response.data);
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

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private printResults(): void {
    logger.info('📊 Test Results Summary:');
    logger.info('=====================================');
    
    let passed = 0;
    let total = this.results.length;
    
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      logger.info(`${index + 1}. ${status}: ${result.test}`);
      if (!result.passed && result.details) {
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
}

// Run the tests
const testRunner = new RateLimitedSecurityTestRunner();
testRunner.runTests().catch((error) => {
  console.error('Security tests failed:', error.message);
  process.exit(1);
});