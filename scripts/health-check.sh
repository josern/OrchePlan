#!/bin/bash
# Production Health Check Script

set -e

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"
TIMEOUT="${HEALTH_CHECK_TIMEOUT:-10}"

echo "🏥 OrchePlan Health Check"
echo "========================"

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $name... "
    
    if response=$(curl -s -w "%{http_code}" -m "$TIMEOUT" "$url" -o /dev/null); then
        if [[ "$response" == "$expected_status" ]]; then
            echo "✅ OK ($response)"
            return 0
        else
            echo "❌ FAIL (HTTP $response)"
            return 1
        fi
    else
        echo "❌ FAIL (No response)"
        return 1
    fi
}

# Function to check database connection
check_database() {
    echo -n "Checking database connection... "
    
    if [[ -z "$DATABASE_URL" ]]; then
        echo "❌ FAIL (DATABASE_URL not set)"
        return 1
    fi
    
    # Extract database connection details
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)"
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    else
        echo "❌ FAIL (Invalid DATABASE_URL)"
        return 1
    fi
    
    export PGPASSWORD="$DB_PASS"
    
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
        echo "✅ OK"
        return 0
    else
        echo "❌ FAIL"
        return 1
    fi
}

# Function to check disk space
check_disk_space() {
    echo -n "Checking disk space... "
    
    local usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    local threshold=85
    
    if [[ $usage -lt $threshold ]]; then
        echo "✅ OK (${usage}% used)"
        return 0
    else
        echo "⚠️  WARNING (${usage}% used - above ${threshold}%)"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    echo -n "Checking memory usage... "
    
    if command -v free >/dev/null 2>&1; then
        local usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        local threshold=85
        
        if [[ $usage -lt $threshold ]]; then
            echo "✅ OK (${usage}% used)"
            return 0
        else
            echo "⚠️  WARNING (${usage}% used - above ${threshold}%)"
            return 1
        fi
    else
        echo "❓ UNKNOWN (free command not available)"
        return 0
    fi
}

# Function to check log files
check_logs() {
    echo -n "Checking log files... "
    
    local log_dir="/var/log/orcheplan"
    local max_size_mb=100
    
    if [[ -d "$log_dir" ]]; then
        local total_size=$(du -sm "$log_dir" 2>/dev/null | cut -f1)
        
        if [[ $total_size -lt $max_size_mb ]]; then
            echo "✅ OK (${total_size}MB)"
            return 0
        else
            echo "⚠️  WARNING (${total_size}MB - above ${max_size_mb}MB)"
            return 1
        fi
    else
        echo "❓ UNKNOWN (log directory not found)"
        return 0
    fi
}

# Perform health checks
exit_code=0

check_endpoint "$BACKEND_URL/health" "Backend API" 200 || exit_code=1
check_endpoint "$FRONTEND_URL/api/health" "Frontend API" 200 || exit_code=1
check_database || exit_code=1
check_disk_space || exit_code=1
check_memory || exit_code=1
check_logs || exit_code=1

echo ""

if [[ $exit_code -eq 0 ]]; then
    echo "🎉 All health checks passed!"
else
    echo "⚠️  Some health checks failed or have warnings"
fi

# Log health check results
log_file="/var/log/orcheplan/health-check.log"
mkdir -p "$(dirname "$log_file")"
echo "$(date): Health check completed with exit code $exit_code" >> "$log_file"

exit $exit_code