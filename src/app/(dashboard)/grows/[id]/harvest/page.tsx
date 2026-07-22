'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, Leaf, Edit2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { HarvestReport, Grow } from '@/types/database'

export default function GrowHarvestPage() {
  const { id: growId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [grow, setGrow]       = useState<Grow | null>(null)
  const [report, setReport]   = useState<HarvestReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)

  const [totalSpend, setTotalSpend]       = useState(0)

  // Form state
  const [harvestDate, setHarvestDate]     = useState('')
  const [wetWeight, setWetWeight]         = useState('')
  const [dryWeight, setDryWeight]         = useState('')
  const [trimWeight, setTrimWeight]       = useState('')
  const [whatWorked, setWhatWorked]       = useState('')
  const [whatToChange, setWhatToChange]   = useState('')
  const [cureStart, setCureStart]         = useState('')
  const [cureEnd, setCureEnd]             = useState('')
  const [thc, setThc]                     = useState('')
  const [cbd, setCbd]                     = useState('')
  const [aromaNote, setAromaNotes]        = useState('')
  const [effectNote, setEffectNotes]      = useState('')
  const [overallRating, setOverallRating] = useState('')
  const [wouldGrowAgain, setWouldGrowAgain] = useState<boolean | null>(null)
  const [notes, setNotes]                 = useState('')

  useEffect(() => { load() }, [growId])

  async function load() {
    const [growRes, reportRes, expRes] = await Promise.all([
      supabase.from('grows').select('*').eq('id', growId).single(),
      supabase.from('harvest_reports').select('*').eq('grow_id', growId).maybeSingle(),
      supabase.from('grow_expenses').select('amount_usd').eq('grow_id', growId),
    ])
    const g = growRes.data as Grow | null
    const r = reportRes.data as HarvestReport | null
    setGrow(g)
    setReport(r)
    setTotalSpend(((expRes.data ?? []) as { amount_usd: number }[]).reduce((s, e) => s + Number(e.amount_usd), 0))
    if (r) {
      setHarvestDate(r.harvest_date ?? '')
      setWetWeight(r.wet_weight_g?.toString() ?? '')
      setDryWeight(r.dry_weight_g?.toString() ?? '')
      setTrimWeight(r.trim_weight_g?.toString() ?? '')
      setWhatWorked(r.what_worked ?? '')
      setWhatToChange(r.what_to_change ?? '')
      setCureStart(r.cure_start_date ?? '')
      setCureEnd(r.cure_end_date ?? '')
      setThc(r.thc_percentage?.toString() ?? '')
      setCbd(r.cbd_percentage?.toString() ?? '')
      setAromaNotes(r.aroma_notes ?? '')
      setEffectNotes(r.effect_notes ?? '')
      setOverallRating(r.overall_rating?.toString() ?? '')
      setWouldGrowAgain(r.would_grow_again)
      setNotes(r.notes ?? '')
    } else if (g?.harvest_date) {
      setHarvestDate(g.harvest_date)
    } else {
      setHarvestDate(format(new Date(), 'yyyy-MM-dd'))
    }
    setEditing(!r) // auto-open form if no report yet
    setLoading(false)
  }

  async function submit() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      grow_id:            growId,
      user_id:            user.id,
      harvest_date:       harvestDate || null,
      wet_weight_g:       wetWeight   ? parseFloat(wetWeight)   : null,
      dry_weight_g:       dryWeight   ? parseFloat(dryWeight)   : null,
      trim_weight_g:      trimWeight  ? parseFloat(trimWeight)  : null,
      what_worked:        whatWorked.trim()    || null,
      what_to_change:     whatToChange.trim()  || null,
      cure_start_date:    cureStart   || null,
      cure_end_date:      cureEnd     || null,
      thc_percentage:     thc         ? parseFloat(thc)         : null,
      cbd_percentage:     cbd         ? parseFloat(cbd)         : null,
      aroma_notes:        aromaNote.trim()  || null,
      effect_notes:       effectNote.trim() || null,
      overall_rating:     overallRating ? parseInt(overallRating) : null,
      would_grow_again:   wouldGrowAgain,
      notes:              notes.trim()  || null,
      terpene_percentages: {},
      photos:             report?.photos ?? [],
      lab_results_url:    report?.lab_results_url ?? null,
    }

    let data: HarvestReport | null = null
    if (report) {
      const res = await supabase.from('harvest_reports').update(payload as never).eq('id', report.id).select().single()
      data = res.data as HarvestReport | null
    } else {
      const res = await supabase.from('harvest_reports').insert([payload as never]).select().single()
      data = res.data as HarvestReport | null
      // Also mark grow as complete
      if (data) {
        await supabase.from('grows').update({ status: 'complete', actual_harvest_date: harvestDate || null } as never).eq('id', growId)
      }
    }

    if (data) {
      setReport(data)
      setEditing(false)
      fetch('/api/calibration/compute', { method: 'POST' }).catch(() => {})
    }
    setSaving(false)
  }

  const yieldPerPlant = grow && report?.dry_weight_g && grow.plant_count
    ? (report.dry_weight_g / 28.35 / grow.plant_count).toFixed(1)
    : null

  const dryOz = report?.dry_weight_g ? report.dry_weight_g / 28.35 : null
  const costPerOz = dryOz && dryOz > 0 && totalSpend > 0 ? totalSpend / dryOz : null
  const costPerGram = report?.dry_weight_g && report.dry_weight_g > 0 && totalSpend > 0 ? totalSpend / report.dry_weight_g : null

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/grows/${growId}`} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {grow?.name ?? 'Grow'} — Harvest
          </h1>
        </div>
        {report && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} style={{ color: 'var(--text-secondary)' }}>
            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
        )}
      </div>

      {loading && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {/* View mode */}
      {!loading && report && !editing && (
        <div className="space-y-4">
          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Harvest Date', value: report.harvest_date ? format(parseISO(report.harvest_date), 'MMM d, yyyy') : '—' },
              { label: 'Dry Weight',   value: report.dry_weight_g ? `${report.dry_weight_g}g` : '—', mono: true },
              { label: 'Wet Weight',   value: report.wet_weight_g ? `${report.wet_weight_g}g` : '—', mono: true },
              { label: 'Yield / Plant', value: yieldPerPlant ? `${yieldPerPlant}oz` : '—', mono: true, highlight: 'var(--accent)' },
            ].map(({ label, value, mono, highlight }) => (
              <div key={label} className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className={`text-base font-semibold ${mono ? 'font-mono' : ''}`} style={{ color: highlight ?? 'var(--text)' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {(report.thc_percentage || report.cbd_percentage) && (
            <div className="rounded-xl border p-4 flex gap-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {report.thc_percentage && (
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>THC</p>
                  <p className="text-xl font-bold font-mono" style={{ color: 'var(--accent)' }}>{report.thc_percentage}%</p>
                </div>
              )}
              {report.cbd_percentage && (
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>CBD</p>
                  <p className="text-xl font-bold font-mono" style={{ color: '#818cf8' }}>{report.cbd_percentage}%</p>
                </div>
              )}
              {report.overall_rating && (
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Rating</p>
                  <p className="text-xl font-bold font-mono" style={{ color: '#f59e0b' }}>{report.overall_rating}/10</p>
                </div>
              )}
            </div>
          )}

          {/* Economics */}
          {totalSpend > 0 && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Economics</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total spend</p>
                  <p className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>${totalSpend.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cost / oz</p>
                  <p className="text-lg font-bold font-mono" style={{ color: costPerOz ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {costPerOz ? `$${costPerOz.toFixed(2)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Cost / gram</p>
                  <p className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>
                    {costPerGram ? `$${costPerGram.toFixed(2)}` : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reflection */}
          {(report.what_worked || report.what_to_change) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {report.what_worked && (
                <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'rgba(82,183,136,0.3)' }}>
                  <p className="text-xs mb-1 font-medium" style={{ color: 'var(--accent)' }}>✓ What worked</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{report.what_worked}</p>
                </div>
              )}
              {report.what_to_change && (
                <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'rgba(244,162,97,0.3)' }}>
                  <p className="text-xs mb-1 font-medium" style={{ color: 'var(--warning)' }}>↻ What I'd change</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{report.what_to_change}</p>
                </div>
              )}
            </div>
          )}

          {report.aroma_notes && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Aroma</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{report.aroma_notes}</p>
            </div>
          )}
          {report.effect_notes && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Effects</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{report.effect_notes}</p>
            </div>
          )}
          {report.notes && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Notes</p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{report.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Edit / create form */}
      {!loading && editing && (
        <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {report ? 'Edit Harvest Report' : 'Log Harvest'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Harvest Date</Label>
              <input type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Overall Rating (1-10)</Label>
              <Input type="number" min="1" max="10" placeholder="8" value={overallRating}
                onChange={e => setOverallRating(e.target.value)} className="font-mono"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Wet Weight (g)</Label>
              <Input type="number" placeholder="500" value={wetWeight} onChange={e => setWetWeight(e.target.value)}
                className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Dry Weight (g)</Label>
              <Input type="number" placeholder="100" value={dryWeight} onChange={e => setDryWeight(e.target.value)}
                className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Trim / Larf Weight (g)</Label>
            <Input type="number" placeholder="20" value={trimWeight} onChange={e => setTrimWeight(e.target.value)}
              className="font-mono w-40" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>THC %</Label>
              <Input type="number" step="0.1" placeholder="22.5" value={thc} onChange={e => setThc(e.target.value)}
                className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>CBD %</Label>
              <Input type="number" step="0.1" placeholder="0.5" value={cbd} onChange={e => setCbd(e.target.value)}
                className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Cure Start</Label>
              <input type="date" value={cureStart} onChange={e => setCureStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Cure End</Label>
              <input type="date" value={cureEnd} onChange={e => setCureEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Aroma Notes</Label>
            <Input placeholder="Earthy, pine, citrus…" value={aromaNote} onChange={e => setAromaNotes(e.target.value)}
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Effect Notes</Label>
            <Input placeholder="Relaxing, uplifting, cerebral…" value={effectNote} onChange={e => setEffectNotes(e.target.value)}
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Would grow again?</Label>
            <div className="flex gap-2">
              {[true, false].map(v => (
                <button key={String(v)} type="button" onClick={() => setWouldGrowAgain(v === wouldGrowAgain ? null : v)}
                  className="px-4 py-1.5 rounded-lg text-sm border"
                  style={{
                    background:  wouldGrowAgain === v ? 'var(--accent-muted)' : 'transparent',
                    borderColor: wouldGrowAgain === v ? 'var(--accent)' : 'var(--border)',
                    color:       wouldGrowAgain === v ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--accent)' }}>✓ What worked</Label>
              <textarea rows={3} placeholder="Dialed VPD, the topping at day 21, this pheno…" value={whatWorked}
                onChange={e => setWhatWorked(e.target.value)}
                className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--warning)' }}>↻ What I'd change</Label>
              <textarea rows={3} placeholder="Less N in late veg, flip a week earlier…" value={whatToChange}
                onChange={e => setWhatToChange(e.target.value)}
                className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes</Label>
            <textarea rows={3} placeholder="General notes about this harvest…" value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="flex gap-2 justify-end">
            {report && (
              <Button variant="ghost" onClick={() => setEditing(false)} style={{ color: 'var(--text-muted)' }}>Cancel</Button>
            )}
            <Button onClick={submit} disabled={saving} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              <Check className="w-4 h-4 mr-1.5" />
              {saving ? 'Saving…' : report ? 'Update Report' : 'Save Harvest'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
