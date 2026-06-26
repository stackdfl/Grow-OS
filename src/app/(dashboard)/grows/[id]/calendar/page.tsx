'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, startOfDay } from 'date-fns'
import { ChevronLeft, Check, SkipForward, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
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

  // Add event form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-dd'))
  const [newType, setNewType] = useState('custom')
  const [newPriority, setNewPriority] = useState('medium')
  const [newDesc, setNewDesc] = useState('')
  const [addingSaving, setAddingSaving] = useState(false)

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

  async function addEvent() {
    if (!newTitle.trim()) return
    setAddingSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAddingSaving(false); return }

    const { data } = await supabase
      .from('calendar_events')
      .insert([{
        grow_id: growId,
        user_id: user.id,
        event_date: newDate,
        event_type: newType,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority,
        completed: false,
        skipped: false,
        source: 'manual',
      } as never])
      .select()
      .single()

    if (data) {
      setEvents(prev => [...prev, data as CalendarEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)))
      setExpandedGroups(g => new Set([...g, newDate]))
      setNewTitle(''); setNewDesc(''); setShowAddForm(false)
    }
    setAddingSaving(false)
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
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Grow Calendar</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {pendingCount} pending · {completedCount} completed
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
          style={{ background: showAddForm ? 'var(--accent-muted)' : 'transparent', borderColor: showAddForm ? 'var(--accent)' : 'var(--border)', color: showAddForm ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Cancel' : 'Add event'}
        </button>
      </div>

      {/* Add event form */}
      {showAddForm && (
        <div className="rounded-xl border p-4 mb-5 space-y-3" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>New Event</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Title *</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Defoliation, trellis check…"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[['medium','Medium'],['high','High'],['critical','Critical'],['low','Low']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setNewPriority(v)}
                className="px-3 py-1 rounded-lg text-xs border capitalize transition-all"
                style={{ background: newPriority === v ? 'var(--accent-muted)' : 'var(--surface-raised)', borderColor: newPriority === v ? 'var(--accent)' : 'var(--border)', color: newPriority === v ? 'var(--accent)' : 'var(--text-muted)' }}>
                {l}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes (optional)</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Additional details…"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div className="flex justify-end">
            <button onClick={addEvent} disabled={addingSaving || !newTitle.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {addingSaving ? 'Adding…' : 'Add Event'}
            </button>
          </div>
        </div>
      )}

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
