'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { differenceInDays, parseISO } from 'date-fns'
import { Sliders, Fan, Lightbulb, Droplets, Wind, X, Minus, Plus, Zap } from 'lucide-react'
import type { EnvReading, TentSchedule, DeviceState } from '@/types/database'

// ── Stage target bands ────────────────────────────────────────────────────────
type Band = { min: number; max: number }
interface Targets { vpd: Band; temp: Band; rh: Band }

function targetsForStage(status: string | undefined): Targets {
  if (status && ['flower', 'flush', 'harvest'].includes(status))
    return { vpd: { min: 1.0, max: 1.5 }, temp: { min: 65, max: 80 }, rh: { min: 40, max: 55 } }
  if (status && ['seedling', 'clone'].includes(status))
    return { vpd: { min: 0.4, max: 0.8 }, temp: { min: 72, max: 82 }, rh: { min: 65, max: 80 } }
  return { vpd: { min: 0.8, max: 1.2 }, temp: { min: 68, max: 82 }, rh: { min: 55, max: 70 } } // veg
}

function bandColor(v: number | null, b: Band): string {
  if (v == null) return '#4a7a58'
  if (v >= b.min && v <= b.max) return '#52B788'
  const margin = (b.max - b.min) * 0.25
  if (v >= b.min - margin && v <= b.max + margin) return '#F4A261'
  return '#E76F51'
}
function bandLabel(v: number | null, b: Band): string {
  if (v == null) return 'No data'
  if (v < b.min) return 'Low'
  if (v > b.max) return 'High'
  return 'On target'
}

function lightStatus(s: TentSchedule | null): 'ON' | 'OFF' | 'RAMPING' | null {
  if (!s) return null
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [onH, onM] = s.lights_on.split(':').map(Number)
  const [offH, offM] = s.lights_off.split(':').map(Number)
  const onMin = onH * 60 + onM, offMin = offH * 60 + offM
  let inWin: boolean, since: number, until: number
  if (onMin < offMin) { inWin = nowMin >= onMin && nowMin < offMin; since = nowMin - onMin; until = offMin - nowMin }
  else { inWin = nowMin >= onMin || nowMin < offMin; since = nowMin >= onMin ? nowMin - onMin : 1440 - onMin + nowMin; until = nowMin < offMin ? offMin - nowMin : 1440 - nowMin + offMin }
  if (!inWin) return 'OFF'
  if (since < (s.sunrise_minutes ?? 0) || until < (s.sunset_minutes ?? 0)) return 'RAMPING'
  return 'ON'
}

interface TentLite { id: string; name: string; last_seen: string | null; grow: { name: string; status: string; flip_date: string | null; harvest_date: string | null } | null }

