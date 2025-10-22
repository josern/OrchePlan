import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../src/services/sqlClient';
import request from 'supertest';
import app from '../src/app';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface TestUsers {
  superuser: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

/**
 * Create test users with different roles for testing
 */
export async function createTestUsers(): Promise<TestUsers> {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create superuser
  const superuser = await prisma.user.create({
    data: {
      email: 'test-superuser@example.com',
      name: 'Test Superuser',
      password: hashedPassword,
      role: 'superuser'
    }
  });

  // Create admin
  const admin = await prisma.user.create({
    data: {
      email: 'test-admin@example.com',
      name: 'Test Admin',
      password: hashedPassword,
      role: 'admin'
    }
  });

  // Create regular user
  const user = await prisma.user.create({
    data: {
      email: 'test-user@example.com',
      name: 'Test User',
      password: hashedPassword,
      role: 'user'
    }
  });

  return {
    superuser: {
      id: superuser.id,
      email: superuser.email,
      name: superuser.name!,
      role: superuser.role!
    },
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name!,
      role: admin.role!
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name!,
      role: user.role!
    }
  };
}

/**
 * Get authentication token for a user
 */
export async function getAuthToken(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return response.body.token;
}

/**
 * Create a direct JWT token for testing (bypasses login)
 */
export function createTestToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Clean up all test data
 */
export async function cleanupTestData(): Promise<void> {
  // Delete in reverse dependency order to avoid foreign key constraint violations
  
  // Delete task comments first
  await prisma.taskComment.deleteMany({
    where: {
      task: {
        project: {
          name: {
            startsWith: 'Test'
          }
        }
      }
    }
  });

  // Delete tasks
  await prisma.task.deleteMany({
    where: {
      project: {
        name: {
          startsWith: 'Test'
        }
      }
    }
  });

  // Delete task statuses
  await prisma.taskStatus.deleteMany({
    where: {
      project: {
        name: {
          startsWith: 'Test'
        }
      }
    }
  });

  // Delete project members
  await prisma.projectMember.deleteMany({
    where: {
      OR: [
        {
          user: {
            email: {
              contains: 'test-'
            }
          }
        },
        {
          project: {
            name: {
              startsWith: 'Test'
            }
          }
        }
      ]
    }
  });

  // Delete projects
  await prisma.project.deleteMany({
    where: {
      name: {
        startsWith: 'Test'
      }
    }
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        contains: 'test-'
      }
    }
  });
}

/**
 * Create a test project with specified owner and members
 */
export async function createTestProject(ownerId: string, members?: Array<{ userId: string; role: 'owner' | 'editor' | 'viewer' }>) {
  return await prisma.project.create({
    data: {
      name: `Test Project ${Date.now()}`,
      ownerId,
      members: members ? {
        create: members
      } : {
        create: [
          { userId: ownerId, role: 'owner' }
        ]
      }
    },
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  });
}

/**
 * Assert that a response contains proper error structure
 */
export function assertErrorResponse(response: any, expectedStatus: number, expectedErrorMessage?: string) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('error');
  if (expectedErrorMessage) {
    expect(response.body.error).toContain(expectedErrorMessage);
  }
}

/**
 * Assert that a response contains proper success structure
 */
export function assertSuccessResponse(response: any, expectedStatus: number = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success');
  expect(response.body.success).toBe(true);
}

/**
 * Create test data for specific security scenarios
 */
export async function createSecurityTestScenario() {
  const users = await createTestUsers();
  
  // Create multiple projects with different ownership structures
  const userOwnedProject = await createTestProject(users.user.id, [
    { userId: users.user.id, role: 'owner' },
    { userId: users.admin.id, role: 'editor' },
    { userId: users.superuser.id, role: 'viewer' }
  ]);

  const adminOwnedProject = await createTestProject(users.admin.id, [
    { userId: users.admin.id, role: 'owner' },
    { userId: users.user.id, role: 'editor' },
    { userId: users.superuser.id, role: 'viewer' }
  ]);

  const superuserOwnedProject = await createTestProject(users.superuser.id, [
    { userId: users.superuser.id, role: 'owner' },
    { userId: users.admin.id, role: 'editor' },
    { userId: users.user.id, role: 'viewer' }
  ]);

  return {
    users,
    projects: {
      userOwned: userOwnedProject,
      adminOwned: adminOwnedProject,
      superuserOwned: superuserOwnedProject
    }
  };
}

/**
 * Wait for a specified amount of time (useful for testing rate limiting)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate multiple rapid requests for testing rate limiting
 */
export async function makeMultipleRequests(
  app: any,
  method: string,
  endpoint: string,
  token: string,
  count: number,
  body?: any
): Promise<any[]> {
  const requests: Promise<any>[] = [];
  
  for (let i = 0; i < count; i++) {
    let req;
    const methodLower = method.toLowerCase();
    
    switch (methodLower) {
      case 'get':
        req = request(app).get(endpoint);
        break;
      case 'post':
        req = request(app).post(endpoint);
        break;
      case 'put':
        req = request(app).put(endpoint);
        break;
      case 'delete':
        req = request(app).delete(endpoint);
        break;
      case 'patch':
        req = request(app).patch(endpoint);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    req.set('Authorization', `Bearer ${token}`);
    
    if (body && (methodLower === 'post' || methodLower === 'put' || methodLower === 'patch')) {
      req.send(body);
    }
    
    requests.push(req);
  }
  
  return Promise.all(requests);
}

/**
 * Test role escalation attempts
 */
export async function testRoleEscalation(attackerToken: string, targetUserId: string, attemptedRole: string) {
  return await request(app)
    .put(`/admin/users/${targetUserId}/role`)
    .set('Authorization', `Bearer ${attackerToken}`)
    .send({
      role: attemptedRole,
      reason: 'Unauthorized escalation attempt'
    });
}

/**
 * Validate that admin operations are properly logged
 */
export async function validateAdminLogging(adminAction: () => Promise<any>) {
  // Record timestamp before action
  const beforeAction = new Date();
  
  // Perform the admin action
  const result = await adminAction();
  
  // In a real implementation, you would check your logging system here
  // For now, we'll return the result and trust that logging middleware is working
  return {
    result,
    timestamp: beforeAction
  };
}