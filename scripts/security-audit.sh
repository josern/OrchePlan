#!/bin/bash
# OrchePlan Production Security Audit Script

set -e

echo "🔐 OrchePlan Security Audit"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Function to check security item
check_security() {
    local description="$1"
    local command="$2"
    local expected="$3"
    local severity="${4:-error}" # error, warning, info
    
    echo -n "Checking $description... "
    
    if eval "$command" >/dev/null 2>&1; then
        if [[ "$expected" == "true" ]]; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((PASS++))
            return 0
        else
            if [[ "$severity" == "warning" ]]; then
                echo -e "${YELLOW}⚠️  WARNING${NC}"
                ((WARN++))
            else
                echo -e "${RED}❌ FAIL${NC}"
                ((FAIL++))
            fi
            return 1
        fi
    else
        if [[ "$expected" == "false" ]]; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((PASS++))
            return 0
        else
            if [[ "$severity" == "warning" ]]; then
                echo -e "${YELLOW}⚠️  WARNING${NC}"
                ((WARN++))
            else
                echo -e "${RED}❌ FAIL${NC}"
                ((FAIL++))
            fi
            return 1
        fi
    fi
}

echo "🔍 Environment Configuration"
echo "----------------------------"

# Check NODE_ENV
check_security "NODE_ENV is production" '[[ "$NODE_ENV" == "production" ]]' "true"

# Check JWT_SECRET strength
check_security "JWT_SECRET is strong" '[[ ${#JWT_SECRET} -ge 32 && "$JWT_SECRET" != "dev-secret" ]]' "true"

# Check DATABASE_URL uses SSL
check_security "Database uses SSL" '[[ "$DATABASE_URL" =~ sslmode=require ]]' "true"

# Check FRONTEND_ORIGINS is set
check_security "FRONTEND_ORIGINS configured" '[[ -n "$FRONTEND_ORIGINS" && "$FRONTEND_ORIGINS" != *"localhost"* ]]' "true"

# Check secure cookies
check_security "Secure cookies enabled" '[[ "$AUTH_COOKIE_SECURE" == "true" ]]' "true"

echo ""
echo "🌐 Network Security"
echo "------------------"

# Check if running on standard ports
check_security "Not running on privileged ports" '[[ "$PORT" -gt 1024 ]]' "true" "warning"

# Check firewall status
check_security "Firewall is active" 'command -v ufw >/dev/null && ufw status | grep -q "Status: active"' "true" "warning"

# Check fail2ban
check_security "Fail2ban is installed" 'command -v fail2ban-client >/dev/null' "true" "warning"

echo ""
echo "🗄️  Database Security"
echo "--------------------"

if [[ -n "$DATABASE_URL" ]]; then
    # Extract database connection details
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)"
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        
        # Check if database is not on default port
        check_security "Database not on default port" '[[ "$DB_PORT" != "5432" ]]' "true" "warning"
        
        # Check if database is not localhost (for production)
        check_security "Database is external" '[[ "$DB_HOST" != "localhost" && "$DB_HOST" != "127.0.0.1" ]]' "true" "warning"
    fi
fi

echo ""
echo "📁 File Permissions"
echo "------------------"

# Check log directory permissions
check_security "Log directory exists" '[[ -d "/var/log/orcheplan" ]]' "true" "warning"

# Check backup directory permissions
check_security "Backup directory secured" '[[ ! -d "/var/backups/orcheplan" ]] || [[ $(stat -c %a /var/backups/orcheplan) == "700" ]]' "true" "warning"

# Check env files are not world-readable
check_security "Environment files secured" '[[ ! -f ".env.production" ]] || [[ $(stat -c %a .env.production) != *"4" && $(stat -c %a .env.production) != *"6" ]]' "true"

echo ""
echo "🔧 Application Security"
echo "----------------------"

# Check if development dependencies are not installed
check_security "No dev dependencies in production" '[[ ! -d "node_modules/@types" ]]' "true" "warning"

# Check if source maps are disabled
check_security "Source maps disabled" '[[ ! -f "frontend/.next/static/chunks/*.js.map" ]]' "true" "warning"

# Check if debug mode is disabled
check_security "Debug mode disabled" '[[ "$DEBUG" != "true" && "$LOG_LEVEL" != "debug" ]]' "true"

echo ""
echo "📊 System Resources"
echo "------------------"

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
check_security "Disk usage under 80%" '[[ $DISK_USAGE -lt 80 ]]' "true" "warning"

# Check memory usage
if command -v free >/dev/null 2>&1; then
    MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    check_security "Memory usage under 80%" '[[ $MEMORY_USAGE -lt 80 ]]' "true" "warning"
fi

echo ""
echo "🔄 Backup & Recovery"
echo "-------------------"

# Check if backup script exists
check_security "Backup script exists" '[[ -f "backend/scripts/backup-database.sh" ]]' "true" "warning"

# Check if cron job for backups exists
check_security "Backup cron job configured" 'crontab -l | grep -q backup-database' "true" "warning"

echo ""
echo "📈 Monitoring"
echo "------------"

# Check if health check script exists
check_security "Health check script exists" '[[ -f "scripts/health-check.sh" ]]' "true" "warning"

# Check if log rotation is configured
check_security "Log rotation configured" '[[ -f "/etc/logrotate.d/orcheplan" ]]' "true" "warning"

echo ""
echo "🚀 Production Readiness"
echo "----------------------"

# Check if SSL certificates exist
check_security "SSL certificates exist" '[[ -f "nginx/ssl/cert.pem" && -f "nginx/ssl/private.key" ]]' "true"

# Check if nginx config exists
check_security "Nginx configuration exists" '[[ -f "nginx/nginx.conf" ]]' "true"

# Check if process manager is configured
check_security "Process manager configured" '[[ -f "ecosystem.config.json" ]]' "true" "warning"

echo ""
echo "📋 Security Summary"
echo "=================="

TOTAL=$((PASS + FAIL + WARN))
PASS_PERCENT=$((PASS * 100 / TOTAL))

echo -e "Total checks: $TOTAL"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo -e "Security Score: $PASS_PERCENT%"

echo ""

if [[ $FAIL -eq 0 ]]; then
    echo -e "${GREEN}🎉 All critical security checks passed!${NC}"
    if [[ $WARN -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Address warnings for improved security${NC}"
    fi
    exit 0
else
    echo -e "${RED}❌ Critical security issues found!${NC}"
    echo -e "${RED}Please fix failed checks before deploying to production${NC}"
    exit 1
fi