export default function DisplayPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [tents, setTents] = useState<TentLite[]>([])
  const [tent, setTent] = useState<TentLite | null>(null)
  const [reading, setReading] = useState<EnvReading | null>(null)
  const [history, setHistory] = useState<EnvReading[]>([])
  const [schedule, setSchedule] = useState<TentSchedule | null>(null)
  const [devices, setDevices] = useState<DeviceState | null>(null)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [ambient, setAmbient] = useState(false)
  const [autoRotate, setAutoRotate] = useState(false)
  const [loading, setLoading] = useState(true)

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const [tentsRes, tentRes, readRes, histRes, schedRes, devRes] = await Promise.all([
      supabase.from('tents').select('id, name, last_seen, grow:grows(name, status, flip_date, harvest_date)').eq('user_id', user.id).order('created_at'),
      supabase.from('tents').select('id, name, last_seen, grow:grows(name, status, flip_date, harvest_date)').eq('id', id).single(),
      supabase.from('env_readings').select('*').eq('tent_id', id).order('reading_time', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('env_readings').select('temp_f, rh_percent, vpd_kpa, reading_time').eq('tent_id', id).gte('reading_time', since).order('reading_time', { ascending: true }),
      supabase.from('tent_schedules').select('*').eq('tent_id', id).maybeSingle(),
      supabase.from('device_states').select('*').eq('tent_id', id).maybeSingle(),
    ])
    setTents((tentsRes.data ?? []) as unknown as TentLite[])
    setTent((tentRes.data ?? null) as unknown as TentLite | null)
    setReading(readRes.data as EnvReading | null)
    setHistory((histRes.data ?? []) as EnvReading[])
    setSchedule(schedRes.data as TentSchedule | null)
    setDevices(devRes.data as DeviceState | null)
    setLoading(false)
  }, [id])

  async function patchDevices(patch: Partial<DeviceState>) {
    setDevices(prev => prev ? { ...prev, ...patch } : prev)
    try {
      const res = await fetch(`/api/tents/${id}/devices`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (res.ok) setDevices(await res.json() as DeviceState)
    } catch { /* keep optimistic */ }
  }

  useEffect(() => { load() }, [load])

  // Clock + periodic refetch of latest reading
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000 * 20)
    const poll = setInterval(load, 1000 * 30)
    return () => { clearInterval(clock); clearInterval(poll) }
  }, [load])

  // Realtime new readings
  useEffect(() => {
    const ch = supabase.channel(`disp-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'env_readings', filter: `tent_id=eq.${id}` },
        (payload) => setReading(payload.new as EnvReading))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  // Idle → ambient mode
  const resetIdle = useCallback(() => {
    setAmbient(false)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setAmbient(true), 35000)
  }, [])
  useEffect(() => {
    resetIdle()
    const evs = ['pointerdown', 'keydown', 'mousemove']
    evs.forEach(e => window.addEventListener(e, resetIdle))
    return () => evs.forEach(e => window.removeEventListener(e, resetIdle))
  }, [resetIdle])

  // Auto-rotate between tents
  useEffect(() => {
    if (!autoRotate || tents.length < 2) return
    const t = setTimeout(() => {
      const i = tents.findIndex(x => x.id === id)
      const next = tents[(i + 1) % tents.length]
      router.replace(`/display/${next.id}`)
    }, 15000)
    return () => clearTimeout(t)
  }, [autoRotate, tents, id, router])

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#000', color: '#52B788' }}>…</div>
  }
  if (!tent) {
    return <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#000', color: '#888' }}>Tent not found</div>
  }

  const targets = targetsForStage(tent.grow?.status)
  const online = tent.last_seen ? Date.now() - new Date(tent.last_seen).getTime() < 90000 : false
  const ls = lightStatus(schedule)

  // Grow day + harvest
  let dayLabel: string | null = null
  if (tent.grow?.flip_date && ['flower', 'flush'].includes(tent.grow.status)) {
    const d = differenceInDays(new Date(), parseISO(tent.grow.flip_date))
    dayLabel = `Flower Day ${d} · Week ${Math.floor(d / 7) + 1}`
  }
  let harvestIn: number | null = null
  if (tent.grow?.harvest_date) harvestIn = differenceInDays(parseISO(tent.grow.harvest_date), new Date())

  const temp = reading?.temp_f ?? null
  const rh = reading?.rh_percent ?? null
  const vpd = reading?.vpd_kpa ?? null

  return (
    <div className="fixed inset-0 overflow-hidden select-none transition-opacity duration-1000"
      style={{ background: '#000', opacity: ambient ? 0.55 : 1, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      onClick={resetIdle}>

      {/* Ambient glow backdrop */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(circle at 50% 30%, ${bandColor(vpd, targets.vpd)}14, transparent 60%)`,
      }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-10">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: online ? '#52B788' : '#4a4a4a', boxShadow: online ? '0 0 10px #52B788' : 'none' }} />
          <span className="text-lg font-bold tracking-wide" style={{ color: '#e8f5e9' }}>{tent.name}</span>
          {!online && <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#2a1a1a', color: '#E76F51' }}>OFFLINE</span>}
        </div>
        <div className="flex items-center gap-4">
          {devices && (
            <button onClick={() => setControlsOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#e8f5e9' }}>
              <Sliders className="w-4 h-4" />
              <span className="text-sm font-medium">Controls</span>
              {devices.auto_mode && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(82,183,136,0.2)', color: '#52B788' }}>AUTO</span>
              )}
            </button>
          )}
          <div className="text-2xl font-bold tabular-nums" style={{ color: '#e8f5e9' }}>
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Main gauges */}
      <div className="absolute inset-0 flex items-center justify-center gap-4 md:gap-12 px-4">
        <Gauge label="TEMP" value={temp} unit="°F" min={50} max={95} decimals={0}
          color={bandColor(temp, targets.temp)} status={bandLabel(temp, targets.temp)} band={targets.temp} />
        <Gauge label="VPD" value={vpd} unit="kPa" min={0} max={2} decimals={2} big
          color={bandColor(vpd, targets.vpd)} status={bandLabel(vpd, targets.vpd)} band={targets.vpd} />
        <Gauge label="RH" value={rh} unit="%" min={0} max={100} decimals={0}
          color={bandColor(rh, targets.rh)} status={bandLabel(rh, targets.rh)} band={targets.rh} />
      </div>

      {/* Bottom info strip */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-5 z-10">
        {/* Grow + light */}
        <div className="flex items-end justify-between mb-4">
          <div>
            {tent.grow ? (
              <>
                <div className="text-xl font-bold" style={{ color: '#e8f5e9' }}>{tent.grow.name}</div>
                <div className="text-sm" style={{ color: '#6b8f7b' }}>
                  {dayLabel ?? tent.grow.status}{harvestIn != null && harvestIn >= 0 ? ` · ${harvestIn}d to harvest` : ''}
                </div>
              </>
            ) : (
              <div className="text-sm" style={{ color: '#6b8f7b' }}>No grow linked</div>
            )}
          </div>
          {ls && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: '#6b8f7b' }}>LIGHTS</span>
              <span className="text-lg font-bold px-3 py-0.5 rounded-lg" style={{
                background: ls === 'ON' ? 'rgba(249,199,79,0.15)' : ls === 'RAMPING' ? 'rgba(244,162,97,0.15)' : 'rgba(255,255,255,0.05)',
                color: ls === 'ON' ? '#F9C74F' : ls === 'RAMPING' ? '#F4A261' : '#4a4a4a',
              }}>{ls}</span>
            </div>
          )}
        </div>

        {/* Device status strip */}
        {devices && (
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <DeviceChip icon={Fan} label="Fan" value={`${devices.fan_speed}%`} active={devices.fan_speed > 0} />
            <DeviceChip icon={Lightbulb} label="Light" value={`${devices.light_level}%`} active={devices.light_level > 0} color="#F9C74F" />
            <DeviceChip icon={Droplets} label="Humidifier" value={devices.humidifier_on ? 'ON' : 'OFF'} active={devices.humidifier_on} color="#38bdf8" />
            {(devices.clip_fan_1_on || devices.clip_fan_2_on) && (
              <DeviceChip icon={Wind} label="Clip fans" value={`${(devices.clip_fan_1_on ? 1 : 0) + (devices.clip_fan_2_on ? 1 : 0)} on`} active />
            )}
          </div>
        )}

        {/* Sparklines */}
        <div className="grid grid-cols-3 gap-4">
          <Spark data={history.map(h => h.temp_f)} color="#9B5DE5" label="24h temp" />
          <Spark data={history.map(h => h.vpd_kpa)} color="#52B788" label="24h vpd" />
          <Spark data={history.map(h => h.rh_percent)} color="#38bdf8" label="24h rh" />
        </div>

        {/* Tent switcher + controls */}
        {tents.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {tents.map(t => (
              <button key={t.id} onClick={() => router.replace(`/display/${t.id}`)}
                className="rounded-full transition-all"
                style={{ width: t.id === id ? 22 : 8, height: 8, background: t.id === id ? '#52B788' : '#333' }} />
            ))}
            <button onClick={() => setAutoRotate(a => !a)} className="ml-3 text-[10px] px-2 py-1 rounded"
              style={{ background: autoRotate ? 'rgba(82,183,136,0.15)' : 'transparent', color: autoRotate ? '#52B788' : '#4a4a4a' }}>
              AUTO
            </button>
          </div>
        )}
      </div>

      {/* No-data hint */}
      {!reading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <p className="text-sm" style={{ color: '#4a4a4a' }}>Waiting for sensor data…</p>
        </div>
      )}

      {/* Control dock */}
      {controlsOpen && devices && (
        <ControlDock devices={devices} onPatch={patchDevices} onClose={() => setControlsOpen(false)} />
      )}
    </div>
  )
}

