# Pokemon TCG Meta Tracker - Project Documentation

## Quick Start for Claude Code

This folder contains everything needed to build a Pokemon TCG meta tracking web application. Read the documents in this order:

1. **[PRD.md](./PRD.md)** - Product Requirements Document
   - Overview of the app and its purpose
   - Feature requirements
   - Data models and types
   - UI/UX requirements

2. **[TECH_STACK.md](./TECH_STACK.md)** - Technology Recommendations
   - Recommended stack (Next.js + TypeScript + Tailwind)
   - Project structure
   - Alternative options

3. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Step-by-Step Build Instructions
   - Detailed code snippets for every component
   - Phase-by-phase implementation
   - Copy-paste ready code blocks

4. **[DATA_SOURCES.md](./DATA_SOURCES.md)** - Data Reference
   - Current meta information
   - Tournament data sources (Limitless TCG)
   - YouTube creator channels
   - Card image APIs
   - Sample data entries

## Project Summary

**What we're building**: A web app that aggregates Pokemon TCG competitive deck information from:
- Tournament results (auto-fetched from Limitless TCG with user-editable tournament selection)
- YouTube content creator recommendations (manual/static data)

**Key Features**:
- **Auto-discover tournaments** from Limitless TCG
- **Editable tournament selection** - pre-selects post-current-set tournaments, but users can add/remove any tournament
- View top-performing decks aggregated from selected tournaments
- See deck recommendations from popular creators
- Click into any deck to view the full 60-card list
- Filter between tournament data and creator content
- Persist tournament selection in localStorage

**Tech Stack**:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- API routes for Limitless TCG scraping
- Cheerio for HTML parsing
- Static JSON for creator data
- Deploy to Vercel

## Current Meta Context

- **Latest Set**: Phantasmal Flames (released November 14, 2025)
- **Relevant Tournaments**: Stuttgart, São Paulo LAIC, Las Vegas, Buenos Aires
- **Top Decks**: Charizard/Noctowl, Dragapult/Dusknoir, Gardevoir/Jellicent, Gholdengo/Lunatone

## Implementation Order

```
Phase 1: Project Setup (30 min)
├── Initialize Next.js with TypeScript + Tailwind
├── Install dependencies (including cheerio for scraping)
└── Configure theme colors

Phase 2: Types & Data Models (30 min)
├── Create TypeScript interfaces
├── Include tournament selection types
└── Define Limitless data structures

Phase 3: Limitless TCG Integration (1.5 hours)
├── Create Limitless service functions
├── Build API route for tournament list scraping
├── Build API route for deck results scraping
└── Add fallback data for when scraping fails

Phase 4: Tournament Selection Component (1 hour)
├── Create useTournamentSelection hook (with localStorage)
├── Build TournamentSelector UI component
├── Implement select/deselect functionality
└── Add "Select Post-[Set]" quick action

Phase 5: Core Components (1 hour)
├── Header component
├── DeckCard component (updated for multiple placements)
├── DeckList component
├── Tabs component

Phase 6: Static Creator Data (30 min)
├── Create creators.json with recommendations
└── (Creator data is manual since it comes from YouTube)

Phase 7: Pages (1 hour)
├── Home page with tournament selector + tabs
├── Deck detail page
└── Global styles

Phase 8: Testing & Deploy (30 min)
├── Test tournament fetching
├── Test selection persistence
└── Deploy to Vercel
```

## Data Entry Priority

Start with these decks (they have the most tournament success):

1. **Charizard ex / Noctowl** - 1st Stuttgart
2. **Dragapult ex / Dusknoir** - 2nd Stuttgart, multiple Top 8
3. **Gardevoir ex / Jellicent ex** - 1st & 2nd São Paulo
4. **Gholdengo ex / Lunatone** - 3rd Stuttgart, 4th São Paulo
5. **Mega Absol ex Box** - 3rd São Paulo

## Key Data Sources

| Source | URL | Data Type |
|--------|-----|-----------|
| Limitless TCG | https://limitlesstcg.com | Tournament results & deck lists |
| Limitless Labs | https://labs.limitlesstcg.com | Advanced tournament stats |
| Pokemon TCG API | https://api.pokemontcg.io | Card images |

## Notes for Claude Code

1. **Tournament Data is Dynamic**: Tournaments are fetched from Limitless TCG via API routes that scrape the website. This means new tournaments appear automatically.

2. **Tournament Selection is Editable**: Users can select which tournaments to include. By default, post-current-set tournaments are pre-selected, but users can add older tournaments or remove newer ones.

3. **Selection Persists**: Tournament selections are saved to localStorage so users don't lose their choices on refresh.

4. **Creator Data is Static**: YouTube creator recommendations are stored in a JSON file since there's no easy API to scrape deck lists from video descriptions.

5. **Fallback Data**: The API routes include hardcoded fallback data in case Limitless scraping fails (rate limiting, site changes, etc.).

6. **Dark Theme**: Use the Pokemon-inspired dark color palette defined in tailwind config.

7. **Mobile First**: Ensure responsive design works on all screen sizes.

8. **Type Safety**: Use TypeScript interfaces for all data structures.

## Questions?

If you need clarification on any requirements, refer to:
- PRD.md for feature questions
- DATA_SOURCES.md for current meta/deck information
- IMPLEMENTATION_GUIDE.md for code structure questions
