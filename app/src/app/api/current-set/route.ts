import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 86400 // Cache for 24 hours

interface TCGSet {
  id: string
  name: string
  series: string
  releaseDate: string
  legalities: {
    standard?: string
    expanded?: string
    unlimited?: string
  }
}

// The Pokemon TCG API release date is the product release, but sets
// become tournament-legal ~2 weeks later. This offset approximates that.
const LEGALITY_OFFSET_DAYS = 14

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr.replace(/\//g, '-'))
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const response = await fetch(
      'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=5&select=id,name,releaseDate,legalities,series',
      { next: { revalidate: 86400 } }
    )

    if (!response.ok) {
      throw new Error(`Pokemon TCG API returned ${response.status}`)
    }

    const data = await response.json()
    const sets: TCGSet[] = data.data || []

    // Find the most recent set that is standard-legal
    const currentSet = sets.find(s => s.legalities?.standard === 'Legal')

    if (!currentSet) {
      throw new Error('No standard-legal set found')
    }

    const releaseDate = currentSet.releaseDate.replace(/\//g, '-')
    const legalDate = addDays(releaseDate, LEGALITY_OFFSET_DAYS)

    return NextResponse.json({
      name: currentSet.name,
      code: currentSet.id,
      releaseDate,
      legalDate,
    })
  } catch (error) {
    console.error('Error fetching current set:', error)
    // Fallback to hardcoded value
    return NextResponse.json({
      name: 'Ascended Heroes',
      code: 'me2pt5',
      releaseDate: '2026-01-30',
      legalDate: '2026-03-06',
    })
  }
}
