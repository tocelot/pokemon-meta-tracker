'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ExternalLink, Trophy } from 'lucide-react'

interface VideoInfo {
  videoId: string
  title: string
  url: string
  thumbnail: string
  publishedText: string
  description: string
  viewCount: string
}

interface TierListInfo {
  video: VideoInfo
  decks: string[]
  loading?: boolean
}

interface CreatorCardProps {
  name: string
  channelUrl: string
  handle: string
}

// Common Pokemon TCG deck archetypes to look for
const DECK_POKEMON = [
  'charizard', 'dragapult', 'gardevoir', 'gholdengo', 'regidrago',
  'miraidon', 'roaring moon', 'iron hands', 'iron thorns', 'iron crown',
  'lugia', 'arceus', 'giratina', 'mew', 'snorlax', 'pidgeot',
  'dusknoir', 'noctowl', 'lunatone', 'jellicent', 'chien-pao',
  'palkia', 'dialga', 'raging bolt', 'terapagos', 'ceruledge',
  'hydreigon', 'banette', 'klawf', 'cornerstone mask', 'ogerpon',
  'comfey', 'lost zone', 'lost box', 'control', 'stall'
]

// Patterns to identify tier list videos
const TIER_LIST_PATTERNS = [
  /tier\s*list/i,
  /top\s*(\d+\s*)?(meta\s*)?decks/i,
  /best\s*(and\s*worst\s*)?decks/i,
  /meta\s*report/i,
  /meta\s*snapshot/i,
  /meta\s*update/i,
  /top\s*picks?\s*(for\s*)?(regional|tournament|worlds|naic|euic|laic|toronto|charlotte|orlando|liverpool|melbourne|sao\s*paulo|vancouver)/i,
  /ranking.*decks/i,
  /decks?\s*to\s*(play|beat)/i,
  /what('s|\s*is)?\s*(the\s*)?play/i,
  /what\s*to\s*play/i,
  /regional\s*(prep|preparation|preview)/i,
]

// Extract decks from text, returning them in order of first appearance
function extractDecksFromText(text: string): string[] {
  const lowerText = text.toLowerCase()
  const foundDecks: string[] = []
  const seen = new Set<string>()

  // Find all deck mentions with their positions
  const mentions: { deck: string; index: number }[] = []

  for (const pokemon of DECK_POKEMON) {
    const lowerPokemon = pokemon.toLowerCase()
    let searchIndex = 0
    while (true) {
      const index = lowerText.indexOf(lowerPokemon, searchIndex)
      if (index === -1) break
      if (!seen.has(lowerPokemon)) {
        seen.add(lowerPokemon)
        const formatted = pokemon.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
        mentions.push({ deck: formatted, index })
      }
      searchIndex = index + 1
    }
  }

  // Sort by position in text (first mentioned = higher ranked)
  mentions.sort((a, b) => a.index - b.index)

  for (const mention of mentions) {
    foundDecks.push(mention.deck)
  }

  return foundDecks
}

export function CreatorCard({ name, channelUrl, handle }: CreatorCardProps) {
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tierListInfo, setTierListInfo] = useState<TierListInfo | null>(null)

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await fetch(`/api/youtube/channel/${handle}`)
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()
        setVideos(data.videos || [])
      } catch {
        setError('Could not load videos')
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [handle])

  // Find tier list video and try to fetch transcript for deck extraction
  useEffect(() => {
    async function findTierListAndFetchTranscript() {
      const tierListVideo = videos.find(video =>
        TIER_LIST_PATTERNS.some(pattern => pattern.test(video.title))
      )

      if (!tierListVideo) {
        setTierListInfo(null)
        return
      }

      // First try to extract decks from title/description
      const text = `${tierListVideo.title} ${tierListVideo.description}`
      let decks = extractDecksFromText(text).slice(0, 3)

      // Initially set with what we have from title/description
      setTierListInfo({ video: tierListVideo, decks, loading: decks.length === 0 })

      // Try to fetch transcript for better deck extraction
      if (decks.length === 0) {
        try {
          const response = await fetch(`/api/youtube/transcript/${tierListVideo.videoId}`)
          const data = await response.json()

          if (data.transcript) {
            // Extract decks from transcript (order = rank)
            decks = extractDecksFromText(data.transcript).slice(0, 3)
          }

          setTierListInfo({ video: tierListVideo, decks, loading: false })
        } catch {
          // On error, just show the video without decks
          setTierListInfo({ video: tierListVideo, decks: [], loading: false })
        }
      }
    }

    if (videos.length > 0) {
      findTierListAndFetchTranscript()
    }
  }, [videos])

  // Extract deck archetype from video title/description
  const extractArchetype = (title: string, description: string): string | null => {
    const text = `${title} ${description}`.toLowerCase()

    for (const pokemon of DECK_POKEMON) {
      if (text.includes(pokemon.toLowerCase())) {
        return pokemon.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
      }
    }

    return null
  }

  // Get the 5 most recent videos
  const recentVideos = videos.slice(0, 5)

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">{name}</h3>
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-poke-blue hover:text-blue-400 flex items-center gap-1 text-sm"
        >
          Channel <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-gray-800/50 rounded-lg p-3">
            <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
            <div className="flex gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-6 bg-gray-700 rounded w-20"></div>
              ))}
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-24 h-14 bg-gray-700 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-gray-500 text-sm">{error}</p>
      ) : videos.length === 0 ? (
        <p className="text-gray-500 text-sm">No recent videos found</p>
      ) : (
        <div className="space-y-4">
          {/* Tier List Section */}
          {tierListInfo ? (
            <a
              href={tierListInfo.video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gradient-to-r from-poke-yellow/10 to-transparent border border-poke-yellow/30 rounded-lg p-3 hover:border-poke-yellow/50 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-poke-yellow" />
                <span className="text-sm font-medium text-poke-yellow">Latest Tier List</span>
                <span className="text-xs text-gray-500 ml-auto">{tierListInfo.video.publishedText}</span>
              </div>
              {tierListInfo.loading ? (
                <div className="flex gap-2 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-6 bg-gray-700 rounded w-24"></div>
                  ))}
                </div>
              ) : tierListInfo.decks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tierListInfo.decks.map((deck, index) => (
                    <span
                      key={deck}
                      className="text-xs px-2 py-1 rounded bg-poke-darker text-white flex items-center gap-1"
                    >
                      <span className="text-poke-yellow font-medium">{index + 1}.</span> {deck}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Click to watch tier rankings →</p>
              )}
              <p className="text-xs text-gray-400 mt-2 line-clamp-2 group-hover:text-gray-300 transition-colors">
                {tierListInfo.video.title}
              </p>
            </a>
          ) : (
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-500">No recent tier list found</span>
              </div>
            </div>
          )}

          {/* Recent Videos Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Recent Videos</h4>
            {recentVideos.map((video) => {
              const archetype = extractArchetype(video.title, video.description)
              return (
                <a
                  key={video.videoId}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 group hover:bg-gray-800/50 rounded p-2 -mx-2 transition-colors"
                >
                  {video.thumbnail && (
                    <Image
                      src={video.thumbnail}
                      alt=""
                      width={96}
                      height={56}
                      className="w-24 h-14 object-cover rounded flex-shrink-0"
                      unoptimized
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm text-white group-hover:text-poke-yellow line-clamp-2 transition-colors">
                      {video.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {archetype && (
                        <span className="text-xs bg-poke-blue/20 text-poke-blue px-2 py-0.5 rounded">
                          {archetype}
                        </span>
                      )}
                      {video.viewCount && (
                        <span className="text-xs text-gray-500">{video.viewCount}</span>
                      )}
                      <span className="text-xs text-gray-500">{video.publishedText}</span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
