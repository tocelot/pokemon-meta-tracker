'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { DeckList as DeckListType, CardEntry } from '@/lib/types'

interface DeckListProps {
  deckList: DeckListType
}

function CardSection({ title, cards }: { title: string; cards: CardEntry[] }) {
  const totalCount = cards.reduce((sum, card) => sum + card.count, 0)
  
  if (cards.length === 0) {
    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {title} (0)
        </h4>
        <p className="text-gray-500 text-sm italic">No cards listed</p>
      </div>
    )
  }
  
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
        {title} ({totalCount})
      </h4>
      <div className="space-y-1">
        {cards.map((card, index) => (
          <div 
            key={card.name + '-' + card.setCode + '-' + index}
            className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-800/50"
          >
            <span className="text-white">
              <span className="text-poke-yellow font-mono mr-2">{card.count}x</span>
              {card.name}
            </span>
            <span className="text-gray-500 text-xs">
              {card.setCode} {card.setNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatForPTCGLive(deckList: DeckListType): string {
  const formatSection = (title: string, cards: CardEntry[]) => {
    const total = cards.reduce((sum, c) => sum + c.count, 0)
    if (total === 0) return ''
    const lines = cards.map(c => `${c.count} ${c.name} ${c.setCode} ${c.setNumber}`)
    return `${title}: ${total}\n${lines.join('\n')}`
  }

  return [
    formatSection('Pokémon', deckList.pokemon),
    formatSection('Trainer', deckList.trainers),
    formatSection('Energy', deckList.energy),
  ].filter(Boolean).join('\n\n')
}

export function DeckList({ deckList }: DeckListProps) {
  const [copied, setCopied] = useState(false)

  const totalCards =
    deckList.pokemon.reduce((sum, c) => sum + c.count, 0) +
    deckList.trainers.reduce((sum, c) => sum + c.count, 0) +
    deckList.energy.reduce((sum, c) => sum + c.count, 0)

  const handleCopy = async () => {
    const text = formatForPTCGLive(deckList)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Deck List</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{totalCards} cards</span>
          {totalCards > 0 && (
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy for PTCG Live'}
            </button>
          )}
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <CardSection title="Pokemon" cards={deckList.pokemon} />
        <CardSection title="Trainers" cards={deckList.trainers} />
        <CardSection title="Energy" cards={deckList.energy} />
      </div>
    </div>
  )
}
