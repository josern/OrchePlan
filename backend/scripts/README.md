# Backend Scripts

This directory contains utility scripts for managing the OrchePlan backend.

## Admin Management

### Create Superuser
Create an admin/superuser account with full system privileges.

**Interactive mode (recommended):**
```bash
npm run create-superuser
```

**Non-interactive mode:**
```bash
npm run create-superuser -- "admin@example.com" "Admin User" "secure-password"
```

**Direct execution:**
```bash
npx ts-node scripts/create_superuser.ts
```

## Account Lockout Management

### Test Account Lockout System
Run comprehensive tests of the account lockout functionality.

```bash
npm run test-lockout
```

### Cleanup Expired Locks
Remove expired account locks from the database.

```bash
npm run cleanup-lockouts
```

**Or run via cron job:**
```bash
# Add to crontab for hourly cleanup
0 * * * * cd /path/to/backend && npm run cleanup-lockouts
```

## Development Scripts

### Database Management
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio
```

### Testing
```bash
# Run smoke tests
npm run smoke-test
```

## Script Descriptions

- **`create_superuser.ts`** - Interactive admin user creation
- **`test_account_lockout.ts`** - Comprehensive lockout system testing
- **`cleanup_lockouts.ts`** - Remove expired account locks
- **`remove_test_user.ts`** - Development utility to remove test users
- **Various `.sh` scripts** - Shell utilities for development and deployment

## Security Notes

- Store superuser credentials securely
- Use strong passwords for admin accounts
- Regularly run cleanup scripts in production
- Monitor admin access logs

See `/docs/admin-setup-guide.md` for complete setup instructions.