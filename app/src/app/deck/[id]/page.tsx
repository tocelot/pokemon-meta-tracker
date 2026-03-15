'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { DeckList } from '@/components/DeckList'
import { DeckList as DeckListType, CardEntry } from '@/lib/types'
import creatorsData from '@/data/creators.json'

const FALLBACK_SET = {
  name: 'Ascended Heroes',
  releaseDate: '2026-03-06',
  code: 'me2pt5',
}

const LAST_UPDATED = new Date().toISOString()

interface AverageCard { name: string; setCode: string; setNumber: string; avgCount: number; minCount: number; maxCount: number; playRate: number }
interface AveragesByCategory { pokemon: AverageCard[]; trainers: AverageCard[]; energy: AverageCard[] }

interface PageProps {
  params: Promise<{ id: string }>
}

// MARKER
function DeckPageContent({ params }: PageProps) {
  const searchParams = useSearchParams()
  const deckListId = searchParams.get('list')
  const playerName = searchParams.get('player')
  const placement = searchParams.get('placement')
  const tournamentName = searchParams.get('tournament')
  const fromTab = searchParams.get('from')
  
  const [currentSet, setCurrentSet] = useState(FALLBACK_SET)

  useEffect(() => {
    fetch('/api/current-set')
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          setCurrentSet({
            name: data.name,
            releaseDate: data.legalDate || data.releaseDate,
            code: data.code,
          })
        }
      })
      .catch(() => {})
  }, [])

  interface DeckEntry {
    deckList: DeckListType
    playerName: string
    placement: number
    deckListId: string
    tournamentName: string
  }

  const [id, setId] = useState<string>('')
  const [topDecks, setTopDecks] = useState<DeckEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [averages, setAverages] = useState<AveragesByCategory | null>(null)
  const [deckCount, setDeckCount] = useState(0)
  const [averagesLoading, setAveragesLoading] = useState(false)

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  useEffect(() => {
    async function fetchTopDecks() {
      setLoading(true)
      setError(null)

      try {
        const found: DeckEntry[] = []

        // If a specific deck list ID was provided, fetch it first
        if (deckListId) {
          const response = await fetch('/api/limitless/decklist/' + deckListId)
          if (response.ok) {
            const data = await response.json()
            if (!data.error && (data.pokemon?.length > 0 || data.trainers?.length > 0 || data.energy?.length > 0)) {
              found.push({
                deckList: data,
                playerName: playerName || '',
                placement: parseInt(placement || '0'),
                deckListId,
                tournamentName: tournamentName || '',
              })
            }
          }
        }

        // Search tournaments for more deck lists of this archetype
        if (id && found.length < 3) {
          const tournamentsRes = await fetch('/api/limitless/tournaments')
          if (tournamentsRes.ok) {
            const tournaments = await tournamentsRes.json()
            for (const tournament of tournaments.slice(0, 5)) {
              if (found.length >= 3) break
              const resultsRes = await fetch('/api/limitless/tournaments/' + tournament.id + '/results')
              if (!resultsRes.ok) continue
              const results = await resultsRes.json()
              const matches = results
                .filter((r: { deckId: string; deckListId?: string }) => r.deckId === id && r.deckListId)
                .sort((a: { placement: number }, b: { placement: number }) => a.placement - b.placement)

              for (const match of matches) {
                if (found.length >= 3) break
                // Skip if we already have this deck list
                if (found.some(f => f.deckListId === match.deckListId)) continue

                const deckRes = await fetch('/api/limitless/decklist/' + match.deckListId)
                if (!deckRes.ok) continue
                const deckData = await deckRes.json()
                if (deckData.pokemon?.length > 0 || deckData.trainers?.length > 0 || deckData.energy?.length > 0) {
                  found.push({
                    deckList: deckData,
                    playerName: match.playerName || '',
                    placement: match.placement,
                    deckListId: match.deckListId,
                    tournamentName: tournament.name || '',
                  })
                }
              }
            }
          }
        }

        if (found.length === 0 && deckListId) {
          setError('Failed to fetch deck list')
        }
        setTopDecks(found)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (id || deckListId) {
      fetchTopDecks()
    }
  }, [deckListId, id, playerName, placement, tournamentName])
  useEffect(() => {
    async function fetchDay2Averages() {
      if (!id) return
      setAveragesLoading(true)
      try {
        const tournamentsRes = await fetch('/api/limitless/tournaments')
        if (!tournamentsRes.ok) return
        const tournaments = await tournamentsRes.json()
        const allDeckLists: DeckListType[] = []
        for (const tournament of tournaments.slice(0, 5)) {
          const resultsRes = await fetch('/api/limitless/tournaments/' + tournament.id + '/results')
          if (!resultsRes.ok) continue
          const results = await resultsRes.json()
          const day2Results = results.filter((r: { deckId: string; placement: number; deckListId?: string }) =>
            r.deckId === id && r.placement <= 32 && r.deckListId
          )
          for (const result of day2Results.slice(0, 10)) {
            if (result.deckListId) {
              const deckRes = await fetch('/api/limitless/decklist/' + result.deckListId)
              if (deckRes.ok) {
                const deckData = await deckRes.json()
                if (deckData.pokemon?.length > 0 || deckData.trainers?.length > 0 || deckData.energy?.length > 0) {
                  allDeckLists.push(deckData)
                }
              }
            }
          }
        }
        if (allDeckLists.length > 0) {
          setDeckCount(allDeckLists.length)
          setAverages(calculateAverages(allDeckLists))
        }
      } catch (err) {
        console.error('Error fetching Day 2 averages:', err)
      } finally {
        setAveragesLoading(false)
      }
    }
    fetchDay2Averages()
  }, [id])

  function calculateAverages(deckLists: DeckListType[]): AveragesByCategory {
    const total = deckLists.length
    function calcCategory(cards: CardEntry[][]): AverageCard[] {
      const cardMap = new Map<string, { counts: number[]; setCode: string; setNumber: string }>()
      cards.forEach(categoryCards => {
        categoryCards.forEach(card => {
          const key = card.name
          if (!cardMap.has(key)) {
            cardMap.set(key, { counts: [], setCode: card.setCode, setNumber: card.setNumber })
          }
          cardMap.get(key)!.counts.push(card.count)
        })
      })
      const results: AverageCard[] = []
      cardMap.forEach((data, name) => {
        const counts = data.counts
        const avgCount = counts.reduce((a, b) => a + b, 0) / total
        results.push({
          name,
          setCode: data.setCode,
          setNumber: data.setNumber,
          avgCount: Math.round(avgCount * 10) / 10,
          minCount: Math.min(...counts),
          maxCount: Math.max(...counts),
          playRate: Math.round((counts.length / total) * 100),
        })
      })
      return results.sort((a, b) => b.playRate - a.playRate || b.avgCount - a.avgCount)
    }
    return {
      pokemon: calcCategory(deckLists.map(d => d.pokemon)),
      trainers: calcCategory(deckLists.map(d => d.trainers)),
      energy: calcCategory(deckLists.map(d => d.energy)),
    }
  }

  function AvgTable({ title, cards }: { title: string; cards: AverageCard[] }) {
    if (cards.length === 0) return null
    return (
      <div>
        <h4 className="text-lg font-semibold text-white mb-3">{title}</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2">Card</th>
              <th className="text-right py-2">Avg</th>
              <th className="text-right py-2">Range</th>
              <th className="text-right py-2">Play Rate</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, idx) => (
              <tr key={idx} className="border-b border-gray-800">
                <td className="py-2 text-white">{card.name}</td>
                <td className="py-2 text-right text-poke-yellow">{card.avgCount}</td>
                <td className="py-2 text-right text-gray-400">{card.minCount}-{card.maxCount}</td>
                <td className="py-2 text-right text-poke-blue">{card.playRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const creatorRec = creatorsData.recommendations.find(r => r.deckId === id)
  
  const archetype = creatorRec?.archetype || {
    id: id,
    name: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    primaryPokemon: [],
    tier: undefined,
  }


  return (
    <div className="min-h-screen bg-poke-darker">
      <Header 
        currentSet={currentSet}
        lastUpdated={LAST_UPDATED}
      />
      
      <main className="container mx-auto px-4 py-8">
        <Link
          href={fromTab === 'tournament' ? '/?tab=tournament' : '/'}
          className="text-poke-yellow hover:text-yellow-300 text-sm mb-6 inline-block"
        >
          ← Back to {fromTab === 'tournament' ? 'Tournament Results' : 'Meta Overview'}
        </Link>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {archetype.name}
          </h1>
          
          {archetype.tier && (
            <span className="inline-block bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 text-sm px-3 py-1 rounded">
              Tier {archetype.tier}
            </span>
          )}
          
          {creatorRec && (
            <div className="mt-4 text-gray-400">
              {creatorRec.notes && <p className="italic">{creatorRec.notes}</p>}
            </div>
          )}
        </div>

        {creatorRec && (
          <div className="mb-8 p-6 bg-poke-dark border border-poke-blue/50 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-3">
              Creator Video
            </h2>
            <p className="text-gray-400 mb-4">
              Watch {creatorRec.creator.name}&apos;s breakdown of this deck:
            </p>
            <a
              href={creatorRec.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-poke-blue hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              {creatorRec.videoTitle}
            </a>
          </div>
        )}

        <h2 className="text-2xl font-bold text-white mb-4">
          Top Placing Decks for this Archetype
        </h2>

        {loading ? (
          <div className="bg-poke-dark border border-gray-800 rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-32 mb-6"></div>
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-24 mb-4"></div>
                    {[1, 2, 3, 4, 5].map(j => (
                      <div key={j} className="h-4 bg-gray-700 rounded"></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
            {error}
          </div>
        ) : topDecks.length > 0 ? (
          <div className="space-y-8">
            {topDecks.map((entry, idx) => {
              const ordinal = entry.placement === 1 ? '1st' : entry.placement === 2 ? '2nd' : entry.placement === 3 ? '3rd' : entry.placement + 'th'
              return (
                <div key={entry.deckListId || idx}>
                  <div className="mb-3 p-3 bg-poke-dark border border-gray-800 rounded-lg">
                    <p className="text-gray-400 text-sm">
                      {entry.playerName && (
                        <span className="text-white font-medium">{entry.playerName}</span>
                      )}
                      {entry.placement > 0 && (
                        <>
                          {entry.playerName ? ' - ' : ''}
                          <span className="text-poke-yellow">{ordinal} place</span>
                        </>
                      )}
                      {entry.tournamentName && (
                        <span className="text-gray-500"> at {entry.tournamentName}</span>
                      )}
                      {entry.deckListId && (
                        <>
                          {' · '}
                          <a
                            href={'https://limitlesstcg.com/decks/list/' + entry.deckListId}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-poke-blue hover:underline"
                          >
                            View on Limitless
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <DeckList deckList={entry.deckList} />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-6 p-4 bg-poke-dark border border-gray-800 rounded-lg">
            <p className="text-gray-400 text-sm">
              No tournament deck list found for this archetype. Check{' '}
              <a
                href="https://limitlesstcg.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-poke-blue hover:underline"
              >
                Limitless TCG
              </a>
              {' '}for more deck lists.
            </p>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Average Card Counts of Day 2 Decks
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {averagesLoading
              ? 'Loading averages...'
              : deckCount > 0
              ? 'Based on ' + deckCount + ' deck' + (deckCount !== 1 ? 's' : '') + ' that made Day 2 (top 32)'
              : 'No Day 2 deck data available for this archetype'}
          </p>

          {averagesLoading ? (
            <div className="bg-poke-dark border border-gray-800 rounded-lg p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-700 rounded w-48"></div>
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              </div>
            </div>
          ) : averages ? (
            <div className="bg-poke-dark border border-gray-800 rounded-lg p-6 space-y-8">
              <AvgTable title="Pokemon" cards={averages.pokemon} />
              <AvgTable title="Trainers" cards={averages.trainers} />
              <AvgTable title="Energy" cards={averages.energy} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

export default function DeckPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-poke-darker flex items-center justify-center text-gray-400">Loading...</div>}>
      <DeckPageContent params={params} />
    </Suspense>
  )
}
