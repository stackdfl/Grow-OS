'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, startOfDay, parseISO, addDays } from 'date-fns'
import { CalendarDays, Check, SkipForward, ChevronDown, ChevronUp, Sprout } from 'lucide-react'
import type { CalendarEvent, Grow } from '@/types/database'

type EventWithGrow = CalendarEvent & { grow: Pick<Grow, 'id' | 'name'> | null }

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)',
  high:     'var(--warning)',
  medium:   'var(--accent)',
  low:      'var(--text-muted)',
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  water: '💧', feed: '🍽️', top_dress: '🌿', transplant: '🪴',
  top: '✂️', lst: '🪢', hst: '💥', defoliate: '🍃', trellis: '🕸️',
  flip: '🔁', flush_start: '🚿', harvest: '✂️', cure_start: '🫙',
  clone_take: '✂️', clone_transplant: '🪴', observation: '👁️',
  environmental_change: '🌡️', custom: '📌',
}

export default function CalendarPage() {
  const supabase = createClient()
  const [events, setEvents] = useState<EventWithGrow[]>([])
  const [grows, setGrows]   = useState<Pick<Grow, 'id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'pending' | 'all' | 'completed'>('pending')
  const [growFilter, setGrowFilter] = useState<string>('all')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    const today  = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const future = format(addDays(new Date(), 60), 'yyyy-MM-dd')

    const [evRes, growRes] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('*, grow:grows(id, name)')
        .gte('event_date', format(addDays(new Date(), -14), 'yyyy-MM-dd'))
        .lte('event_date', future)
        .order('event_date', { ascending: true }),
      supabase
        .from('grows')
        .select('id, name')
        .not('status', 'in', '("complete","failed")')
        .order('created_at', { ascending: false }),
    ])

    const evs = (evRes.data ?? []) as EventWithGrow[]
    setEvents(evs)
    setGrows((growRes.data ?? []) as Pick<Grow, 'id' | 'name'>[])

    // Auto-expand today + next 7 days
    const upcomingDates = new Set<string>()
    for (const ev of evs) {
      if (ev.event_date >= today && !ev.completed && !ev.skipped) {
        upcomingDates.add(ev.event_date)
      }
    }
    setExpandedDates(upcomingDates)
    setLoading(false)
  }

  async function completeEvent(id: string) {
    await supabase.from('calendar_events')
      .update({ completed: true, completed_at: new Date().toISOString() } as never)
      .eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, completed: true } : e))
  }

  async function skipEvent(id: string) {
    await supabase.from('calendar_events').update({ skipped: true } as never).eq('id', id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, skipped: true } : e))
  }

  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')

  const filtered = useMemo(() => events.filter(e => {
    if (growFilter !== 'all' && e.grow_id !== growFilter) return false
    if (filter === 'pending')   return !e.completed && !e.skipped
    if (filter === 'completed') return e.completed || e.skipped
    return true
  }), [events, filter, growFilter])

  const grouped = useMemo(() => {
    const map: Record<string, EventWithGrow[]> = {}
    for (const ev of filtered) {
      ;(map[ev.event_date] ??= []).push(ev)
    }
    return map
  }, [filtered])

  const dates = Object.keys(grouped).sort()
  const pendingCount = events.filter(e => !e.completed && !e.skipped).length

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <CalendarDays className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Calendar</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {pendingCount} pending tasks across all grows
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex gap-1">
          {(['pending', 'all', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border capitalize"
              style={{
                background:  filter === f ? 'var(--accent-muted)' : 'transparent',
                borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                color:       filter === f ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >{f}</button>
          ))}
        </div>

        {grows.length > 1 && (
          <select
            value={growFilter}
            onChange={e => setGrowFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="all">All grows</option>
            {grows.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {!loading && dates.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <CalendarDays className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filter === 'pending' ? 'All caught up! No pending tasks.' : 'No events in this range.'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Set a flip date on a grow to auto-generate its calendar.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {dates.map(date => {
          const dayEvents = grouped[date]
          const isToday   = date === today
          const isPast    = date < today
          const isExpanded = expandedDates.has(date)
          const label = isToday
            ? 'Today'
            : format(parseISO(date + 'T12:00:00'), 'EEEE, MMM d')

          return (
            <div
              key={date}
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--surface)', borderColor: isToday ? 'var(--accent)' : 'var(--border)' }}
            >
              <button
                className="w-full flex items-center justify-between px-4 py-3"
                onClick={() => toggleDate(date)}
              >
                <div className="flex items-center gap-2">
                  {isToday && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />}
                  <span className="text-sm font-medium" style={{ color: isToday ? 'var(--accent)' : isPast ? 'var(--text-muted)' : 'var(--text)' }}>
                    {label}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}>
                    {dayEvents.length}
                  </span>
                </div>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                }
              </button>

              {isExpanded && (
                <div className="border-t divide-y" style={{ borderColor: 'var(--border)' }}>
                  {dayEvents.map(ev => (
                    <EventRow
                      key={ev.id}
                      event={ev}
                      showGrow
                      onComplete={() => completeEvent(ev.id)}
                      onSkip={() => skipEvent(ev.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventRow({
  event: ev,
  showGrow,
  onComplete,
  onSkip,
}: {
  event: EventWithGrow
  showGrow: boolean
  onComplete: () => void
  onSkip: () => void
}) {
  const [descExpanded, setDescExpanded] = useState(false)
  const isDone = ev.completed || ev.skipped
  const color  = PRIORITY_COLORS[ev.priority] ?? 'var(--text-muted)'
  const icon   = EVENT_TYPE_ICONS[ev.event_type] ?? '📌'

  return (
    <div className="px-4 py-3" style={{ opacity: isDone ? 0.5 : 1 }}>
      <div className="flex items-start gap-3">
        <span className="text-base shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium" style={{ color: 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
              {ev.title}
            </p>
            <span className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ background: `${color}20`, color }}>
              {ev.priority}
            </span>
            {ev.completed && <span className="text-xs" style={{ color: 'var(--accent)' }}>✓ Done</span>}
            {ev.skipped  && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Skipped</span>}
          </div>

          {showGrow && ev.grow && (
            <Link
              href={`/grows/${ev.grow.id}/calendar`}
              className="inline-flex items-center gap-1 text-xs mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              <Sprout className="w-3 h-3" />
              {ev.grow.name}
            </Link>
          )}

          {ev.description && (
            <button
              className="text-xs mt-1 text-left block"
              style={{ color: descExpanded ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => setDescExpanded(v => !v)}
            >
              {descExpanded ? ev.description : ev.description.slice(0, 80) + (ev.description.length > 80 ? '…' : '')}
            </button>
          )}
        </div>

        {!isDone && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onComplete}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              title="Complete"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onSkip}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
              title="Skip"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
