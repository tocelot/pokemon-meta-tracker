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
  // Fetch division page AND main page in parallel
  const [divisionResponse, mainResponse] = await Promise.all([
    fetchWithTimeout(`https://limitlesstcg.com/tournaments/${id}/${division}`).catch(() => null),
    fetchWithTimeout(`https://limitlesstcg.com/tournaments/${id}`).catch(() => null),
  ])

  // Parse division page results (has deck list IDs)
  let mainSiteResults: ResultEntry[] = []
  if (divisionResponse?.ok) {
    const html = await divisionResponse.text()
    mainSiteResults = parseResults(html, id, 64)
  }

  // Extract Labs ID from main page and fetch Labs standings
  let labsResults: ResultEntry[] = []
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
          labsResults = parseLabsResults(labsHtml, id)
        }
      } catch {
        // Labs fetch failed, continue with main site results only
      }
    }
  }

  // Merge: prefer Labs (comprehensive Day 2 data), enrich with main site deck list IDs
  if (labsResults.length > 0) {
    const mainByPlayer = new Map<string, ResultEntry>()
    for (const r of mainSiteResults) {
      mainByPlayer.set(r.playerName.toLowerCase(), r)
    }

    const merged: ResultEntry[] = labsResults.map(labsEntry => {
      const mainEntry = mainByPlayer.get(labsEntry.playerName.toLowerCase())
      if (mainEntry?.deckListId) {
        return { ...labsEntry, deckListId: mainEntry.deckListId }
      }
      return labsEntry
    })

    return NextResponse.json(merged)
  }

  // Fallback to main site results
  return NextResponse.json(mainSiteResults)
}

function parseLabsResults(html: string, tournamentId: string): ResultEntry[] {
  const $ = cheerio.load(html)

  let players: Array<{
    name: string
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
