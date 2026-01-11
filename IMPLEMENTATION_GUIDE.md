# Implementation Guide for Claude Code

This document provides step-by-step instructions for building the Pokemon TCG Meta Tracker web app.

## Phase 1: Project Setup

### Step 1.1: Initialize Next.js Project

```bash
npx create-next-app@latest pokemon-tcg-meta --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd pokemon-tcg-meta
```

### Step 1.2: Install Dependencies

```bash
# UI Components
npm install @radix-ui/react-tabs @radix-ui/react-dialog class-variance-authority clsx tailwind-merge lucide-react

# Utilities
npm install date-fns

# Web Scraping (for Limitless TCG)
npm install cheerio
npm install -D @types/cheerio
```

### Step 1.3: Configure Tailwind

Update `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Pokemon-inspired color palette
        'poke-red': '#E3350D',
        'poke-blue': '#3B5998',
        'poke-yellow': '#FFCC00',
        'poke-dark': '#1a1a2e',
        'poke-darker': '#0f0f1a',
      },
    },
  },
  plugins: [],
}
export default config
```

### Step 1.4: Create Utility Functions

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
```

---

## Phase 2: Type Definitions

### Step 2.1: Create Type Definitions

Create `src/lib/types.ts`:

```typescript
// Core Types
export interface CardEntry {
  name: string
  setCode: string
  setNumber: string
  count: number
  imageUrl?: string
}

export interface DeckList {
  pokemon: CardEntry[]
  trainers: CardEntry[]
  energy: CardEntry[]
}

export interface Tournament {
  id: string
  name: string
  location: string
  date: string
  playerCount: number
  format: string
}

export interface Creator {
  id: string
  name: string
  channelUrl: string
  avatarUrl?: string
}

export interface DeckArchetype {
  id: string
  name: string
  primaryPokemon: string[]
  tier?: number
  imageUrl?: string
}

export interface TournamentResult {
  deckId: string
  archetype: DeckArchetype
  tournament: Tournament
  placement: number
  playerName: string
  deckList: DeckList
  conversionRate?: number
}

export interface CreatorRecommendation {
  deckId: string
  archetype: DeckArchetype
  creator: Creator
  videoUrl: string
  videoTitle: string
  publishDate: string
  tierRating?: string
  deckList?: DeckList
  notes?: string
}

export interface MetaData {
  lastUpdated: string
  currentSet: {
    name: string
    releaseDate: string
    code: string
  }
}

// UI Types
export type DataSource = 'tournament' | 'creator'
export type ViewMode = 'grid' | 'list'
```

---

## Phase 3: Limitless TCG Integration

### Step 3.1: Create Limitless Service

Create `src/lib/limitless.ts`:

```typescript
import { Tournament, TournamentResult, DeckList } from './types'

const LIMITLESS_BASE_URL = 'https://limitlesstcg.com'

// Tournament type mapping based on URL patterns
type TournamentType = 'regional' | 'international' | 'special' | 'worlds' | 'other'

export interface LimitlessTournament {
  id: string
  name: string
  date: string
  playerCount: number
  location: string
  type: TournamentType
  format: string
  url: string
}

/**
 * Fetches the list of tournaments from Limitless TCG
 * Note: Limitless doesn't have a public API, so this scrapes the tournaments page
 * In production, you may want to cache this or use a proxy
 */
export async function fetchTournamentList(): Promise<LimitlessTournament[]> {
  try {
    const response = await fetch('/api/limitless/tournaments')
    if (!response.ok) throw new Error('Failed to fetch tournaments')
    return response.json()
  } catch (error) {
    console.error('Error fetching tournament list:', error)
    return []
  }
}

/**
 * Fetches deck results for a specific tournament
 */
export async function fetchTournamentResults(tournamentId: string): Promise<TournamentResult[]> {
  try {
    const response = await fetch(`/api/limitless/tournaments/${tournamentId}/results`)
    if (!response.ok) throw new Error('Failed to fetch tournament results')
    return response.json()
  } catch (error) {
    console.error('Error fetching tournament results:', error)
    return []
  }
}

/**
 * Determines if a tournament occurred after a given date
 */
export function isAfterDate(tournamentDate: string, compareDate: string): boolean {
  return new Date(tournamentDate) >= new Date(compareDate)
}

/**
 * Filters tournaments to only those after the current set release
 */
export function filterPostSetTournaments(
  tournaments: LimitlessTournament[],
  setReleaseDate: string
): LimitlessTournament[] {
  return tournaments.filter(t => isAfterDate(t.date, setReleaseDate))
}

/**
 * Filters to only major tournament types (Regional, IC, Special, Worlds)
 */
export function filterMajorTournaments(tournaments: LimitlessTournament[]): LimitlessTournament[] {
  const majorTypes: TournamentType[] = ['regional', 'international', 'special', 'worlds']
  return tournaments.filter(t => majorTypes.includes(t.type))
}
```

### Step 3.2: Create Limitless API Routes

Create `src/app/api/limitless/tournaments/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const revalidate = 3600 // Cache for 1 hour

