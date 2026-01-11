# Data Sources Reference

This document provides detailed information about data sources and current meta information for the Pokemon TCG Meta Tracker.

## Current Meta Context

### Latest Set Information

| Field | Value |
|-------|-------|
| Set Name | Phantasmal Flames |
| Set Code | PFL |
| Release Date | November 14, 2025 |
| Legal Format | Standard (SVI-PFL) |

### Relevant Tournaments (Post-Phantasmal Flames)

Only include results from these tournaments as they represent the current meta after the latest set release:

| Tournament | Location | Date | Players | Format |
|------------|----------|------|---------|--------|
| Stuttgart Regional | Stuttgart, Germany | Nov 29-30, 2025 | 2,200 | SVI-PFL |
| LAIC (São Paulo IC) | São Paulo, Brazil | Nov 21-23, 2025 | 2,117 | SVI-MEG |
| Las Vegas Regional | Las Vegas, USA | Nov 14-16, 2025 | ~1,500 | SVI-MEG |
| Buenos Aires Special | Buenos Aires, Argentina | Nov 15-16, 2025 | ~400 | SVI-MEG |

**Note**: São Paulo, Las Vegas, and Buenos Aires tournaments occurred during or just after Phantasmal Flames release, so some decks may not include PFL cards.

---

## Primary Data Source: Limitless TCG

### Website URLs

| Resource | URL |
|----------|-----|
| Main Site | https://limitlesstcg.com |
| Metagame Stats | https://limitlesstcg.com/decks |
| Tournament List | https://limitlesstcg.com/tournaments |
| Labs (Advanced) | https://labs.limitlesstcg.com |

### Specific Tournament Pages

| Tournament | Results URL | Decklists URL |
|------------|-------------|---------------|
| Stuttgart 2025 | https://limitlesstcg.com/tournaments/528 | https://limitlesstcg.com/tournaments/528/decklists |
| São Paulo LAIC | https://limitlesstcg.com/tournaments/516 | https://limitlesstcg.com/tournaments/516/decklists |

### Data Available from Limitless

- Full deck lists (60 cards)
- Player names
- Tournament placements (1st-8th typically)
- Deck archetype classifications
- Card set codes and numbers
- Tournament metadata (date, location, player count)

### Data Extraction Notes

Limitless TCG does not have a public API. Data can be obtained by:
1. Manual copy from website
2. Web scraping (respect rate limits and ToS)
3. Community-maintained exports

---

## Secondary Data Source: YouTube Creators

### Target Channels

| Creator | Channel URL | Content Focus | Upload Frequency |
|---------|-------------|---------------|------------------|
| AzulGG | https://youtube.com/@AzulGG | Tier lists, Deck guides, Coaching | Weekly |
| Celio's Network | https://youtube.com/@CeliosNetwork | Deck profiles, Gameplay | 2-3x/week |
| The Shuffle Squad | https://youtube.com/@TheShuffleSquad | Meta analysis, Tournament prep | Weekly |
| Nurse Jared | https://youtube.com/@NurseJared | Deck profiles, Budget options | Weekly |
| ZapdosTCG | https://youtube.com/@ZapdosTCG | Pro player insights, Tournament decks | 2x/week |

### Video Types to Monitor

1. **Tier List Videos**
   - Title patterns: "Tier List", "Best Decks", "Meta Ranking"
   - Usually posted after major tournaments
   - Contains deck rankings (S/A/B/C or Tier 1/2/3)

2. **Deck Profile Videos**
   - Title patterns: "Deck Profile", "Deck Guide", "How to Play"
   - Full deck list often in description or shown in video
   - Includes strategy explanations

3. **Tournament Analysis**
   - Title patterns: "Top 8", "Regional Results", "What Won"
   - Posted within days of major events
   - References winning lists

### Extracting Deck Lists from YouTube

Deck lists may appear in:
1. Video description (most common)
2. Pinned comment
3. Link to external site (pokemoncard.io, play.limitlesstcg.com)
4. Shown on-screen during video

### YouTube Data API (Optional)

For automated fetching of recent videos:

