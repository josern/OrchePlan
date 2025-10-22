# OrchePlan - Production Ready Local Server Deployment

OrchePlan is now fully configured for production deployment on a single server running all components locally (frontend, backend, and database).

## 🎯 **Deployment Overview**

This setup deploys all components on the same server:
- **Frontend**: Next.js application (port 3000)
- **Backend**: Node.js/Express API (port 3001) 
- **Database**: PostgreSQL (local instance)
- **Reverse Proxy**: Nginx (port 80/443)
- **Process Management**: PM2 with clustering
- **SSL**: Let's Encrypt certificates

## 🚀 **Quick Start Deployment**

### Prerequisites
- Ubuntu/Debian server (18.04+ recommended)
- Root/sudo access
- Domain name pointed to your server
- Minimum 2GB RAM, 20GB storage

### Automated Deployment
```bash
# Clone repository
git clone https://github.com/josern/OrchePlan.git
cd OrchePlan

# Run automated deployment
bash scripts/deploy-production.sh
```

The script will:
1. Install Node.js 18.x, PostgreSQL, Nginx, PM2
2. Create application user and directories
3. Build and install the application
4. Configure database and environment files
5. Setup nginx reverse proxy
6. Start services with PM2
7. Configure SSL certificates

## 📋 **Manual Configuration Steps**

After deployment, you'll need to:

### 1. Configure Environment Variables

**Backend** (`/opt/orcheplan/current/backend/.env.production`):
```bash
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://orcheplan:your_secure_password@localhost:5432/orcheplan

# Security
JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
SESSION_SECRET=your-super-secure-session-secret-min-32-chars

# CORS
FRONTEND_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Auth & Security
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=strict

# Performance
NODE_OPTIONS=--max-old-space-size=2048

# Logging
LOG_LEVEL=warn
LOG_TO_FILE=true
```

**Frontend** (`/opt/orcheplan/current/frontend/.env.production`):
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
```

### 2. Update Domain in Nginx

Edit `/etc/nginx/sites-available/orcheplan`:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

### 3. Configure SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 4. Restart Services
```bash
sudo -u orcheplan pm2 restart all
sudo systemctl reload nginx
```

## 🔧 **Production Architecture**

```
Internet → Nginx (80/443) → PM2 Cluster → Node.js Apps
                         ↓
                   PostgreSQL Database
```

- **Nginx**: SSL termination, reverse proxy, static file serving, rate limiting
- **PM2**: Process management, clustering, auto-restart, log rotation
- **Backend**: Express.js API with security middleware
- **Frontend**: Next.js with static generation and server-side rendering
- **Database**: PostgreSQL with connection pooling

## 🛡️ **Security Features**

- ✅ **SSL/TLS encryption** (Let's Encrypt)
- ✅ **Security headers** (HSTS, CSP, X-Frame-Options)
- ✅ **Rate limiting** (API and authentication endpoints)
- ✅ **CSRF protection** with secure tokens
- ✅ **Input validation** and sanitization
- ✅ **Account lockout** after failed attempts
- ✅ **Secure cookies** (HttpOnly, Secure, SameSite)
- ✅ **SQL injection prevention** (Prisma ORM)
- ✅ **XSS protection** with Content Security Policy

## 📊 **Monitoring & Maintenance**

### View Application Status
```bash
# PM2 process status
sudo -u orcheplan pm2 status

# View logs
sudo -u orcheplan pm2 logs

# Nginx status
sudo systemctl status nginx

# Database status
sudo systemctl status postgresql
```

### Health Checks
```bash
# Application health endpoints
curl -f https://yourdomain.com/api/health
curl -f https://yourdomain.com/health

# Check SSL certificate
curl -I https://yourdomain.com
```

### Log Monitoring
```bash
# Application logs
sudo -u orcheplan pm2 logs --lines 100

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# System logs
sudo journalctl -u nginx -f
```

## 🔄 **Updates & Deployments**

### Update Application
```bash
# Backup current deployment
sudo -u orcheplan cp -r /opt/orcheplan/current /opt/orcheplan/backup-$(date +%Y%m%d)

# Deploy new version
cd /path/to/new/OrchePlan
sudo -u orcheplan cp -r * /opt/orcheplan/current/
cd /opt/orcheplan/current
sudo -u orcheplan npm install --production
sudo -u orcheplan npm run build

# Restart services
sudo -u orcheplan pm2 restart all
```

### Database Migrations
```bash
cd /opt/orcheplan/current/backend
sudo -u orcheplan npm run migrate:deploy
```

## 🛠️ **Troubleshooting**

### Common Issues

**Services not starting:**
```bash
# Check PM2 status
sudo -u orcheplan pm2 status
sudo -u orcheplan pm2 restart all

# Check logs for errors
sudo -u orcheplan pm2 logs --err
```

**Database connection issues:**
```bash
# Test database connection
sudo -u postgres psql -c "SELECT version();"
sudo -u orcheplan psql $DATABASE_URL -c "SELECT 1;"
```

**SSL certificate issues:**
```bash
# Renew certificates
sudo certbot renew --dry-run
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

**High memory usage:**
```bash
# Monitor memory usage
sudo -u orcheplan pm2 monit

# Restart if needed
sudo -u orcheplan pm2 restart all
```

### Performance Optimization

**Database optimization:**
```sql
-- Run as postgres user
VACUUM ANALYZE;
REINDEX DATABASE orcheplan;
```

**PM2 optimization:**
```bash
# Optimize PM2 cluster size
sudo -u orcheplan pm2 scale orcheplan-backend 4
```

## 📈 **Scaling Considerations**

For high-traffic deployments, consider:

1. **Database scaling**: Read replicas, connection pooling
2. **Application scaling**: Multiple server instances with load balancer
3. **CDN**: Static asset delivery
4. **Caching**: Redis for session storage and caching
5. **Monitoring**: Prometheus + Grafana for metrics

## 🔐 **Backup Strategy**

### Automated Backups
The deployment includes automated backup scripts:

```bash
# Database backup (runs daily via cron)
/opt/orcheplan/scripts/backup-database.sh

# Application backup
/opt/orcheplan/scripts/backup-application.sh
```

### Manual Backup
```bash
# Database backup
sudo -u postgres pg_dump orcheplan > backup-$(date +%Y%m%d).sql

# Application files backup
sudo tar -czf orcheplan-backup-$(date +%Y%m%d).tar.gz /opt/orcheplan/current
```

## 📞 **Support**

- **Logs**: Check PM2 and Nginx logs for errors
- **Health checks**: Monitor `/api/health` endpoint
- **Performance**: Use PM2 monitoring (`pm2 monit`)
- **Security**: Run security audit script (`bash scripts/security-audit.sh`)

---

## 🎉 **Deployment Complete!**

Your OrchePlan application is now running in production with:
- ✅ High availability with PM2 clustering
- ✅ SSL encryption and security headers
- ✅ Automated backups and monitoring
- ✅ Production-optimized configuration
- ✅ Zero-downtime deployment capability

**Access your application at:** https://yourdomain.com

For ongoing maintenance, monitor the logs and health endpoints regularly.