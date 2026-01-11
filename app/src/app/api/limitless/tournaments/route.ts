import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const revalidate = 3600 // Cache for 1 hour

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const isManualRefresh = searchParams.has('refresh')
  
  try {
    const response = await fetch('https://limitlesstcg.com/tournaments?game=PTCG', {
      headers: {
        'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0',
      },
      ...(isManualRefresh && { cache: 'no-store' as const }),
    })
    
    if (!response.ok) {
      throw new Error('Limitless returned ' + response.status)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const tournaments: Array<{
      id: string
      name: string
      date: string
      playerCount: number
      location: string
      type: string
      format: string
      url: string
    }> = []
    
    // Parse tournament rows from the table
    $('table.completed-tournaments tr[data-date]').each((_, element) => {
      const $row = $(element)
      
      // Get data from attributes
      const date = $row.attr('data-date') || ''
      const country = $row.attr('data-country') || ''
      const name = $row.attr('data-name') || ''
      const playerCount = parseInt($row.attr('data-players') || '0', 10)
      
      // Get tournament ID from the link
      const link = $row.find('a[href*="/tournaments/"]').first()
      const href = link.attr('href') || ''
      const id = href.split('/').pop() || ''
      
      if (id && name) {
        tournaments.push({
          id,
          name,
          date,
          playerCount,
          location: country,
          type: inferTournamentType(name),
          format: 'Standard',
          url: 'https://limitlesstcg.com/tournaments/' + id,
        })
      }
    })
    
    // If scraping didn't work, return fallback data
    if (tournaments.length === 0) {
      return NextResponse.json(getFallbackTournaments())
    }
    
    return NextResponse.json(tournaments)
  } catch (error) {
    console.error('Error fetching Limitless tournaments:', error)
    return NextResponse.json(getFallbackTournaments())
  }
}

function inferTournamentType(name: string): string {
  const nameLower = name.toLowerCase()
  if (nameLower.includes('international') || nameLower.includes('laic') || nameLower.includes('naic') || nameLower.includes('euic') || nameLower.includes('ocic')) return 'international'
  if (nameLower.includes('regional')) return 'regional'
  if (nameLower.includes('special')) return 'special'
  if (nameLower.includes('world')) return 'worlds'
  if (nameLower.includes('champions league')) return 'regional'
  return 'other'
}

function getFallbackTournaments() {
  return [
    {
      id: '528',
      name: 'Regional Stuttgart',
      date: '2025-11-29',
      playerCount: 2200,
      location: 'DE',
      type: 'regional',
      format: 'Standard',
      url: 'https://limitlesstcg.com/tournaments/528',
    },
    {
      id: '516',
      name: 'LAIC 2025-26, São Paulo',
      date: '2025-11-21',
      playerCount: 2117,
      location: 'BR',
      type: 'international',
      format: 'Standard',
      url: 'https://limitlesstcg.com/tournaments/516',
    },
    {
      id: '546',
      name: 'Champions League Aichi',
      date: '2025-12-06',
      playerCount: 6500,
      location: 'JP',
      type: 'regional',
      format: 'Standard',
      url: 'https://limitlesstcg.com/tournaments/546',
    },
  ]
}
