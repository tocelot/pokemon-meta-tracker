# CLAUDE.md - Instructions for Claude Code

This file contains instructions for Claude Code when working on this project.

## Project Structure

```
pokemon_meta_tracker/          ← You are here (project root)
├── CLAUDE.md                  ← This file
├── README.md, PRD.md, etc.    ← Documentation
├── scripts/                   ← Verification scripts
└── app/                       ← Next.js application
    ├── src/
    ├── package.json
    └── ...
```

**IMPORTANT**: The Next.js app lives in the `app/` subfolder. Run all npm commands from there:
```bash
cd app
npm run dev
```

## Project Overview

Pokemon TCG Meta Tracker - A Next.js app that aggregates competitive deck information from Limitless TCG tournaments and YouTube creators.

## Key Documentation Files

- `README.md` - Project summary and quick start
- `PRD.md` - Full product requirements
- `IMPLEMENTATION_GUIDE.md` - Step-by-step code with complete snippets
- `TECH_STACK.md` - Technology choices and architecture
- `DATA_SOURCES.md` - Tournament data and API information
- `CLAUDE_CODE_GUIDELINES.md` - Testing and error prevention
- `SETUP_GUIDE.md` - Folder structure explanation

## Step 1: Initialize the App

First, create the Next.js app in the `app/` subfolder:

```bash
npx create-next-app@latest app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd app
npm install @radix-ui/react-tabs @radix-ui/react-dialog class-variance-authority clsx tailwind-merge lucide-react date-fns cheerio
npm install -D @types/cheerio
```

## Step 2: Build Order (IMPORTANT)

Build files in this exact order to avoid dependency errors. All paths below are relative to the `app/` folder:

1. `tailwind.config.ts` (update with custom colors - see IMPLEMENTATION_GUIDE.md)
2. `src/lib/types.ts`
3. `src/lib/utils.ts`
4. `src/lib/limitless.ts`
5. `src/app/api/limitless/tournaments/route.ts`
6. `src/app/api/limitless/tournaments/[id]/results/route.ts`
7. `src/hooks/useTournamentSelection.ts`
8. `src/components/ui/Tabs.tsx`
9. `src/components/Header.tsx`
10. `src/components/DeckList.tsx`
11. `src/components/DeckCard.tsx`
12. `src/components/TournamentSelector.tsx`
13. `src/data/creators.json`
14. `src/app/page.tsx`
15. `src/app/deck/[id]/page.tsx`
16. `src/app/globals.css` (update existing)
17. `src/app/layout.tsx` (update existing)

## After Every File

Run these commands **from the `app/` directory** after creating/modifying each file:

```bash
cd app  # Make sure you're in the app folder!
npx tsc --noEmit  # Check for TypeScript errors
npm run lint      # Check for lint errors
```

If errors occur, fix them before moving to the next file.

## Testing Commands

All commands run from the `app/` folder:

```bash
cd app  # Always be in the app folder

# TypeScript check (run frequently)
npx tsc --noEmit

# Lint check
npm run lint

# Build check (run before considering done)
npm run build

# Start dev server
npm run dev

# Test API endpoints (in a separate terminal)
curl http://localhost:3000/api/limitless/tournaments
```

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "Module not found" | Check import path uses `@/` alias |
| "useState is not defined" | Add `'use client'` at top of file |
| "Cannot read property of undefined" | Add null checks |
| Build fails with no clear error | Run `npx tsc --noEmit` for details |

## Files Requiring 'use client'

These files must have `'use client'` as the first line:

- `src/hooks/useTournamentSelection.ts`
- `src/components/TournamentSelector.tsx`
- `src/components/ui/Tabs.tsx`
- `src/app/page.tsx` (because it uses hooks)

## Key Dependencies

```bash
npm install @radix-ui/react-tabs @radix-ui/react-dialog class-variance-authority clsx tailwind-merge lucide-react date-fns cheerio
npm install -D @types/cheerio
```

## API Routes

The app scrapes Limitless TCG. If scraping fails, fallback data is returned. Key routes:

- `GET /api/limitless/tournaments` - List all tournaments
- `GET /api/limitless/tournaments?refresh=1` - Bypass cache
- `GET /api/limitless/tournaments/[id]/results` - Get deck results

## Data Flow

```
Limitless TCG (scraped) → API Routes → React Hooks → Components
                                          ↓
                                    localStorage (selections)
```

## Don't Forget

1. Tailwind custom colors are defined in `tailwind.config.ts` (`poke-red`, `poke-blue`, `poke-yellow`, `poke-dark`, `poke-darker`)
2. All deck results are cached for 1 hour server-side
3. Tournament selections persist to localStorage
4. Creator data is static JSON (not scraped)
5. Test the app in browser after major changes
