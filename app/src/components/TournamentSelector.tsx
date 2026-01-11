'use client'

import { useState } from 'react'
import { LimitlessTournament } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Check, ExternalLink, RefreshCw } from 'lucide-react'

interface TournamentSelectorProps {
  tournaments: LimitlessTournament[]
  selectedIds: Set<string>
  currentSetName: string
  currentSetReleaseDate: string
  isLoading: boolean
  lastFetched: Date | null
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  onSelectPostSet: (date: string) => void
  onRefresh: () => Promise<void>
}

export function TournamentSelector({
  tournaments,
  selectedIds,
  currentSetName,
  currentSetReleaseDate,
  isLoading,
  lastFetched,
  onToggle,
  onSelectAll,
  onClearAll,
  onSelectPostSet,
  onRefresh,
}: TournamentSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const selectedCount = selectedIds.size
  const totalCount = tournaments.length

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const isPostSet = (tournamentDate: string) => {
    return new Date(tournamentDate) >= new Date(currentSetReleaseDate)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-poke-dark border border-gray-800 rounded-lg p-4 mb-6">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-gray-700 rounded"></div>
          <div className="h-4 w-48 bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg mb-6 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
          <span className="font-medium text-white">
            Tournament Selection
          </span>
          <span className="text-sm text-gray-400">
            ({selectedCount} of {totalCount} selected)
          </span>
        </div>
        <div className="text-xs text-poke-yellow">
          {isExpanded ? 'Click to collapse' : 'Click to edit'}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-800">
          <div className="flex flex-wrap gap-2 p-4 border-b border-gray-800 bg-gray-900/50">
            <button
              onClick={() => onSelectPostSet(currentSetReleaseDate)}
              className="px-3 py-1.5 text-sm bg-poke-yellow/20 text-poke-yellow border border-poke-yellow/50 rounded hover:bg-poke-yellow/30 transition-colors"
            >
              Select Post-{currentSetName}
            </button>
            <button
              onClick={onSelectAll}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 text-sm bg-poke-blue/20 text-poke-blue border border-poke-blue/50 rounded hover:bg-poke-blue/30 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Refreshing...' : 'Refresh List'}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {tournaments.map((tournament) => {
              const isSelected = selectedIds.has(tournament.id)
              const postSet = isPostSet(tournament.date)
              
              return (
                <div
                  key={tournament.id}
                  className={cn(
                    'flex items-center gap-3 p-3 border-b border-gray-800/50 cursor-pointer transition-colors',
                    isSelected ? 'bg-poke-yellow/10' : 'hover:bg-gray-800/50',
                    !postSet && 'opacity-60'
                  )}
                  onClick={() => onToggle(tournament.id)}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      isSelected
                        ? 'bg-poke-yellow border-poke-yellow'
                        : 'border-gray-600'
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-black" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-medium truncate',
                        isSelected ? 'text-white' : 'text-gray-300'
                      )}>
                        {tournament.name}
                      </span>
                      {postSet && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                          Post-{currentSetName}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>{formatDate(tournament.date)}</span>
                      <span>-</span>
                      <span>{tournament.location}</span>
                      <span>-</span>
                      <span>{tournament.playerCount.toLocaleString()} players</span>
                    </div>
                  </div>

                  <a
                    href={tournament.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-gray-500 hover:text-poke-blue transition-colors"
                    title="View on Limitless"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-gray-900/50 text-xs text-gray-500 border-t border-gray-800 flex justify-between items-center">
            <span>
              Data sourced from Limitless TCG
            </span>
            {lastFetched && (
              <span>
                Last updated: {formatTime(lastFetched)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