```typescript
// YouTube API v3 - Search by channel
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

async function getRecentVideos(channelId: string) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
    `key=${YOUTUBE_API_KEY}&` +
    `channelId=${channelId}&` +
    `part=snippet&` +
    `order=date&` +
    `maxResults=10&` +
    `type=video`
  )
  return response.json()
}
```

Channel IDs (can be found in channel URL or using API):
- AzulGG: Look up from channel
- Celio's Network: Look up from channel
- etc.

---

## Current Top Decks (As of December 2025)

Based on tournament results from Stuttgart and São Paulo:

### Tier 1 Decks

| Deck Archetype | Notable Placements | Key Cards |
|----------------|-------------------|-----------|
| Charizard ex / Noctowl | 1st Stuttgart | Charizard ex (OBF), Noctowl (SCR), Dawn (PFL) |
| Dragapult ex / Dusknoir | 2nd Stuttgart, Top 8 multiple | Dragapult ex (TWM), Dusknoir (PRE), Lillie's Determination |
| Gardevoir ex / Jellicent ex | 1st-2nd São Paulo | Gardevoir ex (SVI), Jellicent ex (WHT), Munkidori |
| Gholdengo ex / Lunatone | 3rd Stuttgart, 4th São Paulo | Gholdengo ex (PAR), Lunatone/Solrock (MEG), Fighting Gong |

### Tier 2 Decks

| Deck Archetype | Notable Placements | Key Cards |
|----------------|-------------------|-----------|
| Mega Absol ex Box | 3rd São Paulo | Mega Absol ex (MEG), Mega Kangaskhan ex, Cornerstone Ogerpon |
| Charizard ex / Pidgeot ex | Top 8 various | Charizard ex (OBF), Pidgeot ex (OBF) |
| Regidrago VSTAR | Top 16 various | Regidrago VSTAR, Kyurem, Giratina VSTAR |

### Key New Cards from Phantasmal Flames (PFL)

Cards seeing competitive play from the latest set:

| Card | Type | Role |
|------|------|------|
| Dawn | Supporter | Draw/Search - popular in Charizard decks |
| Charmander (PFL 11) | Pokemon | Alternative starter with better attack |
| Charmeleon (PFL 12) | Pokemon | Bridge evolution |

### Key Cards from Mega Evolution (MEG)

Many decks use cards from the Mega Evolution set:

| Card | Type | Role |
|------|------|------|
| Lunatone/Solrock | Pokemon | Energy acceleration for Gholdengo |
| Fighting Gong | Item | Search Item cards |
| Lillie's Determination | Supporter | Draw power |
| Boss's Orders (Ghetsis) | Supporter | Gust effect |
| Rare Candy | Item | Evolution skip |
| Ultra Ball | Item | Pokemon search |
| Mega Lucario ex | Pokemon | Alternative attacker |
| Mystery Garden | Stadium | Healing stadium |

### Key Cards from Black Bolt/White Flare (BLK/WHT)

| Card | Type | Role |
|------|------|------|
| Jellicent ex | Pokemon | Attacker for Gardevoir |
| Frillish | Pokemon | Basic for Jellicent |
| Hilda | Supporter | Draw support |
| Air Balloon | Tool | Free retreat |
| Genesect ex | Pokemon | Tech attacker for Gholdengo |

---

## Card Image Sources

### Pokemon TCG API

**Base URL**: https://api.pokemontcg.io/v2

**Example Request**:
```
GET https://api.pokemontcg.io/v2/cards/obf-125
```

Returns Charizard ex from Obsidian Flames.

**Rate Limits**: 20,000 requests/day (with API key), 1,000/day (without)

**Documentation**: https://docs.pokemontcg.io/

### Card Code Format

Cards are referenced by Set Code + Number:
- `OBF-125` = Obsidian Flames #125 (Charizard ex)
- `TWM-130` = Twilight Masquerade #130 (Dragapult ex)
- `MEG-119` = Mega Evolution #119 (Lillie's Determination)

### Set Code Reference

