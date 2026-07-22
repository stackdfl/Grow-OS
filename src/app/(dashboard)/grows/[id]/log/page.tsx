'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns'
import {
  ChevronLeft, ChevronRight, Droplets, Zap, Scissors, Thermometer,
  Eye, Check, Mic, MicOff, Plus, Minus, X, Sparkles,
} from 'lucide-react'
import { PhotoUploader } from '@/components/grows/photo-uploader'
import type { Grow, Recipe } from '@/types/database'

// ── VPD ──────────────────────────────────────────────────────────────────────
function svp(tC: number) { return 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3)) }
function computeVpd(tempF: number, rh: number): number {
  const airC = (tempF - 32) * (5 / 9)
  const leafC = airC - 2 // leaf ~2°F below air
  const vpd = svp(leafC) - (rh / 100) * svp(airC)
  return Math.max(0, parseFloat(vpd.toFixed(2)))
}

const MOODS = [
  { key: 'thriving', label: 'Thriving', emoji: '🔥', color: '#52B788' },
  { key: 'healthy',  label: 'Healthy',  emoji: '🌿', color: '#52B788' },
  { key: 'meh',      label: 'Meh',      emoji: '😐', color: '#F4A261' },
  { key: 'issue',    label: 'Issue',    emoji: '⚠️', color: '#E76F51' },
]

const TRAINING_OPTIONS = [
  'Topped', 'FIM', 'LST', 'Defoliated', 'Lollipopped',
  'Supercropped', 'Transplanted', 'Flipped to flower', 'Flushed',
]

const DEFAULT_NUTES = ['Cal-Mag', 'Base A', 'Base B', 'Bloom', 'Silica', 'Microbes']
const UNITS = ['ml/gal', 'ml/L', 'g/gal', 'tsp/gal']

interface FeedProduct { name: string; amount: number; unit: string }

const STEPS = [
  { key: 'water',  label: 'Water',       icon: Droplets },
  { key: 'feed',   label: 'Feed',        icon: Zap },
  { key: 'train',  label: 'Training',    icon: Scissors },
  { key: 'env',    label: 'Environment', icon: Thermometer },
  { key: 'observe',label: 'Notes',       icon: Eye },
] as const

