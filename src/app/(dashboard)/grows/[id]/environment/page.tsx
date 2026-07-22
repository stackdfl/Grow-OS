'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, Thermometer, Plus, X, Cpu, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EnvReading, Grow, Tent } from '@/types/database'

export default function GrowEnvironmentPage() {
  const { id: growId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [grow, setGrow]       = useState<Pick<Grow, 'id' | 'name'> | null>(null)
  const [readings, setReadings] = useState<EnvReading[]>([])
  const [tent, setTent]         = useState<Pick<Tent, 'id' | 'name' | 'is_online'> | null>(null)
  const [loading, setLoading]   = useState(true)

  // Form
  const [adding, setAdding] = useState(false)
  const [readingTime, setReadingTime] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [tempF, setTempF]   = useState('')
  const [rh, setRh]         = useState('')
  const [vpd, setVpd]       = useState('')
  const [co2, setCo2]       = useState('')
  const [ppfd, setPpfd]     = useState('')
  const [ph, setPh]         = useState('')
  const [ec, setEc]         = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [growId])

  async function load() {
    const [growRes, readRes, tentRes] = await Promise.all([
      supabase.from('grows').select('id, name').eq('id', growId).single(),
      supabase.from('env_readings').select('*').eq('grow_id', growId)
        .order('reading_time', { ascending: false }).limit(100),
      supabase.from('tents').select('id, name, is_online').eq('grow_id', growId).maybeSingle(),
    ])
    setGrow(growRes.data as Pick<Grow, 'id' | 'name'> | null)
    setReadings((readRes.data ?? []) as EnvReading[])
    setTent(tentRes.data as Pick<Tent, 'id' | 'name' | 'is_online'> | null)
    setLoading(false)
  }

  async function submit() {
    if (!tempF && !rh) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const tempC = tempF ? ((parseFloat(tempF) - 32) * 5 / 9) : null

    const { data } = await supabase
      .from('env_readings')
      .insert([{
        grow_id:      growId,
        user_id:      user.id,
        reading_time: new Date(readingTime).toISOString(),
        temp_f:       tempF  ? parseFloat(tempF)  : null,
        temp_c:       tempC,
        rh_percent:   rh     ? parseFloat(rh)     : null,
        vpd_kpa:      vpd    ? parseFloat(vpd)    : null,
        co2_ppm:      co2    ? parseFloat(co2)    : null,
        ppfd:         ppfd   ? parseFloat(ppfd)   : null,
        ph:           ph     ? parseFloat(ph)     : null,
        ec:           ec     ? parseFloat(ec)     : null,
        source:       'manual',
        raw_data:     {},
      }])
      .select()
      .single()

    if (data) {
      setReadings(p => [data as EnvReading, ...p])
      setTempF('')
      setRh('')
      setVpd('')
      setCo2('')
      setPpfd('')
      setPh('')
      setEc('')
      setAdding(false)
      fetch('/api/calibration/compute', { method: 'POST' }).catch(() => {})
    }
    setSaving(false)
  }

  // VPD auto-calculate from temp+RH when both are filled
  useEffect(() => {
    if (tempF && rh && !vpd) {
      const t = parseFloat(tempF)
      const r = parseFloat(rh)
      if (!isNaN(t) && !isNaN(r)) {
        const tc = (t - 32) * 5 / 9
        const svp = 0.6108 * Math.exp(17.27 * tc / (tc + 237.3))
        const calculated = svp * (1 - r / 100)
        setVpd(calculated.toFixed(2))
      }
    }
  }, [tempF, rh])

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/grows/${growId}`} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {grow?.name ?? 'Grow'} — Environment
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{readings.length} readings</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Log Reading
          </Button>
        )}
      </div>

      {/* Tent controller link */}
      {tent && (
        <Link
          href={`/controller/${tent.id}`}
          className="flex items-center justify-between p-3 rounded-xl border mb-4"
          style={{ background: tent.is_online ? 'var(--accent-muted)' : 'var(--surface)', borderColor: tent.is_online ? 'var(--accent)' : 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 shrink-0" style={{ color: tent.is_online ? 'var(--accent)' : 'var(--text-muted)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{tent.name}</p>
              <p className="text-xs" style={{ color: tent.is_online ? 'var(--accent)' : 'var(--text-muted)' }}>
                {tent.is_online ? 'Live — view controller' : 'Offline — view controller'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
        </Link>
      )}

      {adding && (
        <div className="rounded-xl border p-4 mb-5 space-y-4" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Log Reading</span>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Date & Time</Label>
            <input type="datetime-local" value={readingTime} onChange={e => setReadingTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Temp °F', val: tempF, set: setTempF, placeholder: '76' },
              { label: 'RH %',    val: rh,    set: setRh,    placeholder: '55' },
              { label: 'VPD kPa', val: vpd,   set: setVpd,   placeholder: 'auto' },
              { label: 'CO₂ ppm', val: co2,   set: setCo2,   placeholder: '1200' },
              { label: 'PPFD',    val: ppfd,  set: setPpfd,  placeholder: '800' },
              { label: 'pH',      val: ph,    set: setPh,    placeholder: '6.2' },
              { label: 'EC',      val: ec,    set: setEc,    placeholder: '1.8' },
            ].map(({ label, val, set, placeholder }) => (
              <div key={label} className="space-y-1">
                <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</Label>
                <Input type="number" step="0.1" placeholder={placeholder} value={val}
                  onChange={e => set(e.target.value)} className="font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
            ))}
          </div>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            VPD auto-calculates from Temp + RH if left blank.
          </p>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAdding(false)} style={{ color: 'var(--text-muted)' }}>Cancel</Button>
            <Button onClick={submit} disabled={saving || (!tempF && !rh)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && readings.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <Thermometer className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No readings logged yet</p>
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Log First Reading
          </Button>
        </div>
      )}

      {/* Table */}
      {readings.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
                  {['Date/Time', 'Temp °F', 'RH %', 'VPD', 'CO₂', 'PPFD', 'pH', 'EC'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {readings.map(r => (
                  <tr key={r.id} className="hover:bg-white/[0.02]" style={{ background: 'var(--surface)' }}>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {format(parseISO(r.reading_time), 'MMM d HH:mm')}
                    </td>
                    {[r.temp_f, r.rh_percent, r.vpd_kpa, r.co2_ppm, r.ppfd, r.ph, r.ec].map((val, i) => {
                      let color = 'var(--text)'
                      // VPD coloring
                      if (i === 2 && val !== null) {
                        color = val < 0.4 ? '#818cf8' : val > 1.6 ? 'var(--danger)' : 'var(--accent)'
                      }
                      return (
                        <td key={i} className="px-3 py-2.5 font-mono" style={{ color: val !== null ? color : 'var(--border)' }}>
                          {val !== null ? val : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
