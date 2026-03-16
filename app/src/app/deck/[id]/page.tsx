'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
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

function DeckPageContent({ params }: PageProps) {
  const searchParams = useSearchParams()
  const deckListId = searchParams.get('list')
  const playerName = searchParams.get('player')
  const placement = searchParams.get('placement')
  const tournamentName = searchParams.get('tournament')
  const fromTab = searchParams.get('from')
  const divisionFromUrl = searchParams.get('division')
  const labsTpId = searchParams.get('labsTpId')
  const labsIdParam = searchParams.get('labsId')
  const labsDivisionParam = searchParams.get('labsDivision')
  const [divisionParam, setDivisionParam] = useState(divisionFromUrl || '')

  useEffect(() => {
    if (!divisionFromUrl) {
      try {
        const saved = localStorage.getItem('pokemon-tcg-meta-division')
        if (saved === 'JR' || saved === 'SR' || saved === '') {
          setDivisionParam(saved)
        }
      } catch {
        // ignore
      }
    }
  }, [divisionFromUrl])

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

  const [id, setId] = useState<string>('')
  const [deckList, setDeckList] = useState<DeckListType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [averages, setAverages] = useState<AveragesByCategory | null>(null)
  const [deckCount, setDeckCount] = useState(0)
  const [averagesLoading, setAveragesLoading] = useState(false)
  const [myDeckText, setMyDeckText] = useState('')
  const [myDeck, setMyDeck] = useState<DeckListType | null>(null)
  const [showPasteBox, setShowPasteBox] = useState(false)

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  // Fetch deck list: use main site deckListId if available, otherwise try Labs
  useEffect(() => {
    if (!deckListId && !labsTpId) return

    async function fetchDeckList() {
      setLoading(true)
      setError(null)
      try {
        let url: string
        if (deckListId) {
          // Fetch from main Limitless site
          url = '/api/limitless/decklist/' + deckListId
        } else {
          // Fetch from Labs using tp_id
          url = `/api/limitless/labs-decklist/${labsIdParam}/${labsDivisionParam}/${labsTpId}`
        }

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('Failed to fetch deck list')
        }
        const data = await response.json()
        if (data.error || (!data.pokemon?.length && !data.trainers?.length && !data.energy?.length)) {
          throw new Error('No deck list data found')
        }
        setDeckList(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDeckList()
  }, [deckListId, labsTpId, labsIdParam, labsDivisionParam])

  // Fetch Day 2 averages for this archetype
  useEffect(() => {
    if (!id) return

    async function fetchDay2Averages() {
      setAveragesLoading(true)
      try {
        let selectedTournamentIds: string[] = []
        try {
          const stored = localStorage.getItem('pokemon-tcg-meta-selected-tournaments')
          if (stored) {
            const parsed = JSON.parse(stored)
            selectedTournamentIds = parsed.selectedIds || []
          }
        } catch {
          // ignore
        }
        const divisionQuery = divisionParam ? `?division=${divisionParam}` : ''

        let tournamentIds = selectedTournamentIds
        if (tournamentIds.length === 0) {
          const tournamentsRes = await fetch('/api/limitless/tournaments')
          if (!tournamentsRes.ok) return
          const tournaments = await tournamentsRes.json()
          tournamentIds = tournaments.slice(0, 5).map((t: { id: string }) => t.id)
        }

        const allDeckLists: DeckListType[] = []
        for (const tournamentId of tournamentIds) {
          const resultsRes = await fetch('/api/limitless/tournaments/' + tournamentId + '/results' + divisionQuery)
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
  }, [id, divisionParam])

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

  function parsePTCGLiveDeck(text: string): DeckListType {
    const pokemon: CardEntry[] = []
    const trainers: CardEntry[] = []
    const energy: CardEntry[] = []
    let current: CardEntry[] = pokemon

    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^pok[eé]mon/i.test(trimmed)) { current = pokemon; continue }
      if (/^trainer/i.test(trimmed)) { current = trainers; continue }
      if (/^energy/i.test(trimmed)) { current = energy; continue }
      if (/^total cards/i.test(trimmed)) continue

      const match = trimmed.match(/^(\d+)\s+(.+?)\s+([A-Z]{2,5}\d*)\s+(\d+)$/)
      if (match) {
        current.push({
          count: parseInt(match[1]),
          name: match[2].trim(),
          setCode: match[3],
          setNumber: match[4],
        })
      }
    }
    return { pokemon, trainers, energy }
  }

  function handlePasteDeck() {
    if (!myDeckText.trim()) {
      setMyDeck(null)
      return
    }
    const parsed = parsePTCGLiveDeck(myDeckText)
    const totalCards = parsed.pokemon.length + parsed.trainers.length + parsed.energy.length
    if (totalCards > 0) {
      setMyDeck(parsed)
      setShowPasteBox(false)
    }
  }

  const myDeckMap = useMemo(() => {
    if (!myDeck) return null
    const map = new Map<string, number>()
    for (const card of [...myDeck.pokemon, ...myDeck.trainers, ...myDeck.energy]) {
      map.set(card.name, (map.get(card.name) || 0) + card.count)
    }
    return map
  }, [myDeck])

  function AvgTable({ title, cards, myCards }: { title: string; cards: AverageCard[]; myCards: CardEntry[] | null }) {
    if (cards.length === 0) return null

    const avgCardNames = new Set(cards.map(c => c.name))
    const extraCards = myCards
      ? myCards.filter(c => !avgCardNames.has(c.name))
      : []

    return (
      <div>
        <h4 className="text-lg font-semibold text-white mb-3">{title}</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2">Card</th>
              {myDeckMap && <th className="text-right py-2">Mine</th>}
              <th className="text-right py-2">Avg</th>
              <th className="text-right py-2">Range</th>
              <th className="text-right py-2">Play Rate</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, idx) => {
              const myCount = myDeckMap?.get(card.name) ?? null
              const diff = myCount !== null ? myCount - card.avgCount : null
              const hasDiff = diff !== null && Math.abs(diff) >= 0.5

              return (
                <tr key={idx} className={`border-b border-gray-800 ${hasDiff ? (diff! > 0 ? 'bg-green-500/5' : 'bg-red-500/5') : ''}`}>
                  <td className="py-2 text-white">{card.name}</td>
                  {myDeckMap && (
                    <td className="py-2 text-right">
                      {myCount !== null ? (
                        <span className={hasDiff ? (diff! > 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium') : 'text-gray-300'}>
                          {myCount}
                          {hasDiff && (
                            <span className="text-xs ml-1">
                              ({diff! > 0 ? '+' : ''}{Math.round(diff! * 10) / 10})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-red-400/60">-</span>
                      )}
                    </td>
                  )}
                  <td className="py-2 text-right text-poke-yellow">{card.avgCount}</td>
                  <td className="py-2 text-right text-gray-400">{card.minCount}-{card.maxCount}</td>
                  <td className="py-2 text-right text-poke-blue">{card.playRate}%</td>
                </tr>
              )
            })}
            {extraCards.map((card, idx) => (
              <tr key={'extra-' + idx} className="border-b border-gray-800 bg-blue-500/5">
                <td className="py-2 text-white">{card.name}</td>
                {myDeckMap && (
                  <td className="py-2 text-right">
                    <span className="text-blue-400 font-medium">
                      {card.count}
                      <span className="text-xs ml-1">(unique)</span>
                    </span>
                  </td>
                )}
                <td className="py-2 text-right text-gray-500">-</td>
                <td className="py-2 text-right text-gray-500">-</td>
                <td className="py-2 text-right text-gray-500">0%</td>
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

  const placementNum = parseInt(placement || '0')
  const ordinal = placementNum === 1 ? '1st' : placementNum === 2 ? '2nd' : placementNum === 3 ? '3rd' : placementNum + 'th'

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
          Deck List
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
        ) : deckList ? (
          <div>
            {(playerName || placementNum > 0 || tournamentName) && (
              <div className="mb-3 p-3 bg-poke-dark border border-gray-800 rounded-lg">
                <p className="text-gray-400 text-sm">
                  {playerName && (
                    <span className="text-white font-medium">{playerName}</span>
                  )}
                  {placementNum > 0 && (
                    <>
                      {playerName ? ' - ' : ''}
                      <span className="text-poke-yellow">{ordinal} place</span>
                    </>
                  )}
                  {tournamentName && (
                    <span className="text-gray-500"> at {tournamentName}</span>
                  )}
                  {deckListId ? (
                    <>
                      {' · '}
                      <a
                        href={'https://limitlesstcg.com/decks/list/' + deckListId}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-poke-blue hover:underline"
                      >
                        View on Limitless
                      </a>
                    </>
                  ) : labsTpId && labsIdParam && labsDivisionParam ? (
                    <>
                      {' · '}
                      <a
                        href={`https://labs.limitlesstcg.com/${labsIdParam}/${labsDivisionParam}/player/${labsTpId}/decklist`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-poke-blue hover:underline"
                      >
                        View on Limitless Labs
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            )}
            <DeckList deckList={deckList} />
          </div>
        ) : !loading ? (
          <div className="mt-6 p-4 bg-poke-dark border border-gray-800 rounded-lg">
            <p className="text-gray-400 text-sm">
              No deck list available for this archetype. Check{' '}
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
        ) : null}

        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Average Card Counts of Day 2 Decks
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <p className="text-gray-400 text-sm">
              {averagesLoading
                ? 'Loading averages...'
                : deckCount > 0
                ? 'Based on ' + deckCount + ' deck' + (deckCount !== 1 ? 's' : '') + ' that made Day 2 (top 32)'
                : 'No Day 2 deck data available for this archetype'}
            </p>
            {averages && (
              <div className="flex items-center gap-2">
                {myDeck && (
                  <button
                    onClick={() => { setMyDeck(null); setMyDeckText(''); setShowPasteBox(false) }}
                    className="text-sm px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-colors"
                  >
                    Clear My Deck
                  </button>
                )}
                <button
                  onClick={() => setShowPasteBox(!showPasteBox)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-poke-blue/20 text-poke-blue border border-poke-blue/50 hover:bg-poke-blue/30 transition-colors"
                >
                  {myDeck ? 'Update My Deck' : 'Compare My Deck'}
                </button>
              </div>
            )}
          </div>

          {showPasteBox && (
            <div className="mb-6 bg-poke-dark border border-gray-700 rounded-lg p-4">
              <p className="text-gray-300 text-sm mb-3">
                Paste your deck list from PTCG Live (export format):
              </p>
              <textarea
                value={myDeckText}
                onChange={(e) => setMyDeckText(e.target.value)}
                placeholder={`Pokémon: 13\n4 Charcadet PFL 19\n3 Ceruledge ex SSP 36\n...\n\nTrainer: 26\n4 Carmine TWM 145\n...\n\nEnergy: 21\n11 Fighting Energy MEE 6\n...`}
                className="w-full h-48 bg-poke-darker border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-poke-blue resize-none"
              />
              <div className="flex justify-end gap-3 mt-3">
                <button
                  onClick={() => { setShowPasteBox(false); setMyDeckText('') }}
                  className="text-sm px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasteDeck}
                  className="text-sm px-4 py-2 bg-poke-blue hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Compare
                </button>
              </div>
            </div>
          )}

          {myDeck && averages && (
            <div className="mb-6 flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30"></span><span className="text-gray-400">More than average</span></span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30"></span><span className="text-gray-400">Less than average</span></span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30"></span><span className="text-gray-400">Unique to my deck</span></span>
              <span className="flex items-center gap-1.5"><span className="text-red-400/60">-</span><span className="text-gray-400">Not in my deck</span></span>
            </div>
          )}

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
              <AvgTable title="Pokemon" cards={averages.pokemon} myCards={myDeck?.pokemon || null} />
              <AvgTable title="Trainers" cards={averages.trainers} myCards={myDeck?.trainers || null} />
              <AvgTable title="Energy" cards={averages.energy} myCards={myDeck?.energy || null} />
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
