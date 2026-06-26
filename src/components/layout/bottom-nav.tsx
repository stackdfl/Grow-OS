'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Sprout, Cpu, FlaskConical, Bot } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Home' },
  { href: '/grows',      icon: Sprout,          label: 'Grows' },
  { href: '/controller', icon: Cpu,             label: 'Controller' },
  { href: '/recipes',    icon: FlaskConical,    label: 'Recipes' },
  { href: '/coach',      icon: Bot,             label: 'Coach' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 border-t z-50 flex items-center"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '56px' }}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors"
            style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
