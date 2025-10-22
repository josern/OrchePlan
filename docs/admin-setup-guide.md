# Admin/Superuser Management Guide

## Creating Your First Superuser

### Method 1: Interactive Mode (Recommended)

Run the script in interactive mode for guided setup:

```bash
cd /path/to/backend
npx ts-node scripts/create_superuser.ts
```

The script will prompt you for:
- **Email**: Valid email address for the superuser
- **Full Name**: Display name for the admin user
- **Password**: Secure password (minimum 6 characters)
- **Confirm Password**: Password confirmation

**Example interaction:**
```
🔐 Superuser Creation Tool

Email: admin@yourcompany.com
Full Name: System Administrator
Password: ******** (hidden)
Confirm Password: ******** (hidden)

✅ Superuser created successfully!
   ID: 6e3a57db-4837-4117-9983-cf4d59947467
   Email: admin@yourcompany.com
   Name: System Administrator
   Role: superuser
```

### Method 2: Non-Interactive Mode

For automation or CI/CD pipelines:

```bash
cd /path/to/backend
npx ts-node scripts/create_superuser.ts "admin@yourcompany.com" "System Administrator" "your-secure-password"
```

## Managing Existing Users

### Promoting Existing Users to Superuser

If you run the script with an existing user's email, you'll be prompted to promote them:

```bash
npx ts-node scripts/create_superuser.ts existing@user.com "Existing User" "password"
```

Output:
```
User with email existing@user.com already exists. Update to superuser? (y/N): y
✅ User existing@user.com has been promoted to superuser
```

### User Roles Hierarchy

1. **user** (default) - Regular users with basic access
2. **admin** - Administrative privileges for most admin functions
3. **superuser** - Full system access, can't be locked out, has all permissions

## Admin Dashboard Access

Once you have a superuser account:

1. **Login** to the frontend application
2. **Navigate** to the admin page via:
   - Sidebar: Click "Admin" (only visible to admin/superuser users)
   - Direct URL: `https://your-domain.com/admin`

### Admin Dashboard Features

#### Account Lockout Management
- **View Statistics**: Total locked, auto-locked, manually locked accounts
- **Check Account Status**: Verify lockout status of any user
- **Unlock Accounts**: Manually unlock locked accounts with audit reasons
- **Lock Accounts**: Manually lock accounts for security purposes
- **Cleanup**: Remove expired locks from the database

#### Security Monitoring
- **Locked Accounts List**: View all currently locked accounts
- **Lockout Reasons**: See why accounts were locked (failed attempts vs manual)
- **Audit Trail**: All admin actions are logged with timestamps and reasons

## Production Setup Recommendations

### 1. Create Your First Superuser

```bash
# Production setup
cd /path/to/backend
npx ts-node scripts/create_superuser.ts
```

**Best Practices:**
- Use a company email address
- Use a strong, unique password
- Store credentials securely (password manager)
- Don't share superuser credentials

### 2. Create Additional Admin Users

For team environments, create additional admin users:

```bash
# Create regular admin (not superuser)
# Note: Currently the script only creates superusers
# You can modify user roles directly in the database if needed
```

### 3. Regular User Management

Regular users are created through:
- **Frontend Signup**: Standard user registration
- **Admin Invitation**: (Future feature)
- **Direct Database**: For bulk imports

## Security Considerations

### Account Lockout Protection

- **Superusers cannot be locked out** automatically
- Admin users have elevated privileges but can still be locked
- Regular users are subject to all lockout rules

### Admin Access Logging

All admin actions are logged including:
- User who performed the action
- Target user/account
- Action performed (lock/unlock)
- Reason provided
- Timestamp
- IP address

### Role-Based Access Control

Frontend automatically:
- Shows/hides admin navigation based on user role
- Protects admin routes with role guards
- Displays appropriate error messages for insufficient permissions

## Troubleshooting

### Script Errors

**Database Connection Issues:**
```bash
# Ensure database is running and accessible
npx prisma db push
npx prisma generate
```

**Permission Errors:**
```bash
# Ensure script has execute permissions
chmod +x scripts/*.sh
```

### Access Issues

**Can't Access Admin Page:**
- Verify user has `admin` or `superuser` role in database
- Check browser console for authentication errors
- Ensure backend admin routes are accessible

**Lockout System Not Working:**
- Check database schema includes lockout fields
- Verify account lockout service is running
- Check logs for lockout-related errors

### Database Queries

**Check user roles:**
```sql
SELECT id, email, name, role FROM "User" WHERE role IN ('admin', 'superuser');
```

**Manually promote user:**
```sql
UPDATE "User" SET role = 'superuser' WHERE email = 'user@example.com';
```

**View locked accounts:**
```sql
SELECT id, email, name, "failedLoginAttempts", "lockedUntil", "lockoutReason", "isManuallyLocked"
FROM "User" 
WHERE "isManuallyLocked" = true OR "lockedUntil" > NOW();
```

## Backup and Recovery

### Before Promoting Users

Always backup your database before making role changes:

```bash
# PostgreSQL backup
pg_dump your_database > backup_before_admin_setup.sql

# Or using Prisma
npx prisma db pull
```

### Emergency Access

If you lose admin access:

1. **Database Access**: Directly modify user roles in database
2. **Script Access**: Use the superuser creation script to create new admin
3. **Environment Reset**: Reset development environment if necessary

## Integration with CI/CD

For automated deployments:

```bash
# Create superuser in deployment script
if [ "$NODE_ENV" = "production" ]; then
  echo "Creating production superuser..."
  npx ts-node scripts/create_superuser.ts "$ADMIN_EMAIL" "$ADMIN_NAME" "$ADMIN_PASSWORD"
fi
```

**Environment Variables:**
- `ADMIN_EMAIL`: Superuser email
- `ADMIN_NAME`: Superuser display name  
- `ADMIN_PASSWORD`: Secure password from secrets management

This ensures your production environment always has admin access configured.