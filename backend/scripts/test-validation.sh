#!/bin/bash

# Input Validation Test Script
# Tests the validation middleware with various invalid inputs

echo "🔒 Testing Input Validation Implementation"
echo "=========================================="

# Test server availability
echo "📡 Checking server availability..."
if ! curl -s http://localhost:3000/csrf-token > /dev/null; then
    echo "❌ Server not running. Please start with: npm run dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Test 1: Invalid email format
echo "🧪 Test 1: Invalid email format"
response=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email","password":"ValidPass123","name":"Test User"}')
echo "Response: $response"
if echo "$response" | grep -q "valid email"; then
    echo "✅ Email validation working"
else
    echo "❌ Email validation failed"
fi
echo ""

# Test 2: Weak password
echo "🧪 Test 2: Weak password validation"
response=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"weak","name":"Test User"}')
echo "Response: $response"
if echo "$response" | grep -q "Password must"; then
    echo "✅ Password strength validation working"
else
    echo "❌ Password strength validation failed"
fi
echo ""

# Test 3: XSS attempt in name field
echo "🧪 Test 3: XSS prevention in name field"
response=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","password":"ValidPass123","name":"<script>alert(\"xss\")</script>"}')
echo "Response: $response"
if echo "$response" | grep -q "script" || echo "$response" | grep -q "contain only"; then
    echo "✅ XSS prevention working"
else
    echo "❌ XSS prevention may not be working properly"
fi
echo ""

# Test 4: Missing required fields
echo "🧪 Test 4: Required field validation"
response=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}')
echo "Response: $response"
if echo "$response" | grep -q "required"; then
    echo "✅ Required field validation working"
else
    echo "❌ Required field validation failed"
fi
echo ""

# Test 5: Invalid project name length
echo "🧪 Test 5: Project name length validation"
# First, let's try to create a user and login to test project creation
echo "Creating test user first..."
curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"ValidPass123","name":"Test User"}' \
  --cookie-jar /tmp/test_cookies.txt > /dev/null

# Now test project creation with invalid name
response=$(curl -s -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"","description":"Test project"}' \
  --cookie /tmp/test_cookies.txt)
echo "Response: $response"
if echo "$response" | grep -q "between 1 and"; then
    echo "✅ Project name validation working"
else
    echo "❌ Project name validation failed"
fi
echo ""

# Cleanup
rm -f /tmp/test_cookies.txt

echo "🏁 Input validation tests completed!"
echo ""
echo "💡 Expected behavior:"
echo "   - All tests should show validation errors for invalid inputs"
echo "   - No actual user/project creation should succeed with invalid data"
echo "   - Error messages should be descriptive and field-specific"