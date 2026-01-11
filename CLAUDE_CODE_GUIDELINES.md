# Claude Code Guidelines for Pokemon TCG Meta Tracker

This document provides best practices, testing strategies, and error prevention guidelines for Claude Code when building this app.

## Table of Contents
1. [Development Workflow](#development-workflow)
2. [Testing Strategy](#testing-strategy)
3. [Error Prevention](#error-prevention)
4. [Code Quality Rules](#code-quality-rules)
5. [Debugging Checklist](#debugging-checklist)

---

## Development Workflow

### Build Order (Dependencies First)

Always build in this order to avoid missing dependency errors:

```
1. Project setup (package.json, tsconfig, tailwind.config)
2. Types (src/lib/types.ts) - NO dependencies on other project files
3. Utilities (src/lib/utils.ts) - Only external deps
4. Services (src/lib/limitless.ts) - Depends on types
5. API Routes - Depends on services
6. Hooks - Depends on types, services
7. UI Components (smallest first):
   - src/components/ui/* (Button, Badge, Tabs)
   - src/components/DeckList.tsx
   - src/components/DeckCard.tsx
   - src/components/TournamentSelector.tsx
   - src/components/Header.tsx
8. Pages (depend on everything above)
9. Static data files (src/data/*.json)
```

### After Each File Creation

Run these checks after creating each file:

```bash
# 1. TypeScript compilation check
npx tsc --noEmit

# 2. If it's a component/page, check the dev server still runs
npm run dev &
sleep 5
curl -s http://localhost:3000 > /dev/null && echo "✓ Server OK" || echo "✗ Server failed"
kill %1

# 3. Lint check
npm run lint
```

### Incremental Building

**DO**: Build and test one component at a time
```bash
# Create component
# Run tsc --noEmit
# Fix any errors
# Move to next component
```

**DON'T**: Create all files at once then debug

---

## Testing Strategy

### 1. TypeScript Compilation Tests

After every file change:
```bash
npx tsc --noEmit
```

This catches:
- Import errors
- Type mismatches
- Missing exports
- Undefined variables

### 2. Runtime Smoke Tests

Create a simple test script to verify the app runs:

```bash
# scripts/smoke-test.sh
#!/bin/bash
set -e

echo "Building app..."
npm run build

echo "Starting server..."
npm run start &
SERVER_PID=$!
sleep 5

echo "Testing endpoints..."

# Test home page
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✓ Home page OK"
else
  echo "✗ Home page failed (HTTP $HTTP_CODE)"
  exit 1
fi

# Test API route
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/limitless/tournaments)
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✓ Tournaments API OK"
else
  echo "✗ Tournaments API failed (HTTP $HTTP_CODE)"
  exit 1
fi

# Cleanup
kill $SERVER_PID
echo "All smoke tests passed!"
```

### 3. Component Isolation Tests

Test components in isolation before integrating:

```tsx
// src/app/test/page.tsx (temporary test page)
import { DeckCard } from '@/components/DeckCard'

export default function TestPage() {
  return (
    <div className="p-8 bg-poke-darker min-h-screen">
      <h1 className="text-white text-2xl mb-4">Component Tests</h1>
      
      {/* Test DeckCard with mock data */}
      <DeckCard
        id="test-deck"
        name="Test Deck / Pokemon"
        tier={1}
        placements={[
          {
            placement: 1,
            playerName: "Test Player",
            tournament: { id: "test", name: "Test Regional", date: "2025-01-01" }
          }
        ]}
        source="tournament"
      />
    </div>
  )
}
```

### 4. API Route Tests

Test API routes directly:

```bash
# Test tournament list endpoint
curl http://localhost:3000/api/limitless/tournaments | jq '.'

# Test with refresh parameter
curl "http://localhost:3000/api/limitless/tournaments?refresh=1" | jq '.'

# Test tournament results endpoint
curl http://localhost:3000/api/limitless/tournaments/528/results | jq '.'
```

### 5. Manual UI Checklist

After building, manually verify:

```
[ ] Home page loads without console errors
[ ] Tournament selector expands/collapses
[ ] Tournaments can be selected/deselected
[ ] "Select Post-[Set]" button works
[ ] "Refresh List" button shows loading state
[ ] Deck cards display correctly
[ ] Clicking a deck card navigates to detail page
[ ] Deck list displays all 60 cards
[ ] Back navigation works
[ ] Creator tab shows recommendations
[ ] Responsive design works (resize browser)
[ ] Dark theme colors are correct
```

---

## Error Prevention

### Common Pitfalls to Avoid

#### 1. Import Path Errors

**Wrong:**
```typescript
import { DeckCard } from '../components/DeckCard'  // Relative paths break easily
```

**Right:**
```typescript
import { DeckCard } from '@/components/DeckCard'  // Use path alias
```

#### 2. Missing 'use client' Directive

**Wrong:**
```tsx
// src/components/TournamentSelector.tsx
import { useState } from 'react'  // Error: useState requires client component
```

**Right:**
```tsx
// src/components/TournamentSelector.tsx
'use client'

import { useState } from 'react'
```

**Rule:** Add `'use client'` to any component that uses:
- `useState`, `useEffect`, `useCallback`, etc.
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`localStorage`, `window`)

#### 3. Async Component Errors

**Wrong:**
```tsx
// Page component with async in wrong place
export default function Page() {
  const data = await fetch(...)  // Can't use await in non-async function
}
```

**Right (Server Component):**
```tsx
export default async function Page() {
  const data = await fetch(...)
}
```

**Right (Client Component):**
```tsx
'use client'
export default function Page() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch(...).then(setData)
  }, [])
}
```

#### 4. JSON Import Errors

**Wrong:**
```typescript
import data from './data.json'  // May fail without resolveJsonModule
```

**Right (ensure tsconfig.json has):**
```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

#### 5. Missing Key Props in Lists

**Wrong:**
```tsx
{items.map(item => <Card {...item} />)}
```

**Right:**
```tsx
{items.map(item => <Card key={item.id} {...item} />)}
```

#### 6. Cheerio Selector Failures

The Limitless TCG scraping may fail if selectors don't match. Always:

```typescript
// Include fallback data
function getFallbackTournaments() {
  return [
    // Hardcoded tournament data
  ]
}

// Use try-catch with fallback
try {
  const data = parseHTML(html)
  if (data.length === 0) throw new Error('No data parsed')
  return data
} catch {
  console.warn('Scraping failed, using fallback data')
  return getFallbackTournaments()
}
```

### Pre-Commit Checklist

Before considering any feature "done":

```bash
# 1. No TypeScript errors
npx tsc --noEmit

# 2. No lint errors  
npm run lint

# 3. Build succeeds
npm run build

# 4. Dev server starts
npm run dev

# 5. No console errors in browser
# (Check browser DevTools)
```

---

## Code Quality Rules

### TypeScript Strictness

Use strict TypeScript to catch errors early:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Component Structure

Every component should follow this structure:

```tsx
'use client'  // If needed

// 1. Imports (external first, then internal)
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SomeType } from '@/lib/types'

// 2. Types/Interfaces
interface ComponentProps {
  prop1: string
  prop2?: number
}

// 3. Component
export function Component({ prop1, prop2 = 0 }: ComponentProps) {
  // 3a. Hooks
  const [state, setState] = useState(false)
  
  // 3b. Derived state / computations
  const computed = prop1.toUpperCase()
  
  // 3c. Event handlers
  const handleClick = () => {
    setState(true)
  }
  
  // 3d. Render
  return (
    <div onClick={handleClick}>
      {computed}
    </div>
  )
}
```

### File Naming Conventions

```
src/
├── components/
│   ├── ui/
│   │   └── Button.tsx      # PascalCase for components
│   ├── DeckCard.tsx
│   └── DeckList.tsx
├── hooks/
│   └── useTournamentSelection.ts  # camelCase with 'use' prefix
├── lib/
│   ├── types.ts            # camelCase for utilities
│   ├── utils.ts
│   └── limitless.ts
├── app/
│   ├── page.tsx            # lowercase for Next.js conventions
│   └── api/
│       └── limitless/
│           └── tournaments/
│               └── route.ts
└── data/
    └── creators.json       # lowercase for data files
```

### Error Handling Pattern

Always handle errors gracefully:

```typescript
// API Routes
export async function GET() {
  try {
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

// Client-side
const [error, setError] = useState<string | null>(null)

try {
  const response = await fetch('/api/...')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error')
}

// Display error in UI
{error && (
  <div className="text-red-500 p-4 bg-red-500/10 rounded">
    Error: {error}
  </div>
)}
```

---

## Debugging Checklist

### When Something Doesn't Work

#### Build Errors

```bash
# 1. Check TypeScript errors
npx tsc --noEmit 2>&1 | head -50

# 2. Check for missing dependencies
npm ls | grep "UNMET"

# 3. Clear caches and reinstall
rm -rf node_modules .next
npm install
```

#### Runtime Errors

```bash
# 1. Check server logs
npm run dev  # Watch terminal output

# 2. Check browser console
# Open DevTools > Console

# 3. Check network requests
# Open DevTools > Network

# 4. Test API directly
curl http://localhost:3000/api/limitless/tournaments
```

#### Styling Issues

```bash
# 1. Verify Tailwind is processing
# Check if classes appear in page source

# 2. Check for typos in class names
# bg-poke-dark vs bg-pokedark (wrong)

# 3. Verify tailwind.config.ts has custom colors
```

#### Scraping Issues

```bash
# 1. Test Limitless directly
curl https://limitlesstcg.com/tournaments | head -100

# 2. Check if HTML structure changed
# Compare actual HTML to expected selectors

# 3. Verify cheerio is parsing
# Add console.log in API route
```

### Quick Fixes

| Problem | Solution |
|---------|----------|
| "Module not found" | Check import path, run `npm install` |
| "X is not a function" | Check export, might need `'use client'` |
| "Hydration mismatch" | Add `'use client'` or use `useEffect` |
| "Cannot read property of undefined" | Add null checks, verify data shape |
| Styles not applying | Check Tailwind config, class name typos |
| API returns empty | Check network tab, test endpoint directly |

---

## Automated Testing Setup (Optional)

If you want more robust testing, add Jest:

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

Create `jest.config.js`:
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
})
```

Create `jest.setup.js`:
```javascript
import '@testing-library/jest-dom'
```

Example test:
```tsx
// __tests__/components/DeckCard.test.tsx
import { render, screen } from '@testing-library/react'
import { DeckCard } from '@/components/DeckCard'

describe('DeckCard', () => {
  it('renders deck name', () => {
    render(
      <DeckCard
        id="test"
        name="Charizard ex"
        tier={1}
        source="tournament"
      />
    )
    expect(screen.getByText('Charizard ex')).toBeInTheDocument()
  })
})
```

Run tests:
```bash
npm test
```

---

## Summary: Claude Code Workflow

1. **Create file** → Run `npx tsc --noEmit`
2. **Fix any errors** → Re-run tsc
3. **Test in browser** → Check console for errors
4. **Move to next file** → Repeat

**Golden Rule**: Never create more than 2-3 files without running type checks and verifying the app still builds.
