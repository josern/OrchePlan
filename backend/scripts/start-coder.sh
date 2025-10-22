#!/bin/bash

# Start backend server for Coder environment with HTTPS support
echo "Starting OrchePlan backend for Coder environment..."
echo "Port: 3000"
echo "Binding to: 0.0.0.0 (all interfaces)"
echo "External URL: https://3000--main--orcheplan--andreas.coder.josern.com"
echo "Frontend URL: https://9002--main--orcheplan--andreas.coder.josern.com"
echo "Cookie settings: secure=true, sameSite=none"
echo ""

# Load Coder-specific environment variables
if [ -f .env.coder ]; then
    export $(cat .env.coder | grep -v '^#' | xargs)
    echo "Loaded Coder environment variables"
else
    echo "Warning: .env.coder not found, using defaults"
    export HOST=0.0.0.0
    export PORT=3000
    export AUTH_COOKIE_SECURE=true
    export AUTH_COOKIE_SAMESITE=none
    export FRONTEND_ORIGINS=https://9002--main--orcheplan--andreas.coder.josern.com
fi

echo "Starting server..."
npm run dev