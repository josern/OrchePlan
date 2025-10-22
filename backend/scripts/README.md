# OrchePlan Backend Scripts

This directory contains essential utility scripts for managing the OrchePlan backend in production.

## Available Scripts

### User Management

#### `npm run create-superuser`
Creates a new superuser account with admin privileges.
- **File**: `create_superuser.ts`
- **Usage**: Interactive script that prompts for email, name, and password
- **Purpose**: Create administrative users for initial setup or when locked out

#### `npm run check-users`
Displays all users in the database with their roles and status.
- **File**: `check_users.ts` 
- **Usage**: `npm run check-users`
- **Purpose**: Audit user accounts and their permissions

### Security & Account Management

#### `npm run cleanup-lockouts`
Clears all account lockouts.
- **File**: `cleanup_lockouts.ts`
- **Usage**: `npm run cleanup-lockouts`
- **Purpose**: Reset locked accounts (use with caution in production)

### Database Management

#### `npm run db:backup`
Creates a timestamped backup of the PostgreSQL database.
- **File**: `backup-database.sh`
- **Usage**: `npm run db:backup`
- **Purpose**: Regular database backups for disaster recovery
- **Environment Variables**:
  - `BACKUP_PATH`: Directory for backups (default: `/var/backups/orcheplan`)
  - `BACKUP_RETENTION_DAYS`: Days to keep backups (default: 30)

### Development & Testing

#### `npm run start-local`
Sets up local development environment with database migrations.
- **File**: `start-local.sh`
- **Usage**: `npm run start-local`
- **Purpose**: Initialize local development setup

#### `npm run smoke-test`
Runs basic functionality tests to verify system health.
- **File**: `smoke-test.sh`
- **Usage**: `npm run smoke-test`
- **Purpose**: Quick system health check

### Environment-Specific Startup Scripts

#### Coder Environment
- **File**: `start-coder.sh`
- **Purpose**: Configured for Coder.com development environment
- **Usage**: Direct execution for Coder-specific setup

#### External Environment  
- **File**: `start-external.sh`
- **Purpose**: External deployment configuration
- **Usage**: For deployments outside local environment

## Usage Examples

### Initial Setup
```bash
# Create the first admin user
npm run create-superuser

# Verify user was created
npm run check-users
```

### Regular Maintenance
```bash
# Backup database
npm run db:backup

# Check system health
npm run smoke-test

# Clear locked accounts if needed
npm run cleanup-lockouts
```

### Development
```bash
# Setup local environment
npm run start-local

# Start development server
npm run dev
```

## Script Conventions

All scripts follow these production-ready conventions:

1. **Error Handling**: Proper exit codes and error messages
2. **Logging**: Structured logging with timestamps
3. **Security**: No hardcoded credentials or sensitive data
4. **Database**: Always disconnect Prisma client properly
5. **Environment**: Respect environment variables for configuration

## Environment Variables

Scripts may use these environment variables:

- `DATABASE_URL`: Prisma database connection (required)
- `BACKUP_PATH`: Database backup directory
- `BACKUP_RETENTION_DAYS`: How long to keep backups
- `NODE_ENV`: Environment mode (development/production)

## Security Notes

- **create-superuser**: Only run when creating initial admin accounts
- **cleanup-lockouts**: Use carefully in production - only unlock accounts you trust
- **db:backup**: Ensure backup directory has proper permissions and disk space
- All scripts require appropriate database permissions

## Maintenance

These scripts are designed for production use and should be:

- Run by authorized personnel only
- Tested in staging before production use
- Monitored for successful completion
- Used as part of regular maintenance procedures

## File Structure

```
scripts/
├── README.md                    # This documentation
├── create_superuser.ts          # User management
├── check_users.ts              # User auditing  
├── cleanup_lockouts.ts         # Security management
├── backup-database.sh          # Database backup
├── smoke-test.sh              # Health checks
├── start-local.sh             # Local development
├── start-coder.sh             # Coder environment
└── start-external.sh          # External deployment
```

## Support

For issues with scripts:
1. Check logs for error messages
2. Verify environment variables are set
3. Ensure database connectivity
4. Check file permissions
5. Consult application documentation