#!/usr/bin/env ts-node

/**
 * Debug Role Hierarchy Security Test
 * 
 * This test includes detailed logging to debug authentication and authorization issues.
 */

import axios from 'axios';
import { createComponentLogger } from '../src/utils/logger';

const logger = createComponentLogger('DebugSecurityTest');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

class DebugSecurityTestRunner {
  private testUser = {
    email: 'debug-test@security.com',
    password: 'DebugTestPassword123!',
    name: 'Debug Test User',
    token: '',
    id: ''
  };

  async runTests(): Promise<void> {
    logger.info('🔍 Starting Debug Role Hierarchy Security Tests');
    
    try {
      await this.createTestUser();
      await this.authenticateTestUser();
      await this.debugAuthEndpoints();
      
      logger.info('✅ Debug tests completed!');
    } catch (error) {
      logger.error('❌ Debug tests failed:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async createTestUser(): Promise<void> {
    logger.info('📝 Creating debug test user...');
    
    try {
      await axios.post(`${BASE_URL}/auth/signup`, {
        name: this.testUser.name,
        email: this.testUser.email,
        password: this.testUser.password
      });
      logger.info('✅ Debug test user created successfully');
    } catch (error: any) {
      if (error.response?.status === 409) {
        logger.info('ℹ️ Debug test user already exists');
      } else {
        logger.error('❌ Failed to create debug test user:', error.response?.data || error.message);
        throw error;
      }
    }
  }

  private async authenticateTestUser(): Promise<void> {
    logger.info('🔑 Authenticating debug test user...');
    
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: this.testUser.email,
        password: this.testUser.password
      });
      
      this.testUser.token = response.data.token;
      this.testUser.id = response.data.user.id;
      
      logger.info('✅ Debug test user authenticated successfully', {
        userId: this.testUser.id,
        userRole: response.data.user.role,
        tokenLength: this.testUser.token.length
      });
    } catch (error: any) {
      logger.error('❌ Failed to authenticate debug test user:', error.response?.data || error.message);
      throw error;
    }
  }

  private async debugAuthEndpoints(): Promise<void> {
    logger.info('🔍 Testing authentication and authorization...');

    // Test 1: Check /auth/me endpoint
    await this.debugEndpoint('GET', '/auth/me', 'Check user profile access');
    
    // Test 2: Check admin endpoint with detailed debugging
    await this.debugEndpoint('GET', '/admin/users', 'Check admin access (should fail with 403)');
    
    // Test 3: Test with invalid token
    await this.debugEndpointWithToken('GET', '/admin/users', 'invalid-token-123', 'Check invalid token handling');
    
    // Test 4: Test with no token
    await this.debugEndpointWithToken('GET', '/admin/users', '', 'Check no token handling');
  }

  private async debugEndpoint(method: string, endpoint: string, description: string): Promise<void> {
    await this.debugEndpointWithToken(method, endpoint, this.testUser.token, description);
  }

  private async debugEndpointWithToken(method: string, endpoint: string, token: string, description: string): Promise<void> {
    logger.info(`🔍 ${description} - ${method} ${endpoint}`);
    
    try {
      const config: any = {
        method: method.toLowerCase(),
        url: `${BASE_URL}${endpoint}`,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        validateStatus: () => true // Don't throw on non-2xx status codes
      };

      logger.info('Request details:', {
        url: config.url,
        method: config.method,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
      });

      const response = await axios(config);
      
      logger.info('Response details:', {
        status: response.status,
        statusText: response.statusText,
        dataKeys: response.data ? Object.keys(response.data) : [],
        data: response.data
      });

      // Analyze the response
      if (response.status >= 200 && response.status < 300) {
        logger.info('✅ Success response received');
      } else if (response.status === 401) {
        logger.info('🔒 Unauthorized (401) - Authentication failed');
        if (response.data?.error) {
          logger.info('Error details:', response.data.error);
        }
      } else if (response.status === 403) {
        logger.info('🚫 Forbidden (403) - Authorization failed');
        if (response.data?.error) {
          logger.info('Error details:', response.data.error);
        }
      } else {
        logger.info(`❓ Unexpected status: ${response.status}`);
      }
      
    } catch (error: any) {
      logger.error(`❌ Request failed for ${description}:`, {
        error: error.message,
        code: error.code
      });
    }
  }
}

// Run the debug tests
const testRunner = new DebugSecurityTestRunner();
testRunner.runTests().catch((error) => {
  console.error('Debug tests failed:', error.message);
  process.exit(1);
});