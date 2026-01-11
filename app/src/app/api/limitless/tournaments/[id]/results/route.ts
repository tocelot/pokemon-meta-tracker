import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const revalidate = 3600 // Cache for 1 hour

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const response = await fetch(
      'https://limitlesstcg.com/tournaments/' + id,
      {
        headers: {
          'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0',
        },
      }
    )
    
    if (!response.ok) {
      throw new Error('Limitless returned ' + response.status)
    }
    
    const html = await response.text()
    const results = parseResults(html, id)
    
    if (results.length === 0) {
      return NextResponse.json([])
    }
    
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching tournament results:', error)
    return NextResponse.json([])
  }
}

function parseResults(html: string, tournamentId: string) {
  const $ = cheerio.load(html)
  const results: Array<{
    deckId: string
    archetype: { id: string; name: string; primaryPokemon: string[]; tier?: number }
    tournament: { id: string }
    placement: number
    playerName: string
    deckListId: string | null
    deckList: { pokemon: never[]; trainers: never[]; energy: never[] }
  }> = []
  
  $('tr[data-rank]').each((_, element) => {
    const $row = $(element)
    
    const rank = parseInt($row.attr('data-rank') || '0', 10)
    const playerName = $row.attr('data-name') || ''
    const deckName = $row.attr('data-deck') || 'Unknown Deck'
    
    // Get deck list ID from the link
    const deckListLink = $row.find('a[href*="/decks/list/"]').attr('href') || ''
    const deckListId = deckListLink.split('/').pop() || null
    
    if (rank > 0 && rank <= 32 && playerName) {
      results.push({
        deckId: generateDeckId(deckName),
        archetype: {
          id: generateDeckId(deckName),
          name: deckName,
          primaryPokemon: extractPrimaryPokemon(deckName),
          tier: rank <= 4 ? 1 : rank <= 8 ? 2 : 3,
        },
        tournament: { id: tournamentId },
        placement: rank,
        playerName,
        deckListId,
        deckList: { pokemon: [], trainers: [], energy: [] },
      })
    }
  })
  
  return results
}

function generateDeckId(deckName: string): string {
  return deckName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unknown'
}

function extractPrimaryPokemon(deckName: string): string[] {
  return deckName
    .split(/[\s\/,&]+/)
    .filter(s => s.length > 0 && s[0] === s[0].toUpperCase())
}
