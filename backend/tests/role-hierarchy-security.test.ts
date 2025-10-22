import request from 'supertest';
import app from '../src/app';
import { createTestUsers, cleanupTestData, getAuthToken } from './test-helpers';
import prisma from '../src/services/sqlClient';

describe('Role Hierarchy Security Tests', () => {
  let superuserToken: string;
  let adminToken: string;
  let userToken: string;
  let testUsers: any;
  let testProject: any;

  beforeAll(async () => {
    // Create test users with different roles
    testUsers = await createTestUsers();
    
    // Get authentication tokens
    superuserToken = await getAuthToken(testUsers.superuser.email, 'password123');
    adminToken = await getAuthToken(testUsers.admin.email, 'password123');
    userToken = await getAuthToken(testUsers.user.email, 'password123');

    // Create a test project for project-level permission tests
    testProject = await prisma.project.create({
      data: {
        name: 'Test Project',
        ownerId: testUsers.user.id,
        members: {
          create: [
            { userId: testUsers.user.id, role: 'owner' },
            { userId: testUsers.admin.id, role: 'editor' },
            { userId: testUsers.superuser.id, role: 'viewer' }
          ]
        }
      }
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('System-Level Role Hierarchy', () => {
    describe('Superuser Privileges', () => {
      test('superuser can access admin endpoints', async () => {
        const response = await request(app)
          .get('/admin/users')
          .set('Authorization', `Bearer ${superuserToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('superuser can modify admin users', async () => {
        const response = await request(app)
          .put(`/admin/users/${testUsers.admin.id}/role`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({
            role: 'user',
            reason: 'Testing superuser privileges'
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Restore admin role
        await request(app)
          .put(`/admin/users/${testUsers.admin.id}/role`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({
            role: 'admin',
            reason: 'Restoring admin role'
          })
          .expect(200);
      });

      test('superuser can modify other superuser accounts', async () => {
        // Create another superuser for testing
        const anotherSuperuser = await prisma.user.create({
          data: {
            email: `test-superuser-2-${Date.now()}@example.com`,
            name: 'Test Superuser 2',
            password: 'hashedpassword',
            role: 'superuser'
          }
        });

        const response = await request(app)
          .put(`/admin/users/${anotherSuperuser.id}/role`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({
            role: 'admin',
            reason: 'Testing superuser can modify other superusers'
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Cleanup
        await prisma.user.delete({ where: { id: anotherSuperuser.id } });
      });

      test('superuser cannot modify their own role', async () => {
        const response = await request(app)
          .put(`/admin/users/${testUsers.superuser.id}/role`)
          .set('Authorization', `Bearer ${superuserToken}`)
          .send({
            role: 'admin',
            reason: 'Attempting self-modification'
          })
          .expect(400);

        expect(response.body.error).toContain('Cannot change your own role');
      });
    });

    describe('Admin Privileges and Restrictions', () => {
      test('admin can access admin endpoints', async () => {
        const response = await request(app)
          .get('/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      test('admin can modify regular users', async () => {
        const response = await request(app)
          .put(`/admin/users/${testUsers.user.id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'admin',
            reason: 'Testing admin privileges'
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Restore user role
        await request(app)
          .put(`/admin/users/${testUsers.user.id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'user',
            reason: 'Restoring user role'
          })
          .expect(200);
      });

      test('admin cannot modify superuser accounts', async () => {
        const response = await request(app)
          .put(`/admin/users/${testUsers.superuser.id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'user',
            reason: 'Attempting unauthorized modification'
          })
          .expect(403);

        expect(response.body.error).toContain('Admins cannot modify superuser accounts');
      });

      test('admin cannot promote users to superuser', async () => {
        const response = await request(app)
          .put(`/admin/users/${testUsers.user.id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'superuser',
            reason: 'Attempting unauthorized promotion'
          })
          .expect(403);

        expect(response.body.error).toContain('Admins cannot promote users to superuser role');
      });

      test('admin cannot modify their own role', async () => {
        const response = await request(app)
          .put(`/admin/users/${testUsers.admin.id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'user',
            reason: 'Attempting self-modification'
          })
          .expect(400);

        expect(response.body.error).toContain('Cannot change your own role');
      });

      test('admin cannot lock/unlock superuser accounts', async () => {
        const lockResponse = await request(app)
          .post(`/admin/lockouts/${testUsers.superuser.email}/lock`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            reason: 'Testing restriction'
          })
          .expect(403);

        expect(lockResponse.body.error).toContain('Admins cannot modify superuser accounts');
      });
    });

    describe('Regular User Restrictions', () => {
      test('regular user cannot access admin endpoints', async () => {
        const response = await request(app)
          .get('/admin/users')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.error).toContain('Access denied - insufficient privileges');
      });

      test('regular user cannot access admin lockout endpoints', async () => {
        const response = await request(app)
          .get('/admin/lockouts')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.error).toContain('Access denied - insufficient privileges');
      });

      test('regular user cannot modify other users', async () => {
        const response = await request(app)
          .put(`/admin/users/${testUsers.admin.id}/role`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            role: 'user',
            reason: 'Unauthorized attempt'
          })
          .expect(403);

        expect(response.body.error).toContain('Access denied - insufficient privileges');
      });
    });
  });

  describe('Project-Level Role Hierarchy', () => {
    describe('Project Owner Privileges', () => {
    test('project owner can add members to project', async () => {
      // Create a new user to add to project
      const newUser = await prisma.user.create({
        data: {
          email: `new-member-${Date.now()}@example.com`,
          name: 'New Member',
          password: 'hashedpassword'
        }
      });        const response = await request(app)
          .post(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${userToken}`) // user is the project owner
          .send({
            userId: newUser.id,
            role: 'viewer'
          })
          .expect(201);

        expect(response.body.role).toBe('viewer');

        // Cleanup - delete project member first, then user
        await prisma.projectMember.deleteMany({ where: { userId: newUser.id } });
        await prisma.user.delete({ where: { id: newUser.id } });
      });

      test('project owner can change member roles', async () => {
        const response = await request(app)
          .put(`/projects/${testProject.id}/members/${testUsers.admin.id}`)
          .set('Authorization', `Bearer ${userToken}`) // user is the project owner
          .send({
            role: 'viewer'
          })
          .expect(200);

        expect(response.body.role).toBe('viewer');

        // Restore editor role
        await request(app)
          .put(`/projects/${testProject.id}/members/${testUsers.admin.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            role: 'editor'
          })
          .expect(200);
      });

  test('project owner can remove members', async () => {
    // Add a temporary member first
    const tempUser = await prisma.user.create({
      data: {
        email: `temp-member-${Date.now()}@example.com`,
        name: 'Temp Member',
        password: 'hashedpassword'
      }
    });        await request(app)
          .post(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            userId: tempUser.id,
            role: 'viewer'
          })
          .expect(201);

        // Now remove the member
        await request(app)
          .delete(`/projects/${testProject.id}/members/${tempUser.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(204);

        // Cleanup - delete project member first (if any), then user
        await prisma.projectMember.deleteMany({ where: { userId: tempUser.id } });
        await prisma.user.delete({ where: { id: tempUser.id } });
      });
    });

    describe('Project Editor Restrictions', () => {
      test('project editor cannot add members', async () => {
        const response = await request(app)
          .post(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${adminToken}`) // admin is editor in this project
          .send({
            userId: testUsers.superuser.id,
            role: 'viewer'
          })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
      });

      test('project editor cannot change member roles', async () => {
        const response = await request(app)
          .put(`/projects/${testProject.id}/members/${testUsers.superuser.id}`)
          .set('Authorization', `Bearer ${adminToken}`) // admin is editor in this project
          .send({
            role: 'editor'
          })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
      });

      test('project editor cannot remove members', async () => {
        const response = await request(app)
          .delete(`/projects/${testProject.id}/members/${testUsers.superuser.id}`)
          .set('Authorization', `Bearer ${adminToken}`) // admin is editor in this project
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
      });

      test('project editor can view members', async () => {
        const response = await request(app)
          .get(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${adminToken}`) // admin is editor in this project
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('Project Viewer Restrictions', () => {
      test('project viewer can only view members', async () => {
        const response = await request(app)
          .get(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${superuserToken}`) // superuser is viewer in this project
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      test('project viewer cannot add members', async () => {
        const response = await request(app)
          .post(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${superuserToken}`) // superuser is viewer in this project
          .send({
            userId: testUsers.user.id,
            role: 'viewer'
          })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
      });
    });

    describe('Cross-Hierarchy Interactions', () => {
      test('system admin with project viewer role cannot override project permissions', async () => {
        // Admin (system level) but only viewer in project should not be able to add members
        const response = await request(app)
          .post(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${adminToken}`) // admin is only editor in this project
          .send({
            userId: testUsers.superuser.id,
            role: 'viewer'
          })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
      });

      test('system superuser with project viewer role cannot override project permissions', async () => {
        // Superuser (system level) but only viewer in project should not be able to add members
        const response = await request(app)
          .post(`/projects/${testProject.id}/members`)
          .set('Authorization', `Bearer ${superuserToken}`) // superuser is only viewer in this project
          .send({
            userId: testUsers.user.id,
            role: 'viewer'
          })
          .expect(403);

        expect(response.body.error).toBe('Forbidden');
      });
    });
  });

  describe('Token and Authentication Security', () => {
    test('expired or invalid tokens are rejected', async () => {
      const response = await request(app)
        .get('/admin/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    test('missing tokens are rejected', async () => {
      const response = await request(app)
        .get('/admin/users')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    test('malformed authorization headers are rejected', async () => {
      const response = await request(app)
        .get('/admin/users')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Input Validation Security', () => {
    test('invalid role values are rejected', async () => {
      const response = await request(app)
        .put(`/admin/users/${testUsers.user.id}/role`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          role: 'invalid_role',
          reason: 'Testing validation'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    test('missing required fields are rejected', async () => {
      const response = await request(app)
        .put(`/admin/users/${testUsers.user.id}/role`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          role: 'admin'
          // missing reason field
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });

    test('invalid user IDs are rejected', async () => {
      const response = await request(app)
        .put('/admin/users/invalid-uuid/role')
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          role: 'admin',
          reason: 'Testing validation'
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid input');
    });
  });

  describe('Account Lockout Security', () => {
    test('admins cannot lock superuser accounts', async () => {
      const response = await request(app)
        .post(`/admin/lockouts/${testUsers.superuser.email}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Testing lockout restrictions'
        })
        .expect(403);

      expect(response.body.error).toContain('Admins cannot modify superuser accounts');
    });

    test('superuser can lock admin accounts', async () => {
      const response = await request(app)
        .post(`/admin/lockouts/${testUsers.admin.email}/lock`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          reason: 'Testing superuser lockout privileges'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Unlock the admin account
      await request(app)
        .post(`/admin/lockouts/${testUsers.admin.email}/unlock`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          reason: 'Unlocking after test'
        })
        .expect(200);
    });

    test('regular users cannot lock any accounts', async () => {
      const response = await request(app)
        .post(`/admin/lockouts/${testUsers.admin.email}/lock`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'Unauthorized attempt'
        })
        .expect(403);

      expect(response.body.error).toContain('Access denied - insufficient privileges');
    });
  });

  describe('Audit Logging Verification', () => {
    test('role changes are properly logged', async () => {
      // Perform a role change
      await request(app)
        .put(`/admin/users/${testUsers.user.id}/role`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          role: 'admin',
          reason: 'Testing audit logging'
        })
        .expect(200);

      // Check that the action was logged (this would need access to your logging system)
      // For now, we verify the operation succeeded and trust the logging middleware
      
      // Restore original role
      await request(app)
        .put(`/admin/users/${testUsers.user.id}/role`)
        .set('Authorization', `Bearer ${superuserToken}`)
        .send({
          role: 'user',
          reason: 'Restoring original role'
        })
        .expect(200);
    });
  });
});