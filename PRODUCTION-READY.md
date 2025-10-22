# OrchePlan - Production Ready Local Server Deployment

OrchePlan is now fully configured for production deployment on a single server running all components locally (frontend, backend, and database).

## 🎯 **Deployment Overview**

This setup deploys all components on the same server:
- **Frontend**: Next.js application (port 3000)
- **Backend**: Node.js/Express API (port 3001) 
- **Database**: PostgreSQL (local instance)
- **Process Management**: PM2 with clustering

## 🚀 **Quick Start Deployment**

### Prerequisites
- Ubuntu/Debian server (18.04+ recommended)
- Root/sudo access
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
1. Install Node.js 18.x, PostgreSQL, PM2
2. Create application user and directories
3. Build and install the application
4. Configure database and environment files
5. Start services with PM2
6. Setup automated backups and monitoring

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
FRONTEND_ORIGINS=http://your-server-ip:3000

# Auth & Security
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax

# Performance
NODE_OPTIONS=--max-old-space-size=2048

# Logging
LOG_LEVEL=warn
LOG_TO_FILE=true
```

**Frontend** (`/opt/orcheplan/current/frontend/.env.production`):
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://your-server-ip:3001
```

### 2. Restart Services
```bash
sudo -u orcheplan pm2 restart all
```

## 🔧 **Production Architecture**

```
Internet → PM2 Cluster → Node.js Apps
                    ↓
              PostgreSQL Database
```

- **PM2**: Process management, clustering, auto-restart, log rotation
- **Backend**: Express.js API with security middleware (port 3001)
- **Frontend**: Next.js with static generation and server-side rendering (port 3000)
- **Database**: PostgreSQL with connection pooling

## 🛡️ **Security Features**

- ✅ **Security headers** (HSTS, CSP, X-Frame-Options)
- ✅ **Rate limiting** (API and authentication endpoints)
- ✅ **CSRF protection** with secure tokens
- ✅ **Input validation** and sanitization
- ✅ **Account lockout** after failed attempts
- ✅ **SQL injection prevention** (Prisma ORM)
- ✅ **XSS protection** with Content Security Policy

**Note**: For production environments with public access, consider adding a reverse proxy (nginx/Apache) for SSL termination and additional security features.

## 📊 **Monitoring & Maintenance**

### View Application Status
```bash
# PM2 process status
sudo -u orcheplan pm2 status

# View logs
sudo -u orcheplan pm2 logs

# Database status
sudo systemctl status postgresql
```

### Health Checks
```bash
# Application health endpoints
curl -f http://your-server-ip:3001/api/health
curl -f http://your-server-ip:3000/health
```

### Log Monitoring
```bash
# Application logs
sudo -u orcheplan pm2 logs --lines 100

# System logs
sudo journalctl -u postgresql -f
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

1. **Reverse Proxy**: Add nginx/Apache for SSL, caching, and load balancing
2. **Database scaling**: Read replicas, connection pooling
3. **Application scaling**: Multiple server instances with load balancer
4. **CDN**: Static asset delivery
5. **Caching**: Redis for session storage and caching
6. **Monitoring**: Prometheus + Grafana for metrics

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
- ✅ Production-optimized configuration
- ✅ Automated backups and monitoring
- ✅ Zero-downtime deployment capability
- ✅ Security middleware and protection

**Access your application at:** 
- Frontend: http://your-server-ip:3000
- Backend API: http://your-server-ip:3001

For ongoing maintenance, monitor the logs and health endpoints regularly.

**Security Note**: This configuration runs applications directly without SSL. For production environments accessible from the internet, consider adding a reverse proxy (nginx/Apache) with SSL certificates for enhanced security.