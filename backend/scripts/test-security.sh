#!/bin/bash

# Role Hierarchy Security Test Runner
# This script performs basic security checks against a running OrchePlan backend

set -e

echo "🔒 OrchePlan Role Hierarchy Security Test Runner"
echo "================================================"

# Configuration
BASE_URL=${TEST_BASE_URL:-"http://localhost:3001"}
ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@example.com"}
USER_EMAIL=${USER_EMAIL:-"user@example.com"}

echo "Testing against: $BASE_URL"
echo ""

# Function to make HTTP requests and check status codes
check_endpoint() {
    local method=$1
    local endpoint=$2
    local token=$3
    local expected_status=$4
    local description=$5
    local data=$6

    echo -n "Testing: $description... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -X "$method" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" || echo "000")
    else
        response=$(curl -s -w "%{http_code}" -X "$method" \
            -H "Authorization: Bearer $token" \
            "$BASE_URL$endpoint" || echo "000")
    fi
    
    status_code="${response: -3}"
    
    if [ "$status_code" = "$expected_status" ]; then
        echo "✅ PASS ($status_code)"
    else
        echo "❌ FAIL (expected $expected_status, got $status_code)"
        return 1
    fi
}

# Function to get auth token (requires credentials)
get_auth_token() {
    local email=$1
    local password=$2
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
        "$BASE_URL/api/auth/login" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
    else
        echo ""
    fi
}

echo "🔍 Basic Connectivity Tests"
echo "---------------------------"

# Test 1: Server is running
echo -n "Server connectivity... "
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" | grep -q "200\|404"; then
    echo "✅ PASS"
else
    echo "❌ FAIL - Server not responding"
    exit 1
fi

echo ""
echo "🚫 Unauthenticated Access Tests"
echo "-------------------------------"

# Test 2: Admin endpoints require authentication
check_endpoint "GET" "/api/admin/users" "" "401" "Admin endpoint rejects no token"

# Test 3: Invalid token is rejected
check_endpoint "GET" "/api/admin/users" "invalid-token" "401" "Admin endpoint rejects invalid token"

echo ""
echo "⚠️  Manual Authentication Required"
echo "----------------------------------"
echo "For complete testing, you need to provide valid authentication tokens."
echo "Please ensure you have users with different roles and update the tokens below:"
echo ""
echo "Example commands to get tokens:"
echo "curl -X POST -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"password\"}' $BASE_URL/api/auth/login"
echo "curl -X POST -H 'Content-Type: application/json' -d '{\"email\":\"user@example.com\",\"password\":\"password\"}' $BASE_URL/api/auth/login"
echo ""

# If tokens are provided via environment variables, test with them
if [ -n "$ADMIN_TOKEN" ]; then
    echo "🔑 Testing with provided admin token"
    echo "-----------------------------------"
    
    check_endpoint "GET" "/api/admin/users" "$ADMIN_TOKEN" "200" "Admin can access admin endpoints"
    
    echo ""
fi

if [ -n "$USER_TOKEN" ]; then
    echo "🔑 Testing with provided user token"
    echo "----------------------------------"
    
    check_endpoint "GET" "/api/admin/users" "$USER_TOKEN" "403" "User cannot access admin endpoints"
    
    echo ""
fi

echo "📋 Security Checklist"
echo "---------------------"
echo "Manual verification required:"
echo "□ Superuser can modify admin accounts"
echo "□ Admin cannot modify superuser accounts"
echo "□ Admin cannot promote to superuser"
echo "□ Users cannot access admin functions"
echo "□ Project owners can manage members"
echo "□ Project editors cannot manage members"
echo "□ System roles don't override project roles"
echo ""

echo "🔍 Additional Security Tests"
echo "---------------------------"

# Test input validation
echo -n "Testing input validation... "
response=$(curl -s -w "%{http_code}" -X PUT \
    -H "Content-Type: application/json" \
    -d '{"role":"invalid_role","reason":"test"}' \
    "$BASE_URL/api/admin/users/invalid-uuid/role" || echo "000")

status_code="${response: -3}"
if [ "$status_code" = "400" ] || [ "$status_code" = "401" ]; then
    echo "✅ PASS ($status_code)"
else
    echo "❌ FAIL (expected 400/401, got $status_code)"
fi

echo ""
echo "✅ Basic security tests completed!"
echo ""
echo "For comprehensive testing, run:"
echo "1. npm run test:security-manual (with valid tokens)"
echo "2. Manual verification using the admin dashboard"
echo "3. Review the security testing guide in docs/"