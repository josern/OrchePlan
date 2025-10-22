#!/bin/bash

# Start backend server with external access
echo "Starting OrchePlan backend server..."
echo "Port: 3000"
echo "Binding to: 0.0.0.0 (all interfaces)"
echo "External URL: https://3000--main--orcheplan--andreas.coder.josern.com"
echo "Local URL: http://localhost:3000"
echo ""

# Set environment variables for external access
export HOST=0.0.0.0
export PORT=3000

# Start the server
npm start