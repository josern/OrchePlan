# Database Setup for Same-Server Installation

## Overview
When the API and database run on the same server instance, you have several connection options with different security and performance trade-offs.

## Connection Methods

### 1. Unix Socket Connection (Most Secure & Fastest)
```bash
# Uses Unix domain socket - no network layer
DATABASE_URL="postgresql://orcheplan_user:password@/orcheplan_db?host=/var/run/postgresql"
```
**Pros:**
- ✅ Fastest connection (no TCP overhead)
- ✅ Most secure (no network exposure)
- ✅ No SSL overhead needed

**Cons:**
- ⚠️ Only works on same machine
- ⚠️ Requires proper socket permissions

### 2. Localhost TCP (Balanced)
```bash
# Standard localhost connection
DATABASE_URL="postgresql://orcheplan_user:password@localhost:5432/orcheplan_db"

# With SSL preference
DATABASE_URL="postgresql://orcheplan_user:password@localhost:5432/orcheplan_db?sslmode=prefer"
```
**Pros:**
- ✅ Standard connection method
- ✅ Easy to configure
- ✅ Works with all tools

**Cons:**
- ⚠️ Slightly slower than Unix socket
- ⚠️ Uses network stack

### 3. Loopback with SSL (Most Secure TCP)
```bash
# Force SSL even on localhost
DATABASE_URL="postgresql://orcheplan_user:password@127.0.0.1:5432/orcheplan_db?sslmode=require"
```
**Pros:**
- ✅ Encrypted even locally
- ✅ Consistent with remote configs
- ✅ Good for compliance

**Cons:**
- ⚠️ SSL overhead on localhost
- ⚠️ Requires SSL certificates

## Recommended Configuration

### Development
```bash
# Fast and simple
DATABASE_URL="postgresql://orcheplan_user:password@localhost:5432/orcheplan_db"
```

### Production (Same Server)
```bash
# Unix socket for best performance and security
DATABASE_URL="postgresql://orcheplan_user:password@/orcheplan_db?host=/var/run/postgresql"

# Or localhost with SSL preference
DATABASE_URL="postgresql://orcheplan_user:password@localhost:5432/orcheplan_db?sslmode=prefer"
```

## PostgreSQL Configuration

### 1. Create Database User
```sql
-- Connect as postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE orcheplan_db;
CREATE USER orcheplan_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE orcheplan_db TO orcheplan_user;

-- Grant schema permissions
\c orcheplan_db
GRANT ALL ON SCHEMA public TO orcheplan_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO orcheplan_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO orcheplan_user;
```

### 2. Configure PostgreSQL (postgresql.conf)
```bash
# For same-server setup, minimal changes needed
listen_addresses = 'localhost'  # Only listen on localhost
port = 5432

# SSL configuration (optional for localhost)
ssl = on                        # Enable SSL
ssl_cert_file = 'server.crt'    # SSL certificate
ssl_key_file = 'server.key'     # SSL private key

# Performance optimizations for same-server
shared_buffers = 256MB          # Adjust based on RAM
effective_cache_size = 1GB      # Adjust based on RAM
```

### 3. Configure Access (pg_hba.conf)
```bash
# Allow local connections
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# For Unix socket connections
local   orcheplan_db    orcheplan_user                          scram-sha-256

# For localhost TCP connections
host    orcheplan_db    orcheplan_user  127.0.0.1/32           scram-sha-256
host    orcheplan_db    orcheplan_user  ::1/128                scram-sha-256
```

## Security Considerations

### Same-Server Benefits
- ✅ No network exposure of database
- ✅ Simpler firewall configuration
- ✅ Reduced attack surface
- ✅ Better performance

### Best Practices
1. **Use Unix sockets** when possible for best security
2. **Strong passwords** even for localhost connections
3. **Restrict pg_hba.conf** to only needed users/databases
4. **Regular backups** since single point of failure
5. **Monitor resources** since both services share the same server

## Environment Setup Script

Create this as `setup-database.sh`:
```bash
#!/bin/bash
# Setup PostgreSQL for same-server OrchePlan installation

DB_NAME="orcheplan_db"
DB_USER="orcheplan_user"
DB_PASS="$(openssl rand -base64 32)"

echo "Setting up PostgreSQL for OrchePlan..."

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Set permissions
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo "Database setup complete!"
echo "Add this to your .env file:"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
```

## Performance Optimization

For same-server setups, you can optimize PostgreSQL specifically:

```sql
-- Optimize for single-server deployment
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

This configuration prioritizes performance and simplicity while maintaining security appropriate for a same-server deployment.