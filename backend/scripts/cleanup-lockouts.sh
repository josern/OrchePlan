#!/bin/bash

# Account Lockout Cleanup Job
# This script can be run via cron to periodically clean up expired account locks

# Set the script directory as working directory
cd "$(dirname "$0")/.."

# Load environment variables if .env file exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run the cleanup script
echo "$(date): Starting account lockout cleanup..."

# Execute the TypeScript cleanup script
npx ts-node scripts/cleanup_lockouts.ts

if [ $? -eq 0 ]; then
    echo "$(date): Account lockout cleanup completed successfully"
else
    echo "$(date): Account lockout cleanup failed with exit code $?"
    exit 1
fi