#!/bin/bash

set -e  # Exit on any error

# Local Server Deployment Script for OrchePlan
# This script deploys OrchePlan on the same server (frontend, backend, database locally)

echo "🚀 Starting OrchePlan Local Server Deployment..."
echo "=================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should not be run as root for security reasons"
   exit 1
fi

# Configuration
APP_NAME="orcheplan"
APP_USER="orcheplan"
APP_DIR="/opt/orcheplan"
PM2_ECOSYSTEM="/opt/orcheplan/ecosystem.config.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_step() {
    echo -e "${BLUE}==> $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required commands exist
check_requirements() {
    print_step "Checking requirements..."
    
    if ! command -v sudo &> /dev/null; then
        print_error "sudo is required but not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "git is required but not installed"
        exit 1
    fi
    
    print_success "Requirements check passed"
}

# Run requirements check
check_requirements

# Step 1: Update system
print_step "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Step 2: Install required packages
print_step "Installing required packages..."
sudo apt install -y curl wget git postgresql postgresql-contrib

# Step 3: Install Node.js 25.x
print_step "Installing Node.js 25.x..."
curl -fsSL https://deb.nodesource.com/setup_25.x | sudo -E bash -
sudo apt install -y nodejs

# Step 4: Install PM2 globally
print_step "Installing PM2..."
sudo npm install -g pm2

# Step 5: Create application user
print_step "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    sudo useradd -r -s /bin/bash -d $APP_DIR $APP_USER
    print_success "User $APP_USER created"
else
    print_warning "User $APP_USER already exists"
fi

# Step 6: Create application directories
print_step "Creating application directories..."
sudo mkdir -p $APP_DIR/releases
sudo mkdir -p $APP_DIR/shared/logs
sudo mkdir -p /var/log/orcheplan
sudo chown -R $APP_USER:$APP_USER $APP_DIR
sudo chown -R $APP_USER:$APP_USER /var/log/orcheplan

# Step 7: Deploy application code
print_step "Deploying application code..."
RELEASE_DIR="$APP_DIR/releases/$(date +%Y%m%d_%H%M%S)"
sudo -u $APP_USER mkdir -p $RELEASE_DIR

# Copy current directory to release directory (excluding root lockfile to avoid Next.js warning)
sudo -u $APP_USER cp -r . $RELEASE_DIR/
# Remove root package-lock.json to prevent Next.js workspace detection issues
sudo -u $APP_USER rm -f $RELEASE_DIR/package-lock.json
sudo -u $APP_USER ln -sfn $RELEASE_DIR $APP_DIR/current

# Step 8: Install dependencies
print_step "Installing dependencies..."
cd $APP_DIR/current

# Copy .npmrc for reduced warnings
sudo -u $APP_USER cp .npmrc /opt/orcheplan/ 2>/dev/null || echo "No .npmrc found"

# Backend dependencies (all dependencies needed for build)
print_step "Installing backend dependencies..."
cd $APP_DIR/current/backend
sudo -u $APP_USER npm install --loglevel=warn

# Frontend dependencies (all dependencies needed for build)
print_step "Installing frontend dependencies..."
cd $APP_DIR/current/frontend
sudo -u $APP_USER npm install --loglevel=warn

# Step 9: Build applications
print_step "Building applications..."

# Build backend first (TypeScript compilation)
cd $APP_DIR/current/backend
sudo -u $APP_USER npm run build

# Build frontend
cd $APP_DIR/current/frontend
sudo -u $APP_USER npm run build

# Step 9.5: Clean up devDependencies after build
print_step "Cleaning up devDependencies after build..."
cd $APP_DIR/current/backend
sudo -u $APP_USER npm prune --omit=dev --loglevel=warn

cd $APP_DIR/current/frontend
sudo -u $APP_USER npm prune --omit=dev --loglevel=warn

# Step 10: Setup PostgreSQL database
print_step "Setting up PostgreSQL database..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE orcheplan;" || echo "Database might already exist"
sudo -u postgres psql -c "CREATE USER orcheplan WITH CREATEDB PASSWORD 'secure_password_here';" || echo "User might already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE orcheplan TO orcheplan;" || echo "Privileges might already be granted"

# Grant schema permissions for Prisma migrations
sudo -u postgres psql -d orcheplan -c "GRANT ALL ON SCHEMA public TO orcheplan;" || echo "Schema privileges might already be granted"
sudo -u postgres psql -d orcheplan -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO orcheplan;" || echo "Table privileges might already be granted"
sudo -u postgres psql -d orcheplan -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO orcheplan;" || echo "Sequence privileges might already be granted"
sudo -u postgres psql -d orcheplan -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO orcheplan;" || echo "Default table privileges might already be granted"
sudo -u postgres psql -d orcheplan -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO orcheplan;" || echo "Default sequence privileges might already be granted"

# Step 11: Setup environment files
print_step "Setting up environment files..."

# Backend environment
if [[ ! -f "$APP_DIR/current/backend/.env.production" ]]; then
    sudo -u $APP_USER cp $APP_DIR/current/backend/.env.production.example $APP_DIR/current/backend/.env.production 2>/dev/null || echo "No .env.production.example found"
    print_warning "Please update $APP_DIR/current/backend/.env.production with your configuration"
