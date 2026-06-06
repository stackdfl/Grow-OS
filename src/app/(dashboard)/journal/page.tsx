'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { BookOpen, Plus, X, Sprout, Droplets, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { JournalEntry, Grow } from '@/types/database'

type EntryWithGrow = JournalEntry & { grow: Pick<Grow, 'id' | 'name' | 'status'> | null }

export default function JournalPage() {
  const supabase = createClient()

  const [entries, setEntries] = useState<EntryWithGrow[]>([])
  const [grows, setGrows]     = useState<Pick<Grow, 'id' | 'name' | 'status'>[]>([])
  const [loading, setLoading] = useState(true)
  const [growFilter, setGrowFilter] = useState('all')

  // Quick-add form
  const [adding, setAdding]       = useState(false)
  const [addGrowId, setAddGrowId] = useState('')
  const [addDate, setAddDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [addNotes, setAddNotes]   = useState('')
  const [addWatered, setAddWatered] = useState(false)
  const [addFed, setAddFed]         = useState(false)
  const [saving, setSaving]         = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [entRes, growRes] = await Promise.all([
      supabase
        .from('journal_entries')
        .select('*, grow:grows(id, name, status)')
        .order('entry_date', { ascending: false })
        .limit(100),
      supabase
        .from('grows')
        .select('id, name, status')
        .not('status', 'in', '("complete","failed")')
        .order('created_at', { ascending: false }),
    ])
    setEntries((entRes.data ?? []) as EntryWithGrow[])
    const activeGrows = (growRes.data ?? []) as Pick<Grow, 'id' | 'name' | 'status'>[]
    setGrows(activeGrows)
    if (activeGrows.length > 0 && !addGrowId) setAddGrowId(activeGrows[0].id)
    setLoading(false)
  }

  async function submitEntry() {
    if (!addGrowId || !addNotes.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data } = await supabase
      .from('journal_entries')
      .insert([{
        grow_id:          addGrowId,
        user_id:          user.id,
        entry_date:       addDate,
        raw_notes:        addNotes.trim(),
        structured_data:  {},
        photos:           [],
        watering_logged:  addWatered,
        feeding_logged:   addFed,
        training_logged:  false,
      }])
      .select('*, grow:grows(id, name, status)')
      .single()

    if (data) {
      setEntries(prev => [data as EntryWithGrow, ...prev])
      setAddNotes('')
      setAddWatered(false)
      setAddFed(false)
      setAdding(false)
    }
    setSaving(false)
  }

  const displayed = entries.filter(e =>
    growFilter === 'all' || e.grow_id === growFilter
  )

  // Group by date
  const byDate: Record<string, EntryWithGrow[]> = {}
  for (const e of displayed) {
    ;(byDate[e.entry_date] ??= []).push(e)
  }
  const dates = Object.keys(byDate).sort().reverse()

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Grow Journal</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{entries.length} entries</p>
          </div>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Log Entry
          </Button>
        )}
      </div>

      {/* Quick-add form */}
      {adding && (
        <div
          className="rounded-xl border p-4 mb-5 space-y-3"
          style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>New Journal Entry</span>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Grow</label>
              <select
                value={addGrowId}
                onChange={e => setAddGrowId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {grows.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input
                type="date"
                value={addDate}
                onChange={e => setAddDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          <textarea
            rows={4}
            placeholder="What happened today? Observations, actions taken, concerns…"
            value={addNotes}
            onChange={e => setAddNotes(e.target.value)}
            autoFocus
            className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />

          <div className="flex gap-3">
            {[
              { key: 'watered', label: 'Watered', icon: Droplets, val: addWatered, set: setAddWatered },
              { key: 'fed', label: 'Fed', icon: Zap, val: addFed, set: setAddFed },
            ].map(({ key, label, icon: Icon, val, set }) => (
              <button
                key={key}
                type="button"
                onClick={() => set(!val)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors"
                style={{
                  background:  val ? 'var(--accent-muted)' : 'transparent',
                  borderColor: val ? 'var(--accent)' : 'var(--border)',
                  color:       val ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAdding(false)} style={{ color: 'var(--text-muted)' }}>Cancel</Button>
            <Button onClick={submitEntry} disabled={saving || !addNotes.trim() || !addGrowId} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {saving ? 'Saving…' : 'Save Entry'}
            </Button>
          </div>
        </div>
      )}

      {/* Grow filter */}
      {grows.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setGrowFilter('all')}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{
              background:  growFilter === 'all' ? 'var(--accent-muted)' : 'transparent',
              borderColor: growFilter === 'all' ? 'var(--accent)' : 'var(--border)',
              color:       growFilter === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >All</button>
          {grows.map(g => (
            <button
              key={g.id}
              onClick={() => setGrowFilter(g.id)}
              className="px-3 py-1.5 rounded-lg text-sm border"
              style={{
                background:  growFilter === g.id ? 'var(--accent-muted)' : 'transparent',
                borderColor: growFilter === g.id ? 'var(--accent)' : 'var(--border)',
                color:       growFilter === g.id ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >{g.name}</button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {!loading && dates.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No journal entries yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Start logging your grows</p>
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Log First Entry
          </Button>
        </div>
      )}

      {/* Entries by date */}
      <div className="space-y-5">
        {dates.map(date => (
          <div key={date}>
            <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {format(parseISO(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
            </p>
            <div className="space-y-3">
              {byDate[date].map(entry => (
                <div
                  key={entry.id}
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    {entry.grow && (
                      <Link
                        href={`/grows/${entry.grow.id}`}
                        className="flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--accent)' }}
                      >
                        <Sprout className="w-3.5 h-3.5" />
                        {entry.grow.name}
                      </Link>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      {entry.watering_logged && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                          <Droplets className="w-2.5 h-2.5" /> Watered
                        </span>
                      )}
                      {entry.feeding_logged && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                          <Zap className="w-2.5 h-2.5" /> Fed
                        </span>
                      )}
                    </div>
                  </div>
                  {entry.raw_notes && (
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                      {entry.raw_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
