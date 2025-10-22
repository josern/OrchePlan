# Environment Configuration Guide

This guide explains all environment variables used in OrchePlan backend and how to configure them for different deployment scenarios.

## Quick Setup

### Development
```bash
cp .env.development.example .env
# Edit .env with your local database credentials
```

### Production
```bash
cp .env.production.example .env.production
# Edit .env.production with your production values
```

## Environment Variables Reference

### Core Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `development`, `production` |
| `PORT` | No | Server port | `3001` (default: 3000) |
| `HOST` | No | Server host | `0.0.0.0` (default: localhost) |

### Database Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/orcheplan` |
| `SHADOW_DATABASE_URL` | Migration only | Prisma shadow database | `postgresql://user:pass@localhost:5432/shadow` |

### Security Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `JWT_SECRET` | Yes | JWT signing secret (32+ chars) | `your-super-secure-secret-key` |
| `BCRYPT_ROUNDS` | No | Password hashing rounds | `12` (default: 10) |

### CORS Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `FRONTEND_ORIGINS` | Production | Allowed frontend URLs (comma-separated) | `https://orcheplan.com,https://www.orcheplan.com` |

### Cookie Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AUTH_COOKIE_DOMAIN` | Production | Cookie domain for subdomain sharing | `.orcheplan.com` |
| `AUTH_COOKIE_SECURE` | No | Use secure cookies (HTTPS only) | `true` (auto-detected) |
| `AUTH_COOKIE_SAMESITE` | No | SameSite cookie policy | `none`, `lax`, `strict` |

### Logging Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `LOG_LEVEL` | No | Logging level | `debug`, `info`, `warn`, `error` |
| `LOG_CONSOLE` | No | Enable console logging | `true`, `false` |
| `LOG_FILE` | No | Enable file logging | `true`, `false` |
| `LOG_DIR` | No | Log file directory | `./logs` |

## Deployment Scenarios

### Local Development (localhost)

```bash
# .env
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/orcheplan_dev
JWT_SECRET=dev-secret
FRONTEND_ORIGINS=http://localhost:3000
# No AUTH_COOKIE_DOMAIN needed for localhost
```

### Production with Subdomains

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/orcheplan_prod
JWT_SECRET=your-production-secret
FRONTEND_ORIGINS=https://orcheplan.com,https://www.orcheplan.com
AUTH_COOKIE_DOMAIN=.orcheplan.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none
```

### Staging Environment

```bash
# .env.staging
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@staging-db:5432/orcheplan_staging
JWT_SECRET=staging-secret
FRONTEND_ORIGINS=https://staging.orcheplan.com
AUTH_COOKIE_DOMAIN=.orcheplan.com
```

## Cookie Domain Configuration

### Why Cookie Domain Matters

When your frontend (`https://orcheplan.com`) and API (`https://api.orcheplan.com`) are on different subdomains, browsers won't share cookies by default.

### Solutions

| Scenario | AUTH_COOKIE_DOMAIN | Result |
|----------|-------------------|---------|
| Same domain | Not set | Cookies work normally |
| Subdomains | `.orcheplan.com` | Cookies shared across all subdomains |
| Different domains | Not possible | Need alternative auth (tokens) |

### Examples

```bash
# ✅ Shares cookies between orcheplan.com and api.orcheplan.com
AUTH_COOKIE_DOMAIN=.orcheplan.com

# ❌ Only works on exact domain
AUTH_COOKIE_DOMAIN=orcheplan.com

# ✅ Works for localhost development
# AUTH_COOKIE_DOMAIN=   # Leave empty
```

## Security Best Practices

### Production Checklist

- [ ] Use strong, unique `JWT_SECRET` (32+ random characters)
- [ ] Set `AUTH_COOKIE_SECURE=true` for HTTPS
- [ ] Configure `FRONTEND_ORIGINS` with exact URLs
- [ ] Use `.yourdomain.com` format for `AUTH_COOKIE_DOMAIN`
- [ ] Set appropriate `LOG_LEVEL` (warn/error for production)
- [ ] Use environment-specific database credentials
- [ ] Enable SSL for database connections

### Development vs Production

| Setting | Development | Production |
|---------|-------------|------------|
| `NODE_ENV` | `development` | `production` |
| `JWT_SECRET` | Simple string | Strong random key |
| `AUTH_COOKIE_SECURE` | `false` | `true` |
| `LOG_LEVEL` | `debug` | `warn` |
| `FRONTEND_ORIGINS` | `http://localhost:*` | `https://yourdomain.com` |

## Troubleshooting

### Common Issues

**"Not allowed by CORS"**
- Check `FRONTEND_ORIGINS` includes your frontend URL
- Ensure no trailing slashes in URLs

**"Authentication required" on API calls**
- Verify `AUTH_COOKIE_DOMAIN` is set correctly
- Check if cookies are being sent (browser dev tools)
- Confirm `AUTH_COOKIE_SECURE` matches your HTTPS setup

**Database connection errors**
- Verify `DATABASE_URL` format and credentials
- Check if database server is running and accessible
- Ensure SSL settings match your database configuration