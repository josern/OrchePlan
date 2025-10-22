# OrchePlan Production Deployment Guide

This guide will help you deploy OrchePlan to production with optimal security and performance.

## Prerequisites

- **Server Requirements:**
  - Linux server (Ubuntu 20.04+ or CentOS 7+)
  - 2+ CPU cores
  - 4GB+ RAM
  - 20GB+ disk space
  - PostgreSQL 12+ database
  - Node.js 18+ and npm
  - Docker & Docker Compose (optional)

- **Security Requirements:**
  - SSL/TLS certificate for HTTPS
  - Firewall configured (ports 80, 443 open)
  - Strong passwords and secrets
  - Regular security updates

## Quick Start (Docker)

1. **Clone and prepare:**
   ```bash
   git clone <your-repo>
   cd OrchePlan
   ```

2. **Configure environment:**
   ```bash
   # Backend configuration
   cp backend/.env.production.example backend/.env.production
   # Edit backend/.env.production with your values

   # Frontend configuration  
   cp frontend/.env.production.example frontend/.env.production
   # Edit frontend/.env.production with your values
   ```

3. **Generate secrets:**
   ```bash
   # Generate JWT secret (at least 32 characters)
   openssl rand -base64 32

   # Generate database password
   openssl rand -base64 16
   ```

4. **Setup SSL certificates:**
   ```bash
   mkdir -p nginx/ssl
   # Copy your SSL certificate and key to nginx/ssl/
   # cert.pem and private.key
   ```

5. **Deploy with Docker:**
   ```bash
   npm run docker:build
   npm run docker:up
   ```

6. **Initialize database:**
   ```bash
   docker exec orcheplan-backend npx prisma migrate deploy
   docker exec orcheplan-backend npm run create-superuser
   ```

## Manual Deployment

### 1. Environment Setup

```bash
# Install dependencies
sudo apt update
sudo apt install -y nodejs npm postgresql-client nginx

# Install PM2 for process management
npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash orcheplan
sudo usermod -aG sudo orcheplan
```

### 2. Application Setup

```bash
# Clone repository
sudo -u orcheplan git clone <your-repo> /home/orcheplan/app
cd /home/orcheplan/app

# Install dependencies and build
npm install
npm run build

# Setup environment files
cp backend/.env.production.example backend/.env.production
cp frontend/.env.production.example frontend/.env.production
# Edit with your configuration
```

### 3. Database Setup

```bash
# Run migrations
cd backend
npm run prisma:migrate:deploy

# Create superuser
npm run create-superuser
```

### 4. Process Management

```bash
# Start with PM2
pm2 start ecosystem.config.json
pm2 save
pm2 startup
```

### 5. Nginx Configuration

```bash
# Copy nginx configuration
sudo cp nginx/nginx.conf /etc/nginx/sites-available/orcheplan
sudo ln -s /etc/nginx/sites-available/orcheplan /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Security Configuration

### 1. Database Security

- Use strong, unique passwords
- Enable SSL connections
- Restrict database access to application server only
- Regular backups with encryption

### 2. Application Security

- Set strong JWT_SECRET (32+ characters)
- Enable HTTPS only
- Configure CORS properly
- Set secure cookie flags
- Enable rate limiting

### 3. Server Security

- Enable firewall (ufw/iptables)
- Regular security updates
- Disable unnecessary services
- Use fail2ban for intrusion prevention
- Monitor logs regularly

### 4. SSL/TLS Configuration

- Use strong cipher suites
- Enable HSTS headers
- Regular certificate renewal
- Disable older TLS versions

## Environment Variables Reference

### Backend (.env.production)

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
JWT_SECRET=your-strong-secret-here
FRONTEND_ORIGINS=https://yourdomain.com
AUTH_COOKIE_SECURE=true
LOG_LEVEL=warn
PORT=3000
```

### Frontend (.env.production)

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_TELEMETRY_DISABLED=1
```

## Monitoring & Maintenance

### 1. Health Checks

```bash
# Run health check
bash scripts/health-check.sh

# Setup cron job for monitoring
echo "*/5 * * * * /path/to/health-check.sh" | crontab -
```

### 2. Backup Setup

```bash
# Setup automated backups
echo "0 2 * * * /path/to/backup-database.sh" | crontab -
```

### 3. Log Management

```bash
# Setup log rotation
sudo cp config/logrotate.conf /etc/logrotate.d/orcheplan
```

### 4. Updates

```bash
# Update application
git pull
npm install
npm run build
pm2 restart all
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_URL format
   - Verify database server is running
   - Check firewall rules

2. **SSL Certificate Issues**
   - Verify certificate files exist
   - Check certificate expiration
   - Validate domain name matches

3. **Application Won't Start**
   - Check PM2 logs: `pm2 logs`
   - Verify environment variables
   - Check port availability

4. **High Memory Usage**
   - Monitor with: `pm2 monit`
   - Adjust PM2 configuration
   - Check for memory leaks

### Getting Help

- Check application logs in `/var/log/orcheplan/`
- Review PM2 logs: `pm2 logs`
- Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Run health check: `bash scripts/health-check.sh`

## Performance Optimization

1. **Database Optimization**
   - Add appropriate indexes
   - Regular VACUUM and ANALYZE
   - Monitor query performance

2. **Application Optimization**
   - Enable gzip compression
   - Optimize static file serving
   - Use CDN for assets

3. **Caching**
   - Enable Redis for session storage
   - Cache static assets
   - Database query caching

## Security Checklist

- [ ] Strong JWT secret configured
- [ ] Database uses SSL/TLS
- [ ] HTTPS enabled with valid certificate
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Firewall rules in place
- [ ] Regular security updates
- [ ] Backup system tested
- [ ] Monitoring configured
- [ ] Log rotation setup
- [ ] Intrusion detection enabled