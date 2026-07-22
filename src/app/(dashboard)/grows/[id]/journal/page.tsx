'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, BookOpen, Plus, X, Droplets, Zap, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhotoUploader } from '@/components/grows/photo-uploader'
import { PhotoGrid } from '@/components/grows/photo-grid'
import type { JournalEntry, Grow } from '@/types/database'

export default function GrowJournalPage() {
  const { id: growId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [userId, setUserId]   = useState('')
  const [grow, setGrow]       = useState<Pick<Grow, 'id' | 'name'> | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Form
  const [adding, setAdding]     = useState(false)
  const [date, setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes]       = useState('')
  const [photos, setPhotos]     = useState<string[]>([])
  const [watered, setWatered]   = useState(false)
  const [fed, setFed]           = useState(false)
  const [trained, setTrained]   = useState(false)
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [growId])

  async function load() {
    const [{ data: { user } }, growRes, entRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('grows').select('id, name').eq('id', growId).single(),
      supabase.from('journal_entries').select('*').eq('grow_id', growId)
        .order('entry_date', { ascending: false }).limit(200),
    ])
    setUserId(user?.id ?? '')
    setGrow(growRes.data as Pick<Grow, 'id' | 'name'> | null)
    setEntries((entRes.data ?? []) as JournalEntry[])
    setLoading(false)
  }

  function resetForm() {
    setNotes(''); setPhotos([]); setWatered(false); setFed(false); setTrained(false)
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

  async function submit() {
    if (!notes.trim() && photos.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data } = await supabase
      .from('journal_entries')
      .insert([{
        grow_id:         growId,
        user_id:         user.id,
        entry_date:      date,
        raw_notes:       notes.trim(),
        structured_data: {},
        photos,
        watering_logged: watered,
        feeding_logged:  fed,
        training_logged: trained,
      }])
      .select()
      .single()

    if (data) {
      setEntries(p => [data as JournalEntry, ...p])
      resetForm()
      setAdding(false)
    }
    setSaving(false)
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/grows/${growId}`} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {grow?.name ?? 'Grow'} — Journal
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{entries.length} entries</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Log
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border p-4 mb-5 space-y-3" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>New Entry</span>
            <button onClick={() => { resetForm(); setAdding(false) }}>
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <textarea rows={4} placeholder="What happened today? Observations, concerns, actions taken…"
            value={notes} onChange={e => setNotes(e.target.value)} autoFocus
            className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />

          {userId && (
            <PhotoUploader
              userId={userId}
              growId={growId}
              onUploaded={setPhotos}
            />
          )}

          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Watered', icon: Droplets, val: watered, set: setWatered },
              { label: 'Fed', icon: Zap, val: fed, set: setFed },
              { label: 'Trained', icon: Scissors, val: trained, set: setTrained },
            ].map(({ label, icon: Icon, val, set }) => (
              <button key={label} type="button" onClick={() => set(!val)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border"
                style={{
                  background:  val ? 'var(--accent-muted)' : 'transparent',
                  borderColor: val ? 'var(--accent)' : 'var(--border)',
                  color:       val ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { resetForm(); setAdding(false) }} style={{ color: 'var(--text-muted)' }}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || (!notes.trim() && photos.length === 0)}
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {saving ? 'Saving…' : 'Save Entry'}
            </Button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && entries.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No journal entries yet</p>
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> First Entry
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {entries.map(entry => (
          <div key={entry.id} className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-muted)' }}>
                {format(parseISO(entry.entry_date + 'T12:00:00'), 'EEEE, MMM d yyyy')}
              </span>
              <div className="flex items-center gap-1.5">
                {entry.watering_logged && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                    <Droplets className="w-2.5 h-2.5" /> Water
                  </span>
                )}
                {entry.feeding_logged && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                    <Zap className="w-2.5 h-2.5" /> Feed
                  </span>
                )}
                {entry.training_logged && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                    <Scissors className="w-2.5 h-2.5" /> Train
                  </span>
                )}
              </div>
            </div>
            {entry.raw_notes && (
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {entry.raw_notes}
              </p>
            )}
            {entry.photos?.length > 0 && (
              <PhotoGrid urls={entry.photos} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
