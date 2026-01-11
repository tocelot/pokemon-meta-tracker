'use client'

import { useState, useEffect, useCallback } from 'react'
import { LimitlessTournament } from '@/lib/types'

const STORAGE_KEY = 'pokemon-tcg-meta-selected-tournaments'

interface UseTournamentSelectionReturn {
  tournaments: LimitlessTournament[]
  selectedIds: Set<string>
  isLoading: boolean
  error: string | null
  lastFetched: Date | null
  toggleTournament: (id: string) => void
  selectAll: () => void
  clearAll: () => void
  selectPostSet: (setReleaseDate: string) => void
  isSelected: (id: string) => boolean
  refreshTournaments: () => Promise<void>
}

export function useTournamentSelection(
  currentSetReleaseDate: string
): UseTournamentSelectionReturn {
  const [tournaments, setTournaments] = useState<LimitlessTournament[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchTournaments = useCallback(async (bypassCache = false) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const timestamp = new Date().getTime()
      const url = bypassCache 
        ? '/api/limitless/tournaments?refresh=' + timestamp
        : '/api/limitless/tournaments'
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch tournaments')
      const data = await response.json()
      
      const sorted = data.sort((a: LimitlessTournament, b: LimitlessTournament) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      
      setTournaments(sorted)
      setLastFetched(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTournaments()
  }, [fetchTournaments])

  const selectPostSetInternal = useCallback((releaseDate: string) => {
    const postSetIds = tournaments
      .filter(t => new Date(t.date) >= new Date(releaseDate))
      .filter(t => ['regional', 'international', 'special', 'worlds'].includes(t.type))
      .map(t => t.id)
    setSelectedIds(new Set(postSetIds))
  }, [tournaments])

  useEffect(() => {
    if (tournaments.length === 0 || initialized) return
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setSelectedIds(new Set(parsed.selectedIds))
        } catch {
          selectPostSetInternal(currentSetReleaseDate)
        }
      } else {
        selectPostSetInternal(currentSetReleaseDate)
      }
    }
    
    setInitialized(true)
  }, [tournaments, currentSetReleaseDate, initialized, selectPostSetInternal])

  useEffect(() => {
    if (!initialized || typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedIds: Array.from(selectedIds),
      lastModified: new Date().toISOString(),
    }))
  }, [selectedIds, initialized])

  const toggleTournament = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(tournaments.map(t => t.id)))
  }, [tournaments])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectPostSet = useCallback((releaseDate: string) => {
    selectPostSetInternal(releaseDate)
  }, [selectPostSetInternal])

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id)
  }, [selectedIds])

  const refreshTournaments = useCallback(async () => {
    await fetchTournaments(true)
  }, [fetchTournaments])

  return {
    tournaments,
    selectedIds,
    isLoading,
    error,
    lastFetched,
    toggleTournament,
    selectAll,
    clearAll,
    selectPostSet,
    isSelected,
    refreshTournaments,
  }
}