export default function DailyLogPage() {
  const { id: growId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [grow, setGrow] = useState<Grow | null>(null)
  const [userId, setUserId] = useState('')
  const [suggestedNutes, setSuggestedNutes] = useState<string[]>(DEFAULT_NUTES)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  // Water
  const [watered, setWatered] = useState(false)
  const [volume, setVolume] = useState(500)
  const [phIn, setPhIn] = useState(6.2)
  const [ecIn, setEcIn] = useState(1.2)
  const [showRunoff, setShowRunoff] = useState(false)
  const [runoffPh, setRunoffPh] = useState(6.0)
  const [runoffEc, setRunoffEc] = useState(1.5)

  // Feed
  const [fed, setFed] = useState(false)
  const [products, setProducts] = useState<FeedProduct[]>([])
  const [feedVolume, setFeedVolume] = useState(1000)
  const [feedPh, setFeedPh] = useState(6.0)
  const [feedEc, setFeedEc] = useState(1.8)

  // Training
  const [training, setTraining] = useState<string[]>([])

  // Environment
  const [envOn, setEnvOn] = useState(false)
  const [tempF, setTempF] = useState(76)
  const [rh, setRh] = useState(55)
  const vpd = useMemo(() => computeVpd(tempF, rh), [tempF, rh])

  // Observation
  const [mood, setMood] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => { load() }, [growId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: growData } = await supabase
      .from('grows').select('*, genetics(*)').eq('id', growId).single()
    const g = growData as Grow | null
    setGrow(g)

    // Prefill nutrient suggestions from the grow's recipe (current week)
    if (g?.recipe_id) {
      const { data: recipeData } = await supabase
        .from('recipes').select('feeding_schedule, veg_weeks').eq('id', g.recipe_id).single()
      const recipe = recipeData as Pick<Recipe, 'feeding_schedule' | 'veg_weeks'> | null
      if (recipe?.feeding_schedule?.length) {
        const wk = currentWeek(g, recipe.veg_weeks ?? 4)
        const match = recipe.feeding_schedule.find(f => f.week === wk)
          ?? recipe.feeding_schedule.reduce((a, b) => Math.abs(b.week - wk) < Math.abs(a.week - wk) ? b : a)
        const names = match?.products?.map(p => p.name) ?? []
        if (names.length) setSuggestedNutes(Array.from(new Set([...names, ...DEFAULT_NUTES])).slice(0, 8))
      }
    }
    setLoading(false)
  }

  const dayNumber = useMemo(() => {
    if (!grow) return null
    const start = grow.clone_date ?? grow.veg_start_date ?? grow.flip_date
    if (!start) return null
    return differenceInDays(startOfDay(new Date()), parseISO(start)) + 1
  }, [grow])

  function toggleProduct(name: string) {
    setProducts(prev => prev.some(p => p.name === name)
      ? prev.filter(p => p.name !== name)
      : [...prev, { name, amount: 5, unit: 'ml/gal' }])
  }
  function updateProduct(name: string, patch: Partial<FeedProduct>) {
    setProducts(prev => prev.map(p => p.name === name ? { ...p, ...patch } : p))
  }

  async function save() {
    setSaving(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const ops: PromiseLike<unknown>[] = []

    if (watered) {
      ops.push(supabase.from('watering_logs').insert([{
        grow_id: growId, user_id: userId, log_date: today,
        volume_per_plant_ml: volume, ph_in: phIn, ec_in: ecIn,
        runoff_ph: showRunoff ? runoffPh : null, runoff_ec: showRunoff ? runoffEc : null,
        additives: [], notes: null, source: 'manual',
      } as never]))
    }
    if (fed && products.length > 0) {
      ops.push(supabase.from('feeding_logs').insert([{
        grow_id: growId, user_id: userId, log_date: today,
        products, total_volume_ml: feedVolume, ph_in: feedPh, ec_in: feedEc, notes: null,
      } as never]))
    }
    if (envOn) {
      ops.push(supabase.from('env_readings').insert([{
        grow_id: growId, tent_id: null, user_id: userId,
        reading_time: new Date().toISOString(),
        temp_f: tempF, temp_c: parseFloat(((tempF - 32) * 5 / 9).toFixed(1)),
        rh_percent: rh, vpd_kpa: vpd, source: 'manual', raw_data: {},
      } as never]))
    }

    // Always create a journal entry tying it together
    ops.push(supabase.from('journal_entries').insert([{
      grow_id: growId, user_id: userId, entry_date: today,
      raw_notes: note.trim(),
      structured_data: {
        mood: mood || null,
        training,
        watered, fed,
        env: envOn ? { temp_f: tempF, rh_percent: rh, vpd_kpa: vpd } : null,
      },
      photos,
      watering_logged: watered,
      feeding_logged: fed,
      training_logged: training.length > 0,
    } as never]))

    await Promise.all(ops)
    fetch('/api/calibration/compute', { method: 'POST' }).catch(() => {})
    setSaving(false)
    setDone(true)
    setTimeout(() => router.push(`/grows/${growId}/journal`), 1700)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]" style={{ color: 'var(--text-muted)' }}>Loading…</div>
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 pipeline-pulse"
          style={{ background: 'var(--accent-muted)' }}>
          <Check className="w-10 h-10" style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>
          {dayNumber ? `Day ${dayNumber} logged` : 'Logged'} ✓
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nice work — keeping the record tight.</p>
      </div>
    )
  }

  const isLast = step === STEPS.length - 1
  const StepIcon = STEPS[step].icon

  return (
    <div className="px-4 md:px-6 py-5 max-w-lg mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push(`/grows/${growId}`)} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Log Today{dayNumber ? ` · Day ${dayNumber}` : ''}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {grow?.name} · {format(new Date(), 'EEE, MMM d')}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <button key={s.key} onClick={() => setStep(i)} className="flex-1 h-1.5 rounded-full transition-colors"
            style={{ background: i <= step ? 'var(--accent)' : 'var(--surface-raised)' }} />
        ))}
      </div>

      {/* Step heading */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
          <StepIcon className="w-4.5 h-4.5" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>{STEPS[step].label}</span>
      </div>

      {/* ── Step bodies ───────────────────────────────────────────────── */}
      {step === 0 && (
        <Card>
          <BigToggle on={watered} setOn={setWatered} onLabel="Watered today" offLabel="Did you water?" />
          {watered && (
            <div className="space-y-4 mt-4">
              <Stepper label="Volume / plant" value={volume} set={setVolume} step={50} unit="ml" min={0} />
              <div className="grid grid-cols-2 gap-3">
                <Stepper label="pH in" value={phIn} set={setPhIn} step={0.1} decimals={1} min={0} />
                <Stepper label="EC in" value={ecIn} set={setEcIn} step={0.1} decimals={1} min={0} />
              </div>
              {!showRunoff ? (
                <button onClick={() => setShowRunoff(true)} className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  <Plus className="w-3 h-3" /> Add runoff readings
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Stepper label="Runoff pH" value={runoffPh} set={setRunoffPh} step={0.1} decimals={1} min={0} />
                  <Stepper label="Runoff EC" value={runoffEc} set={setRunoffEc} step={0.1} decimals={1} min={0} />
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card>
          <BigToggle on={fed} setOn={setFed} onLabel="Fed today" offLabel="Feed today?" />
          {fed && (
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Tap what you used {grow?.recipe_id && <span style={{ color: 'var(--accent)' }}>· from your recipe</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedNutes.map(n => {
                    const active = products.some(p => p.name === n)
                    return (
                      <button key={n} onClick={() => toggleProduct(n)}
                        className="px-3 py-1.5 rounded-lg text-sm border transition-all"
                        style={{
                          background: active ? 'var(--accent-muted)' : 'transparent',
                          borderColor: active ? 'var(--accent)' : 'var(--border)',
                          color: active ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                        {n}
                      </button>
                    )
                  })}
                </div>
              </div>

              {products.length > 0 && (
                <div className="space-y-2">
                  {products.map(p => (
                    <div key={p.name} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--surface-raised)' }}>
                      <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{p.name}</span>
                      <input type="number" step="0.5" value={p.amount}
                        onChange={e => updateProduct(p.name, { amount: parseFloat(e.target.value) || 0 })}
                        className="w-16 px-2 py-1 rounded text-sm font-mono outline-none text-right"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                      <select value={p.unit} onChange={e => updateProduct(p.name, { unit: e.target.value })}
                        className="px-1.5 py-1 rounded text-xs outline-none"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button onClick={() => toggleProduct(p.name)}><X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Stepper label="Total vol" value={feedVolume} set={setFeedVolume} step={100} unit="ml" min={0} />
                <Stepper label="pH" value={feedPh} set={setFeedPh} step={0.1} decimals={1} min={0} />
                <Stepper label="EC" value={feedEc} set={setFeedEc} step={0.1} decimals={1} min={0} />
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Anything you did to the plants?</p>
          <div className="flex flex-wrap gap-2">
            {TRAINING_OPTIONS.map(t => {
              const active = training.includes(t)
              return (
                <button key={t} onClick={() => setTraining(p => active ? p.filter(x => x !== t) : [...p, t])}
                  className="px-3 py-2 rounded-lg text-sm border transition-all"
                  style={{
                    background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                    borderColor: active ? '#8b5cf6' : 'var(--border)',
                    color: active ? '#a78bfa' : 'var(--text-muted)',
                  }}>
                  {t}
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <BigToggle on={envOn} setOn={setEnvOn} onLabel="Recording conditions" offLabel="Log environment?" />
          {envOn && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <Stepper label="Temp" value={tempF} set={setTempF} step={1} unit="°F" />
                <Stepper label="Humidity" value={rh} set={setRh} step={1} unit="%" />
              </div>
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: 'var(--surface-raised)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>VPD (auto)</span>
                <span className="text-lg font-bold font-mono" style={{ color: vpdColor(vpd) }}>{vpd.toFixed(2)} kPa</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {step === 4 && (
        <Card>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>How's it looking?</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {MOODS.map(m => (
              <button key={m.key} onClick={() => setMood(mood === m.key ? '' : m.key)}
                className="flex flex-col items-center gap-1 py-3 rounded-xl border transition-all"
                style={{
                  background: mood === m.key ? `${m.color}22` : 'transparent',
                  borderColor: mood === m.key ? m.color : 'var(--border)',
                }}>
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px]" style={{ color: mood === m.key ? m.color : 'var(--text-muted)' }}>{m.label}</span>
              </button>
            ))}
          </div>

          <NoteField note={note} setNote={setNote} />

          <div className="mt-4">
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Photos</p>
            {userId && <PhotoUploader userId={userId} growId={growId} onUploaded={setPhotos} />}
          </div>
        </Card>
      )}

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', borderColor: 'var(--border)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ color: 'var(--text-muted)' }}>Back</button>
          )}
          <div className="flex-1" />
          {!isLast ? (
            <button onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              <Sparkles className="w-4 h-4" /> {saving ? 'Saving…' : 'Save day'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentWeek(g: Grow, vegWeeks: number): number {
  const today = startOfDay(new Date())
  if (g.flip_date && ['flower', 'flush'].includes(g.status)) {
    return vegWeeks + Math.floor(differenceInDays(today, parseISO(g.flip_date)) / 7) + 1
  }
  if (g.veg_start_date) {
    return Math.floor(differenceInDays(today, parseISO(g.veg_start_date)) / 7) + 1
  }
  return 1
}

function vpdColor(vpd: number): string {
  if (vpd < 0.4) return '#3b82f6'
  if (vpd <= 1.2) return '#52B788'
  if (vpd <= 1.5) return '#F4A261'
  return '#E76F51'
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}

function BigToggle({ on, setOn, onLabel, offLabel }: {
  on: boolean; setOn: (b: boolean) => void; onLabel: string; offLabel: string
}) {
  return (
    <button onClick={() => setOn(!on)}
      className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all"
      style={{
        background: on ? 'var(--accent-muted)' : 'var(--surface-raised)',
        borderColor: on ? 'var(--accent)' : 'var(--border)',
      }}>
      <span className="text-sm font-medium" style={{ color: on ? 'var(--accent)' : 'var(--text-secondary)' }}>
        {on ? onLabel : offLabel}
      </span>
      <div className="relative w-11 h-6 rounded-full transition-colors" style={{ background: on ? 'var(--accent)' : 'var(--border)' }}>
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
      </div>
    </button>
  )
}

function Stepper({ label, value, set, step, unit, decimals = 0, min }: {
  label: string; value: number; set: (n: number) => void; step: number
  unit?: string; decimals?: number; min?: number
}) {
  function bump(dir: number) {
    const next = parseFloat((value + dir * step).toFixed(2))
    set(min != null ? Math.max(min, next) : next)
  }
  return (
    <div>
      <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--surface-raised)' }}>
        <button onClick={() => bump(-1)} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
          <Minus className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-base font-bold font-mono" style={{ color: 'var(--text)' }}>{value.toFixed(decimals)}</span>
          {unit && <span className="text-xs ml-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
        </div>
        <button onClick={() => bump(1)} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function NoteField({ note, setNote }: { note: string; setNote: (s: string) => void }) {
  const [listening, setListening] = useState(false)
  const recogRef = useRef<{ stop: () => void } | null>(null)
  const supported = typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  function toggleVoice() {
    if (listening) { recogRef.current?.stop(); setListening(false); return }
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown })
      .webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition
    if (!SR) return
    const r = new (SR as new () => {
      lang: string; interimResults: boolean; continuous: boolean
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void
      onend: () => void; start: () => void; stop: () => void
    })()
    r.lang = 'en-US'; r.interimResults = false; r.continuous = true
    r.onresult = (e) => {
      let txt = ''
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript
      setNote(txt)
    }
    r.onend = () => setListening(false)
    recogRef.current = r
    r.start()
    setListening(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes</p>
        {supported && (
          <button onClick={toggleVoice} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md"
            style={{ background: listening ? 'rgba(231,111,81,0.15)' : 'var(--surface-raised)', color: listening ? 'var(--danger)' : 'var(--text-muted)' }}>
            {listening ? <><MicOff className="w-3 h-3" /> Stop</> : <><Mic className="w-3 h-3" /> Speak</>}
          </button>
        )}
      </div>
      <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
        placeholder="Observations, smells, concerns, what you changed…"
        className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
    </div>
  )
}
