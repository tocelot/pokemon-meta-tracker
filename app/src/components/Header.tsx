import Link from 'next/link'

interface HeaderProps {
  currentSet: {
    name: string
    releaseDate: string
  }
  lastUpdated: string
}

export function Header({ currentSet, lastUpdated }: HeaderProps) {
  return (
    <header className="bg-poke-darker border-b border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-poke-yellow via-poke-red to-poke-blue bg-clip-text text-transparent">
              Pokemon TCG Meta Tracker
            </Link>
            <p className="text-sm text-gray-400">
              Current Set: {currentSet.name} (Released {currentSet.releaseDate})
            </p>
          </div>
          <div className="text-sm text-gray-500 text-right">
            <div>Last Updated: {new Date(lastUpdated).toLocaleDateString()}</div>
            <a
              href="https://x.com/Tocelot/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-poke-blue hover:underline"
            >
              @tocelot
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
