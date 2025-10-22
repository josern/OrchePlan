#!/bin/bash
# Dependency Cleanup Script for OrchePlan Frontend
# Generated from dependency audit report

set -e

echo "=== OrchePlan Dependency Cleanup Script ==="
echo ""
echo "This script will remove unused dependencies and files identified in the audit."
echo ""

# Function to prompt for confirmation
confirm() {
    read -p "$1 (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

cd "$(dirname "$0")/../frontend"

echo "Current directory: $(pwd)"
echo ""

# Step 1: Remove definitely unused dependencies
if confirm "Remove embla-carousel-react and patch-package?"; then
    echo "Removing embla-carousel-react and patch-package..."
    npm uninstall embla-carousel-react patch-package
    echo "✅ Removed unused dependencies"
fi

echo ""

# Step 2: Remove unused Radix UI components
if confirm "Remove unused Radix UI components (accordion, checkbox, menubar, radio-group, progress)?"; then
    echo "Removing unused Radix UI dependencies..."
    npm uninstall \
        @radix-ui/react-accordion \
        @radix-ui/react-checkbox \
        @radix-ui/react-menubar \
        @radix-ui/react-radio-group \
        @radix-ui/react-progress
    
    echo "Removing unused component files..."
    rm -f src/components/ui/accordion.tsx
    rm -f src/components/ui/checkbox.tsx
    rm -f src/components/ui/menubar.tsx
    rm -f src/components/ui/radio-group.tsx
    rm -f src/components/ui/progress.tsx
    
    echo "✅ Removed unused Radix UI components"
fi

echo ""

# Step 3: Optionally remove recharts
if confirm "Remove recharts and chart.tsx? (Skip if you plan to add analytics/charts)"; then
    echo "Removing recharts..."
    npm uninstall recharts
    rm -f src/components/ui/chart.tsx
    echo "✅ Removed recharts and chart component"
fi

echo ""

# Step 4: Optionally remove AI/Genkit dependencies
if confirm "Remove Genkit/AI dependencies? (Skip if using AI features)"; then
    echo "Removing Genkit dependencies..."
    npm uninstall genkit @genkit-ai/googleai @genkit-ai/next
    npm uninstall -D genkit-cli
    
    if confirm "Also remove src/ai directory?"; then
        rm -rf src/ai
        echo "✅ Removed AI directory"
    fi
    
    echo "✅ Removed Genkit dependencies"
fi

echo ""

# Step 5: Verify installation
echo "Running npm install to clean up..."
npm install

echo ""
echo "Running TypeScript type check..."
npm run typecheck

echo ""
echo "=== Cleanup Complete ==="
echo ""
echo "Next steps:"
echo "1. Test the application: npm run dev"
echo "2. Run build to verify: npm run build"
echo "3. Commit changes if everything works"
echo ""
echo "To see what was removed, check: git status"
