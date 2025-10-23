# OrchePlan - Production Ready Local Deployment

OrchePlan is configured for production deployment running in the user's checkout folder on a single server with all components (frontend, backend, database, and nginx) running locally.

## 🎯 **Deployment Overview**

This setup deploys all components on the same server from the checkout directory:
- **Frontend**: Next.js application (port 3000)
- **Backend**: Node.js/Express API (port 3001) 
- **Database**: PostgreSQL (local instance)
- **Reverse Proxy**: Nginx with SSL
- **Process Management**: PM2 with clustering
- **Domain**: orcheplan.com with api.orcheplan.com subdomain

## 🚀 **Quick Start Deployment**

### Prerequisites
- Ubuntu/Debian/CentOS server with root access
- Domain configured: `orcheplan.com` and `api.orcheplan.com` pointing to server
- Minimum 2GB RAM, 20GB storage

### 1. Clone and Setup Repository
```bash
# Clone to user directory (e.g. /home/user/OrchePlan)
git clone https://github.com/josern/OrchePlan.git
cd OrchePlan

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Install System Dependencies
```bash
# Install Node.js 25.x
curl -fsSL https://deb.nodesource.com/setup_25.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx

# Install Certbot for SSL
sudo apt-get install -y certbot python3-certbot-nginx
```

### 3. Configure Database
```bash
# Switch to postgres user and create database
sudo -u postgres psql << EOF
CREATE USER orcheplan WITH PASSWORD 'your_secure_password';
CREATE DATABASE orcheplan OWNER orcheplan;
GRANT ALL PRIVILEGES ON DATABASE orcheplan TO orcheplan;
\q
EOF

# Create environment file with database URL
echo "DATABASE_URL=postgresql://orcheplan:your_secure_password@localhost:5432/orcheplan" > backend/.env.production
```

### 4. Configure Environment Files

**Backend** (`backend/.env.production`):
```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://orcheplan:your_secure_password@localhost:5432/orcheplan
SHADOW_DATABASE_URL=postgresql://orcheplan:your_secure_password@localhost:5432/orcheplan_shadow

# Security
JWT_SECRET=your-super-secure-jwt-secret-here-32-characters-minimum

# CORS Configuration
FRONTEND_ORIGINS=https://orcheplan.com,https://www.orcheplan.com

# Cookie Configuration for subdomain sharing
AUTH_COOKIE_DOMAIN=.orcheplan.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=none

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
LOG_FILE=true
LOG_DIR=./logs
```

**Frontend** (`frontend/.env.production`):
```bash
NODE_ENV=production

# API Configuration
NEXT_PUBLIC_API_BASE=https://api.orcheplan.com
NEXT_PUBLIC_BACKEND_URL=https://api.orcheplan.com

# Application Configuration
NEXT_PUBLIC_APP_NAME=OrchePlan
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_APP_URL=https://orcheplan.com
```

### 5. Build Applications
```bash
# Build backend
cd backend
npm run build
npx prisma migrate deploy
npx prisma generate

# Build frontend
cd ../frontend
npm run build:production

# Return to root
cd ..
```

### 6. Configure Nginx
```bash
# Copy vhost configuration
sudo cp nginx/orcheplan.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/orcheplan.conf /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Obtain SSL Certificates
```bash
# Get Let's Encrypt certificates for both domains
sudo certbot --nginx -d orcheplan.com -d www.orcheplan.com -d api.orcheplan.com

# Enable auto-renewal
sudo systemctl enable certbot.timer
```

### 8. Create PM2 Ecosystem File
Create `ecosystem.config.js` in the project root:
```javascript
module.exports = {
  apps: [
    {
      name: 'orcheplan-backend',
      cwd: './backend',
      script: 'dist/src/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env_file: '.env.production',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'orcheplan-frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
};
```

### 9. Start Services
```bash
# Create log directories
mkdir -p backend/logs frontend/logs

# Start PM2 services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions to run the generated command with sudo
```

## 🔧 **Directory Structure**