// ── Device status chip ────────────────────────────────────────────────────────
function DeviceChip({ icon: Icon, label, value, active, color = '#52B788' }: {
  icon: typeof Fan; label: string; value: string; active: boolean; color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: active ? `${color}22` : 'rgba(255,255,255,0.04)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: active ? color : '#4a4a4a' }} />
      </div>
      <div>
        <div className="text-[10px]" style={{ color: '#6b8f7b' }}>{label}</div>
        <div className="text-sm font-bold font-mono" style={{ color: active ? '#e8f5e9' : '#4a4a4a' }}>{value}</div>
      </div>
    </div>
  )
}

// ── Control dock (bottom sheet) ───────────────────────────────────────────────
function ControlDock({ devices, onPatch, onClose }: {
  devices: DeviceState; onPatch: (p: Partial<DeviceState>) => void; onClose: () => void
}) {
  const auto = devices.auto_mode
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-t-3xl border-t p-6 pb-8 space-y-5"
        style={{ background: '#0b1410', borderColor: '#1e3028' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold" style={{ color: '#e8f5e9' }}>Controls</span>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: '#6b8f7b' }} /></button>
        </div>

        {/* Auto mode */}
        <button onClick={() => onPatch({ auto_mode: !auto })}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors"
          style={{ background: auto ? 'rgba(82,183,136,0.12)' : 'rgba(255,255,255,0.03)', borderColor: auto ? '#52B788' : '#1e3028' }}>
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5" style={{ color: auto ? '#52B788' : '#6b8f7b' }} />
            <div className="text-left">
              <div className="text-sm font-bold" style={{ color: '#e8f5e9' }}>Auto mode</div>
              <div className="text-[11px]" style={{ color: '#6b8f7b' }}>VPD-driven fan & humidifier</div>
            </div>
          </div>
          <div className="relative w-12 h-7 rounded-full transition-colors" style={{ background: auto ? '#52B788' : '#2a3a32' }}>
            <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: auto ? 'translateX(20px)' : 'translateX(0)' }} />
          </div>
        </button>

        {auto && (
          <p className="text-xs text-center" style={{ color: '#6b8f7b' }}>Disable auto mode to control devices manually.</p>
        )}

        {/* Sliders / toggles */}
        <div className={auto ? 'opacity-40 pointer-events-none space-y-5' : 'space-y-5'}>
          <DockSlider icon={Fan} label="Exhaust fan" value={devices.fan_speed} color="#52B788"
            onChange={v => onPatch({ fan_speed: v })} />
          <DockSlider icon={Lightbulb} label="Light" value={devices.light_level} color="#F9C74F"
            onChange={v => onPatch({ light_level: v })} />

          <div className="grid grid-cols-3 gap-3">
            <DockToggle icon={Droplets} label="Humidifier" on={devices.humidifier_on} color="#38bdf8"
              onClick={() => onPatch({ humidifier_on: !devices.humidifier_on })} />
            <DockToggle icon={Wind} label="Clip fan 1" on={devices.clip_fan_1_on} color="#52B788"
              onClick={() => onPatch({ clip_fan_1_on: !devices.clip_fan_1_on })} />
            <DockToggle icon={Wind} label="Clip fan 2" on={devices.clip_fan_2_on} color="#52B788"
              onClick={() => onPatch({ clip_fan_2_on: !devices.clip_fan_2_on })} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DockSlider({ icon: Icon, label, value, color, onChange }: {
  icon: typeof Fan; label: string; value: number; color: string; onChange: (v: number) => void
}) {
  const bump = (d: number) => onChange(Math.max(0, Math.min(100, value + d)))
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="text-sm" style={{ color: '#e8f5e9' }}>{label}</span>
        </div>
        <span className="text-lg font-bold font-mono" style={{ color }}>{value}%</span>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => bump(-5)} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#e8f5e9' }}><Minus className="w-4 h-4" /></button>
        <input type="range" min={0} max={100} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, ${color} ${value}%, #1e3028 ${value}%)` }} />
        <button onClick={() => bump(5)} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#e8f5e9' }}><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

function DockToggle({ icon: Icon, label, on, color, onClick }: {
  icon: typeof Fan; label: string; on: boolean; color: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors"
      style={{ background: on ? `${color}18` : 'rgba(255,255,255,0.03)', borderColor: on ? color : '#1e3028' }}>
      <Icon className="w-5 h-5" style={{ color: on ? color : '#4a4a4a' }} />
      <span className="text-[11px]" style={{ color: on ? '#e8f5e9' : '#6b8f7b' }}>{label}</span>
      <span className="text-[10px] font-bold" style={{ color: on ? color : '#4a4a4a' }}>{on ? 'ON' : 'OFF'}</span>
    </button>
  )
}

// ── Radial gauge ──────────────────────────────────────────────────────────────
function Gauge({ label, value, unit, min, max, decimals, color, status, band, big }: {
  label: string; value: number | null; unit: string; min: number; max: number
  decimals: number; color: string; status: string; band: Band; big?: boolean
}) {
  const size = big ? 300 : 230
  const stroke = big ? 16 : 12
  const r = (size - stroke) / 2 - 8
  const cx = size / 2, cy = size / 2
  const sweep = 270 // degrees
  const startAngle = 135 // bottom-left
  const frac = value == null ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)))
  const circ = 2 * Math.PI * r
  const arcLen = (sweep / 360) * circ

  // band markers (target zone) on the arc
  const bandStartFrac = Math.max(0, Math.min(1, (band.min - min) / (max - min)))
  const bandEndFrac = Math.max(0, Math.min(1, (band.max - min) / (max - min)))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '32vw', height: 'auto' }}>
      <defs>
        <filter id={`g-${label}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g transform={`rotate(${startAngle} ${cx} ${cy})`}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#16201b" strokeWidth={stroke}
          strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round" />
        {/* Target band */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2f5a44" strokeWidth={stroke}
          strokeDasharray={`${(bandEndFrac - bandStartFrac) * arcLen} ${circ}`}
          strokeDashoffset={`${-bandStartFrac * arcLen}`} strokeLinecap="butt" opacity="0.6" />
        {/* Value arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${frac * arcLen} ${circ}`} strokeLinecap="round"
          filter={`url(#g-${label})`} style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.6s ease' }} />
      </g>
      {/* Center value */}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={big ? 64 : 46} fontWeight="800" fill="#e8f5e9"
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value == null ? '—' : value.toFixed(decimals)}
      </text>
      <text x={cx} y={cy + (big ? 30 : 24)} textAnchor="middle" fontSize={big ? 18 : 14} fill="#6b8f7b">{unit}</text>
      <text x={cx} y={cy + (big ? 58 : 46)} textAnchor="middle" fontSize={big ? 13 : 11} fontWeight="700"
        letterSpacing="0.15em" fill={color}>{label}</text>
      <text x={cx} y={size - (big ? 14 : 10)} textAnchor="middle" fontSize={11} fill={color} opacity="0.85">{status}</text>
    </svg>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, color, label }: { data: (number | null)[]; color: string; label: string }) {
  const pts = data.filter((d): d is number => d != null)
  const w = 200, h = 40
  let path = ''
  if (pts.length > 1) {
    const min = Math.min(...pts), max = Math.max(...pts)
    const range = max - min || 1
    path = pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }
  return (
    <div>
      <div className="text-[10px] mb-1" style={{ color: '#4a7a58' }}>{label}</div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {path ? (
          <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 3px ${color}88)` }} />
        ) : (
          <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#1a2620" strokeWidth="1" strokeDasharray="3 3" />
        )}
      </svg>
    </div>
  )
}
