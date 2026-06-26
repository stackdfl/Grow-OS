'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Save, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Recipe } from '@/types/database'

const STAGES    = ['clone', 'seedling', 'veg', 'early-flower', 'late-flower', 'flush'] as const
const MEDIUMS   = ['Living Soil', 'Coco Coir', 'Pro-Mix / Peat', 'DWC Hydro', 'NFT Hydro', 'Rockwool', 'Aeroponic', 'Other']
const ENVS      = ['Indoor', 'Outdoor', 'Greenhouse']
const DIFFS     = ['beginner', 'intermediate', 'advanced', 'expert'] as const
const PRESET_TAGS = ['indoor', 'outdoor', 'greenhouse', 'living-soil', 'coco', 'hydro', 'dwc', 'organic', 'autoflower', 'high-yield', 'beginner-friendly']

interface FeedRow  { week: number; stage: string; notes: string }
interface WaterRow { week: number; freqDays: number; volume: number; ph: number; ec: number; notes: string }
interface EnvRow   { week: number; stage: string; tempDay: number; tempNight: number; rh: number; lightHours: number }

function toFeedRows(schedule: Recipe['feeding_schedule']): FeedRow[] {
  if (!schedule?.length) return [{ week: 1, stage: 'veg', notes: '' }]
  return schedule.map(w => ({
    week: w.week,
    stage: w.stage,
    notes: w.products?.[0]?.notes ?? w.products?.[0]?.name ?? '',
  }))
}
function toWaterRows(schedule: Recipe['watering_schedule']): WaterRow[] {
  if (!schedule?.length) return [{ week: 1, freqDays: 2, volume: 0, ph: 6.2, ec: 0, notes: '' }]
  return schedule.map(w => ({
    week: w.week,
    freqDays: w.frequency_days,
    volume: w.volume_per_plant_ml ?? 0,
    ph: w.ph_target ?? 0,
    ec: w.ec_target ?? 0,
    notes: w.notes ?? '',
  }))
}
function toEnvRows(schedule: Recipe['env_schedule']): EnvRow[] {
  if (!schedule?.length) return [{ week: 1, stage: 'veg', tempDay: 78, tempNight: 68, rh: 60, lightHours: 18 }]
  return schedule.map(w => ({
    week: w.week,
    stage: w.stage,
    tempDay: w.temp_day_f ?? 0,
    tempNight: w.temp_night_f ?? 0,
    rh: w.rh_percent ?? 0,
    lightHours: w.light_hours ?? 0,
  }))
}

