import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const revalidate = 3600 // Cache for 1 hour

interface ResultEntry {
  deckId: string
  archetype: { id: string; name: string; primaryPokemon: string[]; tier?: number }
  tournament: { id: string }
  placement: number
  playerName: string
  deckListId: string | null
  labsTpId: number | null
  labsId: string | null
  labsDivision: string | null
  hasLabsDeckList: boolean
  deckList: { pokemon: never[]; trainers: never[]; energy: never[] }
}

function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, {
    headers: { 'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0' },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const division = searchParams.get('division') || '' // 'JR', 'SR', or '' (Masters)

    if (division === 'JR' || division === 'SR') {
      return await handleDivisionResults(id, division)
    }

    // Masters: scrape main tournament page
    const response = await fetchWithTimeout(`https://limitlesstcg.com/tournaments/${id}`)
    if (!response.ok) {
      throw new Error('Limitless returned ' + response.status)
    }

    const html = await response.text()
    const results = parseResults(html, id, 32)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching tournament results:', error)
    return NextResponse.json([])
  }
}

async function handleDivisionResults(id: string, division: string) {
  // Fetch main tournament page to find Labs ID
  const mainResponse = await fetchWithTimeout(`https://limitlesstcg.com/tournaments/${id}`).catch(() => null)

  if (mainResponse?.ok) {
    const mainHtml = await mainResponse.text()
    const $main = cheerio.load(mainHtml)

    let labsId = ''
    $main('a[href*="labs.limitlesstcg.com"]').each((_, el) => {
      const href = $main(el).attr('href') || ''
      const match = href.match(/labs\.limitlesstcg\.com\/(\d+)/)
      if (match) labsId = match[1]
    })

    if (labsId) {
      try {
        const labsUrl = `https://labs.limitlesstcg.com/${labsId}/${division}/standings`
        const labsResponse = await fetchWithTimeout(labsUrl)
        if (labsResponse.ok) {
          const labsHtml = await labsResponse.text()
          const labsResults = parseLabsResults(labsHtml, id, labsId, division)
          if (labsResults.length > 0) {
            return NextResponse.json(labsResults)
          }
        }
      } catch {
        // Labs fetch failed, fall through to main site
      }
    }
  }

  // Fallback: scrape main site division page if Labs unavailable
  try {
    const divisionResponse = await fetchWithTimeout(`https://limitlesstcg.com/tournaments/${id}/${division}`)
    if (divisionResponse.ok) {
      const html = await divisionResponse.text()
      return NextResponse.json(parseResults(html, id, 64))
    }
  } catch {
    // Division page also failed
  }

  return NextResponse.json([])
}

function parseLabsResults(html: string, tournamentId: string, labsId: string, division: string): ResultEntry[] {
  const $ = cheerio.load(html)

  let players: Array<{
    name: string
    tp_id: number
    placement: number
    day2: number
    deck_name: string
    deck_id: string
    decklist: number
  }> = []

  $('script').each((_, el) => {
    const text = $(el).html() || ''
    if (text.length > 5000) {
      try {
        const parsed = JSON.parse(text)
        const message = JSON.parse(parsed.body).message
        if (Array.isArray(message)) {
          players = message
        }
      } catch {
        // Not the right script tag
      }
    }
  })

  if (players.length === 0) return []

  // Filter to Day 2 players only
  const day2Players = players.filter(p => p.day2 === 1)

  return day2Players.map(p => ({
    deckId: p.deck_id || generateDeckId(p.deck_name || 'Unknown'),
    archetype: {
      id: p.deck_id || generateDeckId(p.deck_name || 'Unknown'),
      name: p.deck_name || 'Unknown Deck',
      primaryPokemon: extractPrimaryPokemon(p.deck_name || ''),
      tier: p.placement <= 4 ? 1 : p.placement <= 8 ? 2 : 3,
    },
    tournament: { id: tournamentId },
    placement: p.placement,
    playerName: p.name,
    deckListId: null,
    labsTpId: p.tp_id || null,
    labsId,
    labsDivision: division,
    hasLabsDeckList: p.decklist === 1,
    deckList: { pokemon: [] as never[], trainers: [] as never[], energy: [] as never[] },
  }))
}

function parseResults(html: string, tournamentId: string, maxRank: number = 32): ResultEntry[] {
  const $ = cheerio.load(html)
  const results: ResultEntry[] = []

  $('tr[data-rank]').each((_, element) => {
    const $row = $(element)

    const rank = parseInt($row.attr('data-rank') || '0', 10)
    const playerName = $row.attr('data-name') || ''
    const deckName = $row.attr('data-deck') || 'Unknown Deck'

    // Get deck list ID from the link
    const deckListLink = $row.find('a[href*="/decks/list/"]').attr('href') || ''
    const deckListId = deckListLink.split('/').pop() || null

    if (rank > 0 && rank <= maxRank && playerName) {
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
        labsTpId: null,
        labsId: null,
        labsDivision: null,
        hasLabsDeckList: false,
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
