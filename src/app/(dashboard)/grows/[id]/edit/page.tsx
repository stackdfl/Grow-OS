'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Grow, Genetics } from '@/types/database'

const STATUSES = [
  { value: 'clone',    label: 'Clone' },
  { value: 'seedling', label: 'Seedling' },
  { value: 'veg',      label: 'Veg' },
  { value: 'flower',   label: 'Flower' },
  { value: 'flush',    label: 'Flush' },
  { value: 'harvest',  label: 'Harvest' },
  { value: 'drying',   label: 'Drying' },
  { value: 'curing',   label: 'Curing' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed',   label: 'Failed' },
]

const MEDIUMS = ['Living Soil', 'Coco Coir', 'Pro-Mix / Peat', 'Rockwool', 'DWC Hydro', 'NFT Hydro', 'Aeroponic', 'Other']

export default function EditGrowPage() {
  const { id: growId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [genetics, setGenetics] = useState<Genetics[]>([])

  // Fields
  const [name, setName]                 = useState('')
  const [status, setStatus]             = useState('clone')
  const [geneticsId, setGeneticsId]     = useState('')
  const [plantCount, setPlantCount]     = useState('1')
  const [spaceLabel, setSpaceLabel]     = useState('')
  const [cloneDate, setCloneDate]       = useState('')
  const [vegStart, setVegStart]         = useState('')
  const [flipDate, setFlipDate]         = useState('')
  const [harvestDate, setHarvestDate]   = useState('')
  const [mediumType, setMediumType]     = useState('')
  const [containerSize, setContainerSize] = useState('')
  const [notes, setNotes]               = useState('')

  useEffect(() => { load() }, [growId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [growRes, genRes] = await Promise.all([
      supabase.from('grows').select('*').eq('id', growId).eq('user_id', user.id).single(),
      supabase.from('genetics').select('id, strain_name, breeder')
        .or(`user_id.eq.${user.id},is_public.eq.true`)
        .order('strain_name'),
    ])

    const g = growRes.data as Grow | null
    if (!g) { router.push('/grows'); return }

    setName(g.name)
    setStatus(g.status)
    setGeneticsId(g.genetics_id ?? '')
    setPlantCount(String(g.plant_count))
    setSpaceLabel(g.space_label ?? '')
    setCloneDate(g.clone_date ?? '')
    setVegStart(g.veg_start_date ?? '')
    setFlipDate(g.flip_date ?? '')
    setHarvestDate(g.harvest_date ?? '')
    setMediumType(g.medium_type ?? '')
    setContainerSize(g.container_size_gal ? String(g.container_size_gal) : '')
    setNotes(g.notes ?? '')

    setGenetics((genRes.data ?? []) as Genetics[])
    setLoading(false)
  }

  async function save() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)

    const { error } = await supabase
      .from('grows')
      .update({
        name: name.trim(),
        status,
        genetics_id: geneticsId || null,
        plant_count: parseInt(plantCount) || 1,
        space_label: spaceLabel.trim() || null,
        clone_date: cloneDate || null,
        veg_start_date: vegStart || null,
        flip_date: flipDate || null,
        harvest_date: harvestDate || null,
        medium_type: mediumType || null,
        container_size_gal: containerSize ? parseFloat(containerSize) : null,
        notes: notes.trim() || null,
      } as never)
      .eq('id', growId)

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Grow updated')
    router.push(`/grows/${growId}`)
  }

  const inputStyle = { background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }
  const labelStyle = { color: 'var(--text-muted)' }

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/grows/${growId}`} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Edit Grow</h1>
      </div>

      {loading ? (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div className="space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={labelStyle}>Grow name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Spring Tent #1" style={inputStyle} />
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={labelStyle}>Current stage</Label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    background: status === s.value ? 'var(--accent-muted)' : 'var(--surface-raised)',
                    borderColor: status === s.value ? 'var(--accent)' : 'var(--border)',
                    color: status === s.value ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Genetics */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={labelStyle}>Strain</Label>
            <select value={geneticsId} onChange={e => setGeneticsId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={inputStyle}>
              <option value="">— No strain selected —</option>
              {genetics.map(g => (
                <option key={g.id} value={g.id}>
                  {g.strain_name}{g.breeder ? ` — ${g.breeder}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Plant count + space */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={labelStyle}>Plant count</Label>
              <Input type="number" min="1" value={plantCount} onChange={e => setPlantCount(e.target.value)}
                className="font-mono" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={labelStyle}>Space / tent label</Label>
              <Input value={spaceLabel} onChange={e => setSpaceLabel(e.target.value)} placeholder="4×4 Tent A" style={inputStyle} />
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Key Dates</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Clone / Sprout date', val: cloneDate, set: setCloneDate },
                { label: 'Veg start date', val: vegStart, set: setVegStart },
                { label: 'Flip date (12/12)', val: flipDate, set: setFlipDate },
                { label: 'Est. harvest date', val: harvestDate, set: setHarvestDate },
              ].map(({ label, val, set }) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-xs" style={labelStyle}>{label}</Label>
                  <input type="date" value={val} onChange={e => set(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                    style={inputStyle} />
                </div>
              ))}
            </div>
          </div>

          {/* Medium */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={labelStyle}>Growing medium</Label>
            <div className="flex flex-wrap gap-2">
              {MEDIUMS.map(m => (
                <button key={m} type="button" onClick={() => setMediumType(mediumType === m ? '' : m)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  style={{
                    background: mediumType === m ? 'var(--accent-muted)' : 'var(--surface-raised)',
                    borderColor: mediumType === m ? 'var(--accent)' : 'var(--border)',
                    color: mediumType === m ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Container size */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={labelStyle}>Container size (gal)</Label>
            <Input type="number" step="0.5" placeholder="3" value={containerSize}
              onChange={e => setContainerSize(e.target.value)} className="font-mono w-32" style={inputStyle} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs" style={labelStyle}>Notes</Label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any grow notes…"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
              style={inputStyle} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => router.push(`/grows/${growId}`)} style={{ color: 'var(--text-muted)' }}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
