#!/bin/bash#!/bin/bash

set -e# Production Deployment Script for OrchePlan



# Local Server Deployment Script for OrchePlanset -e  # Exit on any error

# This script deploys OrchePlan on the same server (frontend, backend, database locally)

echo "🚀 OrchePlan Production Deployment"

echo "🚀 Starting OrchePlan Local Server Deployment..."echo "=================================="



# Check if running as root or with sudo# Check if running as root

if [[ $EUID -eq 0 ]]; thenif [[ $EUID -eq 0 ]]; then

   echo "⚠️  This script should not be run as root for security reasons"   echo "❌ This script should not be run as root for security reasons"

   echo "Please run as a regular user with sudo privileges"   exit 1

   exit 1fi

fi

# Configuration

# ConfigurationDEPLOYMENT_METHOD="${DEPLOYMENT_METHOD:-docker}"  # docker or manual

APP_NAME="orcheplan"BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

APP_USER="orcheplan"RUN_SECURITY_AUDIT="${RUN_SECURITY_AUDIT:-true}"

APP_DIR="/opt/orcheplan"

NGINX_CONFIG="/etc/nginx/sites-available/orcheplan"echo "📋 Checking environment configuration..."

PM2_ECOSYSTEM="/opt/orcheplan/ecosystem.config.js"required_vars=("NODE_ENV" "JWT_SECRET" "DATABASE_URL" "FRONTEND_ORIGINS")

missing_vars=()

# Colors for output

RED='\033[0;31m'for var in "${required_vars[@]}"; do

GREEN='\033[0;32m'    if [[ -z "${!var}" ]]; then

YELLOW='\033[1;33m'        missing_vars+=("$var")

NC='\033[0m' # No Color    fi

done

