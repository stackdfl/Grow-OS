'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { RefreshCw, ChevronLeft, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import type { TentSchedule, Grow, Tent } from '@/types/database'

const DEFAULT_VPD: Record<string, { min: number; max: number }> = {
  '1':  { min: 0.8, max: 1.0 },
  '2':  { min: 0.8, max: 1.0 },
  '3':  { min: 0.8, max: 1.0 },
  '4':  { min: 1.0, max: 1.2 },
  '5':  { min: 1.0, max: 1.2 },
  '6':  { min: 1.0, max: 1.2 },
  '7':  { min: 1.2, max: 1.5 },
  '8':  { min: 1.2, max: 1.5 },
  '9':  { min: 1.2, max: 1.5 },
  '10': { min: 1.2, max: 1.5 },
}

export default function TentSchedulePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [tent, setTent] = useState<Tent | null>(null)
  const [grows, setGrows] = useState<Grow[]>([])
  const [schedule, setSchedule] = useState<TentSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [regeneratingKey, setRegeneratingKey] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

  // Form state
  const [lightsOn, setLightsOn] = useState('06:00')
  const [lightsOff, setLightsOff] = useState('18:00')
  const [sunriseMin, setSunriseMin] = useState('30')
  const [sunsetMin, setSunsetMin] = useState('30')
  const [flowerWeek, setFlowerWeek] = useState('1')
  const [vpdTargets, setVpdTargets] = useState<Record<string, { min: number; max: number }>>(DEFAULT_VPD)
  const [linkedGrowId, setLinkedGrowId] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: tentData }, { data: scheduleData }, { data: growsData }] = await Promise.all([
      supabase.from('tents').select('*').eq('id', id).eq('user_id', user.id).single(),
      supabase.from('tent_schedules').select('*').eq('tent_id', id).single(),
      supabase.from('grows').select('id, name, status, flip_date').eq('user_id', user.id).not('status', 'in', '("complete","failed")').order('created_at', { ascending: false }),
    ])

    if (!tentData) { router.push('/controller'); return }

    setTent(tentData as Tent)
    setGrows((growsData ?? []) as Grow[])
    setLinkedGrowId((tentData as Tent).grow_id ?? '')

    if (scheduleData) {
      const s = scheduleData as TentSchedule
      setSchedule(s)
      setLightsOn(s.lights_on)
      setLightsOff(s.lights_off)
      setSunriseMin(String(s.sunrise_minutes))
      setSunsetMin(String(s.sunset_minutes))
      setFlowerWeek(String(s.flower_week))
      setVpdTargets(s.vpd_targets as Record<string, { min: number; max: number }>)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/tents/${id}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lights_on: lightsOn,
        lights_off: lightsOff,
        sunrise_minutes: parseInt(sunriseMin) || 30,
        sunset_minutes: parseInt(sunsetMin) || 30,
        flower_week: parseInt(flowerWeek) || 1,
        vpd_targets: vpdTargets,
        grow_id: linkedGrowId || null,
      }),
    })

    if (res.ok) {
      toast.success('Schedule saved')
    } else {
      toast.error('Failed to save schedule')
    }
    setSaving(false)
  }

  async function handleRegenerateKey() {
    setRegeneratingKey(true)
    const res = await fetch(`/api/tents/${id}/regenerate-key`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setNewKey(data.api_key)
      toast.success('New API key generated')
    } else {
      toast.error('Failed to regenerate key')
    }
    setRegeneratingKey(false)
  }

  async function handleDelete() {
    await supabase.from('tents').delete().eq('id', id)
    toast.success('Tent deleted')
    router.push('/controller')
  }

  function updateVpd(week: string, field: 'min' | 'max', val: string) {
    setVpdTargets(prev => ({
      ...prev,
      [week]: { ...prev[week], [field]: parseFloat(val) || 0 },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  const linkedGrow = grows.find(g => g.id === linkedGrowId)

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/controller/${id}`)} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Schedule</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tent?.name}</p>
        </div>
      </div>

      {/* Light schedule */}
      <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Light Schedule</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lights On</Label>
            <Input
              type="time"
              value={lightsOn}
              onChange={(e) => setLightsOn(e.target.value)}
              className="font-mono"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lights Off</Label>
            <Input
              type="time"
              value={lightsOff}
              onChange={(e) => setLightsOff(e.target.value)}
              className="font-mono"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sunrise Ramp (min)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={sunriseMin}
              onChange={(e) => setSunriseMin(e.target.value)}
              className="font-mono"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sunset Ramp (min)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              value={sunsetMin}
              onChange={(e) => setSunsetMin(e.target.value)}
              className="font-mono"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Current Flower Week</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={12}
              value={flowerWeek}
              onChange={(e) => setFlowerWeek(e.target.value)}
              className="font-mono w-24"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            {linkedGrow?.flip_date && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Auto-calculated from {linkedGrow.name}&apos;s flip date
              </p>
            )}
          </div>
        </div>
      </div>

      {/* VPD targets */}
      <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>VPD Targets by Flower Week</p>
          <button
            onClick={() => setVpdTargets(DEFAULT_VPD)}
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 pb-1">
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Week</p>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Min kPa</p>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Max kPa</p>
          </div>
          {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((week) => {
            const currentWeek = parseInt(flowerWeek) === parseInt(week)
            return (
              <div
                key={week}
                className="grid grid-cols-3 gap-2 items-center rounded-lg px-2 py-1"
                style={{ background: currentWeek ? 'var(--accent-muted)' : 'transparent' }}
              >
                <p
                  className="text-sm font-medium"
                  style={{ color: currentWeek ? 'var(--accent)' : 'var(--text-secondary)' }}
                >
                  Wk {week}
                </p>
                <Input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="2.5"
                  value={vpdTargets[week]?.min ?? ''}
                  onChange={(e) => updateVpd(week, 'min', e.target.value)}
                  className="font-mono text-sm h-8"
                  style={{ background: 'var(--surface-raised)', borderColor: currentWeek ? 'var(--accent)' : 'var(--border)', color: 'var(--text)' }}
                />
                <Input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="2.5"
                  value={vpdTargets[week]?.max ?? ''}
                  onChange={(e) => updateVpd(week, 'max', e.target.value)}
                  className="font-mono text-sm h-8"
                  style={{ background: 'var(--surface-raised)', borderColor: currentWeek ? 'var(--accent)' : 'var(--border)', color: 'var(--text)' }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Tent settings */}
      <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Tent Settings</p>

        <div className="space-y-1.5">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Linked Grow</Label>
          <select
            value={linkedGrowId}
            onChange={(e) => setLinkedGrowId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: linkedGrowId ? 'var(--text)' : 'var(--text-muted)' }}
          >
            <option value="">No grow linked</option>
            {grows.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.status})</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>API Key</Label>
          {newKey ? (
            <div className="space-y-2">
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg"
                style={{ background: 'rgba(244,162,97,0.1)', border: '1px solid rgba(244,162,97,0.3)' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                <p className="text-xs" style={{ color: 'var(--warning)' }}>New key generated — copy it now and re-flash your ESP32.</p>
              </div>
              <code
                className="block w-full px-3 py-2 rounded-lg text-xs font-mono overflow-x-auto"
                style={{ background: 'var(--surface-raised)', color: 'var(--accent)', border: '1px solid var(--border)' }}
              >
                {newKey}
              </code>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleRegenerateKey}
              disabled={regeneratingKey}
              className="text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {regeneratingKey ? 'Regenerating…' : 'Regenerate API Key'}
            </Button>
          )}
        </div>

        <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete tent
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--danger)' }}>Delete this tent and all its data?</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs h-8"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  className="text-xs h-8"
                  style={{ background: 'var(--danger)', color: 'white' }}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        className="w-full font-medium"
        onClick={handleSave}
        disabled={saving}
        style={{ background: 'var(--accent)', color: '#0a0f0d' }}
      >
        {saving ? 'Saving…' : 'Save Schedule'}
      </Button>
    </div>
  )
}
