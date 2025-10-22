#!/bin/bash

# Script to clean up console.log statements from frontend and backend

echo "🧹 Cleaning up console statements from frontend..."

# Frontend cleanup
find /home/coder/OrchePlan/frontend/src -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read file; do
    echo "Processing: $file"
    
    # Remove console.log statements (but keep console.error, console.warn in production)
    sed -i '/console\.log(/d' "$file"
    sed -i '/console\.debug(/d' "$file"
    sed -i '/console\.group(/d' "$file"
    sed -i '/console\.groupEnd(/d' "$file"
    
    # Remove standalone debug lines
    sed -i '/^\s*\/\/.*DEBUG/d' "$file"
    sed -i '/^\s*\/\*.*DEBUG.*\*\//d' "$file"
    
    # Remove lines that only contain debug logging setup
    sed -i '/^\s*console\.log.*request.*options/d' "$file"
    sed -i '/^\s*console\.log.*Request ID/d' "$file"
    sed -i '/^\s*console\.log.*Response received/d' "$file"
done

echo "🧹 Cleaning up console statements from backend..."

# Backend cleanup
find /home/coder/OrchePlan/backend/src -name "*.ts" -o -name "*.js" | while read file; do
    echo "Processing: $file"
    
    # Remove console.log statements (but keep console.error, console.warn in production)
    sed -i '/console\.log(/d' "$file"
    sed -i '/console\.debug(/d' "$file"
    sed -i '/console\.group(/d' "$file"
    sed -i '/console\.groupEnd(/d' "$file"
    
    # Remove standalone debug lines
    sed -i '/^\s*\/\/.*DEBUG/d' "$file"
    sed -i '/^\s*\/\*.*DEBUG.*\*\//d' "$file"
    
    # Remove debug logging from tasks route
    sed -i '/\[DEBUG\]/d' "$file"
done

echo "✅ Console cleanup completed!"