export async function GET(request: Request) {
  // Check if this is a manual refresh request (bypass cache)
  const { searchParams } = new URL(request.url)
  const isManualRefresh = searchParams.has('refresh')
  
  try {
    // Fetch the tournaments page from Limitless
    const response = await fetch('https://limitlesstcg.com/tournaments', {
      headers: {
        'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0',
      },
      // For manual refresh, add cache: 'no-store' to bypass Next.js cache
      ...(isManualRefresh && { cache: 'no-store' }),
    })
    
    if (!response.ok) {
      throw new Error(`Limitless returned ${response.status}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const tournaments: any[] = []
    
    // Parse tournament entries from the page
    // Note: Selector may need adjustment based on actual Limitless HTML structure
    $('.tournament-item, [data-tournament]').each((_, element) => {
      const $el = $(element)
      const id = $el.attr('data-id') || $el.find('a').attr('href')?.split('/').pop() || ''
      const name = $el.find('.tournament-name, h3, .name').text().trim()
      const dateText = $el.find('.tournament-date, .date').text().trim()
      const playerCount = parseInt($el.find('.player-count, .players').text().replace(/\D/g, '')) || 0
      const location = $el.find('.location').text().trim()
      
      if (id && name) {
        tournaments.push({
          id,
          name,
          date: parseDate(dateText),
          playerCount,
          location,
          type: inferTournamentType(name),
          format: 'Standard',
          url: `https://limitlesstcg.com/tournaments/${id}`,
        })
      }
    })
    
    return NextResponse.json(tournaments)
  } catch (error) {
    console.error('Error fetching Limitless tournaments:', error)
    
    // Return fallback data if scraping fails
    return NextResponse.json(getFallbackTournaments())
  }
}

function parseDate(dateText: string): string {
  // Handle various date formats from Limitless
  // e.g., "29th November 2025", "November 29-30, 2025"
  try {
    const date = new Date(dateText.replace(/(\d+)(st|nd|rd|th)/, '$1'))
    return date.toISOString().split('T')[0]
  } catch {
    return dateText
  }
}

function inferTournamentType(name: string): string {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('international') || nameLower.includes(' ic ')) return 'international'
  if (nameLower.includes('regional')) return 'regional'
  if (nameLower.includes('special')) return 'special'
  if (nameLower.includes('world')) return 'worlds'
  return 'other'
}

function getFallbackTournaments() {
  // Hardcoded fallback data in case scraping fails
  return [
    {
      id: '528',
      name: 'Stuttgart Regional Championship',
      date: '2025-11-29',
      playerCount: 2200,
      location: 'Stuttgart, Germany',
      type: 'regional',
      format: 'Standard (SVI-PFL)',
      url: 'https://limitlesstcg.com/tournaments/528',
    },
    {
      id: '516',
      name: 'Latin America International Championship',
      date: '2025-11-21',
      playerCount: 2117,
      location: 'São Paulo, Brazil',
      type: 'international',
      format: 'Standard (SVI-MEG)',
      url: 'https://limitlesstcg.com/tournaments/516',
    },
    {
      id: 'las-vegas-2025',
      name: 'Las Vegas Regional Championship',
      date: '2025-11-14',
      playerCount: 1500,
      location: 'Las Vegas, USA',
      type: 'regional',
      format: 'Standard (SVI-MEG)',
      url: 'https://limitlesstcg.com/tournaments/las-vegas-2025',
    },
    {
      id: 'buenos-aires-2025',
      name: 'Buenos Aires Special Event',
      date: '2025-11-15',
      playerCount: 400,
      location: 'Buenos Aires, Argentina',
      type: 'special',
      format: 'Standard (SVI-MEG)',
      url: 'https://limitlesstcg.com/tournaments/buenos-aires-2025',
    },
  ]
}
```

Create `src/app/api/limitless/tournaments/[id]/results/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const revalidate = 3600 // Cache for 1 hour

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Fetch the decklists page for this tournament
    const response = await fetch(
      `https://limitlesstcg.com/tournaments/${id}/decklists`,
      {
        headers: {
          'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error(`Limitless returned ${response.status}`)
    }
    
    const html = await response.text()
    const results = parseDecklists(html, id)
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching tournament results:', error)
    return NextResponse.json([])
  }
}