export function RecipeEditor({ recipe }: { recipe: Recipe }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [title, setTitle]         = useState(recipe.title)
  const [description, setDesc]    = useState(recipe.description ?? '')
  const [strainName, setStrain]   = useState(recipe.genetics?.strain ?? '')
  const [breeder, setBreeder]     = useState(recipe.genetics?.breeder ?? '')
  const [source, setSource]       = useState<'clone' | 'seed' | ''>(recipe.genetics?.source ?? '')
  const [medium, setMedium]       = useState(recipe.medium?.type ?? '')
  const [environment, setEnv]     = useState('')
  const [difficulty, setDiff]     = useState(recipe.difficulty ?? '')
  const [dryTempF, setDryTempF]   = useState(recipe.harvest_data?.dry_temp_f?.toString() ?? '')
  const [dryRhPct, setDryRhPct]   = useState(recipe.harvest_data?.dry_rh_percent?.toString() ?? '')
  const [cureDays, setCureDays]   = useState(recipe.harvest_data?.cure_duration_days?.toString() ?? '')
  const [vegWeeks, setVegWeeks]   = useState(recipe.veg_weeks ?? 4)
  const [flowerWeeks, setFlowerWeeks] = useState(recipe.flower_weeks ?? 9)
  const [yieldEst, setYieldEst]   = useState(recipe.estimated_yield_oz_per_plant?.toString() ?? '')
  const [feedRows, setFeedRows]   = useState<FeedRow[]>(toFeedRows(recipe.feeding_schedule))
  const [waterRows, setWaterRows] = useState<WaterRow[]>(toWaterRows(recipe.watering_schedule))
  const [envRows, setEnvRows]     = useState<EnvRow[]>(toEnvRows(recipe.env_schedule))
  const [successFactors, setSuccessFactors] = useState<string[]>(recipe.key_success_factors?.length ? recipe.key_success_factors : [''])
  const [failurePoints, setFailurePoints]   = useState<string[]>(recipe.common_failure_points?.length ? recipe.common_failure_points : [''])
  const [tags, setTags]           = useState<string[]>(recipe.tags ?? [])
  const [isPublic, setIsPublic]   = useState(recipe.is_public)

  function toggleTag(t: string) {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }
  function updateFeedRow(i: number, field: keyof FeedRow, val: string | number) {
    setFeedRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }
  function updateWaterRow(i: number, field: keyof WaterRow, val: string | number) {
    setWaterRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }
  function updateEnvRow(i: number, field: keyof EnvRow, val: string | number) {
    setEnvRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')

    const allTags = [...new Set([
      ...tags,
      ...(environment ? [environment.toLowerCase()] : []),
    ])]

    const feedingSchedule = feedRows.filter(r => r.notes.trim()).map(r => ({
      week: r.week, stage: r.stage,
      products: [{ name: r.notes, amount: 0, unit: '', frequency: '', notes: '' }],
    }))
    const wateringSchedule = waterRows.filter(r => r.freqDays > 0).map(r => ({
      week: r.week, frequency_days: r.freqDays,
      volume_per_plant_ml: r.volume || null,
      ph_target: r.ph || null, ec_target: r.ec || null, notes: r.notes || null,
    }))
    const envSchedule = envRows.filter(r => r.tempDay > 0).map(r => ({
      week: r.week, stage: r.stage,
      temp_day_f: r.tempDay || null, temp_night_f: r.tempNight || null,
      rh_percent: r.rh || null, light_hours: r.lightHours || null,
    }))

    const supabase = createClient()
    const { error: err } = await supabase
      .from('recipes')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        genetics: { strain: strainName.trim() || undefined, breeder: breeder.trim() || undefined, source: source || undefined },
        harvest_data: {
          ...(recipe.harvest_data ?? {}),
          dry_temp_f: dryTempF ? parseFloat(dryTempF) : undefined,
          dry_rh_percent: dryRhPct ? parseFloat(dryRhPct) : undefined,
          cure_duration_days: cureDays ? parseInt(cureDays) : undefined,
        },
        medium: { type: medium || undefined },
        difficulty: difficulty || null,
        veg_weeks: vegWeeks,
        flower_weeks: flowerWeeks,
        total_weeks: vegWeeks + flowerWeeks,
        estimated_yield_oz_per_plant: yieldEst ? parseFloat(yieldEst) : null,
        feeding_schedule: feedingSchedule,
        watering_schedule: wateringSchedule,
        env_schedule: envSchedule,
        key_success_factors: successFactors.filter(Boolean),
        common_failure_points: failurePoints.filter(Boolean),
        tags: allTags,
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', recipe.id)

    setSaving(false)
    if (err) { setError(err.message); return }
    router.push(`/recipes/${recipe.id}`)
  }

  const inputStyle = { background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }
  const labelCls  = 'text-xs font-medium block mb-1.5'
  const labelStyle = { color: 'var(--text-secondary)' }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h1 className="text-base font-semibold">Edit Recipe</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Form — single scrollable page for easy editing */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-8">
        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(231,111,81,0.1)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {/* Basics */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Basics</h2>
          <div className="space-y-1.5">
            <label className={labelCls} style={labelStyle}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls} style={labelStyle}>Description</label>
            <textarea rows={3} value={description} onChange={e => setDesc(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none" style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Strain</label>
              <input value={strainName} onChange={e => setStrain(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Breeder</label>
              <input value={breeder} onChange={e => setBreeder(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls} style={labelStyle}>Propagation source</label>
            <div className="flex gap-2">
              {(['clone', 'seed', ''] as const).map(s => (
                <button key={s} type="button" onClick={() => setSource(s)}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize"
                  style={{
                    background: source === s ? 'var(--accent-muted)' : 'var(--surface-raised)',
                    borderColor: source === s ? 'var(--accent)' : 'var(--border)',
                    color: source === s ? 'var(--accent)' : 'var(--text-secondary)',
                  }}>
                  {s === '' ? 'Not specified' : s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Medium</label>
              <select value={medium} onChange={e => setMedium(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle}>
                <option value="">Select…</option>
                {MEDIUMS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Difficulty</label>
              <select value={difficulty} onChange={e => setDiff(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none capitalize" style={inputStyle}>
                <option value="">Select…</option>
                {DIFFS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Veg weeks', value: vegWeeks, setter: setVegWeeks },
              { label: 'Flower weeks', value: flowerWeeks, setter: setFlowerWeeks },
            ].map(({ label, value, setter }) => (
              <div key={label} className="space-y-1.5">
                <label className={labelCls} style={labelStyle}>{label}</label>
                <input type="number" min={1} value={value} onChange={e => setter(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono" style={inputStyle} />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Est. yield (oz/plant)</label>
              <input type="number" step="0.5" value={yieldEst} onChange={e => setYieldEst(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono" style={inputStyle} />
            </div>
          </div>
        </section>

        {/* Feeding */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Feeding Schedule</h2>
            <button type="button" onClick={() => setFeedRows(prev => [...prev, { week: prev.length + 1, stage: 'veg', notes: '' }])}
              className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
              <Plus className="w-3 h-3" /> Add week
            </button>
          </div>
          {feedRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="number" value={row.week} onChange={e => updateFeedRow(i, 'week', parseInt(e.target.value) || 1)}
                className="w-12 px-2 py-1.5 rounded-lg text-xs border outline-none font-mono text-center" style={inputStyle} title="Week" />
              <select value={row.stage} onChange={e => updateFeedRow(i, 'stage', e.target.value)}
                className="w-28 px-2 py-1.5 rounded-lg text-xs border outline-none" style={inputStyle}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={row.notes} onChange={e => updateFeedRow(i, 'notes', e.target.value)}
                placeholder="Products + rates" className="flex-1 px-2 py-1.5 rounded-lg text-xs border outline-none" style={inputStyle} />
              <button type="button" onClick={() => setFeedRows(prev => prev.filter((_, j) => j !== i))}>
                <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          ))}
        </section>

        {/* Watering */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Watering Schedule</h2>
            <button type="button" onClick={() => setWaterRows(prev => [...prev, { week: prev.length + 1, freqDays: 2, volume: 0, ph: 6.2, ec: 0, notes: '' }])}
              className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
              <Plus className="w-3 h-3" /> Add week
            </button>
          </div>
          <div className="text-[9px] grid grid-cols-6 gap-2 px-1" style={{ color: 'var(--text-muted)' }}>
            <span>Wk</span><span>Every (d)</span><span>mL/plant</span><span>pH</span><span>EC</span><span>Notes</span>
          </div>
          {waterRows.map((row, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-center">
              {(['week','freqDays','volume','ph','ec'] as (keyof WaterRow)[]).map(f => (
                <input key={f} type="number" step={f === 'ph' ? '0.1' : '1'}
                  value={(row[f] as number) || ''}
                  onChange={e => updateWaterRow(i, f, parseFloat(e.target.value) || 0)}
                  className="px-2 py-1.5 rounded-lg text-xs border outline-none font-mono" style={inputStyle} />
              ))}
              <div className="flex gap-1">
                <input value={row.notes} onChange={e => updateWaterRow(i, 'notes', e.target.value)}
                  placeholder="Notes" className="flex-1 px-2 py-1.5 rounded-lg text-xs border outline-none" style={inputStyle} />
                <button type="button" onClick={() => setWaterRows(prev => prev.filter((_, j) => j !== i))}>
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Environment */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Environment Targets</h2>
            <button type="button" onClick={() => setEnvRows(prev => [...prev, { week: prev.length + 1, stage: 'veg', tempDay: 78, tempNight: 68, rh: 60, lightHours: 18 }])}
              className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
              <Plus className="w-3 h-3" /> Add week
            </button>
          </div>
          {envRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <input type="number" value={row.week} onChange={e => updateEnvRow(i, 'week', parseInt(e.target.value) || 1)}
                className="w-10 px-2 py-1.5 rounded-lg text-xs border outline-none font-mono text-center" style={inputStyle} title="Wk" />
              <select value={row.stage} onChange={e => updateEnvRow(i, 'stage', e.target.value)}
                className="w-28 px-2 py-1.5 rounded-lg text-xs border outline-none" style={inputStyle}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {([
                { f: 'tempDay' as keyof EnvRow, ph: 'Day°F' },
                { f: 'tempNight' as keyof EnvRow, ph: 'Night°F' },
                { f: 'rh' as keyof EnvRow, ph: 'RH%' },
                { f: 'lightHours' as keyof EnvRow, ph: 'Hrs' },
              ]).map(({ f, ph }) => (
                <input key={f} type="number" placeholder={ph} title={ph}
                  value={(row[f] as number) || ''}
                  onChange={e => updateEnvRow(i, f, parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 rounded-lg text-xs border outline-none font-mono" style={inputStyle} />
              ))}
              <button type="button" onClick={() => setEnvRows(prev => prev.filter((_, j) => j !== i))}>
                <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          ))}
        </section>

        {/* Tips */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tips & Results</h2>
          {[
            { label: 'Key success factors', color: 'var(--accent)', items: successFactors, setItems: setSuccessFactors, placeholder: 'e.g. Dial in VPD early in flower' },
            { label: 'Common failure points', color: 'var(--danger)', items: failurePoints, setItems: setFailurePoints, placeholder: 'e.g. Overwatering in week 2' },
          ].map(({ label, color, items, setItems, placeholder }) => (
            <div key={label}>
              <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color }}>{label}</label>
              <div className="space-y-1.5">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                    <input value={item} onChange={e => { const n = [...items]; n[i] = e.target.value; setItems(n) }}
                      placeholder={placeholder} className="flex-1 px-3 py-1.5 rounded-lg text-sm border outline-none" style={inputStyle} />
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                        <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setItems([...items, ''])} className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'var(--accent)' }}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Drying & Cure */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Drying & Cure</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Dry temp (°F)</label>
              <input type="number" step="1" placeholder="60" value={dryTempF} onChange={e => setDryTempF(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Dry RH (%)</label>
              <input type="number" step="1" placeholder="60" value={dryRhPct} onChange={e => setDryRhPct(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} style={labelStyle}>Cure (days)</label>
              <input type="number" step="1" placeholder="30" value={cureDays} onChange={e => setCureDays(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono" style={inputStyle} />
            </div>
          </div>
        </section>

        {/* Tags + publish */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tags & Visibility</h2>
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map(t => (
              <button key={t} type="button" onClick={() => toggleTag(t)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  background: tags.includes(t) ? 'var(--accent-muted)' : 'var(--surface-raised)',
                  borderColor: tags.includes(t) ? 'var(--accent)' : 'var(--border)',
                  color: tags.includes(t) ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Publish publicly</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {isPublic ? 'Visible in the community marketplace' : 'Only visible to you'}
              </p>
            </div>
            <button type="button" onClick={() => setIsPublic(p => !p)}
              className="w-11 h-6 rounded-full transition-colors relative"
              style={{ background: isPublic ? 'var(--accent)' : 'var(--surface)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                style={{ background: '#fff', left: isPublic ? 'calc(100% - 22px)' : '2px' }} />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