| Set Name | Code | Release |
|----------|------|---------|
| Phantasmal Flames | PFL | Nov 2025 |
| Mega Evolution | MEG | Sep 2025 |
| Black Bolt | BLK | Jul 2025 |
| White Flare | WHT | Jul 2025 |
| Journey Together | JTG | Mar 2025 |
| Prismatic Evolutions | PRE | Jan 2025 |
| Surging Sparks | SSP | Nov 2024 |
| Stellar Crown | SCR | Sep 2024 |
| Shrouded Fable | SFA | Aug 2024 |
| Twilight Masquerade | TWM | May 2024 |
| Temporal Forces | TEF | Mar 2024 |
| Paradox Rift | PAR | Nov 2023 |
| Paldea Evolved | PAL | Jun 2023 |
| Obsidian Flames | OBF | Aug 2023 |
| Scarlet & Violet Base | SVI | Mar 2023 |
| Pokemon 151 | MEW | Sep 2023 |
| Paldean Fates | PAF | Jan 2024 |

---

## Data Update Workflow

### Manual Update Process

1. **After Major Tournament (within 48 hours)**
   - Visit Limitless TCG tournament page
   - Copy Top 8 deck lists
   - Update `tournaments.json`
   - Update `meta.json` lastUpdated timestamp

2. **Weekly Creator Check**
   - Visit each YouTube channel
   - Check for new tier list or deck profile videos
   - Extract deck lists from descriptions
   - Update `creators.json`

3. **After New Set Release**
   - Update `meta.json` currentSet info
   - Clear older tournament data (pre-new-set)
   - Monitor for new archetypes

### Automated Update Options (Future)

1. **Limitless Scraping**
   - Use Puppeteer or Playwright
   - Respect rate limits (1 req/second max)
   - Run daily via cron job

2. **YouTube API Polling**
   - Check for new videos daily
   - Filter by title keywords
   - Extract deck lists from descriptions

3. **Community Data Sources**
   - play.limitlesstcg.com exports
   - pokemoncard.io database
   - RK9 Labs tournament data

---

## Sample Data Entry

### Tournament Result Entry

```json
{
  "deckId": "charizard-noctowl",
  "archetype": {
    "id": "charizard-noctowl",
    "name": "Charizard ex / Noctowl",
    "primaryPokemon": ["Charizard ex", "Noctowl", "Pidgeot ex"],
    "tier": 1
  },
  "tournament": {
    "id": "stuttgart-2025",
    "name": "Stuttgart Regional",
    "location": "Stuttgart, Germany",
    "date": "2025-11-29",
    "playerCount": 2200,
    "format": "Standard (SVI-PFL)"
  },
  "placement": 1,
  "playerName": "Nicolai Stiborg",
  "deckList": {
    "pokemon": [
      {"name": "Charmander", "setCode": "PAF", "setNumber": "7", "count": 2},
      {"name": "Charizard ex", "setCode": "OBF", "setNumber": "125", "count": 2}
      // ... rest of pokemon
    ],
    "trainers": [
      {"name": "Dawn", "setCode": "PFL", "setNumber": "87", "count": 4}
      // ... rest of trainers
    ],
    "energy": [
      {"name": "Fire Energy", "setCode": "MEE", "setNumber": "2", "count": 5}
      // ... rest of energy
    ]
  }
}
```

### Creator Recommendation Entry

```json
{
  "deckId": "dragapult-dusknoir",
  "archetype": {
    "id": "dragapult-dusknoir",
    "name": "Dragapult ex / Dusknoir",
    "primaryPokemon": ["Dragapult ex", "Dusknoir"],
    "tier": 1
  },
  "creator": {
    "id": "zapdostcg",
    "name": "ZapdosTCG",
    "channelUrl": "https://youtube.com/@ZapdosTCG"
  },
  "videoUrl": "https://youtube.com/watch?v=XXXXX",
  "videoTitle": "The BEST Control Deck for Stuttgart!",
  "publishDate": "2025-11-25",
  "tierRating": "Tier 1",
  "notes": "Strong spread damage and prize denial strategy."
}
```
