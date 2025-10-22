#!/bin/bash

# OrchePlan Logging System Demo
# This script demonstrates the logging capabilities

echo "🚀 OrchePlan Logging System Demo"
echo "================================="

# Start backend server in background for demo
echo "📝 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!

# Wait for server to start
sleep 5

echo "📊 Demonstrating logging features..."

# Test API endpoint to generate logs
echo "🔍 Making test API requests..."
curl -s http://localhost:3000/auth/me > /dev/null 2>&1 || echo "Expected auth error (generates logs)"

# Check if log files are created
echo "📁 Checking log files..."
if [ -d "logs" ]; then
    echo "✅ Log directory created"
    ls -la logs/
else
    echo "❌ Log directory not found"
fi

# Show recent logs if they exist
echo "📋 Recent log entries:"
if [ -f "logs/info-$(date +%Y-%m-%d).log" ]; then
    echo "--- INFO LOGS ---"
    tail -n 5 "logs/info-$(date +%Y-%m-%d).log" 2>/dev/null || echo "No info logs yet"
fi

if [ -f "logs/error-$(date +%Y-%m-%d).log" ]; then
    echo "--- ERROR LOGS ---"
    tail -n 5 "logs/error-$(date +%Y-%m-%d).log" 2>/dev/null || echo "No error logs yet"
fi

# Clean up
echo "🧹 Cleaning up..."
kill $BACKEND_PID 2>/dev/null

echo "✨ Demo complete!"
echo ""
echo "📚 Learn more:"
echo "- Read docs/logging-system.md for full documentation"
echo "- Check backend/logs/ directory for log files"
echo "- Open browser console for frontend logs"