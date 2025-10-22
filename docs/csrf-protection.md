# CSRF Protection Implementation

## Overview

Cross-Site Request Forgery (CSRF) protection has been implemented to prevent malicious websites from making unauthorized requests to the OrchePlan API on behalf of authenticated users.

## Backend Implementation

### Configuration
- **Package**: `@dr.pogodin/csurf` (maintained fork of deprecated `csurf`)
- **Cookie Name**: `_csrf`
- **Protection Level**: 
  - **Production**: Full CSRF protection for all state-changing requests (POST, PUT, DELETE, PATCH)
  - **Development**: Disabled by default for easier development

### Backend Features
- CSRF token endpoint: `GET /csrf-token`
- Secure cookie storage with appropriate settings
- Environment-based configuration
- Integration with existing authentication system

### Environment Variables
```bash
# Enable CSRF in development (optional)
NODE_ENV=development

# Production automatically enables CSRF protection
NODE_ENV=production
```

## Frontend Implementation

### Automatic Token Management
- Tokens are automatically fetched and cached
- Invalid tokens trigger automatic retry with fresh token
- Graceful fallback in development mode

### API Integration
- CSRF tokens automatically added to state-changing requests
- Transparent to existing API calls
- Error handling for CSRF failures

### Frontend Configuration
```bash
# Force enable CSRF in development (optional)
NEXT_PUBLIC_ENABLE_CSRF=true
```

## Usage

### Backend Usage
CSRF protection is automatically applied in production. No code changes needed in route handlers.

### Frontend Usage
No changes needed - existing API calls automatically include CSRF tokens when required.

```typescript
// These calls automatically include CSRF tokens in production:
await createProject(projectData);
await updateTask(taskId, updates);
await deleteProject(projectId);
```

### Manual Token Access (if needed)
```typescript
import { getCsrfToken } from '@/lib/csrf';

const token = await getCsrfToken();
// Use token in custom requests
```

## Security Benefits

1. **Prevents CSRF Attacks**: Malicious sites cannot make requests without valid tokens
2. **Secure Cookie Storage**: Tokens stored in httpOnly cookies
3. **Automatic Token Rotation**: Invalid tokens trigger fresh token fetch
4. **Environment Awareness**: Full protection in production, flexible in development

## Testing

### Manual Testing
1. Start backend and frontend
2. In production mode, verify CSRF tokens are required
3. Test token refresh on invalid token scenarios

### CSRF Protection Test
```bash
# This should fail without proper CSRF token in production:
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project"}' \
  --cookie-jar cookies.txt

# This should work after getting token:
curl -X GET http://localhost:3000/csrf-token --cookie-jar cookies.txt
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-previous-call>" \
  -d '{"name":"Test Project"}' \
  --cookie cookies.txt
```

## Troubleshooting

### Common Issues
1. **"Invalid CSRF token" errors**: Usually resolved by token refresh mechanism
2. **Development issues**: CSRF is disabled in development by default
3. **CORS errors**: Ensure `X-CSRF-Token` is in allowed headers

### Debug Mode
Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Disable CSRF (Development Only)
CSRF is automatically disabled in development. To force enable:
```bash
NEXT_PUBLIC_ENABLE_CSRF=true npm run dev
```

## Migration Notes

### Existing Code Compatibility
- ✅ No changes needed to existing API calls
- ✅ Backward compatible with non-CSRF clients in development
- ✅ Automatic token management

### Breaking Changes
- **Production Only**: CSRF protection may break external API clients that don't handle tokens
- **Solution**: External clients need to fetch tokens from `/csrf-token` endpoint

## Security Considerations

### What CSRF Protects Against
- ✅ Malicious websites making unauthorized requests
- ✅ Cross-site form submissions
- ✅ Clickjacking-based attacks

### What CSRF Doesn't Protect Against
- ❌ XSS attacks (use Content Security Policy)
- ❌ SQL injection (use parameterized queries)
- ❌ Authentication bypass (use proper session management)

### Additional Security Measures
Consider implementing alongside CSRF:
- Content Security Policy (CSP)
- SameSite cookies (already configured)
- Input validation and sanitization
- Rate limiting (already implemented)

## Performance Impact

- **Minimal**: Token caching reduces overhead
- **One-time fetch**: Tokens reused across requests
- **Background refresh**: Invalid tokens refreshed automatically
- **No blocking**: Development mode has no CSRF overhead