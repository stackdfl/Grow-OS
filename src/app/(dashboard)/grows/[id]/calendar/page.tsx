'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, startOfDay } from 'date-fns'
import { ChevronLeft, Check, SkipForward, ChevronDown, ChevronUp } from 'lucide-react'
import type { CalendarEvent } from '@/types/database'

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'var(--danger)',
  high: 'var(--warning)',
  medium: 'var(--accent)',
  low: 'var(--text-muted)',
}

const EVENT_TYPE_ICONS: Record<string, string> = {
  water: '💧', feed: '🍽️', top_dress: '🌿', transplant: '🪴',
  top: '✂️', lst: '🪢', hst: '💥', defoliate: '🍃', trellis: '🕸️',
  flip: '🔁', flush_start: '🚿', harvest: '✂️', cure_start: '🫙',
  clone_take: '✂️', clone_transplant: '🪴', observation: '👁️',
  environmental_change: '🌡️', custom: '📌', drying: '💨',
}

type GroupedEvents = Record<string, CalendarEvent[]>

export default function GrowCalendarPage() {
  const params = useParams()
  const growId = params.id as string
  const supabase = createClient()

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadEvents()
  }, [growId])

  async function loadEvents() {
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('grow_id', growId)
      .order('event_date', { ascending: true })
    setEvents((data ?? []) as CalendarEvent[])
    setLoading(false)

    // Auto-expand today and upcoming
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const upcoming = new Set<string>()
    for (const ev of (data ?? []) as CalendarEvent[]) {
      if (ev.event_date >= today && !ev.completed && !ev.skipped) {
        upcoming.add(ev.event_date)
      }
    }
    setExpandedGroups(upcoming)
  }

  async function completeEvent(eventId: string) {
    await supabase
      .from('calendar_events')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', eventId)
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, completed: true, completed_at: new Date().toISOString() } : e))
  }

  async function skipEvent(eventId: string) {
    await supabase
      .from('calendar_events')
      .update({ skipped: true })
      .eq('id', eventId)
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, skipped: true } : e))
  }

  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')

  const filtered = events.filter((e) => {
    if (filter === 'pending') return !e.completed && !e.skipped
    if (filter === 'completed') return e.completed || e.skipped
    return true
  })

  // Group by date
  const grouped: GroupedEvents = {}
  for (const ev of filtered) {
    if (!grouped[ev.event_date]) grouped[ev.event_date] = []
    grouped[ev.event_date].push(ev)
  }
  const dates = Object.keys(grouped).sort()

  const pendingCount = events.filter((e) => !e.completed && !e.skipped).length
  const completedCount = events.filter((e) => e.completed).length

  function toggleGroup(date: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/grows/${growId}`} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Grow Calendar</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {pendingCount} pending · {completedCount} completed
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['pending', 'all', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border capitalize transition-colors"
            style={{
              background: filter === f ? 'var(--accent-muted)' : 'transparent',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading calendar…</div>
      )}

      {!loading && dates.length === 0 && (
        <div className="text-center py-10 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {filter === 'pending' ? 'No pending tasks. All caught up!' : 'No events yet.'}
          </p>
          {filter === 'pending' && events.length === 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Set a flip date on your grow to auto-generate the calendar.
            </p>
          )}
        </div>
      )}

      {/* Events grouped by date */}
      <div className="space-y-2">
        {dates.map((date) => {
          const dayEvents = grouped[date]
          const isToday = date === today
          const isPast = date < today
          const isExpanded = expandedGroups.has(date)
          const dateLabel = isToday
            ? 'Today'
            : format(parseISO(date + 'T12:00:00'), 'EEEE, MMM d')

          return (
            <div
              key={date}
              className="rounded-xl border overflow-hidden"
              style={{
                background: 'var(--surface)',
                borderColor: isToday ? 'var(--accent)' : 'var(--border)',
              }}
            >
              {/* Date header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3"
                onClick={() => toggleGroup(date)}
              >
                <div className="flex items-center gap-2">
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  )}
                  <span
                    className="text-sm font-medium"
                    style={{ color: isToday ? 'var(--accent)' : isPast ? 'var(--text-muted)' : 'var(--text)' }}
                  >
                    {dateLabel}
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

              {/* Events */}
              {isExpanded && (
                <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                  {dayEvents.map((ev) => (
                    <EventRow
                      key={ev.id}
                      event={ev}
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

function EventRow({ event, onComplete, onSkip }: {
  event: CalendarEvent
  onComplete: () => void
  onSkip: () => void
}) {
  const [expanded, setExpanded] = useState(event.priority === 'critical')
  const priorityColor = PRIORITY_COLORS[event.priority] ?? 'var(--text-muted)'
  const icon = EVENT_TYPE_ICONS[event.event_type] ?? '📌'
  const isDone = event.completed || event.skipped

  return (
    <div
      className="px-4 py-3 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)', opacity: isDone ? 0.5 : 1 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-base shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="text-sm font-medium"
              style={{
                color: 'var(--text)',
                textDecoration: isDone ? 'line-through' : 'none',
              }}
            >
              {event.title}
            </p>
            <span
              className="text-xs px-1.5 py-0.5 rounded capitalize"
              style={{ background: `${priorityColor}20`, color: priorityColor }}
            >
              {event.priority}
            </span>
            {event.completed && (
              <span className="text-xs" style={{ color: 'var(--success)' }}>✓ Done</span>
            )}
            {event.skipped && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Skipped</span>
            )}
          </div>

          {event.description && (
            <button
              className="text-xs mt-1 text-left"
              style={{ color: expanded ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? event.description : `${event.description.slice(0, 80)}…`}
            </button>
          )}
        </div>

        {/* Actions */}
        {!isDone && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={onComplete}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              title="Mark complete"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onSkip}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
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
