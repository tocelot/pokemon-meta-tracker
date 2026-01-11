# Pokemon TCG Meta Tracker - Product Requirements Document

## Overview

A web application that aggregates and displays the current Pokemon TCG competitive meta from two primary data sources: tournament results from Limitless TCG and deck recommendations from prominent YouTube content creators.

## Problem Statement

Competitive Pokemon TCG players need to quickly understand the current metagame to prepare for tournaments. Currently, this requires manually checking multiple sources:
- Tournament result websites like Limitless TCG
- Various YouTube channels for deck profiles and tier lists
- Community forums and social media

This app consolidates these sources into a single, easy-to-navigate interface.

## Target Users

- Competitive Pokemon TCG players preparing for tournaments
- Casual players interested in the competitive meta
- Content creators researching deck trends

## Core Features

### 1. Tournament Results Section

**Data Source**: https://limitlesstcg.com/tournaments (auto-fetched)

Display tournament performance data from major events. The app automatically discovers tournaments from Limitless TCG and pre-selects those held after the release of the latest set.

#### Tournament Selection Feature

**Auto-Discovery**:
- App fetches the list of all available tournaments from Limitless TCG
- Tournaments are filtered by type (Regional, International, Special Event, Worlds)
- Pre-selects tournaments that occurred after the current set's release date

**Refresh Behavior**:
- Tournament list is fetched automatically when the app loads
- Results are cached for 1 hour (server-side)
- Users can manually refresh via "Refresh List" button (bypasses cache)
- Last fetched timestamp displayed in the selector footer

**User Controls**:
- Tournament selector panel (collapsible) showing all available tournaments
- Checkboxes to include/exclude specific tournaments
- "Select All Post-[Set Name]" quick button
- "Clear All" and "Select All" buttons
- "Refresh List" button to fetch latest tournaments from Limitless
- Visual indicator showing which tournaments are currently included
- Tournament metadata displayed: name, date, player count, location

**Pre-Selected Tournaments (Post-Phantasmal Flames, Nov 14, 2025)**:
- Stuttgart Regional Championship (November 29-30, 2025) - 2200 players
- São Paulo International Championship (November 21-23, 2025) - 2117 players  
- Las Vegas Regional Championship (November 14-16, 2025)
- Buenos Aires Special Event (November 15-16, 2025)

**Display Requirements**:
- Show deck archetypes with their conversion rates (Day 2 conversion)
- Display win rates where available
- Show top placements (1st-8th place finishes)
- Filter/sort by tournament or combined view
- Visual indicators for tier placement (Tier 1, Tier 2, etc.)
- Clear indication of which tournaments are contributing to the displayed data

**Key Deck Archetypes to Track** (based on current meta):
- Charizard ex / Noctowl
- Charizard ex / Pidgeot ex
- Dragapult ex / Dusknoir
- Gardevoir ex / Jellicent ex
- Gholdengo ex / Lunatone
- Mega Absol ex Box
- Regidrago VSTAR
- Lugia VSTAR
- And others as they appear in results

### 2. Creator Recommendations Section

**Data Sources**: YouTube channels of prominent TCG content creators

**Target Creators**:
| Creator | YouTube Channel | Focus |
|---------|----------------|-------|
| AzulGG | @AzulGG | Competitive analysis, deck guides |
| Celio's Network | @CeliosNetwork | Deck profiles, tournament prep |
| The Shuffle Squad | @TheShuffleSquad | Meta analysis, tier lists |
| Nurse Jared | @NurseJared | Deck profiles, gameplay |
| ZapdosTCG | @ZapdosTCG | Pro player insights, deck guides |

**Content Types to Aggregate**:
- Tier List videos
- Deck Introduction/Profile videos
- Post-tournament analysis videos

**Display Requirements**:
- Show recommended decks with tier ratings (if provided)
- Link to source video
- Display deck list if available in video description
- Show publication date for relevance
- Creator attribution

### 3. Deck Detail View

When a user clicks on any deck (from either section):

**Display**:
- Full 60-card deck list organized by:
  - Pokemon (sorted by evolution line)
  - Trainer cards (Supporters, Items, Tools, Stadiums)
  - Energy
- Card images (optional, from Pokemon TCG API or similar)
- Card counts
- Estimated deck cost (if data available)
- Source attribution (tournament placement or creator recommendation)
- Multiple list variations if available

### 4. Data Freshness Indicators

- Show "Last Updated" timestamps for each data source
- Visual indicator for data age (green = <24hrs, yellow = 1-7 days, red = >7 days)
- Manual refresh capability

## User Interface Requirements

### Layout

