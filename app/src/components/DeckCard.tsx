import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'
import { Placement } from '@/lib/types'

interface DeckCardProps {
  id: string
  name: string
  tier?: number
  placements?: Placement[]
  deckListId?: string | null
  creatorName?: string
  videoUrl?: string
  source: 'tournament' | 'creator'
}

export function DeckCard({
  id,
  name,
  tier,
  placements,
  deckListId,
  creatorName,
  videoUrl,
  source
}: DeckCardProps) {
  const tierColors: Record<number, string> = {
    1: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    2: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    3: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  }

  const getPlacementEmoji = (p: number) => {
    if (p === 1) return '1st'
    if (p === 2) return '2nd'
    if (p === 3) return '3rd'
    return p + 'th'
  }

  // Build the href with deckListId as a query param
  const href = deckListId ? '/deck/' + id + '?list=' + deckListId : '/deck/' + id

  return (
    <Link href={href}>
      <div className="bg-poke-dark border border-gray-800 rounded-lg p-4 hover:border-poke-yellow/50 transition-all cursor-pointer group h-full">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white group-hover:text-poke-yellow transition-colors">
            {name}
          </h3>
          {tier && (
            <span className={cn(
              'text-xs px-2 py-1 rounded border flex-shrink-0 ml-2',
              tierColors[tier] || tierColors[3]
            )}>
              Tier {tier}
            </span>
          )}
        </div>
        
        {source === 'tournament' && placements && placements.length > 0 && (
          <div className="text-sm text-gray-400 space-y-2">
            {placements.slice(0, 3).map((p, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span>
                  <span className="text-poke-yellow font-medium">
                    {getPlacementEmoji(p.placement)}
                  </span>
                  {' '}{p.playerName}
                </span>
                <span className="text-xs text-gray-500">
                  {p.tournament.name.replace(' Regional Championship', '').replace(' International Championship', ' IC')}
                </span>
              </div>
            ))}
            {placements.length > 3 && (
              <p className="text-xs text-gray-500">
                +{placements.length - 3} more placement{placements.length - 3 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
        
        {source === 'creator' && creatorName && (
          <div className="text-sm text-gray-400">
            <p className="flex items-center gap-1">
              Recommended by{' '}
              <span className="text-poke-blue">{creatorName}</span>
              {videoUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    window.open(videoUrl, '_blank', 'noopener,noreferrer')
                  }}
                  className="text-gray-500 hover:text-poke-blue"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </p>
          </div>
        )}
        
        <div className="mt-3 text-xs text-gray-500">
          Click to view deck list
        </div>
      </div>
    </Link>
  )
}
