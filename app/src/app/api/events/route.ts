import { NextResponse } from 'next/server'

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

    if (Array.isArray(data)) {
      for (const event of data) {
        // Only include League Cups and League Challenges
        const eventType = event.type as string
        if (eventType !== 'League Cup' && eventType !== 'League Challenge') {
          continue
        }

        // Extract time from the 'when' field (format: "2026-01-11 17:30:00")
        const whenParts = event.when?.split(' ') || []
        const time = whenParts[1]?.slice(0, 5) || '' // Get HH:MM

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
        })
      }

      // Sort by date first (chronological), then by distance within the same date
      if (latitude && longitude) {
        // Filter by max distance
        events = events.filter(e => e.distance !== undefined && e.distance <= maxDistance)
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

    return NextResponse.json({ events, total: events.length })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ events: [], error: 'Failed to fetch events' })
  }
}
