# CSRF Protection Implementation

## Overview

OrchePlan implements **selective CSRF protection** that ensures critical operations are protected against Cross-Site Request Forgery attacks in all environments, while maintaining developer experience.

## Security Strategy

### Critical Operations Protected (All Environments)
```typescript
const criticalPaths = [
    '/api/auth/',      // Authentication operations (login, signup, password change)
    '/api/admin/',     // Admin operations (user management, system config)
    '/api/users/',     // User management (role changes, profile updates)
    '/api/projects/',  // Project creation/deletion
    '/api/statuses/'   // Status management
];
```

### Protection Levels

#### Development Environment
- ✅ **Critical Operations**: Full CSRF protection
- ⚠️ **Non-Critical Operations**: CSRF bypassed for development ease
- 🔍 **Monitoring**: Logged CSRF protection status

#### Production Environment
- ✅ **All State-Changing Operations**: Full CSRF protection
- ✅ **Critical Operations**: Enhanced protection
- 🔍 **Monitoring**: Complete CSRF audit trail

## Implementation Details

### CSRF Token Configuration
```typescript
{
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 3600000, // 1 hour
    },
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] // Only safe HTTP methods
}
```

### Frontend Integration

#### Getting CSRF Token
```javascript
// Frontend can request CSRF token
fetch('/csrf-token')
    .then(response => response.json())
    .then(data => {
        const csrfToken = data.csrfToken;
        // Include in subsequent requests
    });
```

#### Including CSRF Token in Requests
```javascript
// Header approach
fetch('/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(loginData)
});

// Form field approach (automatic)
// Token automatically included in forms when using CSRF middleware
```

## Security Benefits

### Attack Prevention
- **Cross-Site Request Forgery**: Prevents malicious sites from making unauthorized requests
- **State-Changing Attacks**: Protects user account modifications
- **Admin Operation Protection**: Secures administrative functions
- **Authentication Security**: Protects login/logout operations

### Development Benefits
- **Selective Protection**: Critical operations secured without hindering development
- **Easy Testing**: Non-critical operations can be tested without CSRF complexity
- **Production Parity**: Critical paths behave identically in dev and production

## Testing CSRF Protection

### Manual Testing
```bash
# Test protected endpoint without CSRF token (should fail)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Expected: 403 Forbidden with CSRF error

# Test with valid CSRF token (should succeed)
# 1. Get CSRF token
curl http://localhost:3000/csrf-token

# 2. Use token in request
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-step-1>" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Automated Testing
```javascript
// Test helper for CSRF-protected requests
async function makeProtectedRequest(url, data) {
    // Get CSRF token
    const tokenResponse = await fetch('/csrf-token');
    const { csrfToken } = await tokenResponse.json();
    
    // Make protected request
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify(data)
    });
}
```

## Monitoring and Logging

The system logs CSRF protection status and attempts:

```typescript
// Successful CSRF validation
logger.info('CSRF token validated', {
    component: 'csrf',
    path: req.path,
    method: req.method,
    correlationId: req.correlationId
});

// CSRF validation failure
logger.warn('CSRF validation failed', {
    component: 'csrf',
    path: req.path,
    method: req.method,
    error: 'Invalid CSRF token',
    correlationId: req.correlationId
});
```

## Security Considerations

### Token Management
- **Expiration**: Tokens expire after 1 hour
- **Regeneration**: New tokens generated per session
- **Storage**: Secure HTTP-only cookies
- **Transmission**: HTTPS in production

### Attack Scenarios Prevented
1. **Malicious Website CSRF**: External sites cannot forge requests
2. **XSS-Enhanced CSRF**: Even with XSS, CSRF tokens provide additional protection
3. **State Manipulation**: Unauthorized changes to user accounts/projects prevented
4. **Admin Privilege Escalation**: Admin operations require valid CSRF tokens

## Best Practices

### Frontend Development
1. Always request CSRF token before state-changing operations
2. Include CSRF token in all protected API calls
3. Handle CSRF errors gracefully (refresh token on 403)
4. Store tokens securely (avoid localStorage for sensitive tokens)

### Backend Development
1. Apply CSRF protection to all state-changing operations
2. Use secure cookie configurations
3. Implement proper error handling for CSRF failures
4. Log CSRF events for security monitoring

## Compliance Benefits

This CSRF implementation helps meet security standards:
- **OWASP Top 10**: Addresses A01:2021 – Broken Access Control
- **NIST Cybersecurity Framework**: Implements access control measures
- **ISO 27001**: Supports information security management
- **SOC 2**: Demonstrates security control implementation

## Troubleshooting

### Common Issues
1. **403 CSRF Error**: Token missing or invalid
   - Solution: Ensure frontend requests CSRF token
   
2. **Token Expiration**: Tokens expire after 1 hour
   - Solution: Implement token refresh logic
   
3. **SameSite Issues**: Cookie not sent cross-site
   - Solution: Configure SameSite settings properly

### Debug Mode
Enable debug logging to troubleshoot CSRF issues:
```bash
DEBUG=csrf npm run dev
```

This comprehensive CSRF protection ensures OrchePlan is secure against cross-site request forgery attacks while maintaining developer productivity.