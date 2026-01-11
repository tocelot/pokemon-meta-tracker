# Tech Stack Recommendations

## Recommended Stack: Next.js + TypeScript

### Frontend Framework: Next.js 14+ (App Router)

**Why Next.js:**
- Server-side rendering for fast initial load and SEO
- App Router provides clean file-based routing
- Built-in API routes for data fetching
- Excellent TypeScript support
- Easy deployment to Vercel (free tier available)

### Styling: Tailwind CSS

**Why Tailwind:**
- Rapid prototyping with utility classes
- Great for responsive design
- Built-in dark mode support
- Pairs well with component libraries

**Optional**: shadcn/ui for pre-built accessible components

### State Management

For V1, keep it simple:
- React's built-in `useState` and `useContext`
- Server components for data fetching where possible

### Data Storage

**Hybrid Approach**:

1. **Tournament Data** - Fetched dynamically from Limitless TCG
   - API routes scrape limitlesstcg.com
   - Results cached for 1 hour (ISR)
   - Fallback data if scraping fails

2. **Tournament Selection** - localStorage
   - User's selected tournaments persisted client-side
   - Pre-populates with post-current-set tournaments

3. **Creator Recommendations** - Static JSON
   - Manually curated deck recommendations
   - Located in `/data/creators.json`

```
/data
  /creators.json          # Manual creator recommendations
```

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      User's Browser                      │
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ localStorage    │    │ React State                 │ │
│  │ (selections)    │◄──►│ (tournaments, results)      │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────┐
│                    Next.js API Routes                    │
│  /api/limitless/tournaments      - List all tournaments │
│  /api/limitless/tournaments/[id]/results - Deck results │
└───────────────────────────────┬─────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────┐
│                    Limitless TCG                         │
│  https://limitlesstcg.com/tournaments                   │
│  https://limitlesstcg.com/tournaments/[id]/decklists    │
└─────────────────────────────────────────────────────────┘
```

### External APIs & Data Sources

#### Limitless TCG (Primary - Auto-fetched)
- Tournament list and deck results
- No official API - scraped via Cheerio
- Website: https://limitlesstcg.com and https://labs.limitlesstcg.com
- Cached for 1 hour to avoid rate limiting

#### Pokemon TCG API (for card images)
- **pokemontcg.io**: Free API for card data and images
- Rate limited but sufficient for static data
- Documentation: https://docs.pokemontcg.io/

#### YouTube (Manual data entry)
- No automated integration for V1
- Creator recommendations manually added to JSON
- Future: Could use YouTube Data API v3 for video metadata

### Deployment

**Recommended: Vercel**
- Free hobby tier
- Automatic deployments from GitHub
- Edge functions for API routes
- Great Next.js integration (they made it)

**Alternative: Netlify**
- Similar features to Vercel
- Good for static sites

### Development Tools

```json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0"
  }
}
```

## Project Structure

```
pokemon-tcg-meta/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Home page with tournament selector + tabs
│   ├── deck/
│   │   └── [id]/
│   │       └── page.tsx            # Deck detail view
│   ├── api/
│   │   └── limitless/
│   │       ├── tournaments/
│   │       │   └── route.ts        # Fetch tournament list from Limitless
│   │       │   └── [id]/
│   │       │       └── results/
│   │       │           └── route.ts # Fetch deck results for a tournament
│   └── globals.css
├── components/
│   ├── ui/                         # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Tabs.tsx
│   ├── DeckCard.tsx                # Deck preview card
│   ├── DeckList.tsx                # Full deck list display
│   ├── TournamentSelector.tsx      # Editable tournament selection panel
│   ├── CreatorSection.tsx
│   └── Header.tsx
├── hooks/
│   └── useTournamentSelection.ts   # Tournament selection state + localStorage
├── lib/
│   ├── types.ts                    # TypeScript interfaces
│   ├── utils.ts                    # Helper functions
│   └── limitless.ts                # Limitless TCG service functions
├── data/                           # Static data (creator recommendations only)
│   └── creators.json
├── public/
│   └── images/
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Alternative Stacks

### Option 2: Vite + React + Static Hosting

**Pros:**
- Simpler setup
- Faster development server
- No server-side complexity

**Cons:**
- No SSR (client-side only)
- Manual routing setup
- Need separate API if data becomes dynamic

### Option 3: Astro + Islands

**Pros:**
- Excellent for content-heavy sites
- Ships zero JS by default
- Supports React components

**Cons:**
- Less common, smaller community
- Overkill for this app size

## Recommendation Summary

For this project, I recommend:

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | Next.js 14 (App Router) | Best DX, API routes for scraping |
| Language | TypeScript | Type safety for data models |
| Styling | Tailwind CSS | Fast development |
| Components | shadcn/ui | Accessible, customizable |
| Scraping | Cheerio | Fast HTML parsing |
| Tournament Data | Limitless API routes | Auto-fetches new tournaments |
| Creator Data | Static JSON | Manual curation needed |
| Selection State | localStorage | Persists user choices |
| Deployment | Vercel | Free, automatic deploys |
| Card Images | pokemontcg.io API | Free, comprehensive |
