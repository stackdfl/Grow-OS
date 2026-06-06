'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronRight, ChevronLeft, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeedRow  { week: number; stage: string; notes: string }
interface WaterRow { week: number; freqDays: number; volume: number; ph: number; ec: number; notes: string }
interface EnvRow   { week: number; stage: string; tempDay: number; tempNight: number; rh: number; lightHours: number }

const STAGES    = ['clone', 'seedling', 'veg', 'early-flower', 'late-flower', 'flush'] as const
const MEDIUMS   = ['Living Soil', 'Coco Coir', 'Pro-Mix / Peat', 'DWC Hydro', 'NFT Hydro', 'Rockwool', 'Aeroponic', 'Other']
const ENVS      = ['Indoor', 'Outdoor', 'Greenhouse']
const DIFFS     = ['beginner', 'intermediate', 'advanced', 'expert'] as const
const PRESET_TAGS = ['indoor', 'outdoor', 'greenhouse', 'living-soil', 'coco', 'hydro', 'dwc', 'organic', 'autoflower', 'high-yield', 'beginner-friendly']

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewRecipePage() {
  const router = useRouter()
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Step 1: Basics
  const [title, setTitle]         = useState('')
  const [description, setDesc]    = useState('')
  const [strainName, setStrain]   = useState('')
  const [breeder, setBreeder]     = useState('')
  const [medium, setMedium]       = useState('')
  const [environment, setEnv]     = useState('')
  const [difficulty, setDiff]     = useState('')

  // Step 2: Timeline
  const [vegWeeks, setVegWeeks]       = useState(4)
  const [flowerWeeks, setFlowerWeeks] = useState(9)
  const [yieldEst, setYieldEst]       = useState('')

  // Schedule tables
  const [feedRows, setFeedRows]   = useState<FeedRow[]>([
    { week: 1, stage: 'clone', notes: '' },
    { week: 2, stage: 'veg',   notes: '' },
  ])
  const [waterRows, setWaterRows] = useState<WaterRow[]>([
    { week: 1, freqDays: 2, volume: 0, ph: 6.2, ec: 0, notes: '' },
  ])
  const [envRows, setEnvRows]     = useState<EnvRow[]>([
    { week: 1, stage: 'veg', tempDay: 78, tempNight: 68, rh: 65, lightHours: 18 },
    { week: Math.ceil(vegWeeks) + 1, stage: 'early-flower', tempDay: 80, tempNight: 70, rh: 55, lightHours: 12 },
  ])

  // Step 3: Tips
  const [successFactors, setSuccessFactors] = useState<string[]>([''])
  const [failurePoints,  setFailurePoints]  = useState<string[]>([''])

  // Step 4: Publish
  const [tags, setTags]         = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(false)

  // ─── Helpers ──────────────────────────────────────────────────────────────
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

  // ─── Save ─────────────────────────────────────────────────────────────────
  async function handleSave(publish: boolean) {
    if (!title.trim()) { setError('Title is required'); setStep(1); return }
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Auto-add environment + medium to tags
    const allTags = [...new Set([
      ...tags,
      environment.toLowerCase(),
      medium.toLowerCase().replace(/ \/ /g, '-').replace(/ /g, '-').replace(/\//g, '-'),
    ].filter(Boolean))]

    const feedingSchedule = feedRows
      .filter(r => r.notes.trim())
      .map(r => ({
        week: r.week,
        stage: r.stage,
        products: [{ name: r.notes, amount: 0, unit: '', frequency: '', notes: '' }],
      }))

    const wateringSchedule = waterRows
      .filter(r => r.freqDays > 0)
      .map(r => ({
        week: r.week,
        frequency_days: r.freqDays,
        volume_per_plant_ml: r.volume || null,
        ph_target: r.ph || null,
        ec_target: r.ec || null,
        notes: r.notes || null,
      }))

    const envSchedule = envRows
      .filter(r => r.tempDay > 0)
      .map(r => ({
        week: r.week,
        stage: r.stage,
        temp_day_f: r.tempDay || null,
        temp_night_f: r.tempNight || null,
        rh_percent: r.rh || null,
        light_hours: r.lightHours || null,
      }))

    const { data, error: err } = await supabase
      .from('recipes')
      .insert({
        author_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        genetics: {
          strain: strainName.trim() || undefined,
          breeder: breeder.trim() || undefined,
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
        training_schedule: [],
        amendment_schedule: [],
        key_success_factors: successFactors.filter(Boolean),
        common_failure_points: failurePoints.filter(Boolean),
        tags: allTags,
        is_public: publish,
        version: '1.0',
      } as never)
      .select('id')
      .single()

    setSaving(false)
    if (err) { setError(err.message); return }
    router.push(`/recipes/${(data as { id: string }).id}`)
  }

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle = {
    background: 'var(--surface-raised)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  }
  const labelStyle = { color: 'var(--text-secondary)' }

  function Input({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={labelStyle}>{label}</label>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
          style={inputStyle}
        />
      </div>
    )
  }

  function NumInput({ label, value, onChange, min = 0, max = 99, step = 1 }: {
    label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
  }) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-medium" style={labelStyle}>{label}</label>
        <input
          type="number"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
          style={inputStyle}
        />
      </div>
    )
  }

  // ─── Step content ─────────────────────────────────────────────────────────
  function Step1() {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Basics</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>What is this recipe and who is it for?</p>
        </div>

        <Input label="Recipe title *" value={title} onChange={setTitle} placeholder="e.g. Blue Dream — 9-Week Living Soil Run" />

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={labelStyle}>Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder="What makes this recipe unique? Any context growers should know."
            className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Strain" value={strainName} onChange={setStrain} placeholder="Blue Dream" />
          <Input label="Breeder" value={breeder} onChange={setBreeder} placeholder="Barneys Farm" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={labelStyle}>Growing medium</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MEDIUMS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMedium(m)}
                className="px-2 py-2 rounded-lg border text-xs font-medium text-left transition-all"
                style={{
                  background: medium === m ? 'var(--accent-muted)' : 'var(--surface-raised)',
                  borderColor: medium === m ? 'var(--accent)' : 'var(--border)',
                  color: medium === m ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={labelStyle}>Environment</label>
            <div className="flex gap-2">
              {ENVS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEnv(e)}
                  className="flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all"
                  style={{
                    background: environment === e ? 'var(--accent-muted)' : 'var(--surface-raised)',
                    borderColor: environment === e ? 'var(--accent)' : 'var(--border)',
                    color: environment === e ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={labelStyle}>Difficulty</label>
            <div className="flex gap-2">
              {DIFFS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiff(d)}
                  className="flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all capitalize"
                  style={{
                    background: difficulty === d ? 'var(--accent-muted)' : 'var(--surface-raised)',
                    borderColor: difficulty === d ? 'var(--accent)' : 'var(--border)',
                    color: difficulty === d ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {d[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function Step2() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Schedule</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Week-by-week feeding, watering, and environment targets.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <NumInput label="Veg weeks" value={vegWeeks} onChange={setVegWeeks} min={1} max={16} />
          <NumInput label="Flower weeks" value={flowerWeeks} onChange={setFlowerWeeks} min={6} max={20} />
          <Input label="Est. yield (oz/plant)" value={yieldEst} onChange={setYieldEst} placeholder="2.5" type="number" />
        </div>

        {/* Feeding schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Feeding schedule
            </label>
            <button
              type="button"
              onClick={() => setFeedRows(prev => [...prev, { week: prev.length + 1, stage: 'veg', notes: '' }])}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--accent)' }}
            >
              <Plus className="w-3 h-3" /> Add week
            </button>
          </div>
          <div className="space-y-1.5">
            {feedRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  value={row.week}
                  onChange={e => updateFeedRow(i, 'week', parseInt(e.target.value) || 1)}
                  className="w-12 px-2 py-1.5 rounded-lg text-xs border outline-none font-mono text-center"
                  style={inputStyle}
                  title="Week"
                />
                <select
                  value={row.stage}
                  onChange={e => updateFeedRow(i, 'stage', e.target.value)}
                  className="w-28 px-2 py-1.5 rounded-lg text-xs border outline-none"
                  style={inputStyle}
                >
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  value={row.notes}
                  onChange={e => updateFeedRow(i, 'notes', e.target.value)}
                  placeholder="Products + rates, e.g. Bio-thrive 2mL/gal"
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs border outline-none"
                  style={inputStyle}
                />
                <button type="button" onClick={() => setFeedRows(prev => prev.filter((_, j) => j !== i))}>
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Watering schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Watering schedule
            </label>
            <button
              type="button"
              onClick={() => setWaterRows(prev => [...prev, { week: prev.length + 1, freqDays: 2, volume: 0, ph: 6.2, ec: 0, notes: '' }])}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--accent)' }}
            >
              <Plus className="w-3 h-3" /> Add week
            </button>
          </div>
          <div className="text-[9px] mb-1.5 grid grid-cols-6 gap-2 px-1" style={{ color: 'var(--text-muted)' }}>
            <span>Week</span><span>Every (days)</span><span>mL/plant</span><span>pH</span><span>EC</span><span>Notes</span>
          </div>
          <div className="space-y-1.5">
            {waterRows.map((row, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 items-center">
                {(['week','freqDays','volume','ph','ec'] as (keyof WaterRow)[]).map(field => (
                  <input
                    key={field}
                    type="number"
                    step={field === 'ph' ? '0.1' : '1'}
                    value={(row[field] as number) || ''}
                    onChange={e => updateWaterRow(i, field, parseFloat(e.target.value) || 0)}
                    className="px-2 py-1.5 rounded-lg text-xs border outline-none font-mono"
                    style={inputStyle}
                  />
                ))}
                <div className="flex gap-1">
                  <input
                    value={row.notes}
                    onChange={e => updateWaterRow(i, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs border outline-none"
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => setWaterRows(prev => prev.filter((_, j) => j !== i))}>
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Environment schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Environment targets
            </label>
            <button
              type="button"
              onClick={() => setEnvRows(prev => [...prev, { week: prev.length + 1, stage: 'veg', tempDay: 78, tempNight: 68, rh: 60, lightHours: 18 }])}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--accent)' }}
            >
              <Plus className="w-3 h-3" /> Add week
            </button>
          </div>
          <div className="space-y-1.5">
            {envRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <input type="number" value={row.week} onChange={e => updateEnvRow(i, 'week', parseInt(e.target.value) || 1)}
                  className="w-10 px-2 py-1.5 rounded-lg text-xs border outline-none font-mono text-center" style={inputStyle} title="Week" />
                <select value={row.stage} onChange={e => updateEnvRow(i, 'stage', e.target.value)}
                  className="w-28 px-2 py-1.5 rounded-lg text-xs border outline-none" style={inputStyle}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {([
                  { field: 'tempDay' as keyof EnvRow, ph: 'Day°F' },
                  { field: 'tempNight' as keyof EnvRow, ph: 'Night°F' },
                  { field: 'rh' as keyof EnvRow, ph: 'RH%' },
                  { field: 'lightHours' as keyof EnvRow, ph: 'Hrs' },
                ]).map(({ field, ph }) => (
                  <input key={field} type="number" placeholder={ph} title={ph}
                    value={(row[field] as number) || ''}
                    onChange={e => updateEnvRow(i, field, parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1.5 rounded-lg text-xs border outline-none font-mono" style={inputStyle} />
                ))}
                <button type="button" onClick={() => setEnvRows(prev => prev.filter((_, j) => j !== i))}>
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function Step3() {
    function BulletList({ items, onChange, placeholder }: {
      items: string[]
      onChange: (items: string[]) => void
      placeholder: string
    }) {
      return (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
              <input
                value={item}
                onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n) }}
                placeholder={placeholder}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm border outline-none"
                style={inputStyle}
              />
              {items.length > 1 && (
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...items, ''])}
            className="flex items-center gap-1.5 text-xs mt-1"
            style={{ color: 'var(--accent)' }}
          >
            <Plus className="w-3 h-3" /> Add point
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Tips & Results</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Help growers replicate your results.</p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-3 block" style={{ color: 'var(--accent)' }}>
            Key success factors
          </label>
          <BulletList
            items={successFactors}
            onChange={setSuccessFactors}
            placeholder="e.g. Dial in VPD early in flower"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-3 block" style={{ color: 'var(--danger)' }}>
            Common failure points
          </label>
          <BulletList
            items={failurePoints}
            onChange={setFailurePoints}
            placeholder="e.g. Overwatering in week 2"
          />
        </div>
      </div>
    )
  }

  function Step4() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Publish</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Add tags and choose who can see this recipe.</p>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  background: tags.includes(t) ? 'var(--accent-muted)' : 'var(--surface-raised)',
                  borderColor: tags.includes(t) ? 'var(--accent)' : 'var(--border)',
                  color: tags.includes(t) ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Summary card */}
        <div
          className="rounded-xl border p-4 space-y-2 text-sm"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--text)' }}>{title || 'Untitled Recipe'}</p>
          {strainName && <p style={{ color: 'var(--text-secondary)' }}>{strainName}{breeder ? ` · ${breeder}` : ''}</p>}
          <p style={{ color: 'var(--text-muted)' }}>
            {medium || 'No medium'} · {vegWeeks}V + {flowerWeeks}F weeks · {difficulty || 'No difficulty set'}
          </p>
        </div>

        {/* Privacy toggle */}
        <div
          className="flex items-center justify-between p-4 rounded-xl border"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Publish publicly</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {isPublic ? 'Visible in the community marketplace' : 'Only visible to you'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic(p => !p)}
            className="w-11 h-6 rounded-full transition-colors relative"
            style={{ background: isPublic ? 'var(--accent)' : 'var(--surface)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
              style={{
                background: '#fff',
                left: isPublic ? 'calc(100% - 22px)' : '2px',
              }}
            />
          </button>
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(231,111,81,0.1)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            {saving ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            {saving ? 'Publishing…' : 'Publish recipe'}
          </button>
        </div>
      </div>
    )
  }

  const STEPS = ['Basics', 'Schedule', 'Tips', 'Publish']

  return (
    <div className="flex flex-col h-full min-h-0" style={{ color: 'var(--text)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <FlaskConical className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <div className="flex-1">
          <h1 className="text-base font-semibold">New Recipe</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Step {step} of {STEPS.length} — {STEPS[step - 1]}
          </p>
        </div>

        {/* Step indicators */}
        <div className="hidden sm:flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i + 1)}
              className="w-6 h-6 rounded-full text-[10px] font-bold transition-all"
              style={{
                background: i + 1 === step ? 'var(--accent)' : i + 1 < step ? 'var(--accent-muted)' : 'var(--surface-raised)',
                color: i + 1 === step ? '#0a0f0d' : i + 1 < step ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </div>

      {/* Nav */}
      {step < 4 && (
        <div
          className="flex items-center justify-between px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : router.back()}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={() => setStep(s => Math.min(s + 1, 4))}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
