import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const revalidate = 86400 // Cache for 24 hours (deck lists don't change)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const response = await fetch(
      'https://limitlesstcg.com/decks/list/' + id,
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
    const deckList = parseDeckList(html)
    
    return NextResponse.json(deckList)
  } catch (error) {
    console.error('Error fetching deck list:', error)
    return NextResponse.json({
      pokemon: [],
      trainers: [],
      energy: [],
      error: 'Failed to fetch deck list'
    })
  }
}

interface CardEntry {
  name: string
  setCode: string
  setNumber: string
  count: number
}

function parseDeckList(html: string) {
  const $ = cheerio.load(html)
  
  const pokemon: CardEntry[] = []
  const trainers: CardEntry[] = []
  const energy: CardEntry[] = []
  
  let currentCategory = 'pokemon'
  
  // Process each column
  $('.decklist-column').each((_, column) => {
    const $column = $(column)
    const heading = $column.find('.decklist-column-heading').text().toLowerCase()
    
    if (heading.includes('pokémon') || heading.includes('pokemon')) {
      currentCategory = 'pokemon'
    } else if (heading.includes('trainer')) {
      currentCategory = 'trainers'
    } else if (heading.includes('energy')) {
      currentCategory = 'energy'
    }
    
    $column.find('.decklist-card').each((_, card) => {
      const $card = $(card)
      const setCode = $card.attr('data-set') || ''
      const setNumber = $card.attr('data-number') || ''
      const count = parseInt($card.find('.card-count').text().trim(), 10) || 1
      const name = $card.find('.card-name').text().trim()
      
      if (name) {
        const entry: CardEntry = { name, setCode, setNumber, count }
        
        if (currentCategory === 'pokemon') {
          pokemon.push(entry)
        } else if (currentCategory === 'trainers') {
          trainers.push(entry)
        } else if (currentCategory === 'energy') {
          energy.push(entry)
        }
      }
    })
  })
  
  return { pokemon, trainers, energy }
}
