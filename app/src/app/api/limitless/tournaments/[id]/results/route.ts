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
  deckList: { pokemon: never[]; trainers: never[]; energy: never[] }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const division = searchParams.get('division') || '' // 'JR', 'SR', or '' (Masters)

    // Scrape main tournament page (has deck list links)
    const url = division
      ? `https://limitlesstcg.com/tournaments/${id}/${division}`
      : `https://limitlesstcg.com/tournaments/${id}`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0' },
    })

    if (!response.ok) {
      throw new Error('Limitless returned ' + response.status)
    }

    const html = await response.text()
    const maxRank = division ? 64 : 32
    const mainResults = parseResults(html, id, maxRank)

    // For JR/SR, also fetch Labs data and merge to get more Day 2 players
    if (division === 'JR' || division === 'SR') {
      const labsResults = await fetchLabsResults(id, division)
      if (labsResults.length > 0) {
        // Build a map of main site results by player name for deckListId lookup
        const mainByPlayer = new Map<string, ResultEntry>()
        for (const r of mainResults) {
          mainByPlayer.set(r.playerName.toLowerCase(), r)
        }

        // Merge: start with Labs results (more comprehensive), enrich with main site deckListIds
        const merged: ResultEntry[] = labsResults.map(labsEntry => {
          const mainEntry = mainByPlayer.get(labsEntry.playerName.toLowerCase())
          if (mainEntry && mainEntry.deckListId) {
            return { ...labsEntry, deckListId: mainEntry.deckListId }
          }
          return labsEntry
        })

        return NextResponse.json(merged)
      }
    }

    return NextResponse.json(mainResults)
  } catch (error) {
    console.error('Error fetching tournament results:', error)
    return NextResponse.json([])
  }
}

// Fetch Day 2 results from Limitless Labs for JR/SR divisions
async function fetchLabsResults(tournamentId: string, division: string): Promise<ResultEntry[]> {
  try {
    // First, get the Labs ID from the main tournament page
    const mainPage = await fetch(`https://limitlesstcg.com/tournaments/${tournamentId}`, {
      headers: { 'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0' },
    })
    if (!mainPage.ok) return []

    const mainHtml = await mainPage.text()
    const $main = cheerio.load(mainHtml)

    // Find Labs link like "https://labs.limitlesstcg.com/0047/standings"
    let labsId = ''
    $main('a[href*="labs.limitlesstcg.com"]').each((_, el) => {
      const href = $main(el).attr('href') || ''
      const match = href.match(/labs\.limitlesstcg\.com\/(\d+)/)
      if (match) labsId = match[1]
    })

    if (!labsId) return []

    // Fetch Labs standings for the division
    const labsUrl = `https://labs.limitlesstcg.com/${labsId}/${division}/standings`
    const labsResponse = await fetch(labsUrl, {
      headers: { 'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0' },
    })
    if (!labsResponse.ok) return []

    const labsHtml = await labsResponse.text()
    const $labs = cheerio.load(labsHtml)

    // Extract JSON data from SvelteKit script tags
    let players: Array<{
      name: string
      placement: number
      day2: number
      deck_name: string
      deck_id: string
      decklist: number
    }> = []

    $labs('script').each((_, el) => {
      const text = $labs(el).html() || ''
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
      deckList: { pokemon: [] as never[], trainers: [] as never[], energy: [] as never[] },
    }))
  } catch (error) {
    console.error('Error fetching Labs results:', error)
    return []
  }
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
