#!/usr/bin/env ts-node

/**
 * Performance Test Script for OrchePlan Backend
 * Tests response times for key endpoints and analyzes performance metrics
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

interface PerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  success: boolean;
  error?: string;
}

interface PerformanceReport {
  timestamp: string;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  metrics: PerformanceMetric[];
}

const BASE_URL = 'http://localhost:3001';
const ENDPOINTS = [
  { method: 'GET', path: '/', description: 'Health check' },
  { method: 'POST', path: '/auth/signup', description: 'User signup', data: { email: `perf-test-${Date.now()}@example.com`, password: 'testpass123', name: 'Perf Test User' } },
  { method: 'POST', path: '/auth/login', description: 'User login', data: { email: 'admin@example.com', password: 'admin123' } },
  { method: 'GET', path: '/auth/me', description: 'Get current user', requiresAuth: true },
  { method: 'GET', path: '/admin/users', description: 'List users (admin)', requiresAuth: true },
  { method: 'GET', path: '/projects', description: 'List projects', requiresAuth: true },
  { method: 'GET', path: '/admin/lockouts', description: 'Get lockout stats', requiresAuth: true }
];

class PerformanceTester {
  private metrics: PerformanceMetric[] = [];
  private authToken: string | null = null;

  async authenticate(): Promise<boolean> {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'admin@example.com',
        password: 'admin123'
      });
      
      if (response.data.token) {
        this.authToken = response.data.token;
        console.log('✅ Authentication successful');
        return true;
      }
    } catch (error) {
      console.log('❌ Authentication failed, trying to create admin user...');
      
      // Try to create admin user
      try {
        await axios.post(`${BASE_URL}/auth/signup`, {
          email: 'admin@example.com',
          password: 'admin123',
          name: 'Admin User'
        });
        
        const response = await axios.post(`${BASE_URL}/auth/login`, {
          email: 'admin@example.com',
          password: 'admin123'
        });
        
        if (response.data.token) {
          this.authToken = response.data.token;
          console.log('✅ Admin user created and authenticated');
          return true;
        }
      } catch (createError) {
        console.log('❌ Failed to create admin user:', createError);
      }
    }
    
    return false;
  }

  async testEndpoint(endpoint: any): Promise<PerformanceMetric> {
    const startTime = performance.now();
    
    try {
      const config: any = {
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 10000
      };

      if (endpoint.data) {
        config.data = endpoint.data;
      }

      if (endpoint.requiresAuth && this.authToken) {
        config.headers = {
          'Authorization': `Bearer ${this.authToken}`
        };
      }

      const response = await axios(config);
      const endTime = performance.now();
      const responseTime = Math.round((endTime - startTime) * 100) / 100; // Round to 2 decimal places

      return {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        method: endpoint.method,
        responseTime,
        statusCode: response.status,
        success: true
      };
    } catch (error: any) {
      const endTime = performance.now();
      const responseTime = Math.round((endTime - startTime) * 100) / 100;

      return {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        method: endpoint.method,
        responseTime,
        statusCode: error.response?.status || 0,
        success: false,
        error: error.message
      };
    }
  }

  async runTests(): Promise<PerformanceReport> {
    console.log('🚀 Starting performance tests...\n');

    // First authenticate
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.log('⚠️  Continuing without authentication...');
    }

    console.log('📊 Testing endpoints...\n');

    for (const endpoint of ENDPOINTS) {
      console.log(`Testing: ${endpoint.description}`);
      const metric = await this.testEndpoint(endpoint);
      this.metrics.push(metric);
      
      const status = metric.success ? '✅' : '❌';
      const time = `${metric.responseTime}ms`;
      const code = metric.statusCode;
      
      console.log(`  ${status} ${time} (${code}) - ${metric.endpoint}`);
      if (metric.error) {
        console.log(`    Error: ${metric.error}`);
      }
    }

    return this.generateReport();
  }

  generateReport(): PerformanceReport {
    const successfulTests = this.metrics.filter(m => m.success);
    const responseTimes = this.metrics.map(m => m.responseTime);

    return {
      timestamp: new Date().toISOString(),
      totalTests: this.metrics.length,
      successfulTests: successfulTests.length,
      failedTests: this.metrics.length - successfulTests.length,
      averageResponseTime: Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100) / 100,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      metrics: this.metrics
    };
  }

  printReport(report: PerformanceReport): void {
    console.log('\n📈 PERFORMANCE REPORT');
    console.log('==========================================');
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Successful: ${report.successfulTests} ✅`);
    console.log(`Failed: ${report.failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((report.successfulTests / report.totalTests) * 100)}%`);
    console.log('');
    console.log('⏱️  Response Times:');
    console.log(`  Average: ${report.averageResponseTime}ms`);
    console.log(`  Fastest: ${report.minResponseTime}ms`);
    console.log(`  Slowest: ${report.maxResponseTime}ms`);
    console.log('');
    
    console.log('📋 Detailed Results:');
    report.metrics.forEach(metric => {
      const status = metric.success ? '✅' : '❌';
      console.log(`  ${status} ${metric.endpoint.padEnd(25)} ${metric.responseTime}ms (${metric.statusCode})`);
    });

    // Performance Analysis
    console.log('\n🔍 Performance Analysis:');
    
    if (report.averageResponseTime < 100) {
      console.log('  ✅ Excellent response times (< 100ms average)');
    } else if (report.averageResponseTime < 300) {
      console.log('  🟡 Good response times (< 300ms average)');
    } else if (report.averageResponseTime < 1000) {
      console.log('  🟠 Acceptable response times (< 1s average)');
    } else {
      console.log('  🔴 Slow response times (> 1s average)');
    }

    const slowEndpoints = report.metrics.filter(m => m.responseTime > 500);
    if (slowEndpoints.length > 0) {
      console.log('  ⚠️  Slow endpoints (> 500ms):');
      slowEndpoints.forEach(endpoint => {
        console.log(`    - ${endpoint.endpoint}: ${endpoint.responseTime}ms`);
      });
    }

    if (report.failedTests / report.totalTests > 0.1) {
      console.log('  🔴 High failure rate detected');
    } else {
      console.log('  ✅ Good success rate');
    }
  }
}

// Run the performance tests
async function main() {
  const tester = new PerformanceTester();
  
  try {
    const report = await tester.runTests();
    tester.printReport(report);
  } catch (error) {
    console.error('Performance test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PerformanceTester, PerformanceReport, PerformanceMetric };