# Role Hierarchy Security Testing Guide

This guide provides comprehensive instructions for testing the security of the role hierarchy system in OrchePlan.

## Role Hierarchy Overview

OrchePlan implements a three-tier role hierarchy at the system level:

### System Roles (Global)
1. **Superuser** 🔑
   - Highest privilege level
   - Can access all admin functions
   - Can modify admin and regular user accounts
   - Can promote/demote any user (except themselves)
   - Cannot be locked out automatically
   - Can manage other superuser accounts

2. **Admin** 👑
   - Administrative privileges
   - Can access admin dashboard and functions
   - Can modify regular user accounts
   - **CANNOT** modify superuser accounts
   - **CANNOT** promote users to superuser
   - **CANNOT** change their own role
   - Can be locked out if account security is compromised

3. **User** 👤
   - Standard user privileges
   - **CANNOT** access admin functions
   - **CANNOT** modify other user accounts
   - **CANNOT** change their own role
   - Subject to all security restrictions

### Project Roles (Per-Project)
1. **Owner** - Full project control (add/remove members, change roles, delete project)
2. **Editor** - Can edit project content and tasks
3. **Viewer** - Read-only access to project content

**Important**: System-level roles do NOT override project-level permissions. A superuser who is only a viewer in a project cannot perform owner actions in that project.

## Testing Methods

### 1. Automated Testing

#### Jest Test Suite
```bash
# Run all tests
npm test

# Run security-specific tests
npm run test:security

# Run tests in watch mode
npm run test:watch
```

The automated tests in `tests/role-hierarchy-security.test.ts` cover:
- System-level role permissions
- Project-level role permissions
- Cross-hierarchy interactions
- Input validation
- Authentication security
- Account lockout restrictions

#### Manual Testing Script
```bash
# Run manual security tests against a running server
npm run test:security-manual
```

This script makes actual HTTP requests to test the security boundaries.

### 2. Manual Testing Procedures

#### Prerequisites
1. Start the backend server:
   ```bash
   npm run dev
   ```
2. Ensure you have test users with different roles:
   - Superuser account
   - Admin account
   - Regular user account

#### System Role Testing Checklist

**✅ Superuser Privileges**
- [ ] Can access `/admin` dashboard
- [ ] Can view all users in admin panel
- [ ] Can change admin user roles
- [ ] Can change regular user roles
- [ ] Can promote users to admin
- [ ] Can promote users to superuser
- [ ] Can lock/unlock admin accounts
- [ ] Cannot change own role

**✅ Admin Restrictions**
- [ ] Can access `/admin` dashboard
- [ ] Can view all users in admin panel
- [ ] Can change regular user roles
- [ ] Can promote regular users to admin
- [ ] **CANNOT** modify superuser accounts (should see "Restricted" label)
- [ ] **CANNOT** promote users to superuser
- [ ] **CANNOT** lock/unlock superuser accounts
- [ ] **CANNOT** change own role

**✅ User Restrictions**
- [ ] **CANNOT** access `/admin` routes (should get 403 or redirect)
- [ ] **CANNOT** access admin API endpoints
- [ ] **CANNOT** modify other user accounts
- [ ] **CANNOT** promote themselves

#### Project Role Testing Checklist

**✅ Project Owner Privileges**
- [ ] Can add new members to project
- [ ] Can change member roles (owner/editor/viewer)
- [ ] Can remove members from project
- [ ] Can delete project
- [ ] Cannot change their own role to non-owner if they're the only owner

**✅ Project Editor Restrictions**
- [ ] Can view project members
- [ ] **CANNOT** add new members
- [ ] **CANNOT** change member roles
- [ ] **CANNOT** remove members
- [ ] **CANNOT** delete project

**✅ Project Viewer Restrictions**
- [ ] Can view project members
- [ ] **CANNOT** add new members
- [ ] **CANNOT** change member roles
- [ ] **CANNOT** remove members
- [ ] **CANNOT** delete project

#### Cross-Hierarchy Testing

**✅ System vs Project Roles**
- [ ] Superuser with project viewer role **CANNOT** perform owner actions
- [ ] Admin with project viewer role **CANNOT** perform owner actions
- [ ] System role does not override project permissions

### 3. Security Boundary Testing

#### Authentication Testing
```bash
# Test invalid tokens
curl -H "Authorization: Bearer invalid-token" http://localhost:3001/api/admin/users

# Test missing tokens
curl http://localhost:3001/api/admin/users

# Test malformed headers
curl -H "Authorization: InvalidFormat token" http://localhost:3001/api/admin/users
```

#### Input Validation Testing
```bash
# Test invalid role values
curl -X PUT http://localhost:3001/api/admin/users/USER_ID/role \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "invalid_role", "reason": "test"}'

# Test missing required fields
curl -X PUT http://localhost:3001/api/admin/users/USER_ID/role \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

## Expected Security Behaviors

### Frontend Security Features
1. **Role-based UI**: Admin navigation only shows for admin+ roles
2. **Component protection**: RoleGuard components protect sensitive areas
3. **Visual indicators**: Restricted actions show "(Restricted)" labels
4. **Graceful degradation**: Users see appropriate error messages

### Backend Security Features
1. **Route protection**: All admin routes require admin+ roles
2. **Role hierarchy enforcement**: Lower roles cannot modify higher roles
3. **Self-modification prevention**: Users cannot change their own roles
4. **Input validation**: All requests validated for proper format and permissions
5. **Audit logging**: All admin actions are logged for security auditing

### Account Lockout Security
1. **Superuser protection**: Superusers cannot be automatically locked out
2. **Admin privileges**: Only superusers can lock/unlock admin accounts
3. **Hierarchy respect**: Admins cannot lock superuser accounts

## Red Flags to Watch For

🚨 **Critical Security Issues**
- Regular users accessing admin endpoints
- Admins modifying superuser accounts
- Users changing their own roles
- Cross-role privilege escalation
- Bypassing authentication requirements

⚠️ **Security Concerns**
- Missing audit logs for admin actions
- Weak input validation
- Inconsistent error messages revealing system information
- Missing rate limiting on sensitive endpoints

## Troubleshooting

### Common Issues
1. **403 Forbidden**: Check user role and endpoint requirements
2. **401 Unauthorized**: Verify JWT token is valid and properly formatted
3. **400 Bad Request**: Check input validation requirements
4. **Role not updating**: Clear browser cache and refresh

### Debug Steps
1. Check user's current role: `GET /api/auth/me`
2. Verify JWT token payload
3. Check server logs for security warnings
4. Validate request format matches API requirements

## Security Best Practices

1. **Principle of Least Privilege**: Grant minimum necessary permissions
2. **Defense in Depth**: Multiple layers of security (frontend + backend)
3. **Audit Everything**: Log all administrative actions
4. **Regular Testing**: Run security tests before deployments
5. **Role Review**: Periodically audit user roles and permissions

## Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** create a public issue
2. Report privately to the security team
3. Include reproduction steps and potential impact
4. Allow time for assessment and patching before disclosure