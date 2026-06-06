'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Leaf, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/grows': 'Grows',
  '/journal': 'Journal',
  '/calendar': 'Calendar',
  '/recipes': 'Recipes',
  '/equipment': 'Equipment',
  '/coach': 'AI Coach',
  '/profile': 'Profile',
}

export function TopBar() {
  const pathname = usePathname()

  const base = '/' + (pathname.split('/')[1] ?? '')
  const title = PAGE_TITLES[base] ?? 'WeedSmith'

  return (
    <header
      className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 border-b shrink-0"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
          <Leaf className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</span>
      </div>

      {base === '/grows' && (
        <Link href="/grows/new">
          <Button size="sm" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4" />
            New Grow
          </Button>
        </Link>
      )}
    </header>
  )
}
