import fs from 'fs'
import path from 'path'

export interface CachedEvent {
  source: 'pokemon.com' | 'pokedata.ovh'
  type: string
  name: string
  date: string
  displayDate: string
  time: string
  shop: string
  address: string
  city: string
  state: string
  country: string
  distance?: number
  latitude?: string
  longitude?: string
}

export interface CacheData {
  lastUpdated: string
  lastScraperRun: string | null
  location: { lat: number; lng: number; radius: number }
  summary: {
    totalEvents: number
    fromScraper: number
    fromPokedata: number
    uniqueStores: number
  }
  events: CachedEvent[]
}

const CACHE_DIR = process.cwd()
const CACHE_FILE = path.join(CACHE_DIR, 'events-cache.json')
const SCRAPER_RESULTS_FILE = path.join(CACHE_DIR, 'scraper-results.json')

// Cache TTL: 1 hour for combined data, 24 hours for scraper
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const SCRAPER_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function getCacheFilePath(): string {
  return CACHE_FILE
}

export function getScraperResultsPath(): string {
  return SCRAPER_RESULTS_FILE
}

export function readCache(): CacheData | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null
    }
    const data = fs.readFileSync(CACHE_FILE, 'utf8')
    return JSON.parse(data) as CacheData
  } catch (error) {
    console.error('Error reading cache:', error)
    return null
  }
}

export function writeCache(data: CacheData): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2))
    console.log(`Cache written: ${data.events.length} events`)
  } catch (error) {
    console.error('Error writing cache:', error)
  }
}

export function isCacheValid(): boolean {
  const cache = readCache()
  if (!cache) return false

  const lastUpdated = new Date(cache.lastUpdated).getTime()
  const now = Date.now()

  return (now - lastUpdated) < CACHE_TTL_MS
}

export function isScraperDataFresh(): boolean {
  const cache = readCache()
  if (!cache?.lastScraperRun) return false

  const lastRun = new Date(cache.lastScraperRun).getTime()
  const now = Date.now()

  return (now - lastRun) < SCRAPER_TTL_MS
}

export function readScraperResults(): { events: Array<{
  id: string
  type: string
  name: string
  date: string
  time: string
  shop: string
  address: string
  city: string
  state: string
  country: string
}> } | null {
  try {
    if (!fs.existsSync(SCRAPER_RESULTS_FILE)) {
      return null
    }
    const data = fs.readFileSync(SCRAPER_RESULTS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading scraper results:', error)
    return null
  }
}

export function writeScraperResults(data: unknown): void {
  try {
    fs.writeFileSync(SCRAPER_RESULTS_FILE, JSON.stringify(data, null, 2))
    console.log('Scraper results saved')
  } catch (error) {
    console.error('Error writing scraper results:', error)
  }
}
