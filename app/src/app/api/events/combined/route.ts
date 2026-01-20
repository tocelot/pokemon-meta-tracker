import { NextResponse } from 'next/server'
import {
  readCache,
  writeCache,
  isCacheValid,
  readScraperResults,
  CachedEvent,
  CacheData
} from '@/lib/cache'

export const revalidate = 3600 // Cache for 1 hour

export interface LocalEvent {
  id: string
  type: 'League Cup' | 'League Challenge'
  name: string
  date: string
  time: string
  city: string
  state: string
  country: string
  shop: string
  address: string
  cost: string
  registrationUrl: string
  hasJuniors: boolean
  hasSeniors: boolean
  hasMasters: boolean
  distance?: number
  source?: 'pokemon.com' | 'pokedata.ovh'
}

// Location config - Bay Area default
const DEFAULT_LAT = 37.52
const DEFAULT_LNG = -122.2758
const DEFAULT_RADIUS = 100

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Parse scraper date format "Tuesday, January 13, 2026" to "2026-01-13"
function parseScraperDate(dateStr: string): string | null {
  const match = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/i)
  if (!match) return null
  const months: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
    July: '07', August: '08', September: '09', October: '10', November: '11', December: '12'
  }
  return `${match[3]}-${months[match[1]]}-${match[2].padStart(2, '0')}`
}

// Normalize store names for comparison
function normalizeShop(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 15)
}

// Normalize event type
function normalizeType(t: string): 'League Cup' | 'League Challenge' {
  if (t.toLowerCase().includes('cup')) return 'League Cup'
  return 'League Challenge'
}

interface PokedataEvent {
  guid?: string
  type: string
  name: string
  date: string
  when?: string
  shop: string
  city?: string
  state?: string
  country_code?: string
  street_address?: string
  address?: string
  cost?: string
  pokemon_url?: string
  juniors?: string
  seniors?: string
  masters?: string
  latitude?: string
  longitude?: string
  distance?: number
}

async function fetchPokedataEvents(state: string = 'California'): Promise<PokedataEvent[]> {
  const baseBody = {
    past: '', country: 'US', city: '', shop: '', league: '',
    states: JSON.stringify([state]),
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
    console.error('Error fetching from pokedata.ovh:', error)
    return []
  }
}

