import { NextResponse } from 'next/server'
import {
  readCache,
  writeCache,
  isCacheValid,
  readScraperResults,
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

// Normalize address for deduplication (extract street number + name)
function normalizeAddress(addr: string): string {
  if (!addr) return ''
  // Extract just the street portion (e.g., "340 WALNUT ST" from "340 WALNUT ST, REDWOOD CITY, CA 94063, US")
  const streetPart = addr.split(',')[0] || ''
  // Remove non-alphanumeric and normalize
  return streetPart.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Normalize event type
function normalizeType(t: string): 'League Cup' | 'League Challenge' {
  if (t.toLowerCase().includes('cup')) return 'League Cup'
  return 'League Challenge'
}

// Check if event is TCG (not GO or VGC)
function isTCGEvent(name: string): boolean {
  const upperName = name.toUpperCase()
  // Exclude Pokemon GO events
  if (upperName.includes('GO ') || upperName.includes('GO!') ||
      upperName.startsWith('GO ') || upperName.includes(' GO ') ||
      upperName.includes('POKEMON GO') || upperName.includes('LEAUGE')) {
    // "LEAUGE" is a common misspelling in GO events
    if (upperName.includes('GO')) return false
  }
  // Exclude VGC (Video Game Championship) events
  if (upperName.includes('VGC') || upperName.includes('VG ') ||
      upperName.startsWith('VG ') || upperName.includes(' VG ')) {
    return false
  }
  return true
}

// Convert time to 12-hour format with AM/PM
function formatTime(timeStr: string): string {
  if (!timeStr) return ''
  // Already has AM/PM, return as-is
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr
  // Parse 24-hour format (e.g., "17:30" -> "05:30 PM")
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return timeStr
  let hour = parseInt(match[1])
  const minute = match[2]
  const period = hour >= 12 ? 'PM' : 'AM'
  if (hour > 12) hour -= 12
  if (hour === 0) hour = 12
  return `${hour.toString().padStart(2, '0')}:${minute} ${period}`
}

// Haversine formula to calculate distance between two points in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { country = 'US', latitude, longitude, radius = '50', state = '' } = body

    // Build base request body for pokedata API
    // IMPORTANT: ftcg must be disabled to exclude "nonpremier TCG" events
    // We make separate requests for cups and challenges to avoid the 100 event limit
    const baseBody = {
      past: '',
      country: country,
      city: '',
      shop: '',
      league: '',
      states: state ? JSON.stringify([state]) : '[]',
      postcode: '',
      vcups: '',        // VGC Cups (disabled)
      vchallenges: '',  // VGC Challenges (disabled)
      prereleases: '',  // Pre-releases (disabled)
      premier: '',
      go: '',           // Pokemon GO events (disabled)
      gocup: '',
      mss: '',
      ftcg: '',         // Disabled - this excludes nonpremier TCG events
      fvg: '',          // VGC format (disabled)
      fgo: '',          // GO format (disabled)
      latitude: '',
      longitude: '',
      radius: '',
      unit: 'mi',
      width: 1200,
    }

    // Parse radius for distance filtering
    const maxDistance = parseInt(radius) || 50

    // Make separate requests for cups and challenges to get more events
    // Each request can return up to 100 events, so splitting doubles our coverage
    const [cupsResponse, challengesResponse] = await Promise.all([
      fetch('https://pokedata.ovh/events/tableapi/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ ...baseBody, cups: '1', challenges: '' }),
      }),
      fetch('https://pokedata.ovh/events/tableapi/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ ...baseBody, cups: '', challenges: '1' }),
      }),
    ])

    if (!cupsResponse.ok || !challengesResponse.ok) {
      throw new Error(`Pokedata API returned error`)
    }

    const [cupsData, challengesData] = await Promise.all([
      cupsResponse.json(),
      challengesResponse.json(),
    ])

    // Merge the results
    const data = [...(Array.isArray(cupsData) ? cupsData : []), ...(Array.isArray(challengesData) ? challengesData : [])]

    // API returns a direct array of event objects
    let events: LocalEvent[] = []
    const seenEvents = new Set<string>()

    // HYBRID APPROACH: First add scraper events (includes stores not in pokedata)
    const scraperData = readScraperResults()
    if (scraperData?.events) {
      console.log(`Processing ${scraperData.events.length} scraper events`)
      for (const event of scraperData.events) {
        const normalizedDate = parseScraperDate(event.date)
        if (!normalizedDate) continue

        // Skip non-TCG events (GO, VGC)
        if (!isTCGEvent(event.name || '')) continue

        const eventType = normalizeType(event.type)
        // Dedupe by date + time + store name
        const key = `${normalizedDate}-${event.time || ''}-${normalizeShop(event.shop)}-${eventType}`
        if (seenEvents.has(key)) continue
        seenEvents.add(key)

        events.push({
          id: event.id || `scraper-${event.shop}-${normalizedDate}`.replace(/\s+/g, '-'),
          type: eventType,
          name: event.name || '',
          date: normalizedDate,
          time: event.time || '',
          city: event.city || '',
          state: event.state || 'CA',
          country: event.country || 'US',
          shop: event.shop || '',
          address: event.address || '',
          cost: '',
          registrationUrl: 'https://events.pokemon.com/en-us/events',
          hasJuniors: true,
          hasSeniors: true,
          hasMasters: true,
          source: 'pokemon.com',
        })
      }
    }

    // Then add pokedata events (with deduplication)
    if (Array.isArray(data)) {
      for (const event of data) {
        // Only include League Cups and League Challenges
        const eventType = event.type as string
        if (eventType !== 'League Cup' && eventType !== 'League Challenge') {
          continue
        }

        // Skip non-TCG events (GO, VGC)
        if (!isTCGEvent(event.name || '')) continue

        // Extract time from the 'when' field (format: "2026-01-11 17:30:00")
        const whenParts = event.when?.split(' ') || []
        const time = formatTime(whenParts[1]?.slice(0, 5) || '') // Convert to 12-hour format

        // Check for duplicates by date + time + store name
        const key = `${event.date}-${time}-${normalizeShop(event.shop)}-${eventType}`
        if (seenEvents.has(key)) continue
        seenEvents.add(key)

        // Determine age divisions based on participant counts
        const hasJuniors = parseInt(event.juniors || '0') > 0
        const hasSeniors = parseInt(event.seniors || '0') > 0
        const hasMasters = parseInt(event.masters || '0') > 0

        // Calculate distance if we have coordinates
        let distance: number | undefined
        if (latitude && longitude && event.latitude && event.longitude) {
          distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(event.latitude),
            parseFloat(event.longitude)
          )
        }

        events.push({
          id: event.guid || `${event.date}-${event.city}-${event.shop}`.replace(/\s+/g, '-'),
          type: eventType as 'League Cup' | 'League Challenge',
          name: event.name || '',
          date: event.date || '',
          time,
          city: event.city || '',
          state: event.state || '',
          country: event.country_code || '',
          shop: event.shop || '',
          address: event.street_address || '',
          cost: event.cost || '',
          registrationUrl: event.pokemon_url || '',
          hasJuniors,
          hasSeniors,
          hasMasters,
          distance,
          source: 'pokedata.ovh',
        })
      }

      // Sort by date first (chronological), then by distance within the same date
      if (latitude && longitude) {
        // Filter by max distance (only for pokedata events with coordinates)
        events = events.filter(e => {
          if (e.source === 'pokemon.com') return true // Always include scraper events
          return e.distance !== undefined && e.distance <= maxDistance
        })
        // Sort by date first, then by distance
        events.sort((a, b) => {
          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
          if (dateCompare !== 0) return dateCompare
          // Same date, sort by distance
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance
          }
          return 0
        })
      } else {
        // No coordinates, just sort by date
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
    }

    const fromScraper = events.filter(e => e.source === 'pokemon.com').length
    const fromPokedata = events.filter(e => e.source === 'pokedata.ovh').length
    console.log(`Combined: ${events.length} total (${fromScraper} from scraper, ${fromPokedata} from pokedata)`)

    return NextResponse.json({
      events,
      total: events.length,
      sources: { scraper: fromScraper, pokedata: fromPokedata }
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ events: [], error: 'Failed to fetch events' })
  }
}
