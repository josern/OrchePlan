#!/bin/bash
set -e

HOST=${HOST:-http://localhost:3000}

echo "Waiting 2s for server..."
sleep 2

echo "Signing up test user..."
curl -s -X POST "$HOST/auth/signup" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"testpass","name":"Test User"}' | jq || true

echo "Logging in test user..."
curl -s -X POST "$HOST/auth/login" -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"testpass"}' | jq || true

echo "Smoke test finished."