async function buildCombinedData(
  userLat: number,
  userLng: number,
  maxRadius: number,
  state: string
): Promise<{ events: LocalEvent[]; summary: CacheData['summary'] }> {
  console.log('Building combined event data...')

  // Get scraper results (from file cache)
  const scraperData = readScraperResults()
  const scraperEvents = scraperData?.events || []
  console.log(`Scraper: ${scraperEvents.length} events`)

  // Fetch pokedata.ovh events
  const pokeEvents = await fetchPokedataEvents(state)
  console.log(`Pokedata.ovh: ${pokeEvents.length} events`)

  // Filter pokedata by distance
  const pokeNearby = pokeEvents.filter(e => {
    if (!e.latitude || !e.longitude) return false
    const dist = calculateDistance(userLat, userLng, parseFloat(e.latitude), parseFloat(e.longitude))
    e.distance = dist
    return dist <= maxRadius
  })

  // Deduplicate pokedata
  const seenPoke = new Set<string>()
  const uniquePokeEvents = pokeNearby.filter(e => {
    const key = `${e.date}-${normalizeShop(e.shop)}`
    if (seenPoke.has(key)) return false
    seenPoke.add(key)
    return true
  })
  console.log(`Pokedata within ${maxRadius}mi: ${uniquePokeEvents.length} unique`)

  // Combine events
  const combinedEvents: LocalEvent[] = []
  const seenEvents = new Set<string>()

  // Add scraper events first (they include stores not in pokedata)
  scraperEvents.forEach(e => {
    const normalizedDate = parseScraperDate(e.date)
    if (!normalizedDate) return

    const eventType = normalizeType(e.type)
    const key = `${normalizedDate}-${normalizeShop(e.shop)}-${eventType}`
    if (seenEvents.has(key)) return
    seenEvents.add(key)

    combinedEvents.push({
      id: e.id || `scraper-${e.shop}-${normalizedDate}`.replace(/\s+/g, '-'),
      type: eventType,
      name: e.name,
      date: normalizedDate,
      time: e.time || '',
      city: e.city || '',
      state: e.state || 'CA',
      country: e.country || 'US',
      shop: e.shop,
      address: e.address || '',
      cost: '',
      registrationUrl: '',
      hasJuniors: true,
      hasSeniors: true,
      hasMasters: true,
      source: 'pokemon.com',
    })
  })

  // Add pokedata events
  uniquePokeEvents.forEach(e => {
    const eventType = normalizeType(e.type)
    const key = `${e.date}-${normalizeShop(e.shop)}-${eventType}`
    if (seenEvents.has(key)) return
    seenEvents.add(key)

    const whenParts = e.when?.split(' ') || []
    const time = whenParts[1]?.slice(0, 5) || ''

    combinedEvents.push({
      id: e.guid || `pokedata-${e.shop}-${e.date}`.replace(/\s+/g, '-'),
      type: eventType,
      name: e.name,
      date: e.date,
      time,
      city: e.city || '',
      state: e.state || 'CA',
      country: e.country_code || 'US',
      shop: e.shop,
      address: e.street_address || e.address || '',
      cost: e.cost || '',
      registrationUrl: e.pokemon_url || '',
      hasJuniors: parseInt(e.juniors || '0') > 0,
      hasSeniors: parseInt(e.seniors || '0') > 0,
      hasMasters: parseInt(e.masters || '0') > 0,
      distance: e.distance,
      source: 'pokedata.ovh',
    })
  })

  // Sort by date, then by distance
  combinedEvents.sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
    if (dateCompare !== 0) return dateCompare
    if (a.distance !== undefined && b.distance !== undefined) {
      return a.distance - b.distance
    }
    return 0
  })

  const fromScraper = combinedEvents.filter(e => e.source === 'pokemon.com').length
  const fromPokedata = combinedEvents.filter(e => e.source === 'pokedata.ovh').length
  const uniqueStores = [...new Set(combinedEvents.map(e => e.shop))].length

  return {
    events: combinedEvents,
    summary: {
      totalEvents: combinedEvents.length,
      fromScraper,
      fromPokedata,
      uniqueStores,
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      latitude = DEFAULT_LAT,
      longitude = DEFAULT_LNG,
      radius = DEFAULT_RADIUS,
      state = 'California'
    } = body

    const userLat = parseFloat(latitude) || DEFAULT_LAT
    const userLng = parseFloat(longitude) || DEFAULT_LNG
    const maxRadius = parseInt(radius) || DEFAULT_RADIUS

    // Check if cache is valid
    if (isCacheValid()) {
      console.log('Returning cached data')
      const cache = readCache()
      if (cache) {
        // Convert cached events to LocalEvent format and filter by distance
        const events = cache.events
          .filter(e => {
            if (e.latitude && e.longitude) {
              const dist = calculateDistance(userLat, userLng, parseFloat(e.latitude), parseFloat(e.longitude))
              return dist <= maxRadius
            }
            return true // Include scraper events without coordinates
          })
          .map(e => ({
            id: `${e.source}-${e.shop}-${e.date}`.replace(/\s+/g, '-'),
            type: normalizeType(e.type),
            name: e.name,
            date: e.date,
            time: e.time,
            city: e.city,
            state: e.state,
            country: e.country,
            shop: e.shop,
            address: e.address,
            cost: '',
            registrationUrl: '',
            hasJuniors: true,
            hasSeniors: true,
            hasMasters: true,
            distance: e.distance,
            source: e.source,
          } as LocalEvent))

        return NextResponse.json({
          events,
          total: events.length,
          fromCache: true,
          summary: cache.summary,
        })
      }
    }

    // Build fresh combined data
    console.log('Cache stale, refreshing...')
    const { events, summary } = await buildCombinedData(userLat, userLng, maxRadius, state)

    // Write to cache
    const cache = readCache()
    writeCache({
      lastUpdated: new Date().toISOString(),
      lastScraperRun: cache?.lastScraperRun || null,
      location: { lat: userLat, lng: userLng, radius: maxRadius },
      summary,
      events: events.map(e => ({
        source: e.source || 'pokedata.ovh',
        type: e.type,
        name: e.name,
        date: e.date,
        displayDate: e.date,
        time: e.time,
        shop: e.shop,
        address: e.address,
        city: e.city,
        state: e.state,
        country: e.country,
        distance: e.distance,
      })),
    })

    return NextResponse.json({
      events,
      total: events.length,
      fromCache: false,
      summary,
    })
  } catch (error) {
    console.error('Error in combined events endpoint:', error)
    return NextResponse.json(
      { events: [], error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
