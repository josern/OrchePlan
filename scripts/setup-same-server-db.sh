#!/bin/bash
# Database Setup Script for Same-Server Installation
# This script sets up PostgreSQL for OrchePlan when API and DB are on the same server

set -e

# Configuration
DB_NAME="orcheplan_db"
DB_USER="orcheplan_user"
DEFAULT_DB_PASS="$(openssl rand -base64 32)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️  OrchePlan Database Setup for Same-Server Installation${NC}"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "  CentOS/RHEL:   sudo yum install postgresql postgresql-server"
    echo "  macOS:         brew install postgresql"
    exit 1
fi

# Check if PostgreSQL service is running
if ! sudo systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}⚠️  PostgreSQL service is not running. Starting it...${NC}"
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

echo -e "${GREEN}✅ PostgreSQL is installed and running${NC}"

# Prompt for database password
echo ""
read -p "Enter password for database user '$DB_USER' (or press Enter for auto-generated): " DB_PASS
if [ -z "$DB_PASS" ]; then
    DB_PASS="$DEFAULT_DB_PASS"
    echo -e "${YELLOW}🔐 Using auto-generated password${NC}"
fi

# Check if database already exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' already exists${NC}"
    read -p "Do you want to recreate it? This will delete all data! (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🗑️  Dropping existing database...${NC}"
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
        sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;"
    else
        echo -e "${BLUE}ℹ️  Keeping existing database${NC}"
        echo "Make sure your .env file has the correct DATABASE_URL"
        exit 0
    fi
fi

echo -e "${BLUE}📊 Creating database and user...${NC}"

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || {
    echo -e "${RED}❌ Failed to create database${NC}"
    exit 1
}

sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';" || {
    echo -e "${RED}❌ Failed to create user${NC}"
    exit 1
}

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || {
    echo -e "${RED}❌ Failed to grant privileges${NC}"
    exit 1
}

# Connect to the new database and set additional permissions
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" || {
    echo -e "${RED}❌ Failed to grant schema privileges${NC}"
    exit 1
}

# Set default privileges for future tables
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" || {
    echo -e "${YELLOW}⚠️  Could not set default table privileges${NC}"
}

sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;" || {
    echo -e "${YELLOW}⚠️  Could not set default sequence privileges${NC}"
}

echo -e "${GREEN}✅ Database setup complete!${NC}"

# Generate connection strings
echo ""
echo -e "${BLUE}📝 Database Configuration:${NC}"
echo ""

# Unix socket connection (recommended for same server)
UNIX_URL="postgresql://$DB_USER:$DB_PASS@/orcheplan_db?host=/var/run/postgresql"
echo -e "${GREEN}🔗 Unix Socket (Recommended):${NC}"
echo "DATABASE_URL=\"$UNIX_URL\""
echo ""

# Localhost TCP connection
TCP_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo -e "${GREEN}🔗 Localhost TCP:${NC}"
echo "DATABASE_URL=\"$TCP_URL\""
echo ""

# With SSL preference
SSL_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?sslmode=prefer"
echo -e "${GREEN}🔗 Localhost with SSL preference:${NC}"
echo "DATABASE_URL=\"$SSL_URL\""
echo ""

# Update .env file if it exists
ENV_FILE="../.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}📄 Found existing .env file${NC}"
    read -p "Update .env file with new DATABASE_URL? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Backup existing .env
        cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Update DATABASE_URL
        if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
            sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$UNIX_URL\"|" "$ENV_FILE"
            echo -e "${GREEN}✅ Updated DATABASE_URL in .env file${NC}"
        else
            echo "DATABASE_URL=\"$UNIX_URL\"" >> "$ENV_FILE"
            echo -e "${GREEN}✅ Added DATABASE_URL to .env file${NC}"
        fi
    fi
else
    echo -e "${YELLOW}📄 No .env file found. Create one with:${NC}"
    echo "DATABASE_URL=\"$UNIX_URL\""
fi

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Add the DATABASE_URL to your .env file"
echo "2. Run 'npm run prisma:migrate' to create tables"
echo "3. Start your application with 'npm run dev'"
echo ""
echo -e "${YELLOW}💡 Tips for same-server deployment:${NC}"
echo "• Unix socket connections are fastest and most secure"
echo "• No need for SSL encryption on localhost (unless required by policy)"
echo "• Consider setting up automated backups"
echo "• Monitor disk space and performance"