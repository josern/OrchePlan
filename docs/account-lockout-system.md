# Account Lockout System Documentation

## Overview

The Account Lockout System provides automated protection against brute force attacks by temporarily locking user accounts after multiple failed login attempts. It includes both automatic time-based unlocking and manual administrative controls.

## Features

- **Automatic Lockout**: Accounts are locked after 5 failed login attempts
- **Time-based Unlock**: Locked accounts automatically unlock after 15 minutes
- **Manual Controls**: Administrators can manually lock/unlock accounts
- **Failed Attempt Tracking**: Records IP addresses and user agents for security monitoring
- **Statistics**: Provides lockout statistics for monitoring
- **Cleanup**: Automated cleanup of expired locks

## Configuration

The lockout system uses the following default configuration (defined in `AccountLockoutService`):

```typescript
const LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,        // Lock after 5 failed attempts
  lockoutDurationMs: 15 * 60 * 1000,  // 15 minutes lockout
  cleanupIntervalMs: 60 * 60 * 1000   // 1 hour cleanup interval
};
```

## Database Schema

The system adds the following fields to the User model:

```sql
failedLoginAttempts  Int       @default(0)
lastFailedAttempt    DateTime?
lockedUntil          DateTime?
lockoutReason        String?
isManuallyLocked     Boolean   @default(false)
```

## API Endpoints

### Authentication Integration

The lockout system is integrated into the following auth endpoints:

- `POST /auth/login` - Checks lockout status and records failed attempts
- `POST /auth/change-password` - Checks lockout status for password changes

### Administrative Endpoints

All admin endpoints require authentication and admin privileges:

#### Get Lockout Statistics
```
GET /admin/lockouts
```

Returns overall lockout statistics including total locked accounts, auto-locked vs manually locked accounts.

#### Check Account Status
```
GET /admin/lockouts/:email
```

Check the lockout status of a specific account by email.

#### Unlock Account
```
POST /admin/lockouts/:email/unlock
Content-Type: application/json

{
  "reason": "Administrative unlock - user verified"
}
```

Manually unlock a locked account with a reason for audit purposes.

#### Lock Account
```
POST /admin/lockouts/:email/lock
Content-Type: application/json

{
  "reason": "Suspicious activity detected",
  "duration": 60  // Optional: duration in minutes
}
```

Manually lock an account. If no duration is specified, the lock is indefinite until manually unlocked.

#### List Locked Accounts
```
GET /admin/lockouts/locked-accounts
```

Returns a list of all currently locked accounts with their lockout details.

#### Cleanup Expired Locks
```
POST /admin/lockouts/cleanup
```

Manually trigger cleanup of expired locks (normally done automatically).

## Response Codes

### Authentication Endpoints

- `423 Locked` - Account is locked due to failed attempts or manual lock
- `401 Unauthorized` - Invalid credentials (also triggers failed attempt recording)

### Admin Endpoints

- `200 OK` - Operation successful
- `400 Bad Request` - Invalid input parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Admin privileges required
- `404 Not Found` - Account not found
- `500 Internal Server Error` - System error

## Security Features

### Brute Force Protection

1. **Progressive Lockout**: Account locks after 5 failed attempts
2. **Time-based Recovery**: Automatic unlock after 15 minutes
3. **IP Tracking**: Records IP addresses for monitoring
4. **User Agent Logging**: Tracks user agents for forensic analysis

### Audit Logging

All lockout events are logged with:
- Timestamp
- User email
- Action performed
- IP address (for failed attempts)
- Admin email (for manual actions)
- Reason (for manual locks/unlocks)

### Administrative Controls

1. **Manual Override**: Admins can unlock accounts immediately
2. **Preventive Locking**: Admins can manually lock suspicious accounts
3. **Audit Trail**: All manual actions are logged with reasons
4. **Statistics Monitoring**: Real-time lockout statistics

## Automated Maintenance

### Cleanup Script

The system includes an automated cleanup script that can be run via cron:

```bash
# Run every hour to clean up expired locks
0 * * * * /path/to/backend/scripts/cleanup-lockouts.sh
```

### Manual Cleanup

You can also run cleanup manually:

```bash
cd /path/to/backend
npx ts-node scripts/cleanup_lockouts.ts
```

## Testing

A comprehensive test script is available to verify all functionality:

```bash
cd /path/to/backend
npx ts-node scripts/test_account_lockout.ts
```

This test verifies:
- Initial account status
- Failed attempt recording and automatic lockout
- Manual unlock functionality
- Manual lock functionality
- Successful login clearing failed attempts
- Statistics retrieval
- Cleanup functionality

## Integration Notes

### Frontend Integration

When implementing frontend login, handle the `423 Locked` response appropriately:

```typescript
if (response.status === 423) {
  const data = await response.json();
  showError(`Account is locked. ${data.reason}. Unlocks at: ${new Date(data.lockedUntil).toLocaleString()}`);
}
```

### Rate Limiting Coordination

The account lockout system works alongside rate limiting middleware. Consider:
- Rate limiting prevents rapid requests from the same IP
- Account lockout prevents attacks across multiple IPs on the same account
- Both systems log events for security monitoring

### Session Management

- Locked accounts cannot create new sessions
- Existing sessions remain valid during lockout
- Password changes are blocked for locked accounts

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Lockout Rate**: Number of accounts locked per hour/day
2. **Failed Attempt Patterns**: Spikes in failed attempts
3. **Manual Interventions**: Frequency of admin lock/unlock actions
4. **IP Patterns**: Multiple accounts targeted from same IP

### Log Analysis

Search for these log patterns:
- `Account locked due to failed attempts` - Automatic lockouts
- `Account manually locked` - Administrative actions
- `Account manually unlocked` - Administrative actions
- `Failed login attempt recorded` - Individual failed attempts

### Recommended Alerts

1. **High Lockout Rate**: More than X accounts locked in Y minutes
2. **Repeated Manual Actions**: Frequent admin interventions
3. **Pattern Detection**: Same IP targeting multiple accounts
4. **System Errors**: Lockout service failures

## Troubleshooting

### Common Issues

1. **Account Won't Unlock**: Check `isManuallyLocked` field
2. **Statistics Incorrect**: Run cleanup to remove expired locks
3. **Performance Issues**: Consider indexing lockout-related fields

### Emergency Procedures

To emergency unlock all accounts:

```sql
UPDATE "User" SET 
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "lockoutReason" = NULL,
  "isManuallyLocked" = false
WHERE "isManuallyLocked" = true OR "lockedUntil" > NOW();
```

### Debug Commands

```bash
# Check locked accounts
npx prisma studio  # Browse User table

# View recent logs
tail -f logs/app.log | grep "account-lockout"

# Test specific account
curl -X GET "http://localhost:3000/admin/lockouts/user@example.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
```