Your production deployment structure:
```
/home/user/OrchePlan/
├── backend/
│   ├── dist/                 # Compiled TypeScript
│   ├── logs/                 # Application logs
│   ├── .env.production       # Backend environment
│   └── package.json
├── frontend/
│   ├── .next/                # Next.js build output
│   ├── logs/                 # Frontend logs
│   ├── .env.production       # Frontend environment
│   └── package.json
├── nginx/
│   └── orcheplan.conf        # Nginx vhost configuration
├── ecosystem.config.js       # PM2 configuration
└── scripts/                  # Deployment scripts
```

## 📋 **Management Commands**

### PM2 Process Management
```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Stop services
pm2 stop all

# Monitor performance
pm2 monit
```

### Application Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild backend
cd backend
npm install
npm run build
npx prisma migrate deploy

# Rebuild frontend
cd ../frontend
npm install
npm run build:production

# Restart services
cd ..
pm2 restart all
```

### Database Management
```bash
# Create backup
pg_dump -h localhost -U orcheplan orcheplan > backup-$(date +%Y%m%d).sql

# Restore backup
psql -h localhost -U orcheplan orcheplan < backup-file.sql

# Run migrations
cd backend
npx prisma migrate deploy
```

## 🔐 **Security Configuration**

### Firewall Setup
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443

# Block direct access to application ports
sudo ufw deny 3000
sudo ufw deny 3001
```

### File Permissions
```bash
# Set proper permissions for application files
chmod 755 backend/dist/
chmod 644 backend/.env.production
chmod 644 frontend/.env.production
chown -R $USER:$USER /home/$USER/OrchePlan
```

## 📊 **Monitoring and Maintenance**

### Health Checks
```bash
# Check frontend
curl -I https://orcheplan.com

# Check backend API
curl -I https://api.orcheplan.com/health

# Check nginx status
sudo systemctl status nginx

# Check database connection
psql -h localhost -U orcheplan -c "SELECT 1;"
```

### Log Monitoring
```bash
# Application logs
pm2 logs --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
journalctl -u nginx -f
```

### Automated Backups
Create a backup script `scripts/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U orcheplan orcheplan > $BACKUP_DIR/db_$DATE.sql

# Application backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /home/$USER OrchePlan

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

Add to crontab:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/$USER/OrchePlan/scripts/backup.sh
```

## 🚀 **Performance Optimization**

### PM2 Scaling
```bash
# Scale backend instances based on CPU cores
pm2 scale orcheplan-backend 4

# Monitor performance
pm2 monit
```

### Database Optimization
```bash
# Optimize PostgreSQL configuration
sudo nano /etc/postgresql/*/main/postgresql.conf

# Key settings for production:
# shared_buffers = 256MB
# effective_cache_size = 1GB
# maintenance_work_mem = 64MB
# checkpoint_completion_target = 0.9
# wal_buffers = 16MB
```

## 🔧 **Troubleshooting**

### Common Issues

**503 Service Unavailable**
```bash
# Check PM2 services
pm2 status

# Restart services
pm2 restart all
```

**CORS Errors**
```bash
# Check backend environment
cat backend/.env.production | grep FRONTEND_ORIGINS

# Ensure correct domain configuration
```

**Database Connection Errors**
```bash
# Test database connection
psql -h localhost -U orcheplan orcheplan -c "SELECT now();"

# Check database service
sudo systemctl status postgresql
```

**SSL Certificate Issues**
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew --dry-run
```

## 🎉 **Deployment Complete!**

Your OrchePlan application is now running in production with:

- ✅ **Frontend**: https://orcheplan.com
- ✅ **API**: https://api.orcheplan.com  
- ✅ **SSL Encryption**: Let's Encrypt certificates
- ✅ **Process Management**: PM2 with clustering
- ✅ **Reverse Proxy**: Nginx with security headers
- ✅ **Database**: Local PostgreSQL instance
- ✅ **Automated Backups**: Daily database and application backups
- ✅ **Monitoring**: PM2 monitoring and log aggregation

**Key Features:**
- Zero-downtime deployments with PM2
- Cross-subdomain authentication with secure cookies
- Production-optimized builds and configurations
- Automated SSL certificate renewal
- Comprehensive logging and monitoring

For ongoing maintenance, monitor PM2 processes, check logs regularly, and ensure backups are running successfully.
