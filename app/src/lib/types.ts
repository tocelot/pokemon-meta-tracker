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
  deckListId?: string | null
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

// Tournament Discovery Types
export interface LimitlessTournament {
  id: string
  name: string
  date: string
  playerCount: number
  location: string
  type: 'regional' | 'international' | 'special' | 'worlds' | 'other'
  format: string
  url: string
}

// User Preferences
export interface UserTournamentSelection {
  selectedTournamentIds: string[]
  lastModified: string
}

// UI Types
export type DataSource = 'tournament' | 'creator'
export type ViewMode = 'grid' | 'list'

// Placement type for deck cards
export interface Placement {
  placement: number
  playerName: string
  deckListId?: string | null
  tournament: {
    id: string
    name: string
    date: string
  }
}
