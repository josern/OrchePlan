import { beforeAll, afterAll } from '@jest/globals';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Any global setup needed for tests
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Any global cleanup needed after tests
  console.log('Cleaning up test environment...');
});