# Database Encryption Configuration

## SSL/TLS Encryption Options

### Development (Local)
```bash
# Basic SSL (required for production)
DATABASE_URL="postgresql://username:password@hostname:5432/database?sslmode=require"

# Verify CA certificate
DATABASE_URL="postgresql://username:password@hostname:5432/database?sslmode=verify-ca&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=ca-cert.pem"

# Full verification (recommended for production)
DATABASE_URL="postgresql://username:password@hostname:5432/database?sslmode=verify-full&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=ca-cert.pem"
```

### Production (Cloud)
```bash
# AWS RDS with SSL
DATABASE_URL="postgresql://username:password@rds-endpoint.region.rds.amazonaws.com:5432/database?sslmode=require"

# Google Cloud SQL with SSL
DATABASE_URL="postgresql://username:password@cloud-sql-ip:5432/database?sslmode=require&sslcert=client-cert.pem&sslkey=client-key.pem&sslrootcert=server-ca.pem"

# Digital Ocean with SSL
DATABASE_URL="postgresql://username:password@hostname:25060/database?sslmode=require"

# Heroku (SSL automatic)
DATABASE_URL="postgresql://username:password@hostname:5432/database?sslmode=require"
```

### Connection Pool with SSL
```bash
# Primary connection with SSL
DATABASE_URL="postgresql://username:password@hostname:5432/database?sslmode=require&connection_limit=20&pool_timeout=10"

# Direct URL for migrations (no connection pooling)
DIRECT_URL="postgresql://username:password@hostname:5432/database?sslmode=require"
```

## SSL Mode Options

| Mode | Description | Security Level |
|------|-------------|----------------|
| `disable` | No SSL encryption | ❌ Not recommended |
| `allow` | Try SSL, fallback to non-SSL | ⚠️ Development only |
| `prefer` | Prefer SSL, fallback to non-SSL | ⚠️ Development only |
| `require` | Require SSL, no cert verification | ✅ Good for most cases |
| `verify-ca` | Require SSL + verify CA cert | ✅ Better security |
| `verify-full` | Require SSL + verify hostname | ✅ Maximum security |

## Certificate Files

For full SSL verification, you'll need:
- `client-cert.pem` - Client certificate
- `client-key.pem` - Client private key  
- `ca-cert.pem` or `server-ca.pem` - Certificate Authority certificate

Store these in a secure location, typically:
- `/app/certs/` (in Docker)
- `/etc/ssl/certs/` (on server)
- Environment variables (for cloud deployments)