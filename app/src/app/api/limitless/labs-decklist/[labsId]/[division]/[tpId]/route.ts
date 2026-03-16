import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const dynamic = 'force-dynamic'

interface CardEntry {
  name: string
  setCode: string
  setNumber: string
  count: number
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ labsId: string; division: string; tpId: string }> }
) {
  try {
    const { labsId, division, tpId } = await params

    const url = `https://labs.limitlesstcg.com/${labsId}/${division}/player/${tpId}/decklist`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Pokemon-TCG-Meta-Tracker/1.0' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!response.ok) {
      throw new Error('Labs returned ' + response.status)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract deck list from embedded SvelteKit JSON
    let deckData: { pokemon?: Array<{ count: number; name: string; set: string; number: string }>; trainer?: Array<{ count: number; name: string; set: string; number: string }>; energy?: Array<{ count: number; name: string; set: string; number: string }> } | null = null

    $('script').each((_, el) => {
      const text = $(el).html() || ''
      if (text.length > 500) {
        try {
          const parsed = JSON.parse(text)
          const body = JSON.parse(parsed.body)
          const message = body.message
          if (message && (message.pokemon || message.trainer || message.energy)) {
            deckData = message
          }
        } catch {
          // Not the right script tag
        }
      }
    })

    if (!deckData) {
      return NextResponse.json({
        pokemon: [],
        trainers: [],
        energy: [],
        error: 'No deck list data found on Labs',
      })
    }

    type LabsCard = { count: number; name: string; set: string; number: string }
    const mapCards = (cards: LabsCard[] | undefined): CardEntry[] =>
      (cards || []).map(c => ({
        name: c.name,
        setCode: c.set,
        setNumber: c.number,
        count: c.count,
      }))

    const result = deckData as { pokemon?: LabsCard[]; trainer?: LabsCard[]; energy?: LabsCard[] }
    return NextResponse.json({
      pokemon: mapCards(result.pokemon),
      trainers: mapCards(result.trainer),
      energy: mapCards(result.energy),
    })
  } catch (error) {
    console.error('Error fetching Labs deck list:', error)
    return NextResponse.json({
      pokemon: [],
      trainers: [],
      energy: [],
      error: 'Failed to fetch Labs deck list',
    })
  }
}
