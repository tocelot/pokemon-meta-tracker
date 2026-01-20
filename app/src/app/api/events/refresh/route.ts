import { NextResponse } from 'next/server'
import {
  writeScraperResults,
  writeCache,
  readCache,
  readScraperResults,
  CachedEvent,
  CacheData
} from '@/lib/cache'

export const maxDuration = 60 // 1 minute max

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret'

// Location config
const USER_LAT = 37.52
const USER_LNG = -122.2758
const MAX_RADIUS = 100

// Helper functions
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function parseScraperDate(dateStr: string): string | null {
  const match = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/i)
  if (!match) return null
  const months: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
    July: '07', August: '08', September: '09', October: '10', November: '11', December: '12'
  }
  return `${match[3]}-${months[match[1]]}-${match[2].padStart(2, '0')}`
}

function normalizeShop(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15)
}

function normalizeType(t: string): string {
  if (t.toLowerCase().includes('cup')) return 'League Cup'
  if (t.toLowerCase().includes('challenge')) return 'League Challenge'
  return t
}

interface PokedataEvent {
  type: string
  name: string
  date: string
  when?: string
  shop: string
  address?: string
  city?: string
  state?: string
  country?: string
  latitude?: string
  longitude?: string
  distance?: number
}

async function fetchPokedataEvents(): Promise<PokedataEvent[]> {
  const baseBody = {
    past: '', country: 'US', city: '', shop: '', league: '',
    states: JSON.stringify(['California']),
    postcode: '', vcups: '', vchallenges: '', prereleases: '', premier: '',
    go: '', gocup: '', mss: '', ftcg: '', fvg: '', fgo: '',
    latitude: '', longitude: '', radius: '', unit: 'mi', width: 1200
  }

  try {
    const [cupsRes, challengesRes] = await Promise.all([
      fetch('https://pokedata.ovh/events/tableapi/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseBody, cups: '1', challenges: '' })
      }),
      fetch('https://pokedata.ovh/events/tableapi/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseBody, cups: '', challenges: '1' })
      })
    ])

    const cups = await cupsRes.json() as PokedataEvent[]
    const challenges = await challengesRes.json() as PokedataEvent[]
    return [...cups, ...challenges]
  } catch (error) {
    console.error('Error fetching pokedata:', error)
    return []
  }
}

interface ScrapedEvent {
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
}

async function buildCombinedCache(): Promise<CacheData> {
  // Get existing scraper results (uploaded manually or via poketracker)
  const scraperData = readScraperResults()
  const scraperEvents: ScrapedEvent[] = scraperData?.events || []
  console.log(`Scraper results: ${scraperEvents.length} events`)

  // Fetch fresh pokedata events
  const pokeEvents = await fetchPokedataEvents()
  console.log(`Pokedata.ovh: ${pokeEvents.length} events`)

  // Filter by distance
  const pokeNearby = pokeEvents.filter(e => {
    if (!e.latitude || !e.longitude) return false
    const dist = calculateDistance(USER_LAT, USER_LNG, parseFloat(e.latitude), parseFloat(e.longitude))
    e.distance = dist
    return dist <= MAX_RADIUS
  })

  // Deduplicate pokedata
  const seenPoke = new Set<string>()
  const uniquePokeEvents = pokeNearby.filter(e => {
    const key = `${e.date}-${normalizeShop(e.shop)}`
    if (seenPoke.has(key)) return false
    seenPoke.add(key)
    return true
  })
  console.log(`Pokedata within ${MAX_RADIUS}mi: ${uniquePokeEvents.length} unique`)

  // Combine events
  const combinedEvents: CachedEvent[] = []
  const seenEvents = new Set<string>()

  // Add scraper events first
  scraperEvents.forEach(e => {
    const normalizedDate = parseScraperDate(e.date)
    if (!normalizedDate) return

    const key = `${normalizedDate}-${normalizeShop(e.shop)}-${normalizeType(e.type)}`
    if (seenEvents.has(key)) return
    seenEvents.add(key)

    combinedEvents.push({
      source: 'pokemon.com',
      type: normalizeType(e.type),
      name: e.name,
      date: normalizedDate,
      displayDate: e.date,
      time: e.time || '',
      shop: e.shop,
      address: e.address,
      city: e.city || '',
      state: e.state || 'CA',
      country: e.country || 'US',
    })
  })

  // Add pokedata events
  uniquePokeEvents.forEach(e => {
    const key = `${e.date}-${normalizeShop(e.shop)}-${normalizeType(e.type)}`
    if (seenEvents.has(key)) return
    seenEvents.add(key)

    combinedEvents.push({
      source: 'pokedata.ovh',
      type: normalizeType(e.type),
      name: e.name,
      date: e.date,
      displayDate: e.when?.split(' ')[0] || e.date,
      time: e.when?.split(' ')[1]?.slice(0, 5) || '',
      shop: e.shop,
      address: e.address || '',
      city: e.city || '',
      state: e.state || 'CA',
      country: e.country || 'US',
      distance: e.distance,
      latitude: e.latitude,
      longitude: e.longitude,
    })
  })

  // Sort by date
  combinedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const existingCache = readCache()

  return {
    lastUpdated: new Date().toISOString(),
    lastScraperRun: existingCache?.lastScraperRun || null,
    location: { lat: USER_LAT, lng: USER_LNG, radius: MAX_RADIUS },
    summary: {
      totalEvents: combinedEvents.length,
      fromScraper: combinedEvents.filter(e => e.source === 'pokemon.com').length,
      fromPokedata: combinedEvents.filter(e => e.source === 'pokedata.ovh').length,
      uniqueStores: [...new Set(combinedEvents.map(e => e.shop))].length,
    },
    events: combinedEvents,
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret') || authHeader?.replace('Bearer ', '')

  if (secret !== CRON_SECRET && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('=== CACHE REFRESH STARTED ===')
    console.log(`Time: ${new Date().toISOString()}`)

    // Build combined cache from existing scraper results + fresh pokedata
    const cacheData = await buildCombinedCache()

    // Write cache
    writeCache(cacheData)

    console.log('=== CACHE REFRESH COMPLETE ===')
    console.log(`Total events: ${cacheData.summary.totalEvents}`)
    console.log(`From scraper: ${cacheData.summary.fromScraper}`)
    console.log(`From pokedata: ${cacheData.summary.fromPokedata}`)

    return NextResponse.json({
      success: true,
      message: 'Cache refresh complete',
      summary: cacheData.summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also support POST for manual refresh with new scraper data
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const secret = authHeader?.replace('Bearer ', '')

  if (secret !== CRON_SECRET && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // If scraper results are provided, save them
    if (body.scraperResults?.events) {
      console.log(`Saving ${body.scraperResults.events.length} scraper events`)
      writeScraperResults(body.scraperResults)
    }

    // Rebuild cache
    const cacheData = await buildCombinedCache()
    writeCache(cacheData)

    return NextResponse.json({
      success: true,
      message: 'Cache updated with new scraper data',
      summary: cacheData.summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