```
+--------------------------------------------------+
|  Pokemon TCG Meta Tracker                        |
|  Latest Set: Phantasmal Flames (Nov 14, 2025)   |
+--------------------------------------------------+
|                                                  |
|  [Tournament Results]  [Creator Recommendations] |
|                                                  |
+--------------------------------------------------+
|  ▼ Tournament Selection (4 selected)             |
|  +--------------------------------------------+  |
|  | [Select Post-PFL] [Clear All] [Select All]|  |
|  | [🔄 Refresh List]                          |  |
|  +--------------------------------------------+  |
|  | ☑ Stuttgart Regional (Nov 29) - 2200      |  |
|  | ☑ São Paulo LAIC (Nov 21) - 2117          |  |
|  | ☑ Las Vegas Regional (Nov 14) - 1500      |  |
|  | ☑ Buenos Aires Special (Nov 15) - 400     |  |
|  | ☐ Gdańsk Regional (Nov 1) - Pre-set       |  |
|  | ☐ Brisbane Regional (Nov 1) - Pre-set     |  |
|  +--------------------------------------------+  |
|  | Data from Limitless | Last updated: 2:30 PM|  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
|                                                  |
|  DECK CARDS (Grid/List View)                     |
|                                                  |
|  +----------+  +----------+  +----------+        |
|  | Deck 1   |  | Deck 2   |  | Deck 3   |        |
|  | Stats    |  | Stats    |  | Stats    |        |
|  +----------+  +----------+  +----------+        |
|                                                  |
+--------------------------------------------------+
```

### Deck Card Component

Each deck card should show:
- Deck archetype name (e.g., "Charizard ex / Noctowl")
- Primary Pokemon image/icon
- Key stats (conversion rate, placements, or tier rating)
- Source indicator (tournament icon or creator avatar)
- Click to expand for full deck list

### Responsive Design

- Desktop: Grid layout with 3-4 columns
- Tablet: 2 columns
- Mobile: Single column, card-based layout

## Technical Requirements

### Data Architecture

The app should support two modes:

1. **Static Mode** (MVP): Pre-populated JSON data files that can be manually updated
2. **Dynamic Mode** (Future): API integrations for live data

### Data Models

```typescript
interface DeckArchetype {
  id: string;
  name: string;
  primaryPokemon: string[];
  tier?: number;
  sources: DeckSource[];
}

interface TournamentResult {
  deckId: string;
  tournament: Tournament;
  placement: number;
  playerName: string;
  deckList: DeckList;
  conversionRate?: number;
}

interface CreatorRecommendation {
  deckId: string;
  creator: Creator;
  videoUrl: string;
  videoTitle: string;
  publishDate: string;
  tierRating?: string;
  deckList?: DeckList;
}

interface DeckList {
  pokemon: CardEntry[];
  trainers: CardEntry[];
  energy: CardEntry[];
}

interface CardEntry {
  name: string;
  setCode: string;
  setNumber: string;
  count: number;
  imageUrl?: string;
}

interface Tournament {
  id: string;
  name: string;
  location: string;
  date: string;
  playerCount: number;
  format: string;
  limitlessUrl: string;        // URL to tournament on Limitless
  isPostCurrentSet: boolean;   // Auto-calculated based on set release date
  isSelected: boolean;         // User selection state
}

interface Creator {
  id: string;
  name: string;
  channelUrl: string;
  avatarUrl?: string;
}

// Tournament Discovery Types
interface LimitlessTournamentList {
  tournaments: LimitlessTournament[];
  lastFetched: string;
}

interface LimitlessTournament {
  id: string;
  name: string;
  date: string;
  playerCount: number;
  location: string;
  type: 'regional' | 'international' | 'special' | 'worlds' | 'other';
  format: string;
  url: string;
}

// User Preferences (persisted to localStorage)
interface UserTournamentSelection {
  selectedTournamentIds: string[];
  lastModified: string;
}
```

## Success Metrics

1. **Usability**: Users can identify top meta decks within 30 seconds
2. **Accuracy**: Tournament data matches official sources
3. **Freshness**: Data updated within 48 hours of major events
4. **Completeness**: 90%+ of Day 2 deck archetypes represented

## Out of Scope (V1)

- User accounts / authentication
- Deck building tools
- Price tracking / market integration
- Mobile native apps
- Real-time tournament coverage
- Historical trend analysis
- Matchup data

## Future Enhancements (V2+)

- Pokemon TCG Pocket integration
- Deck comparison tools
- Export to deck builder formats
- Push notifications for meta shifts
- Community voting on deck viability
- Integration with card shop inventory
