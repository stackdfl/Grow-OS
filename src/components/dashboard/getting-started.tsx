'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Check, Cpu, Sprout, ClipboardList, X, Rocket } from 'lucide-react'

interface StepDef {
  key: string
  label: string
  desc: string
  icon: typeof Cpu
  href: string
  done: boolean
  locked?: boolean
}

export function GettingStarted() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(true)
  const [steps, setSteps] = useState<StepDef[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [profileRes, equipRes, growsRes, journalRes] = await Promise.all([
      supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single(),
      supabase.from('equipment_profiles').select('id').eq('user_id', user.id).limit(1),
      supabase.from('grows').select('id').eq('user_id', user.id).order('created_at').limit(1),
      supabase.from('journal_entries').select('id').eq('user_id', user.id).limit(1),
    ])

    const dismissed = (profileRes.data as { onboarding_completed?: boolean } | null)?.onboarding_completed ?? false
    const hasTent = (equipRes.data ?? []).length > 0
    const firstGrowId = (growsRes.data as { id: string }[] | null)?.[0]?.id ?? null
    const hasGrow = !!firstGrowId
    const hasLog = (journalRes.data ?? []).length > 0

    const built: StepDef[] = [
      { key: 'tent', label: 'Set up a tent', desc: 'Add your grow space & light', icon: Cpu, href: '/equipment', done: hasTent },
      { key: 'grow', label: 'Add your first grow', desc: 'Strain, stage & key dates', icon: Sprout, href: '/grows/new', done: hasGrow },
      { key: 'log',  label: 'Log your first day', desc: 'Water, feed, a photo — done', icon: ClipboardList,
        href: firstGrowId ? `/grows/${firstGrowId}/log` : '/grows/new', done: hasLog, locked: !hasGrow },
    ]

    const allDone = built.every(s => s.done)
    setSteps(built)
    setHidden(dismissed || allDone)
    setLoading(false)
  }

  async function dismiss() {
    setHidden(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ onboarding_completed: true } as never).eq('id', user.id)
  }

  if (loading || hidden) return null

  const doneCount = steps.filter(s => s.done).length

  return (
    <div className="rounded-2xl border p-5 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--accent-muted), var(--surface))', borderColor: 'var(--accent)' }}>
      <button onClick={dismiss} className="absolute top-3 right-3" style={{ color: 'var(--text-muted)' }}>
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-1">
        <Rocket className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Get growing</h2>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
        {doneCount} of {steps.length} done — let's get your first grow on the board.
      </p>

      <div className="space-y-2">
        {steps.map(s => {
          const Icon = s.icon
          const content = (
            <div className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
              style={{
                background: s.done ? 'transparent' : 'var(--surface)',
                borderColor: s.done ? 'var(--border)' : 'var(--accent)',
                opacity: s.locked ? 0.5 : 1,
              }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: s.done ? 'var(--accent)' : 'var(--surface-raised)' }}>
                {s.done ? <Check className="w-4 h-4" style={{ color: '#0a0f0d' }} />
                        : <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)', textDecoration: s.done ? 'line-through' : 'none' }}>
                  {s.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
              </div>
              {!s.done && !s.locked && (
                <span className="text-xs font-medium px-2 py-1 rounded-md shrink-0" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
                  Start
                </span>
              )}
            </div>
          )
          return s.done || s.locked
            ? <div key={s.key}>{content}</div>
            : <Link key={s.key} href={s.href}>{content}</Link>
        })}
      </div>
    </div>
  )
}