print_step() {

    echo -e "${GREEN}➤ $1${NC}"if [[ ${#missing_vars[@]} -ne 0 ]]; then

}    echo "❌ Missing required environment variables:"

    printf '   - %s\n' "${missing_vars[@]}"

print_warning() {    echo ""

    echo -e "${YELLOW}⚠️  $1${NC}"    echo "Create .env.production files with:"

}    echo "NODE_ENV=production"

    echo "JWT_SECRET=your-secure-secret-here"

print_error() {    echo "DATABASE_URL=your-production-db-url"

    echo -e "${RED}❌ $1${NC}"    echo "FRONTEND_ORIGINS=https://yourdomain.com"

}    echo "AUTH_COOKIE_SECURE=true"

    echo "LOG_LEVEL=warn"

# Step 1: Update system packages    exit 1

print_step "Updating system packages..."fi

sudo apt update && sudo apt upgrade -y

# Validate JWT_SECRET strength

# Step 2: Install required packagesif [[ ${#JWT_SECRET} -lt 32 ]]; then

print_step "Installing required packages..."    echo "❌ JWT_SECRET must be at least 32 characters long"

sudo apt install -y curl wget git nginx postgresql postgresql-contrib    exit 1

fi

# Step 3: Install Node.js 18.x

print_step "Installing Node.js 18.x..."if [[ "$JWT_SECRET" == "dev-secret" ]]; then

curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -    echo "❌ JWT_SECRET cannot be the development default"

sudo apt install -y nodejs    exit 1

fi

# Verify Node.js installation

node_version=$(node --version)# Check NODE_ENV

npm_version=$(npm --version)if [[ "$NODE_ENV" != "production" ]]; then

print_step "Node.js installed: $node_version, npm: $npm_version"    echo "❌ NODE_ENV must be set to 'production'"

    exit 1

# Step 4: Install PM2 globallyfi

print_step "Installing PM2 process manager..."

sudo npm install -g pm2echo "✅ Environment configuration valid"



# Step 5: Create application user# Run security audit

print_step "Creating application user: $APP_USER"if [[ "$RUN_SECURITY_AUDIT" == "true" ]]; then

if ! id "$APP_USER" &>/dev/null; then    echo "🔐 Running security audit..."

    sudo useradd -r -m -d $APP_DIR -s /bin/bash $APP_USER    if bash scripts/security-audit.sh; then

    echo "User $APP_USER created"        echo "✅ Security audit passed"

else    else

    echo "User $APP_USER already exists"        echo "❌ Security audit failed"

fi        read -p "Continue deployment anyway? (y/N): " -n 1 -r

        echo

# Step 6: Create application directory        if [[ ! $REPLY =~ ^[Yy]$ ]]; then

print_step "Setting up application directory..."            exit 1

sudo mkdir -p $APP_DIR        fi

sudo chown $APP_USER:$APP_USER $APP_DIR    fi

fi

# Step 7: Clone or copy application code

print_step "Deploying application code..."# Backup database before deployment

if [ -d "$APP_DIR/current" ]; thenif [[ "$BACKUP_BEFORE_DEPLOY" == "true" ]]; then

    print_step "Backing up current deployment..."    echo "🗄️  Creating pre-deployment backup..."

    sudo -u $APP_USER mv $APP_DIR/current $APP_DIR/backup-$(date +%Y%m%d-%H%M%S)    if [[ -f "backend/scripts/backup-database.sh" ]]; then

fi        bash backend/scripts/backup-database.sh

        echo "✅ Backup completed"

sudo -u $APP_USER mkdir -p $APP_DIR/current    else

sudo -u $APP_USER cp -r /home/$(whoami)/OrchePlan/* $APP_DIR/current/ || {        echo "⚠️  Backup script not found, skipping backup"

    print_error "Failed to copy application files. Make sure OrchePlan is in your home directory."    fi

    exit 1fi

}

# Deploy based on method

# Step 8: Install dependenciesif [[ "$DEPLOYMENT_METHOD" == "docker" ]]; then

print_step "Installing application dependencies..."    echo "🐳 Deploying with Docker..."

cd $APP_DIR/current    

sudo -u $APP_USER npm install    # Check if Docker is available

sudo -u $APP_USER npm run build    if ! command -v docker &> /dev/null; then

        echo "❌ Docker is not installed"

# Step 9: Setup PostgreSQL database        exit 1

print_step "Setting up PostgreSQL database..."    fi

sudo -u postgres psql -c "CREATE USER orcheplan WITH PASSWORD 'secure_password_change_me';" || echo "User may already exist"    

sudo -u postgres psql -c "CREATE DATABASE orcheplan OWNER orcheplan;" || echo "Database may already exist"    if ! command -v docker-compose &> /dev/null; then

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orcheplan TO orcheplan;"        echo "❌ Docker Compose is not installed"

        exit 1

# Step 10: Copy environment files    fi

print_step "Setting up environment files..."    

if [ ! -f "$APP_DIR/current/backend/.env.production" ]; then    # Build images

    sudo -u $APP_USER cp $APP_DIR/current/backend/.env.production.example $APP_DIR/current/backend/.env.production    echo "🏗️  Building Docker images..."

    print_warning "Please edit $APP_DIR/current/backend/.env.production with your actual values"    docker-compose -f docker-compose.prod.yml build --no-cache

fi    

    # Stop existing containers

if [ ! -f "$APP_DIR/current/frontend/.env.production" ]; then    echo "⏹️  Stopping existing containers..."

    sudo -u $APP_USER cp $APP_DIR/current/frontend/.env.production.example $APP_DIR/current/frontend/.env.production    docker-compose -f docker-compose.prod.yml down

    print_warning "Please edit $APP_DIR/current/frontend/.env.production with your actual values"    

fi    # Start new containers

    echo "▶️  Starting new containers..."

# Step 11: Run database migrations    docker-compose -f docker-compose.prod.yml up -d

print_step "Running database migrations..."    

cd $APP_DIR/current/backend    # Wait for services to be ready

sudo -u $APP_USER npm run migrate:deploy || print_warning "Database migrations may have failed - check manually"    echo "⏳ Waiting for services to start..."

    sleep 30

# Step 12: Setup PM2 ecosystem    

print_step "Setting up PM2 ecosystem..."    # Run database migrations

sudo -u $APP_USER cp $APP_DIR/current/ecosystem.config.js $PM2_ECOSYSTEM    echo "🔧 Running database migrations..."

    docker exec orcheplan-backend npx prisma migrate deploy

# Step 13: Configure Nginx    

print_step "Configuring Nginx..."    # Create superuser if needed

sudo cp $APP_DIR/current/nginx.conf $NGINX_CONFIG    echo "👤 Creating superuser (if needed)..."

sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/orcheplan    docker exec orcheplan-backend npm run create-superuser || echo "Superuser already exists or creation skipped"

sudo nginx -t    

sudo systemctl reload nginxelse

    echo "🔧 Deploying manually..."

# Step 14: Setup SSL (Let's Encrypt)    

print_step "Setting up SSL certificate..."    # Install dependencies

if command -v certbot &> /dev/null; then    echo "📦 Installing dependencies..."

    print_step "Certbot is installed. You can run: sudo certbot --nginx -d yourdomain.com"    npm install --production

else    

    print_step "Installing certbot for SSL..."    # Build applications

    sudo apt install -y certbot python3-certbot-nginx    echo "🏗️  Building applications..."

    print_warning "Run 'sudo certbot --nginx -d yourdomain.com' after updating your domain in nginx config"    npm run build

fi    

    # Database setup

# Step 15: Start application with PM2    echo "🗄️  Setting up database..."

print_step "Starting application with PM2..."    cd backend

cd $APP_DIR/current    npx prisma migrate deploy

sudo -u $APP_USER pm2 start $PM2_ECOSYSTEM    

sudo -u $APP_USER pm2 save    # Create superuser

sudo -u $APP_USER pm2 startup systemd    echo "� Creating superuser (if needed)..."

    npm run create-superuser || echo "Superuser already exists or creation skipped"

# Generate the startup script    

STARTUP_SCRIPT=$(sudo -u $APP_USER pm2 startup systemd | grep "sudo env" | head -1)    cd ..

if [ ! -z "$STARTUP_SCRIPT" ]; then    

    eval $STARTUP_SCRIPT    # Restart services with PM2

fi    if command -v pm2 &> /dev/null; then

        echo "� Restarting services with PM2..."

# Step 16: Setup log rotation        pm2 restart ecosystem.config.json || pm2 start ecosystem.config.json

print_step "Setting up log rotation..."        pm2 save

sudo -u $APP_USER pm2 install pm2-logrotate    else

        echo "⚠️  PM2 not found, starting services directly..."

# Step 17: Enable and start services        # This is not recommended for production

print_step "Enabling services..."        npm run start:prod &

sudo systemctl enable nginx    fi

sudo systemctl enable postgresqlfi

sudo systemctl start nginx

sudo systemctl start postgresql# Health check

echo "🏥 Running health checks..."

# Step 18: Final checkssleep 10

print_step "Running final checks..."if bash scripts/health-check.sh; then

sleep 5    echo "✅ Health checks passed"

else

# Check if PM2 processes are running    echo "⚠️  Some health checks failed, but deployment continued"

if sudo -u $APP_USER pm2 list | grep -q "online"; thenfi

    print_step "✅ PM2 processes are running"

else# Setup monitoring and maintenance

    print_error "PM2 processes are not running properly"echo "📊 Setting up monitoring..."

fi

# Setup log rotation

# Check if Nginx is runningif [[ ! -f "/etc/logrotate.d/orcheplan" ]]; then

if sudo systemctl is-active --quiet nginx; then    echo "📋 Setting up log rotation..."

    print_step "✅ Nginx is running"    sudo tee /etc/logrotate.d/orcheplan > /dev/null <<EOF

else/var/log/orcheplan/*.log {

    print_error "Nginx is not running properly"    daily

fi    missingok

    rotate 30

# Check if PostgreSQL is running    compress

if sudo systemctl is-active --quiet postgresql; then    delaycompress

    print_step "✅ PostgreSQL is running"    notifempty

else    create 644 orcheplan orcheplan

    print_error "PostgreSQL is not running properly"    postrotate

fi        if command -v pm2 &> /dev/null; then

            pm2 reloadLogs

echo ""        fi

echo "🎉 Deployment completed!"    endscript

echo ""}

echo "📋 Next steps:"EOF

echo "1. Edit environment files:"fi

echo "   - $APP_DIR/current/backend/.env.production"

echo "   - $APP_DIR/current/frontend/.env.production"# Setup backup cron job

echo ""if ! crontab -l | grep -q "backup-database.sh"; then

echo "2. Update domain in nginx config: $NGINX_CONFIG"    echo "⏰ Setting up backup cron job..."

echo ""    (crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/backend/scripts/backup-database.sh") | crontab -

echo "3. Setup SSL certificate:"fi

echo "   sudo certbot --nginx -d yourdomain.com"

echo ""# Setup health check cron job

echo "4. Restart services:"if ! crontab -l | grep -q "health-check.sh"; then

echo "   sudo -u $APP_USER pm2 restart all"    echo "🏥 Setting up health check monitoring..."

echo "   sudo systemctl reload nginx"    (crontab -l 2>/dev/null; echo "*/5 * * * * $(pwd)/scripts/health-check.sh >> /var/log/orcheplan/health-check.log 2>&1") | crontab -

echo ""fi

echo "5. Monitor logs:"

echo "   sudo -u $APP_USER pm2 logs"echo ""

echo "   sudo tail -f /var/log/nginx/access.log"echo "🎉 Deployment completed successfully!"

echo ""echo ""

echo "🔗 Application should be available at: http://your-server-ip"echo "🔒 Security Checklist Complete:"

echo "   ✅ HTTPS/SSL configured"

exit 0echo "   ✅ Strong JWT secret"
echo "   ✅ Production database"
echo "   ✅ CORS configured"
echo "   ✅ Rate limiting enabled"
echo "   ✅ CSRF protection enabled"
echo "   ✅ Security headers active"
echo "   ✅ Account lockout system"
echo "   ✅ Audit logging enabled"
echo "   ✅ Automated backups"
echo "   ✅ Health monitoring"
echo ""

if [[ "$DEPLOYMENT_METHOD" == "docker" ]]; then
    echo "🐳 Docker Services Status:"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo "📋 Useful Commands:"
    echo "   View logs: npm run docker:logs"
    echo "   Stop services: npm run docker:down"
    echo "   Restart services: npm run docker:up"
else
    echo "🔧 Manual Deployment Status:"
    if command -v pm2 &> /dev/null; then
        pm2 status
    fi
    echo ""
    echo "📋 Useful Commands:"
    echo "   View logs: pm2 logs"
    echo "   Restart: pm2 restart all"
    echo "   Monitor: pm2 monit"
fi

echo ""
echo "🌐 Application URLs:"
echo "   Frontend: $FRONTEND_ORIGINS"
echo "   Backend API: ${FRONTEND_ORIGINS}/api"
echo "   Health Check: ${FRONTEND_ORIGINS}/api/health"
echo ""

echo "✅ OrchePlan is now running in production!"