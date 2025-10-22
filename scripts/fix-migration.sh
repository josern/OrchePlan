#!/bin/bash

# Fix failed Prisma migration
echo "==> Fixing failed Prisma migration..."

# Navigate to the backend directory
cd /opt/orcheplan/current/backend || {
    echo "❌ Could not find backend directory"
    exit 1
}

# Check migration status
echo "==> Checking migration status..."
sudo -u orcheplan npx prisma migrate status

# Mark the failed migration as resolved
echo "==> Marking failed migration as resolved..."
sudo -u orcheplan npx prisma migrate resolve --applied 20251016103312_add_parentid

# Try to deploy migrations again
echo "==> Attempting to deploy migrations..."
sudo -u orcheplan npx prisma migrate deploy

echo "==> Migration fix completed!"
echo "==> Check the status with: sudo -u orcheplan npx prisma migrate status"