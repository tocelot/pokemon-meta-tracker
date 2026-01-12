'use client'

import { useEffect, useState, FormEvent, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { DeckCard } from '@/components/DeckCard'
import { CreatorCard } from '@/components/CreatorCard'
import { TournamentSelector } from '@/components/TournamentSelector'
import { EventCalendar } from '@/components/EventCalendar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useTournamentSelection } from '@/hooks/useTournamentSelection'
import { TournamentResult, Placement } from '@/lib/types'
import { Plus, X, MapPin, Calendar, Clock, ExternalLink, Search } from 'lucide-react'
import creatorsData from '@/data/creators.json'

interface CustomCreator {
  id: string
  name: string
  handle: string
}

interface LocalEvent {
  id: string
  type: 'League Cup' | 'League Challenge'
  name: string
  date: string
  time: string
  city: string
  state: string
  country: string
  shop: string
  address: string
  cost: string
  registrationUrl: string
  hasJuniors: boolean
  hasSeniors: boolean
  hasMasters: boolean
  distance?: number
}

const META_DATA = {
  lastUpdated: new Date().toISOString(),
  currentSet: {
    name: 'Phantasmal Flames',
    releaseDate: '2025-11-14',
    code: 'PFL',
  },
}

interface GroupedResult extends TournamentResult {
  placements: Placement[]
}

function HomePageContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const {
    tournaments,
    selectedIds,
    isLoading: tournamentsLoading,
    lastFetched,
    toggleTournament,
    selectAll,
    clearAll,
    selectPostSet,
    refreshTournaments,
  } = useTournamentSelection(META_DATA.currentSet.releaseDate)

  const [results, setResults] = useState<TournamentResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [customCreators, setCustomCreators] = useState<CustomCreator[]>([])
  const [newHandle, setNewHandle] = useState('')
  const [activeTab, setActiveTab] = useState(tabParam || 'local')

  // Local events state
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [citySearch, setCitySearch] = useState('94002')
  const [searchRadius, setSearchRadius] = useState('50')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calendarDateRange, setCalendarDateRange] = useState<{ start: string; end: string } | null>(null)

  // Memoized callback for calendar date range changes
  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setCalendarDateRange({ start, end })
  }, [])

  // Load custom creators from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('customCreators')
    if (saved) {
      setCustomCreators(JSON.parse(saved))
    }
    // Load saved city
    const savedCity = localStorage.getItem('localEventsCity')
    if (savedCity) {
      setCitySearch(savedCity)
    }
  }, [])

  // Save custom creators to localStorage when they change
  useEffect(() => {
    localStorage.setItem('customCreators', JSON.stringify(customCreators))
  }, [customCreators])

  const addCustomCreator = (e: FormEvent) => {
    e.preventDefault()
    const handle = newHandle.trim().replace('@', '')
    if (!handle) return

    // Check if already exists
    const existsInDefault = creatorsData.creators.some(
      c => c.channelUrl.split('@')[1]?.toLowerCase() === handle.toLowerCase()
    )
    const existsInCustom = customCreators.some(
      c => c.handle.toLowerCase() === handle.toLowerCase()
    )

    if (existsInDefault || existsInCustom) {
      setNewHandle('')
      return
    }

    setCustomCreators(prev => [
      ...prev,
      { id: `custom-${handle}`, name: handle, handle }
    ])
    setNewHandle('')
  }

  const removeCustomCreator = (id: string) => {
    setCustomCreators(prev => prev.filter(c => c.id !== id))
  }

  // Fetch local events
  const fetchLocalEvents = async (city: string) => {
    setEventsLoading(true)
    try {
      // First geocode the city
      const geoResponse = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`)
      const geoData = await geoResponse.json()

      let latitude = ''
      let longitude = ''
      let state = ''

      if (geoData.latitude && geoData.longitude) {
        latitude = geoData.latitude.toString()
        longitude = geoData.longitude.toString()
        state = geoData.state || ''
      }

      // Fetch events
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          radius: searchRadius,
          state,
        }),
      })

      const data = await response.json()
      setLocalEvents(data.events || [])

      // Save city to localStorage
      localStorage.setItem('localEventsCity', city)
    } catch (error) {
      console.error('Error fetching local events:', error)
      setLocalEvents([])
    } finally {
      setEventsLoading(false)
    }
  }

  const handleCitySearch = (e: FormEvent) => {
    e.preventDefault()
    if (citySearch.trim()) {
      fetchLocalEvents(citySearch.trim())
    }
  }

  // Fetch local events on initial load
  useEffect(() => {
    if (citySearch) {
      fetchLocalEvents(citySearch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function fetchResults() {
      if (selectedIds.size === 0) {
        setResults([])
        return
      }

      setResultsLoading(true)
      try {
        const allResults: TournamentResult[] = []
        
        for (const tournamentId of selectedIds) {
          const response = await fetch('/api/limitless/tournaments/' + tournamentId + '/results')
          if (response.ok) {
            const tournamentResults = await response.json()
            const tournament = tournaments.find(t => t.id === tournamentId)
            if (tournament) {
              tournamentResults.forEach((r: TournamentResult & { deckListId?: string }) => {
                r.tournament = {
                  id: tournament.id,
                  name: tournament.name,
                  location: tournament.location,
                  date: tournament.date,
                  playerCount: tournament.playerCount,
                  format: tournament.format,
                }
              })
            }
            allResults.push(...tournamentResults)
          }
        }
        
        allResults.sort((a, b) => {
          if (a.placement !== b.placement) return a.placement - b.placement
          return new Date(b.tournament.date).getTime() - new Date(a.tournament.date).getTime()
        })
        
        setResults(allResults)
      } catch (error) {
        console.error('Error fetching results:', error)
      } finally {
        setResultsLoading(false)
      }
    }

    fetchResults()
  }, [selectedIds, tournaments])

  const groupedResults = results.reduce<GroupedResult[]>((acc, result) => {
    const existing = acc.find(r => r.deckId === result.deckId)
    if (existing) {
      existing.placements.push({
        placement: result.placement,
        playerName: result.playerName,
        deckListId: result.deckListId,
        tournament: {
          id: result.tournament.id,
          name: result.tournament.name,
          date: result.tournament.date,
        },
      })
    } else {
      acc.push({
        ...result,
        placements: [{
          placement: result.placement,
          playerName: result.playerName,
          deckListId: result.deckListId,
          tournament: {
            id: result.tournament.id,
            name: result.tournament.name,
            date: result.tournament.date,
          },
        }],
      })
    }
    return acc
  }, [])

  return (
    <div className="min-h-screen bg-poke-darker">
      <Header 
        currentSet={META_DATA.currentSet}
        lastUpdated={META_DATA.lastUpdated}
      />
      
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="local">
              Locals
            </TabsTrigger>
            <TabsTrigger value="tournament">
              Tournament Results
            </TabsTrigger>
            <TabsTrigger value="creator">
              Top Creators
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tournament">
            <TournamentSelector
              tournaments={tournaments}
              selectedIds={selectedIds}
              currentSetName={META_DATA.currentSet.name}
              currentSetReleaseDate={META_DATA.currentSet.releaseDate}
              isLoading={tournamentsLoading}
              lastFetched={lastFetched}
              onToggle={toggleTournament}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              onSelectPostSet={selectPostSet}
              onRefresh={refreshTournaments}
            />

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Tournament Results
              </h2>
              <p className="text-gray-400 text-sm">
                Showing results from {selectedIds.size} selected tournament{selectedIds.size !== 1 ? 's' : ''}
              </p>
            </div>

            {resultsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-poke-dark border border-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="h-5 bg-gray-700 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : groupedResults.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedResults.map((result) => (
                  <DeckCard
                    key={result.deckId}
                    id={result.deckId}
                    name={result.archetype.name}
                    tier={result.archetype.tier}
                    placements={result.placements}
                    deckListId={result.placements.find(p => p.deckListId)?.deckListId}
                    source="tournament"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                {selectedIds.size === 0 
                  ? 'Select at least one tournament to see results'
                  : 'No results found for selected tournaments'}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="creator">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Top Creators
              </h2>
              <p className="text-gray-400 text-sm">
                Latest videos from competitive Pokemon TCG content creators
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {creatorsData.creators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  name={creator.name}
                  channelUrl={creator.channelUrl}
                  handle={creator.channelUrl.split('@')[1]}
                />
              ))}
              {customCreators.map((creator) => (
                <div key={creator.id} className="relative">
                  <button
                    onClick={() => removeCustomCreator(creator.id)}
                    className="absolute -top-2 -right-2 z-10 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                    title="Remove creator"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <CreatorCard
                    name={creator.name}
                    channelUrl={`https://youtube.com/@${creator.handle}`}
                    handle={creator.handle}
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 border-t border-gray-800 pt-6">
              <h3 className="text-lg font-medium text-white mb-3">Add a Creator</h3>
              <form onSubmit={addCustomCreator} className="flex gap-3">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                  <input
                    type="text"
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder="YouTubeHandle"
                    className="w-full bg-poke-dark border border-gray-700 rounded-lg px-3 py-2 pl-8 text-white placeholder-gray-500 focus:outline-none focus:border-poke-blue"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-poke-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </form>
              <p className="text-gray-500 text-sm mt-2">
                Enter a YouTube handle to track their latest Pokemon TCG videos
              </p>
            </div>
          </TabsContent>

          <TabsContent value="local">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-2">
                Local Tournaments
              </h2>
              <p className="text-gray-400 text-sm">
                Find upcoming League Challenges and Cups near you. Events are shown as they&apos;re registered with Pokemon.
              </p>
            </div>

            {/* Location Search */}
            <div className="bg-poke-dark border border-gray-800 rounded-lg p-4 mb-6">
              <form onSubmit={(e) => { handleCitySearch(e); setSelectedDate(null); }} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-3">
                  <label className="text-gray-400 text-sm whitespace-nowrap">Zip Code</label>
                  <div className="flex-1 relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                      type="text"
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder="e.g. 94002"
                      className="w-full bg-poke-darker border border-gray-700 rounded-lg px-3 py-2 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-poke-blue"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <select
                    value={searchRadius}
                    onChange={(e) => setSearchRadius(e.target.value)}
                    className="flex-1 sm:flex-none bg-poke-darker border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-poke-blue"
                  >
                    <option value="25">25 mi</option>
                    <option value="50">50 mi</option>
                    <option value="75">75 mi</option>
                    <option value="100">100 mi</option>
                  </select>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none bg-poke-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Search
                  </button>
                </div>
              </form>
            </div>

            {/* Calendar */}
            {!eventsLoading && localEvents.length > 0 && (
              <div className="mb-6">
                <EventCalendar
                  events={localEvents}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onDateRangeChange={handleDateRangeChange}
                />
              </div>
            )}

            {/* Events List */}
            {selectedDate && (
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">
                  Events on {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Show all events
                </button>
              </div>
            )}
            {eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-poke-dark border border-gray-800 rounded-lg p-4 animate-pulse">
                    <div className="h-5 bg-gray-700 rounded w-1/3 mb-3"></div>
                    <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : localEvents.length > 0 ? (
              <div className="space-y-4">
                {localEvents
                  .filter(event => {
                    // If a specific date is selected, show only that date
                    if (selectedDate) {
                      return event.date === selectedDate
                    }
                    // Otherwise, filter by calendar's visible date range
                    if (calendarDateRange) {
                      return event.date >= calendarDateRange.start && event.date <= calendarDateRange.end
                    }
                    return true
                  })
                  .sort((a, b) => {
                    // When a date is selected, sort Cups before Challenges, then by distance
                    if (selectedDate) {
                      // League Cups come first
                      if (a.type !== b.type) {
                        return a.type === 'League Cup' ? -1 : 1
                      }
                      // Then sort by distance
                      if (a.distance !== undefined && b.distance !== undefined) {
                        return a.distance - b.distance
                      }
                    }
                    return 0
                  })
                  .map((event) => {
                  // Format date nicely
                  const eventDate = new Date(event.date + 'T00:00:00')
                  const formattedDate = eventDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })

                  // Format time to 12-hour format
                  let formattedTime = ''
                  if (event.time) {
                    const [hours, minutes] = event.time.split(':')
                    const hour = parseInt(hours)
                    const ampm = hour >= 12 ? 'PM' : 'AM'
                    const hour12 = hour % 12 || 12
                    formattedTime = `${hour12}:${minutes} ${ampm}`
                  }

                  const isLeagueCup = event.type === 'League Cup'

                  return (
                    <div
                      key={event.id}
                      className={`bg-poke-dark border rounded-lg overflow-hidden hover:border-gray-600 transition-colors ${
                        isLeagueCup ? 'border-orange-500/50' : 'border-gray-800'
                      }`}
                    >
                      {/* Header */}
                      <div className={`px-4 py-2 ${
                        isLeagueCup
                          ? 'bg-orange-500/20 border-b border-orange-500/30'
                          : 'bg-poke-blue/20 border-b border-poke-blue/30'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold ${
                            isLeagueCup ? 'text-orange-400' : 'text-poke-blue'
                          }`}>
                            {event.type}
                          </span>
                          {event.distance !== undefined && (
                            <span className="text-sm text-gray-400">
                              {Math.round(event.distance)} miles away
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-white font-medium text-lg mb-1">{event.name || event.shop}</h3>
                            <p className="text-gray-400 text-sm mb-3">{event.shop}</p>

                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-white">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span>{formattedDate}</span>
                                {formattedTime && (
                                  <>
                                    <Clock className="w-4 h-4 text-gray-500 ml-2" />
                                    <span>{formattedTime}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-start gap-2 text-gray-400">
                                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <span>{event.address || `${event.city}, ${event.state}`}</span>
                              </div>
                            </div>
                          </div>

                          {event.registrationUrl && (
                            <a
                              href={event.registrationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex-shrink-0 text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                                isLeagueCup
                                  ? 'bg-orange-500 hover:bg-orange-600'
                                  : 'bg-poke-blue hover:bg-blue-600'
                              }`}
                            >
                              Register <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming League Cups or Challenges found near {citySearch}</p>
                <p className="text-sm mt-1">Try increasing the search radius or checking a different location</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-gray-800 py-6 mt-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          Made with love by a pokedad - DM any bug reports to{' '}
          <a
            href="https://x.com/Tocelot/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-poke-blue hover:underline"
          >
            @tocelot
          </a>
        </div>
      </footer>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-poke-darker flex items-center justify-center text-gray-400">Loading...</div>}>
      <HomePageContent />
    </Suspense>
  )
}
