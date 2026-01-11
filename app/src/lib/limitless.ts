import { LimitlessTournament, TournamentResult } from './types'

/**
 * Fetches the list of tournaments from Limitless TCG
 */
export async function fetchTournamentList(): Promise<LimitlessTournament[]> {
  try {
    const response = await fetch('/api/limitless/tournaments')
    if (!response.ok) throw new Error('Failed to fetch tournaments')
    return response.json()
  } catch (error) {
    console.error('Error fetching tournament list:', error)
    return []
  }
}

/**
 * Fetches deck results for a specific tournament
 */
export async function fetchTournamentResults(tournamentId: string): Promise<TournamentResult[]> {
  try {
    const response = await fetch(`/api/limitless/tournaments/${tournamentId}/results`)
    if (!response.ok) throw new Error('Failed to fetch tournament results')
    return response.json()
  } catch (error) {
    console.error('Error fetching tournament results:', error)
    return []
  }
}

/**
 * Determines if a tournament occurred after a given date
 */
export function isAfterDate(tournamentDate: string, compareDate: string): boolean {
  return new Date(tournamentDate) >= new Date(compareDate)
}

/**
 * Filters tournaments to only those after the current set release
 */
export function filterPostSetTournaments(
  tournaments: LimitlessTournament[],
  setReleaseDate: string
): LimitlessTournament[] {
  return tournaments.filter(t => isAfterDate(t.date, setReleaseDate))
}

/**
 * Filters to only major tournament types (Regional, IC, Special, Worlds)
 */
export function filterMajorTournaments(tournaments: LimitlessTournament[]): LimitlessTournament[] {
  const majorTypes = ['regional', 'international', 'special', 'worlds']
  return tournaments.filter(t => majorTypes.includes(t.type))
}
