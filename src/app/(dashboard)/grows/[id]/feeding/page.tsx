'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, Droplets, Plus, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FeedingLog, Grow } from '@/types/database'

type ProductRow = { name: string; amount: string; unit: string; notes: string }

export default function GrowFeedingPage() {
  const { id: growId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [grow, setGrow]     = useState<Pick<Grow, 'id' | 'name'> | null>(null)
  const [logs, setLogs]     = useState<FeedingLog[]>([])
  const [loading, setLoading] = useState(true)

  // Form
  const [adding, setAdding] = useState(false)
  const [date, setDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [products, setProducts] = useState<ProductRow[]>([{ name: '', amount: '', unit: 'ml', notes: '' }])
  const [phIn, setPhIn]     = useState('')
  const [ecIn, setEcIn]     = useState('')
  const [volume, setVolume] = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [growId])

  async function load() {
    const [growRes, logsRes] = await Promise.all([
      supabase.from('grows').select('id, name').eq('id', growId).single(),
      supabase.from('feeding_logs').select('*').eq('grow_id', growId)
        .order('log_date', { ascending: false }).limit(100),
    ])
    setGrow(growRes.data as Pick<Grow, 'id' | 'name'> | null)
    setLogs((logsRes.data ?? []) as FeedingLog[])
    setLoading(false)
  }

  function addProduct() {
    setProducts(p => [...p, { name: '', amount: '', unit: 'ml', notes: '' }])
  }

  function removeProduct(i: number) {
    setProducts(p => p.filter((_, j) => j !== i))
  }

  function updateProduct(i: number, key: keyof ProductRow, val: string) {
    setProducts(p => p.map((row, j) => j === i ? { ...row, [key]: val } : row))
  }

  async function submit() {
    const validProducts = products.filter(p => p.name.trim())
    if (validProducts.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data } = await supabase
      .from('feeding_logs')
      .insert([{
        grow_id:          growId,
        user_id:          user.id,
        log_date:         date,
        products:         validProducts.map(p => ({
          name: p.name.trim(),
          amount: p.amount ? parseFloat(p.amount) : 0,
          unit: p.unit,
          notes: p.notes.trim() || undefined,
        })),
        total_volume_ml: volume ? parseFloat(volume) : null,
        ph_in:           phIn ? parseFloat(phIn) : null,
        ec_in:           ecIn ? parseFloat(ecIn) : null,
        notes:           notes.trim() || null,
      }])
      .select()
      .single()

    if (data) {
      setLogs(p => [data as FeedingLog, ...p])
      setProducts([{ name: '', amount: '', unit: 'ml', notes: '' }])
      setPhIn('')
      setEcIn('')
      setVolume('')
      setNotes('')
      setAdding(false)
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
            {grow?.name ?? 'Grow'} — Feeding Log
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{logs.length} entries</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Log Feed
          </Button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border p-4 mb-5 space-y-4" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Log Feeding</span>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</Label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Products</Label>
              <button onClick={addProduct} className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {products.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_70px_auto] gap-2 items-center">
                  <Input placeholder="Product name" value={p.name} onChange={e => updateProduct(i, 'name', e.target.value)}
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <Input type="number" placeholder="Amount" value={p.amount} onChange={e => updateProduct(i, 'amount', e.target.value)}
                    className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <select value={p.unit} onChange={e => updateProduct(i, 'unit', e.target.value)}
                    className="px-2 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {['ml', 'tsp', 'tbsp', 'oz', 'g'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {products.length > 1 && (
                    <button onClick={() => removeProduct(i)}>
                      <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'pH In', val: phIn, set: setPhIn, placeholder: '6.2' },
              { label: 'EC (mS/cm)', val: ecIn, set: setEcIn, placeholder: '1.8' },
              { label: 'Volume (ml)', val: volume, set: setVolume, placeholder: '1000' },
            ].map(({ label, val, set, placeholder }) => (
              <div key={label} className="space-y-1">
                <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</Label>
                <Input type="number" step="0.1" placeholder={placeholder} value={val}
                  onChange={e => set(e.target.value)} className="font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes</Label>
            <Input placeholder="Any observations…" value={notes} onChange={e => setNotes(e.target.value)}
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAdding(false)} style={{ color: 'var(--text-muted)' }}>Cancel</Button>
            <Button onClick={submit} disabled={saving || products.every(p => !p.name.trim())} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && logs.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <Droplets className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No feeding logs yet</p>
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Log First Feed
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-muted)' }}>
                {format(parseISO(log.log_date + 'T12:00:00'), 'EEE, MMM d yyyy')}
              </span>
              <div className="flex items-center gap-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {log.ph_in !== null && <span>pH {log.ph_in}</span>}
                {log.ec_in !== null && <span>EC {log.ec_in}</span>}
                {log.total_volume_ml !== null && <span>{log.total_volume_ml}ml</span>}
              </div>
            </div>
            <div className="space-y-1">
              {log.products.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span style={{ color: 'var(--text)' }}>{p.name}</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {p.amount} {p.unit}
                  </span>
                </div>
              ))}
            </div>
            {log.notes && (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{log.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
