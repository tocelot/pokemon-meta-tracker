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

export function DeckList({ deckList }: DeckListProps) {
  const totalCards = 
    deckList.pokemon.reduce((sum, c) => sum + c.count, 0) +
    deckList.trainers.reduce((sum, c) => sum + c.count, 0) +
    deckList.energy.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="bg-poke-dark border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Deck List</h3>
        <span className="text-sm text-gray-400">{totalCards} cards</span>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        <CardSection title="Pokemon" cards={deckList.pokemon} />
        <CardSection title="Trainers" cards={deckList.trainers} />
        <CardSection title="Energy" cards={deckList.energy} />
      </div>
    </div>
  )
}