function parseDecklists(html: string, tournamentId: string) {
  const $ = cheerio.load(html)
  const results: any[] = []
  
  // Parse each decklist entry
  // Note: Selectors based on Limitless HTML structure - may need adjustment
  $('.decklist, [data-deck]').each((index, element) => {
    const $deck = $(element)
    
    const placement = index + 1
    const playerName = $deck.find('.player-name, .player').text().trim()
    const deckName = $deck.find('.deck-name, .archetype').text().trim()
    
    // Parse card list
    const pokemon: any[] = []
    const trainers: any[] = []
    const energy: any[] = []
    
    $deck.find('.pokemon .card, [data-category="pokemon"] .card').each((_, card) => {
      const $card = $(card)
      pokemon.push({
        name: $card.find('.card-name').text().trim(),
        setCode: $card.find('.set-code').text().trim(),
        setNumber: $card.find('.set-number').text().trim(),
        count: parseInt($card.find('.count').text()) || 1,
      })
    })
    
    $deck.find('.trainer .card, [data-category="trainer"] .card').each((_, card) => {
      const $card = $(card)
      trainers.push({
        name: $card.find('.card-name').text().trim(),
        setCode: $card.find('.set-code').text().trim(),
        setNumber: $card.find('.set-number').text().trim(),
        count: parseInt($card.find('.count').text()) || 1,
      })
    })
    
    $deck.find('.energy .card, [data-category="energy"] .card').each((_, card) => {
      const $card = $(card)
      energy.push({
        name: $card.find('.card-name').text().trim(),
        setCode: $card.find('.set-code').text().trim(),
        setNumber: $card.find('.set-number').text().trim(),
        count: parseInt($card.find('.count').text()) || 1,
      })
    })
    
    if (deckName || playerName) {
      results.push({
        deckId: generateDeckId(deckName),
        archetype: {
          id: generateDeckId(deckName),
          name: deckName,
          primaryPokemon: extractPrimaryPokemon(deckName),
        },
        tournament: { id: tournamentId },
        placement,
        playerName,
        deckList: { pokemon, trainers, energy },
      })
    }
  })
  
  return results
}

