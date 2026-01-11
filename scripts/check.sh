#!/bin/bash
# scripts/check.sh
# Quick check script - run after creating/modifying any file

echo "🔍 Quick Check"
echo "=============="

# TypeScript check
echo ""
echo "TypeScript:"
if npx tsc --noEmit 2>&1; then
  echo "✅ No TypeScript errors"
else
  echo "❌ TypeScript errors found (see above)"
  exit 1
fi

# Lint check (optional, comment out if slow)
echo ""
echo "Lint:"
if npm run lint 2>&1 | grep -q "error"; then
  echo "❌ Lint errors found"
  npm run lint
  exit 1
else
  echo "✅ No lint errors"
fi

echo ""
echo "✅ All checks passed!"
