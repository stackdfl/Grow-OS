'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Leaf, LayoutDashboard, Sprout, BookOpen,
  FlaskConical, CalendarDays, Zap, Bot, Settings, LogOut, GitBranch, Dna, Calculator, Cpu
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/grows',       icon: Sprout,          label: 'Grows' },
  { href: '/controller',  icon: Cpu,             label: 'Controller' },
  { href: '/journal',     icon: BookOpen,        label: 'Journal' },
  { href: '/calendar',    icon: CalendarDays,    label: 'Calendar' },
  { href: '/recipes',     icon: FlaskConical,    label: 'Recipes' },
  { href: '/strains',     icon: Dna,             label: 'Strains' },
  { href: '/pipeline',    icon: GitBranch,       label: 'Pipeline' },
  { href: '/tools',       icon: Calculator,      label: 'Tools' },
  { href: '/equipment',   icon: Zap,             label: 'Equipment' },
  { href: '/coach',       icon: Bot,             label: 'AI Coach' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'var(--accent-muted)' }}>
          <Leaf className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Grow OS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? 'var(--accent-muted)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t space-y-0.5" style={{ borderColor: 'var(--border)' }}>
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