function generateDeckId(deckName: string): string {
  return deckName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function extractPrimaryPokemon(deckName: string): string[] {
  // Extract Pokemon names from deck name like "Charizard ex / Noctowl"
  return deckName
    .split(/[\/,&]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}
```

### Step 3.3: Install Cheerio for HTML Parsing

```bash
npm install cheerio
npm install -D @types/cheerio
```

---

## Phase 4: Tournament Selection Component

### Step 4.1: Create Tournament Selector Hook

Create `src/hooks/useTournamentSelection.ts`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { LimitlessTournament } from '@/lib/limitless'

const STORAGE_KEY = 'pokemon-tcg-meta-selected-tournaments'

interface UseTournamentSelectionReturn {
  tournaments: LimitlessTournament[]
  selectedIds: Set<string>
  isLoading: boolean
  error: string | null
  lastFetched: Date | null
  toggleTournament: (id: string) => void
  selectAll: () => void
  clearAll: () => void
  selectPostSet: (setReleaseDate: string) => void
  isSelected: (id: string) => boolean
  refreshTournaments: () => Promise<void>
}

export function useTournamentSelection(
  currentSetReleaseDate: string
): UseTournamentSelectionReturn {
  const [tournaments, setTournaments] = useState<LimitlessTournament[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  // Function to fetch tournaments (used on load and for manual refresh)
  const fetchTournaments = useCallback(async (bypassCache = false) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Add cache-busting param for manual refresh
      const url = bypassCache 
        ? `/api/limitless/tournaments?refresh=${Date.now()}`
        : '/api/limitless/tournaments'
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch tournaments')
      const data = await response.json()
      
      // Sort by date descending (newest first)
      const sorted = data.sort((a: LimitlessTournament, b: LimitlessTournament) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      
      setTournaments(sorted)
      setLastFetched(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch tournaments on mount
  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

  // Initialize selection from localStorage or default to post-set tournaments
  useEffect(() => {
    if (tournaments.length === 0 || initialized) return
    
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSelectedIds(new Set(parsed.selectedIds))
      } catch {
        // Invalid stored data, use defaults
        selectPostSetInternal(currentSetReleaseDate)
      }
    } else {
      // First visit, select post-set tournaments by default
      selectPostSetInternal(currentSetReleaseDate)
    }
    
    setInitialized(true)
  }, [tournaments, currentSetReleaseDate, initialized])

  // Persist selection to localStorage
  useEffect(() => {
    if (!initialized) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedIds: Array.from(selectedIds),
      lastModified: new Date().toISOString(),
    }))
  }, [selectedIds, initialized])

  const selectPostSetInternal = useCallback((releaseDate: string) => {
    const postSetIds = tournaments
      .filter(t => new Date(t.date) >= new Date(releaseDate))
      .filter(t => ['regional', 'international', 'special', 'worlds'].includes(t.type))
      .map(t => t.id)
    setSelectedIds(new Set(postSetIds))
  }, [tournaments])

  const toggleTournament = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(tournaments.map(t => t.id)))
  }, [tournaments])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectPostSet = useCallback((releaseDate: string) => {
    selectPostSetInternal(releaseDate)
  }, [selectPostSetInternal])

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  // Manual refresh function (bypasses cache)
  const refreshTournaments = useCallback(async () => {
    await fetchTournaments(true)
  }, [fetchTournaments])

  return {
    tournaments,
    selectedIds,
    isLoading,
    error,
    lastFetched,
    toggleTournament,
    selectAll,
    clearAll,
    selectPostSet,
    isSelected,
    refreshTournaments,
  }
}
```

### Step 4.2: Create Tournament Selector Component

Create `src/components/TournamentSelector.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { LimitlessTournament } from '@/lib/limitless'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Check, ExternalLink, RefreshCw } from 'lucide-react'

interface TournamentSelectorProps {
  tournaments: LimitlessTournament[]
  selectedIds: Set<string>
  currentSetName: string
  currentSetReleaseDate: string
  isLoading: boolean
  lastFetched: Date | null
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onSelectPostSet: (date: string) => void
  onRefresh: () => Promise<void>
}

export function TournamentSelector({
  tournaments,
  selectedIds,
  currentSetName,
  currentSetReleaseDate,
  isLoading,
  lastFetched,
  onToggle,
  onSelectAll,
  onClearAll,
  onSelectPostSet,
  onRefresh,
}: TournamentSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const selectedCount = selectedIds.size
  const totalCount = tournaments.length

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const isPostSet = (tournamentDate: string) => {
    return new Date(tournamentDate) >= new Date(currentSetReleaseDate)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-poke-dark border border-gray-800 rounded-lg p-4 mb-6">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-700 rounded"></div>
          <div className="h-4 w-48 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg mb-6 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-medium text-white">
            Tournament Selection
          </span>
          <span className="text-sm text-gray-400">
            ({selectedCount} of {totalCount} selected)
          </span>
        </div>
        <div className="text-xs text-poke-yellow">
          {isExpanded ? 'Click to collapse' : 'Click to edit'}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-800">
          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-gray-800 bg-gray-900/50">
            <button
              onClick={() => onSelectPostSet(currentSetReleaseDate)}
              className="px-3 py-1.5 text-sm bg-poke-yellow/20 text-poke-yellow border border-poke-yellow/50 rounded hover:bg-poke-yellow/30 transition-colors"
            >
              Select Post-{currentSetName}
            </button>
            <button
              onClick={onSelectAll}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 text-sm bg-poke-blue/20 text-poke-blue border border-poke-blue/50 rounded hover:bg-poke-blue/30 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Refreshing...' : 'Refresh List'}
            </button>
          </div>

          {/* Tournament list */}
          <div className="max-h-80 overflow-y-auto">
            {tournaments.map((tournament) => {
              const isSelected = selectedIds.has(tournament.id)
              const postSet = isPostSet(tournament.date)
              
              return (
                <div
                  key={tournament.id}
                  className={cn(
                    'flex items-center gap-3 p-3 border-b border-gray-800/50 cursor-pointer transition-colors',
                    isSelected ? 'bg-poke-yellow/10' : 'hover:bg-gray-800/50',
                    !postSet && 'opacity-60'
                  )}
                  onClick={() => onToggle(tournament.id)}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      isSelected
                        ? 'bg-poke-yellow border-poke-yellow'
                        : 'border-gray-600'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-black" />}
                  </div>

                  {/* Tournament info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-medium truncate',
                        isSelected ? 'text-white' : 'text-gray-300'
                      )}>
                        {tournament.name}
                      </span>
                      {postSet && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                          Post-{currentSetName}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>{formatDate(tournament.date)}</span>
                      <span>•</span>
                      <span>{tournament.location}</span>
                      <span>•</span>
                      <span>{tournament.playerCount.toLocaleString()} players</span>
                    </div>
                  </div>

                  {/* External link */}
                  <a
                    href={tournament.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-gray-500 hover:text-poke-blue transition-colors"
                    title="View on Limitless"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )
            })}
          </div>

          {/* Footer info */}
          <div className="p-3 bg-gray-900/50 text-xs text-gray-500 border-t border-gray-800 flex justify-between items-center">
            <span>
              Data sourced from Limitless TCG. Tournaments after {formatDate(currentSetReleaseDate)} are marked as post-set.
            </span>
            {lastFetched && (
              <span>
                Last updated: {formatTime(lastFetched)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

### Step 4.3: Install Lucide Icons

```bash
npm install lucide-react
```

---

## Phase 5: Core Components

### Step 5.1: Create Header Component

Create `src/components/Header.tsx`:

```tsx
import Link from 'next/link'

interface HeaderProps {
  currentSet: {
    name: string
    releaseDate: string
  }
  lastUpdated: string
}

export function Header({ currentSet, lastUpdated }: HeaderProps) {
  return (
    <header className="bg-poke-darker border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-poke-yellow via-poke-red to-poke-blue bg-clip-text text-transparent">
              Pokemon TCG Meta Tracker
            </Link>
            <p className="text-sm text-gray-400">
              Current Set: {currentSet.name} (Released {currentSet.releaseDate})
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Last Updated: {new Date(lastUpdated).toLocaleDateString()}
          </div>
        </div>
      </div>
    </header>
  )
}
```

### Step 5.2: Create Deck List Component

Create `src/components/DeckList.tsx`:

```tsx
import { DeckList as DeckListType, CardEntry } from '@/lib/types'

interface DeckListProps {
  deckList: DeckListType
  showImages?: boolean
}

function CardSection({ title, cards }: { title: string; cards: CardEntry[] }) {
  const totalCount = cards.reduce((sum, card) => sum + card.count, 0)
  
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        {title} ({totalCount})
      </h4>
      <div className="space-y-1">
        {cards.map((card, index) => (
          <div 
            key={`${card.name}-${card.setCode}-${index}`}
            className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-800/50"
          >
            <span className="text-white">
              <span className="text-poke-yellow font-mono mr-2">{card.count}x</span>
              {card.name}
            </span>
            <span className="text-gray-500 text-xs">
              {card.setCode} {card.setNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DeckList({ deckList, showImages = false }: DeckListProps) {
  const totalCards = 
    deckList.pokemon.reduce((sum, c) => sum + c.count, 0) +
    deckList.trainers.reduce((sum, c) => sum + c.count, 0) +
    deckList.energy.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Deck List</h3>
        <span className="text-sm text-gray-400">{totalCards} cards</span>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <CardSection title="Pokemon" cards={deckList.pokemon} />
        <CardSection title="Trainers" cards={deckList.trainers} />
        <CardSection title="Energy" cards={deckList.energy} />
      </div>
    </div>
  )
}
```

### Step 5.3: Create Tabs Component

Create `src/components/ui/Tabs.tsx`:

```tsx
'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-lg bg-poke-darker p-1 text-gray-400',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poke-yellow',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-poke-dark data-[state=active]:text-poke-yellow data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

---

## Phase 6: Static Data for Creator Recommendations

Since creator recommendations don't come from Limitless automatically, we need a static JSON file for that section.

### Step 6.1: Create Creator Data File

Create `src/data/creators.json`:

```json
{
  "creators": [
    {
      "id": "azulgg",
      "name": "AzulGG",
      "channelUrl": "https://youtube.com/@AzulGG",
      "avatarUrl": "/images/creators/azulgg.png"
    },
    {
      "id": "celios-network",
      "name": "Celio's Network",
      "channelUrl": "https://youtube.com/@CeliosNetwork",
      "avatarUrl": "/images/creators/celios.png"
    },
    {
      "id": "shuffle-squad",
      "name": "The Shuffle Squad",
      "channelUrl": "https://youtube.com/@TheShuffleSquad",
      "avatarUrl": "/images/creators/shuffle.png"
    },
    {
      "id": "nurse-jared",
      "name": "Nurse Jared",
      "channelUrl": "https://youtube.com/@NurseJared",
      "avatarUrl": "/images/creators/nursejared.png"
    },
    {
      "id": "zapdostcg",
      "name": "ZapdosTCG",
      "channelUrl": "https://youtube.com/@ZapdosTCG",
      "avatarUrl": "/images/creators/zapdos.png"
    }
  ],
  "recommendations": [
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
      "videoUrl": "https://youtube.com/watch?v=example",
      "videoTitle": "The BEST Deck for Stuttgart Regionals!",
      "publishDate": "2025-11-25",
      "tierRating": "Tier 1",
      "notes": "Strong into the Charizard matchup with spread damage."
    }
  ]
}
```

---

## Phase 5: Core Components

### Step 5.1: Create Header Component

Create `src/components/Header.tsx`:

```tsx
import Link from 'next/link'

interface HeaderProps {
  currentSet: {
    name: string
    releaseDate: string
  }
  lastUpdated: string
}

export function Header({ currentSet, lastUpdated }: HeaderProps) {
  return (
    <header className="bg-poke-darker border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-poke-yellow via-poke-red to-poke-blue bg-clip-text text-transparent">
              Pokemon TCG Meta Tracker
            </Link>
            <p className="text-sm text-gray-400">
              Current Set: {currentSet.name} (Released {currentSet.releaseDate})
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Last Updated: {new Date(lastUpdated).toLocaleDateString()}
          </div>
        </div>
      </div>
    </header>
  )
}
```

### Step 5.2: Create Deck Card Component

Create `src/components/DeckCard.tsx`:

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface DeckCardProps {
  id: string
  name: string
  tier?: number
  placement?: number
  playerName?: string
  tournamentName?: string
  creatorName?: string
  videoUrl?: string
  source: 'tournament' | 'creator'
}

export function DeckCard({
  id,
  name,
  tier,
  placement,
  playerName,
  tournamentName,
  creatorName,
  source
}: DeckCardProps) {
  const tierColors: Record<number, string> = {
    1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    2: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    3: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  }

  return (
    <Link href={`/deck/${id}`}>
      <div className="bg-poke-dark border border-gray-800 rounded-lg p-4 hover:border-poke-yellow/50 transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white group-hover:text-poke-yellow transition-colors">
            {name}
          </h3>
          {tier && (
            <span className={cn(
              'text-xs px-2 py-1 rounded border',
              tierColors[tier] || tierColors[3]
            )}>
              Tier {tier}
            </span>
          )}
        </div>
        
        {source === 'tournament' && (
          <div className="text-sm text-gray-400 space-y-1">
            {placement && (
              <p>
                <span className="text-poke-yellow font-medium">
                  {placement === 1 ? '🥇 1st' : 
                   placement === 2 ? '🥈 2nd' : 
                   placement === 3 ? '🥉 3rd' : 
                   `${placement}th`}
                </span>
                {playerName && ` - ${playerName}`}
              </p>
            )}
            {tournamentName && <p>{tournamentName}</p>}
          </div>
        )}
        
        {source === 'creator' && creatorName && (
          <div className="text-sm text-gray-400">
            <p>Recommended by <span className="text-poke-blue">{creatorName}</span></p>
          </div>
        )}
        
        <div className="mt-3 text-xs text-gray-500">
          Click to view deck list →
        </div>
      </div>
    </Link>
  )
}
```

### Step 5.3: Create Deck List Component

Create `src/components/DeckList.tsx`:

```tsx
import { DeckList as DeckListType, CardEntry } from '@/lib/types'

interface DeckListProps {
  deckList: DeckListType
  showImages?: boolean
}

function CardSection({ title, cards }: { title: string; cards: CardEntry[] }) {
  const totalCount = cards.reduce((sum, card) => sum + card.count, 0)
  
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        {title} ({totalCount})
      </h4>
      <div className="space-y-1">
        {cards.map((card, index) => (
          <div 
            key={`${card.name}-${card.setCode}-${index}`}
            className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-800/50"
          >
            <span className="text-white">
              <span className="text-poke-yellow font-mono mr-2">{card.count}x</span>
              {card.name}
            </span>
            <span className="text-gray-500 text-xs">
              {card.setCode} {card.setNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DeckList({ deckList, showImages = false }: DeckListProps) {
  const totalCards = 
    deckList.pokemon.reduce((sum, c) => sum + c.count, 0) +
    deckList.trainers.reduce((sum, c) => sum + c.count, 0) +
    deckList.energy.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Deck List</h3>
        <span className="text-sm text-gray-400">{totalCards} cards</span>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <CardSection title="Pokemon" cards={deckList.pokemon} />
        <CardSection title="Trainers" cards={deckList.trainers} />
        <CardSection title="Energy" cards={deckList.energy} />
      </div>
    </div>
  )
}
```

### Step 4.4: Create Tabs Component

Create `src/components/ui/Tabs.tsx`:

```tsx
'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-lg bg-poke-darker p-1 text-gray-400',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poke-yellow',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-poke-dark data-[state=active]:text-poke-yellow data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

---

## Phase 7: Pages

### Step 7.1: Create Home Page with Tournament Selector

Create `src/app/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { DeckCard } from '@/components/DeckCard'
import { TournamentSelector } from '@/components/TournamentSelector'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useTournamentSelection } from '@/hooks/useTournamentSelection'
import { TournamentResult } from '@/lib/types'

// Meta data - could be fetched from API
const META_DATA = {
  lastUpdated: new Date().toISOString(),
  currentSet: {
    name: 'Phantasmal Flames',
    releaseDate: '2025-11-14',
    code: 'PFL',
  },
}

// Creator data - could be fetched from API
import creatorsData from '@/data/creators.json'

export default function HomePage() {
  const {
    tournaments,
    selectedIds,
    isLoading: tournamentsLoading,
    lastFetched,
    toggleTournament,
    selectAll,
    clearAll,
    selectPostSet,
    isSelected,
    refreshTournaments,
  } = useTournamentSelection(META_DATA.currentSet.releaseDate)

  const [results, setResults] = useState<TournamentResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)

  // Fetch results for selected tournaments
  useEffect(() => {
    async function fetchResults() {
      if (selectedIds.size === 0) {
        setResults([])
        return
      }

      setResultsLoading(true)
      try {
        const allResults: TournamentResult[] = []
        
        // Fetch results for each selected tournament
        for (const tournamentId of selectedIds) {
          const response = await fetch(`/api/limitless/tournaments/${tournamentId}/results`)
          if (response.ok) {
            const tournamentResults = await response.json()
            // Add tournament metadata to each result
            const tournament = tournaments.find(t => t.id === tournamentId)
            if (tournament) {
              tournamentResults.forEach((r: TournamentResult) => {
                r.tournament = {
                  id: tournament.id,
                  name: tournament.name,
                  location: tournament.location,
                  date: tournament.date,
                  playerCount: tournament.playerCount,
                  format: tournament.format,
                }
              })
            }
            allResults.push(...tournamentResults)
          }
        }
        
        // Sort by placement (best first), then by tournament date (newest first)
        allResults.sort((a, b) => {
          if (a.placement !== b.placement) return a.placement - b.placement
          return new Date(b.tournament.date).getTime() - new Date(a.tournament.date).getTime()
        })
        
        setResults(allResults)
      } catch (error) {
        console.error('Error fetching results:', error)
      } finally {
        setResultsLoading(false)
      }
    }

    fetchResults()
  }, [selectedIds, tournaments])

  // Group results by deck archetype for display
  const groupedResults = results.reduce((acc, result) => {
    const existing = acc.find(r => r.deckId === result.deckId)
    if (existing) {
      existing.placements.push({
        placement: result.placement,
        playerName: result.playerName,
        tournament: result.tournament,
      })
    } else {
      acc.push({
        ...result,
        placements: [{
          placement: result.placement,
          playerName: result.playerName,
          tournament: result.tournament,
        }],
      })
    }
    return acc
  }, [] as (TournamentResult & { placements: any[] })[])

  return (
    <div className="min-h-screen bg-poke-darker">
      <Header 
        currentSet={META_DATA.currentSet}
        lastUpdated={META_DATA.lastUpdated}
      />
      
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="tournament" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="tournament">
              🏆 Tournament Results
            </TabsTrigger>
            <TabsTrigger value="creator">
              📺 Creator Recommendations
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tournament">
            {/* Tournament Selector */}
            <TournamentSelector
              tournaments={tournaments}
              selectedIds={selectedIds}
              currentSetName={META_DATA.currentSet.name}
              currentSetReleaseDate={META_DATA.currentSet.releaseDate}
              isLoading={tournamentsLoading}
              lastFetched={lastFetched}
              onToggle={toggleTournament}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              onSelectPostSet={selectPostSet}
              onRefresh={refreshTournaments}
            />

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Tournament Results
              </h2>
              <p className="text-gray-400 text-sm">
                Showing results from {selectedIds.size} selected tournament{selectedIds.size !== 1 ? 's' : ''}
              </p>
            </div>

            {resultsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-poke-dark border border-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="h-5 bg-gray-700 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : groupedResults.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedResults.map((result) => (
                  <DeckCard
                    key={result.deckId}
                    id={result.deckId}
                    name={result.archetype.name}
                    tier={result.archetype.tier}
                    placements={result.placements}
                    source="tournament"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                {selectedIds.size === 0 
                  ? 'Select at least one tournament to see results'
                  : 'No results found for selected tournaments'}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="creator">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Creator Deck Recommendations
              </h2>
              <p className="text-gray-400 text-sm">
                Top deck picks from competitive TCG content creators
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creatorsData.recommendations.map((rec: any) => (
                <DeckCard
                  key={`${rec.deckId}-${rec.creator.id}`}
                  id={rec.deckId}
                  name={rec.archetype.name}
                  tier={rec.archetype.tier}
                  creatorName={rec.creator.name}
                  videoUrl={rec.videoUrl}
                  source="creator"
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
```

### Step 7.2: Update DeckCard Component for Multiple Placements

Update `src/components/DeckCard.tsx`:

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

interface Placement {
  placement: number
  playerName: string
  tournament: {
    id: string
    name: string
    date: string
  }
}

interface DeckCardProps {
  id: string
  name: string
  tier?: number
  placements?: Placement[]
  creatorName?: string
  videoUrl?: string
  source: 'tournament' | 'creator'
}

export function DeckCard({
  id,
  name,
  tier,
  placements,
  creatorName,
  videoUrl,
  source
}: DeckCardProps) {
  const tierColors: Record<number, string> = {
    1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    2: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    3: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  }

  const getPlacementEmoji = (p: number) => {
    if (p === 1) return '🥇'
    if (p === 2) return '🥈'
    if (p === 3) return '🥉'
    return `${p}th`
  }

  // Get best placement for display
  const bestPlacement = placements?.reduce((best, p) => 
    p.placement < best.placement ? p : best, placements[0])

  return (
    <Link href={`/deck/${id}`}>
      <div className="bg-poke-dark border border-gray-800 rounded-lg p-4 hover:border-poke-yellow/50 transition-all cursor-pointer group h-full">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white group-hover:text-poke-yellow transition-colors">
            {name}
          </h3>
          {tier && (
            <span className={cn(
              'text-xs px-2 py-1 rounded border flex-shrink-0 ml-2',
              tierColors[tier] || tierColors[3]
            )}>
              Tier {tier}
            </span>
          )}
        </div>
        
        {source === 'tournament' && placements && placements.length > 0 && (
          <div className="text-sm text-gray-400 space-y-2">
            {/* Show top 3 placements */}
            {placements.slice(0, 3).map((p, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span>
                  <span className="text-poke-yellow font-medium">
                    {getPlacementEmoji(p.placement)}
                  </span>
                  {' '}{p.playerName}
                </span>
                <span className="text-xs text-gray-500">
                  {p.tournament.name.replace(' Regional Championship', '').replace(' International Championship', ' IC')}
                </span>
              </div>
            ))}
            {placements.length > 3 && (
              <p className="text-xs text-gray-500">
                +{placements.length - 3} more placement{placements.length - 3 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
        
        {source === 'creator' && creatorName && (
          <div className="text-sm text-gray-400">
            <p className="flex items-center gap-1">
              Recommended by{' '}
              <span className="text-poke-blue">{creatorName}</span>
              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-500 hover:text-poke-blue"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </p>
          </div>
        )}
        
        <div className="mt-3 text-xs text-gray-500">
          Click to view deck list →
        </div>
      </div>
    </Link>
  )
}
```

### Step 5.2: Create Deck Detail Page

Create `src/app/deck/[id]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/Header'
import { DeckList } from '@/components/DeckList'

import metaData from '@/data/meta.json'
import tournamentsData from '@/data/tournaments.json'
import creatorsData from '@/data/creators.json'

interface PageProps {
  params: { id: string }
}

export default function DeckPage({ params }: PageProps) {
  const { id } = params
  
  // Find deck from tournament results
  const tournamentResult = tournamentsData.results.find(r => r.deckId === id)
  
  // Find deck from creator recommendations
  const creatorRec = creatorsData.recommendations.find(r => r.deckId === id)
  
  // Use tournament result if available, otherwise creator recommendation
  const deckData = tournamentResult || creatorRec
  
  if (!deckData) {
    notFound()
  }
  
  const archetype = deckData.archetype
  const deckList = deckData.deckList

  return (
    <div className="min-h-screen bg-poke-darker">
      <Header 
        currentSet={metaData.currentSet}
        lastUpdated={metaData.lastUpdated}
      />
      
      <main className="container mx-auto px-4 py-8">
        <Link 
          href="/"
          className="text-poke-yellow hover:text-yellow-300 text-sm mb-6 inline-block"
        >
          ← Back to Meta Overview
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {archetype.name}
          </h1>
          
          {archetype.tier && (
            <span className="inline-block bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 text-sm px-3 py-1 rounded">
              Tier {archetype.tier}
            </span>
          )}
          
          {tournamentResult && (
            <div className="mt-4 text-gray-400">
              <p>
                <span className="text-poke-yellow font-semibold">
                  {tournamentResult.placement === 1 ? '🥇 1st Place' : 
                   tournamentResult.placement === 2 ? '🥈 2nd Place' : 
                   tournamentResult.placement === 3 ? '🥉 3rd Place' : 
                   `${tournamentResult.placement}th Place`}
                </span>
                {' '}at {tournamentResult.tournament.name}
              </p>
              <p>Piloted by {tournamentResult.playerName}</p>
            </div>
          )}
          
          {creatorRec && !tournamentResult && (
            <div className="mt-4 text-gray-400">
              <p>
                Recommended by{' '}
                <a 
                  href={creatorRec.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-poke-blue hover:underline"
                >
                  {creatorRec.creator.name}
                </a>
              </p>
              {creatorRec.notes && <p className="mt-2 italic">{creatorRec.notes}</p>}
            </div>
          )}
        </div>
        
        {deckList && <DeckList deckList={deckList} />}
      </main>
    </div>
  )
}
```

### Step 5.3: Update Global Styles

Update `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 255, 255, 255;
  --background-rgb: 15, 15, 26;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgb(26, 26, 46);
}

::-webkit-scrollbar-thumb {
  background: rgb(60, 60, 90);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgb(80, 80, 120);
}
```

### Step 5.4: Update Layout

Update `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pokemon TCG Meta Tracker',
  description: 'Track the best Pokemon TCG decks from tournaments and content creators',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

---

## Phase 8: Testing and Deployment

### Step 8.1: Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

### Step 8.2: Test Tournament Features

1. **Auto-discovery**: Verify tournaments load from Limitless
2. **Selection persistence**: Select/deselect tournaments, refresh page, verify selections persist
3. **Post-set filter**: Click "Select Post-[Set]" and verify correct tournaments selected
4. **Results loading**: Verify deck results load for selected tournaments

### Step 8.3: Test Edge Cases

1. **Limitless unavailable**: Verify fallback data loads if scraping fails
2. **No tournaments selected**: Verify appropriate empty state message
3. **localStorage cleared**: Verify defaults to post-set tournaments

### Step 8.4: Add Creator Data

Manually populate `src/data/creators.json` with deck recommendations from YouTube creators.

### Step 8.5: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Note**: The API routes will work on Vercel, but be aware of:
- Rate limiting from Limitless (cached for 1 hour helps)
- Selector changes may need adjustment if Limitless HTML changes

---

## Phase 9: Future Enhancements

### 9.1: Add Pokemon TCG API Integration

For card images, create `src/lib/pokemon-api.ts`:

```typescript
const API_BASE = 'https://api.pokemontcg.io/v2'

export async function getCardImage(setCode: string, number: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/cards/${setCode}-${number}`)
    const data = await response.json()
    return data.data?.images?.small || null
  } catch {
    return null
  }
}
```

### 9.2: Add YouTube API Integration

For fetching recent videos from creators, you'll need:
1. Google Cloud API key
2. YouTube Data API v3 enabled

### 9.3: Improve Scraping Reliability

Consider:
- Using a headless browser (Puppeteer) if Cheerio can't handle dynamic content
- Adding retry logic with exponential backoff
- Monitoring for Limitless HTML structure changes
- Setting up alerts when scraping fails

---

## Summary Checklist

- [ ] Initialize Next.js project with TypeScript and Tailwind
- [ ] Install dependencies (including cheerio)
- [ ] Create type definitions (including tournament selection types)
- [ ] Create Limitless service functions (`src/lib/limitless.ts`)
- [ ] Create API route for tournament list (`/api/limitless/tournaments`)
- [ ] Create API route for deck results (`/api/limitless/tournaments/[id]/results`)
- [ ] Create useTournamentSelection hook with localStorage persistence
- [ ] Build TournamentSelector component (collapsible, editable)
- [ ] Build Header component
- [ ] Build DeckCard component (supports multiple placements)
- [ ] Build DeckList component  
- [ ] Build Tabs component
- [ ] Create static creators.json for YouTube recommendations
- [ ] Create home page with tournament selector + tabs
- [ ] Create deck detail page
- [ ] Style with dark theme
- [ ] Test tournament auto-discovery
- [ ] Test tournament selection persistence
- [ ] Test "Select Post-[Set]" functionality
- [ ] Deploy to Vercel
- [ ] Manually add creator recommendations as needed
