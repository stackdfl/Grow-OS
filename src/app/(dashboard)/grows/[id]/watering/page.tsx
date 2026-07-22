'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, Droplets, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { WateringLog, Grow } from '@/types/database'

type Additive = { name: string; amount: string; unit: string }

export default function GrowWateringPage() {
  const { id: growId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [grow, setGrow]     = useState<Pick<Grow, 'id' | 'name'> | null>(null)
  const [logs, setLogs]     = useState<WateringLog[]>([])
  const [loading, setLoading] = useState(true)

  const [adding, setAdding] = useState(false)
  const [date, setDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [volume, setVolume] = useState('')
  const [phIn, setPhIn]     = useState('')
  const [ecIn, setEcIn]     = useState('')
  const [runoffPh, setRunoffPh] = useState('')
  const [runoffEc, setRunoffEc] = useState('')
  const [additives, setAdditives] = useState<Additive[]>([])
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [growId])

  async function load() {
    const [growRes, logsRes] = await Promise.all([
      supabase.from('grows').select('id, name').eq('id', growId).single(),
      supabase.from('watering_logs').select('*').eq('grow_id', growId)
        .order('log_date', { ascending: false }).limit(100),
    ])
    setGrow(growRes.data as Pick<Grow, 'id' | 'name'> | null)
    setLogs((logsRes.data ?? []) as WateringLog[])
    setLoading(false)
  }

  function addAdditive() {
    setAdditives(a => [...a, { name: '', amount: '', unit: 'ml' }])
  }

  async function submit() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data } = await supabase
      .from('watering_logs')
      .insert([{
        grow_id: growId,
        user_id: user.id,
        log_date: date,
        volume_per_plant_ml: volume ? parseFloat(volume) : null,
        ph_in: phIn ? parseFloat(phIn) : null,
        ec_in: ecIn ? parseFloat(ecIn) : null,
        runoff_ph: runoffPh ? parseFloat(runoffPh) : null,
        runoff_ec: runoffEc ? parseFloat(runoffEc) : null,
        additives: additives.filter(a => a.name.trim()).map(a => ({
          name: a.name.trim(),
          amount: a.amount ? parseFloat(a.amount) : undefined,
          unit: a.unit || undefined,
        })),
        notes: notes.trim() || null,
        source: 'manual',
      }])
      .select()
      .single()

    if (data) {
      setLogs(p => [data as WateringLog, ...p])
      setVolume(''); setPhIn(''); setEcIn(''); setRunoffPh(''); setRunoffEc('')
      setAdditives([]); setNotes(''); setAdding(false)
      fetch('/api/calibration/compute', { method: 'POST' }).catch(() => {})
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
            {grow?.name ?? 'Grow'} — Watering Log
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{logs.length} entries</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Log Water
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border p-4 mb-5 space-y-4" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Log Watering</span>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</Label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Vol/plant (ml)', val: volume, set: setVolume, ph: '500' },
              { label: 'pH In', val: phIn, set: setPhIn, ph: '6.2' },
              { label: 'EC In', val: ecIn, set: setEcIn, ph: '1.8' },
              { label: 'Runoff pH', val: runoffPh, set: setRunoffPh, ph: '6.5' },
              { label: 'Runoff EC', val: runoffEc, set: setRunoffEc, ph: '2.0' },
            ].map(({ label, val, set, ph }) => (
              <div key={label} className="space-y-1">
                <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</Label>
                <Input type="number" step="0.1" placeholder={ph} value={val}
                  onChange={e => set(e.target.value)} className="font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
            ))}
          </div>

          {/* Additives */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Additives (optional)</Label>
              <button onClick={addAdditive} className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {additives.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_60px_auto] gap-2 items-center">
                  <Input placeholder="Product" value={a.name}
                    onChange={e => setAdditives(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <Input type="number" placeholder="Amt" value={a.amount}
                    onChange={e => setAdditives(p => p.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                    className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <select value={a.unit}
                    onChange={e => setAdditives(p => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                    className="px-2 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {['ml', 'tsp', 'tbsp', 'g'].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <button onClick={() => setAdditives(p => p.filter((_, j) => j !== i))}>
                    <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes</Label>
            <Input placeholder="Any observations…" value={notes} onChange={e => setNotes(e.target.value)}
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAdding(false)} style={{ color: 'var(--text-muted)' }}>Cancel</Button>
            <Button onClick={submit} disabled={saving} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && logs.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <Droplets className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No waterings logged yet</p>
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Log First Watering
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id} className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-muted)' }}>
                {format(parseISO(log.log_date + 'T12:00:00'), 'EEE, MMM d yyyy')}
              </span>
              <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {log.volume_per_plant_ml !== null && <span>{log.volume_per_plant_ml}ml/plant</span>}
                {log.ph_in !== null && <span>pH {log.ph_in}</span>}
                {log.ec_in !== null && <span>EC {log.ec_in}</span>}
              </div>
            </div>
            {log.additives.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {log.additives.map((a, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                    {a.name}{a.amount ? ` ${a.amount}${a.unit ?? ''}` : ''}
                  </span>
                ))}
              </div>
            )}
            {(log.runoff_ph !== null || log.runoff_ec !== null) && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Runoff: {log.runoff_ph !== null ? `pH ${log.runoff_ph}` : ''}
                {log.runoff_ph !== null && log.runoff_ec !== null ? ' · ' : ''}
                {log.runoff_ec !== null ? `EC ${log.runoff_ec}` : ''}
              </p>
            )}
            {log.notes && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{log.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
