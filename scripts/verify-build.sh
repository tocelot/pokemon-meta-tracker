#!/bin/bash
# scripts/verify-build.sh
# Run this script to verify the app builds and runs correctly

set -e  # Exit on any error

echo "🔍 Pokemon TCG Meta Tracker - Build Verification"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Function to run a check
run_check() {
  local name=$1
  local command=$2
  
  echo -n "Checking $name... "
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    FAILURES=$((FAILURES + 1))
    return 1
  fi
}

# Function to run a check and show output on failure
run_check_verbose() {
  local name=$1
  local command=$2
  
  echo -n "Checking $name... "
  local output
  if output=$(eval "$command" 2>&1); then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    echo -e "${YELLOW}Output:${NC}"
    echo "$output" | head -20
    FAILURES=$((FAILURES + 1))
    return 1
  fi
}

echo ""
echo "📦 Dependency Checks"
echo "--------------------"

run_check "Node.js installed" "node --version"
run_check "npm installed" "npm --version"
run_check "node_modules exists" "test -d node_modules"

echo ""
echo "📝 TypeScript Checks"
echo "--------------------"

run_check_verbose "TypeScript compilation" "npx tsc --noEmit"

echo ""
echo "🔧 Lint Checks"
echo "--------------"

run_check_verbose "ESLint" "npm run lint"

echo ""
echo "🏗️  Build Check"
echo "---------------"

run_check_verbose "Next.js build" "npm run build"

echo ""
echo "🌐 Runtime Checks"
echo "-----------------"

# Start server in background
echo -n "Starting dev server... "
npm run dev > /dev/null 2>&1 &
SERVER_PID=$!
sleep 8  # Wait for server to start

if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC}"
  
  # Test home page
  run_check "Home page (200 OK)" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 | grep -q 200"
  
  # Test API route
  run_check "Tournaments API (200 OK)" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/limitless/tournaments | grep -q 200"
  
  # Test API returns JSON array
  run_check "Tournaments API returns array" "curl -s http://localhost:3000/api/limitless/tournaments | head -c 1 | grep -q '\['"
  
else
  echo -e "${RED}✗ Server failed to start${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Cleanup
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "================================================"

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAILURES check(s) failed${NC}"
  exit 1
fi
