'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Cpu, Circle, Settings, RefreshCw, Wind, Sun,
  Droplets, Fan, ChevronRight, Copy, Check, Monitor
} from 'lucide-react'
import type { Tent, DeviceState, TentSchedule, EnvReading } from '@/types/database'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceArea, CartesianGrid,
} from 'recharts'

type Period = '2h' | '12h' | '24h'
const PERIOD_LIMITS: Record<Period, number> = { '2h': 120, '12h': 720, '24h': 1440 }

const OFFLINE_MS = 90 * 1000

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < OFFLINE_MS
}

function vpdColor(vpd: number | null, target: { min: number; max: number } | null): string {
  if (vpd === null || !target) return 'var(--text-muted)'
  if (vpd < target.min) return 'var(--danger)'
  if (vpd > target.max) return 'var(--warning)'
  return 'var(--accent)'
}

function vpdLabel(vpd: number | null, target: { min: number; max: number } | null): string {
  if (vpd === null || !target) return '—'
  if (vpd < target.min) return 'Too low'
  if (vpd > target.max) return 'Too high'
  return 'On target'
}

function calcFlowerWeek(flipDate: string | null, scheduleWeek: number): number {
  if (!flipDate) return scheduleWeek
  const days = Math.floor((Date.now() - new Date(flipDate).getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.ceil(days / 7))
}

function calcCurrentLightStatus(schedule: TentSchedule): 'ON' | 'OFF' | 'RAMPING' {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [onH, onM] = schedule.lights_on.split(':').map(Number)
  const [offH, offM] = schedule.lights_off.split(':').map(Number)
  const onMin = onH * 60 + onM
  const offMin = offH * 60 + offM

  let inWindow: boolean
  let minutesOn: number
  let minutesUntilOff: number

  if (onMin < offMin) {
    inWindow = nowMin >= onMin && nowMin < offMin
    minutesOn = nowMin - onMin
    minutesUntilOff = offMin - nowMin
  } else {
    inWindow = nowMin >= onMin || nowMin < offMin
    minutesOn = nowMin >= onMin ? nowMin - onMin : (24 * 60 - onMin) + nowMin
    minutesUntilOff = nowMin < offMin ? offMin - nowMin : (24 * 60 - nowMin) + offMin
  }

  if (!inWindow) return 'OFF'
  if (minutesOn < schedule.sunrise_minutes) return 'RAMPING'
  if (minutesUntilOff < schedule.sunset_minutes) return 'RAMPING'
  return 'ON'
}

type TentFull = Tent & {
  grow: { id: string; name: string; status: string; flip_date: string | null } | null
}

export default function TentDashboardPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [tent, setTent] = useState<TentFull | null>(null)
  const [devices, setDevices] = useState<DeviceState | null>(null)
  const [schedule, setSchedule] = useState<TentSchedule | null>(null)
  const [latestReading, setLatestReading] = useState<EnvReading | null>(null)
  const [readings, setReadings] = useState<EnvReading[]>([])
  const [period, setPeriod] = useState<Period>('2h')
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  const devicesRef = useRef<DeviceState | null>(null)
  devicesRef.current = devices

  const load = useCallback(async (p: Period = period) => {
    const [
      { data: tentData },
      { data: devicesData },
      { data: scheduleData },
      { data: readingData },
      { data: historyData },
    ] = await Promise.all([
      supabase.from('tents').select('*, grow:grows(id, name, status, flip_date)').eq('id', id).single(),
      supabase.from('device_states').select('*').eq('tent_id', id).single(),
      supabase.from('tent_schedules').select('*').eq('tent_id', id).single(),
      supabase.from('env_readings').select('*').eq('tent_id', id).order('reading_time', { ascending: false }).limit(1).single(),
      supabase.from('env_readings').select('reading_time,temp_f,rh_percent,vpd_kpa').eq('tent_id', id).order('reading_time', { ascending: true }).limit(PERIOD_LIMITS[p]),
    ])

    if (!tentData) { router.push('/controller'); return }

    setTent(tentData as TentFull)
    setDevices(devicesData as DeviceState)
    setSchedule(scheduleData as TentSchedule)
    setLatestReading(readingData as EnvReading | null)
    setReadings((historyData ?? []) as EnvReading[])
    setLastSeen((tentData as TentFull).last_seen)
    setLoading(false)
  }, [id, period])

  useEffect(() => { load() }, [load])

  // Realtime subscription for live readings
  useEffect(() => {
    const channel = supabase
      .channel(`tent-readings-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'env_readings',
        filter: `tent_id=eq.${id}`,
      }, (payload) => {
        const r = payload.new as EnvReading
        setLatestReading(r)
        setLastSeen(new Date().toISOString())
        setTent(prev => prev ? { ...prev, last_seen: new Date().toISOString(), is_online: true } : prev)
        setReadings(prev => [...prev.slice(-PERIOD_LIMITS[period] + 1), r])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function patchDevices(patch: Partial<DeviceState>) {
    if (!devices) return
    const updated = { ...devices, ...patch }
    setDevices(updated)
    setSaving(true)

    const res = await fetch(`/api/tents/${id}/devices`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    if (!res.ok) {
      toast.error('Failed to update device')
      setDevices(devicesRef.current!)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (!tent || !devices || !schedule) return null

  const online = isOnline(lastSeen)
  const flowerWeek = calcFlowerWeek(tent.grow?.flip_date ?? null, schedule.flower_week)
  const weekKey = String(Math.min(flowerWeek, 10))
  const vpdTarget = (schedule.vpd_targets as Record<string, { min: number; max: number }>)[weekKey] ?? null
  const vpd = latestReading?.vpd_kpa ?? null
  const lightStatus = calcCurrentLightStatus(schedule)

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto space-y-4">

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold truncate" style={{ color: 'var(--text)' }}>{tent.name}</h1>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(155,93,229,0.15)', color: 'var(--purple)' }}
            >
              Wk {flowerWeek}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Circle
              className="w-2 h-2"
              fill={online ? 'var(--accent)' : 'var(--text-muted)'}
              style={{ color: online ? 'var(--accent)' : 'var(--text-muted)' }}
            />
            <span className="text-xs" style={{ color: online ? 'var(--accent)' : 'var(--text-muted)' }}>
              {online ? 'Live' : lastSeen ? `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}` : 'Never connected'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/display/${id}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Monitor className="w-4 h-4" /> Display
          </a>
          <Link href={`/controller/${id}/schedule`}>
            <button
              className="p-2 rounded-lg"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
            >
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>

      {/* Never-connected setup card */}
      {!lastSeen && (
        <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Waiting for device</p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Your ESP32 hasn&apos;t connected yet. Make sure it&apos;s flashed with the correct <code className="font-mono px-1 rounded" style={{ background: 'var(--surface-raised)' }}>TENT_ID</code> and <code className="font-mono px-1 rounded" style={{ background: 'var(--surface-raised)' }}>API_KEY</code>.
          </p>
          <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
            <p>Tent ID:</p>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 px-2 py-1.5 rounded font-mono text-[11px] overflow-x-auto"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
              >
                {id}
              </code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(id)
                  setCopiedKey(true)
                  setTimeout(() => setCopiedKey(false), 2000)
                }}
                className="p-1.5 rounded shrink-0"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live readings */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Live Readings</p>
          {latestReading && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatDistanceToNow(new Date(latestReading.reading_time), { addSuffix: true })}
            </p>
          )}
        </div>

        {!latestReading ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Waiting for first reading from device…</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold font-mono" style={{ color: 'var(--text)' }}>
                {latestReading.temp_f?.toFixed(1) ?? '—'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>°F</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold font-mono" style={{ color: 'var(--text)' }}>
                {latestReading.rh_percent?.toFixed(0) ?? '—'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>% RH</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold font-mono" style={{ color: vpdColor(vpd, vpdTarget) }}>
                {vpd?.toFixed(2) ?? '—'}
              </p>
              <p className="text-xs mt-1" style={{ color: vpdColor(vpd, vpdTarget) }}>
                kPa · {vpdLabel(vpd, vpdTarget)}
              </p>
            </div>
          </div>
        )}

        {vpdTarget && vpd !== null && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>VPD target Wk {flowerWeek}</p>
              <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {vpdTarget.min}–{vpdTarget.max} kPa
              </p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, ((vpd - vpdTarget.min * 0.5) / (vpdTarget.max * 1.5 - vpdTarget.min * 0.5)) * 100))}%`,
                  background: vpdColor(vpd, vpdTarget),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* History chart */}
      {readings.length > 1 && (
        <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>History</p>
            <div className="flex items-center gap-1">
              {(['2h', '12h', '24h'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); load(p) }}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: period === p ? 'var(--accent-muted)' : 'transparent',
                    color: period === p ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            {[
              { label: 'Temp °F', color: 'var(--gold)' },
              { label: 'RH %', color: 'var(--purple)' },
              { label: 'VPD kPa', color: 'var(--accent)' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full" style={{ background: color }} />
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={readings} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="reading_time"
                tickFormatter={(v) => format(new Date(v), 'HH:mm')}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="temp"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <YAxis
                yAxisId="rh"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <YAxis yAxisId="vpd" hide domain={[0, 2.5]} />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'var(--text)',
                }}
                labelFormatter={(v) => format(new Date(v), 'HH:mm')}
                formatter={(value, name) => {
                  const v = Number(value)
                  if (name === 'temp_f') return [`${v.toFixed(1)}°F`, 'Temp']
                  if (name === 'rh_percent') return [`${v.toFixed(0)}%`, 'RH']
                  if (name === 'vpd_kpa') return [`${v.toFixed(2)} kPa`, 'VPD']
                  return [`${v}`, String(name)]
                }}
              />
              {vpdTarget && (
                <ReferenceArea
                  yAxisId="vpd"
                  y1={vpdTarget.min}
                  y2={vpdTarget.max}
                  fill="var(--accent)"
                  fillOpacity={0.08}
                />
              )}
              <Line yAxisId="temp" type="monotone" dataKey="temp_f" stroke="var(--gold)" strokeWidth={1.5} dot={false} />
              <Line yAxisId="rh" type="monotone" dataKey="rh_percent" stroke="var(--purple)" strokeWidth={1.5} dot={false} />
              <Line yAxisId="vpd" type="monotone" dataKey="vpd_kpa" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Auto mode toggle */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Auto Mode</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {devices.auto_mode
                ? 'Grow OS is controlling your tent automatically'
                : 'Manual control active'}
            </p>
          </div>
          <button
            onClick={() => patchDevices({ auto_mode: !devices.auto_mode })}
            disabled={saving}
            className="relative w-12 h-6 rounded-full transition-colors"
            style={{ background: devices.auto_mode ? 'var(--accent)' : 'var(--surface-raised)' }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
              style={{
                background: 'white',
                left: devices.auto_mode ? '26px' : '2px',
              }}
            />
          </button>
        </div>
      </div>

      {/* Device controls */}
      <div className="rounded-xl border p-5 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Device Controls</p>

        {devices.auto_mode && (
          <p className="text-xs py-2 px-3 rounded-lg" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
            Disable auto mode to control devices manually.
          </p>
        )}

        {/* Fan speed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Fan Speed</span>
            </div>
            <span className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>{devices.fan_speed}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={devices.fan_speed}
            disabled={devices.auto_mode}
            onChange={(e) => setDevices(prev => prev ? { ...prev, fan_speed: Number(e.target.value) } : prev)}
            onMouseUp={(e) => !devices.auto_mode && patchDevices({ fan_speed: Number((e.target as HTMLInputElement).value) })}
            onTouchEnd={(e) => !devices.auto_mode && patchDevices({ fan_speed: Number((e.target as HTMLInputElement).value) })}
            className="w-full h-1.5 rounded-full appearance-none outline-none"
            style={{ background: `linear-gradient(to right, var(--accent) ${devices.fan_speed}%, var(--surface-raised) ${devices.fan_speed}%)`, opacity: devices.auto_mode ? 0.4 : 1 }}
          />
        </div>

        {/* Light level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Light Level</span>
            </div>
            <span className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>{devices.light_level}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={devices.light_level}
            disabled={devices.auto_mode}
            onChange={(e) => setDevices(prev => prev ? { ...prev, light_level: Number(e.target.value) } : prev)}
            onMouseUp={(e) => !devices.auto_mode && patchDevices({ light_level: Number((e.target as HTMLInputElement).value) })}
            onTouchEnd={(e) => !devices.auto_mode && patchDevices({ light_level: Number((e.target as HTMLInputElement).value) })}
            className="w-full h-1.5 rounded-full appearance-none outline-none"
            style={{ background: `linear-gradient(to right, var(--gold) ${devices.light_level}%, var(--surface-raised) ${devices.light_level}%)`, opacity: devices.auto_mode ? 0.4 : 1 }}
          />
        </div>

        {/* Toggles row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'humidifier_on' as const, label: 'Humidifier', icon: Droplets },
            { key: 'clip_fan_1_on' as const, label: 'Clip Fan 1', icon: Fan },
            { key: 'clip_fan_2_on' as const, label: 'Clip Fan 2', icon: Fan },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              disabled={devices.auto_mode}
              onClick={() => !devices.auto_mode && patchDevices({ [key]: !devices[key] })}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all"
              style={{
                background: devices[key] ? 'var(--accent-muted)' : 'var(--surface-raised)',
                borderColor: devices[key] ? 'var(--accent)' : 'var(--border)',
                opacity: devices.auto_mode ? 0.5 : 1,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: devices[key] ? 'var(--accent)' : 'var(--text-muted)' }} />
              <span className="text-[10px] text-center leading-tight" style={{ color: devices[key] ? 'var(--accent)' : 'var(--text-muted)' }}>
                {label}<br />{devices[key] ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Schedule card */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Today&apos;s Schedule</p>
          <Link href={`/controller/${id}/schedule`}>
            <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--accent)' }}>
              Edit <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Lights On</p>
            <p className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>{schedule.lights_on}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Lights Off</p>
            <p className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>{schedule.lights_off}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Sunrise Ramp</p>
            <p className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>{schedule.sunrise_minutes} min</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Sunset Ramp</p>
            <p className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>{schedule.sunset_minutes} min</p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: lightStatus === 'ON' ? 'rgba(249,199,79,0.1)' : lightStatus === 'RAMPING' ? 'rgba(82,183,136,0.1)' : 'var(--surface-raised)',
          }}
        >
          <Sun
            className="w-4 h-4"
            style={{ color: lightStatus === 'ON' ? 'var(--gold)' : lightStatus === 'RAMPING' ? 'var(--accent)' : 'var(--text-muted)' }}
          />
          <span className="text-sm font-medium" style={{ color: lightStatus === 'ON' ? 'var(--gold)' : lightStatus === 'RAMPING' ? 'var(--accent)' : 'var(--text-muted)' }}>
            Lights {lightStatus}
          </span>
        </div>
      </div>

      {/* Linked grow */}
      {tent.grow && (
        <Link href={`/grows/${tent.grow.id}`}>
          <div className="rounded-xl border p-4 flex items-center justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Linked Grow</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{tent.grow.name}</p>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </div>
        </Link>
      )}
    </div>
  )
}