fi

# Frontend environment
if [[ ! -f "$APP_DIR/current/frontend/.env.production" ]]; then
    sudo -u $APP_USER cp $APP_DIR/current/frontend/.env.production.example $APP_DIR/current/frontend/.env.production 2>/dev/null || echo "No .env.production.example found"
    print_warning "Please update $APP_DIR/current/frontend/.env.production with your configuration"
fi

# Step 12: Run database migrations
print_step "Running database migrations..."
cd $APP_DIR/current/backend

# Generate Prisma client first
print_step "Generating Prisma client..."
sudo -u $APP_USER npm run prisma:generate

# Check for failed migrations and resolve them
print_step "Checking migration status..."
if sudo -u $APP_USER npx prisma migrate status 2>&1 | grep -q "failed"; then
    print_warning "Found failed migrations, attempting to resolve..."
    # Mark failed migrations as resolved
    sudo -u $APP_USER npx prisma migrate resolve --applied 20251016103312_add_parentid || echo "Could not resolve failed migration"
fi

# Deploy migrations
print_step "Deploying database migrations..."
sudo -u $APP_USER npm run prisma:migrate:deploy || echo "Migration command failed or not found"

# Step 13: Setup PM2 ecosystem
print_step "Setting up PM2 ecosystem..."
if [[ -f "$APP_DIR/current/ecosystem.config.js" ]]; then
    sudo -u $APP_USER cp $APP_DIR/current/ecosystem.config.js $PM2_ECOSYSTEM
else
    print_warning "No ecosystem.config.js found, PM2 will need manual configuration"
fi

# Step 14: Start applications with PM2
print_step "Starting applications with PM2..."
cd $APP_DIR/current
if [[ -f "$PM2_ECOSYSTEM" ]]; then
    sudo -u $APP_USER pm2 start $PM2_ECOSYSTEM
    sudo -u $APP_USER pm2 save
    sudo -u $APP_USER pm2 startup
else
    print_warning "Starting applications manually since no PM2 ecosystem config found"
    cd $APP_DIR/current/backend
    sudo -u $APP_USER pm2 start npm --name "orcheplan-backend" -- start
    cd $APP_DIR/current/frontend
    sudo -u $APP_USER pm2 start npm --name "orcheplan-frontend" -- start
    sudo -u $APP_USER pm2 save
fi

# Step 15: Enable and start services
print_step "Enabling services..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Step 16: Final checks
print_step "Running final checks..."
sleep 5

# Check if PM2 processes are running
if sudo -u $APP_USER pm2 status | grep -q "online"; then
    print_success "PM2 processes are running"
else
    print_error "Some PM2 processes failed to start"
fi

# Check if PostgreSQL is running
if sudo systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL is running"
else
    print_error "PostgreSQL is not running"
fi

# Step 17: Setup log rotation
print_step "Setting up log rotation..."
if [[ ! -f "/etc/logrotate.d/orcheplan" ]]; then
    sudo tee /etc/logrotate.d/orcheplan > /dev/null <<LOGEOF
/var/log/orcheplan/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $APP_USER $APP_USER
    postrotate
        sudo -u $APP_USER pm2 reloadLogs
    endscript
}
LOGEOF
    print_success "Log rotation configured"
fi

# Step 18: Setup backup cron job
print_step "Setting up automated backups..."
if ! sudo -u $APP_USER crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
    if [[ -f "$APP_DIR/current/backend/scripts/backup-database.sh" ]]; then
        (sudo -u $APP_USER crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/current/backend/scripts/backup-database.sh") | sudo -u $APP_USER crontab -
        print_success "Backup cron job configured"
    else
        print_warning "Backup script not found, skipping cron job setup"
    fi
fi

# Step 19: Setup health check monitoring
print_step "Setting up health monitoring..."
if ! sudo -u $APP_USER crontab -l 2>/dev/null | grep -q "health-check.sh"; then
    if [[ -f "$APP_DIR/current/scripts/health-check.sh" ]]; then
        (sudo -u $APP_USER crontab -l 2>/dev/null; echo "*/5 * * * * $APP_DIR/current/scripts/health-check.sh >> /var/log/orcheplan/health-check.log 2>&1") | sudo -u $APP_USER crontab -
        print_success "Health monitoring configured"
    else
        print_warning "Health check script not found, skipping monitoring setup"
    fi
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Update environment files:"
echo "   - $APP_DIR/current/backend/.env.production"
echo "   - $APP_DIR/current/frontend/.env.production"
echo ""
echo "2. Restart services:"
echo "   sudo -u $APP_USER pm2 restart all"
echo ""
echo "3. Monitor logs:"
echo "   sudo -u $APP_USER pm2 logs"
echo ""
echo "🔗 Application should be available at:"
echo "   Frontend: http://your-server-ip:3000"
echo "   Backend API: http://your-server-ip:3001"
echo ""
echo "📋 Security reminders:"
echo "   - Configure firewall to allow only necessary ports"
echo "   - Set strong database passwords"
echo "   - Update environment variables with secure secrets"
echo "   - Consider setting up a reverse proxy (Apache/Nginx) for production"

exit 0
