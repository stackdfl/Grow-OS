'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { addDays, addWeeks, startOfDay, differenceInDays, format, parseISO } from 'date-fns'
import { Layers, ChevronRight, Plus, X, Trash2, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EquipmentProfile, Grow, Genetics } from '@/types/database'
import { TentFloorPlan } from './tent-floor-plan'
import { TimeScrubber } from './time-scrubber'
import { GanttStrip } from './gantt-strip'
import { PipelineTips } from './pipeline-tips'
import { StatsBand } from './stats-band'
import type { GeneticsOutcome } from '@/lib/calibration/engine'
import {
  getGrowEvents, getStageAtDate, resolveDates, getMoveEvents,
  STAGE_COLOR, STAGE_LABEL, EVENT_META,
  type PipelineEvent, type MoveEvent,
} from '@/lib/pipeline/stages'

const MIN_DAYS = -14
const MAX_DAYS = 180

interface Props {
  equipment: EquipmentProfile[]
  grows: Grow[]
  allGenetics: Genetics[]
  geneticsHistory: GeneticsOutcome[]
}

interface PlanForm {
  vegTentId: string
  equipmentId: string   // flower tent (final home)
  geneticsId: string
  plantCount: number
  potSizeGal: number
  cloneDate: string
  vegWeeks: number
  flowerWeeks: number
}

const POT_SIZES = [1, 2, 3, 5, 7, 10, 15, 20]

export function PipelineClient({ equipment, grows, allGenetics, geneticsHistory }: Props) {
  const [daysOffset, setDaysOffset] = useState(0)
  const [selectedGrowId, setSelectedGrowId] = useState<string | null>(null)
  const [liveGrows, setLiveGrows] = useState<Grow[]>(grows)
  const [planOpen, setPlanOpen] = useState(false)

  const today = startOfDay(new Date())
  const viewDate = addDays(today, daysOffset)

  const allEvents = useMemo<PipelineEvent[]>(
    () => liveGrows.flatMap(getGrowEvents).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [liveGrows]
  )

  // Move events (veg tent → flower tent) keyed by grow for badges + warnings
  const moveEvents = useMemo<MoveEvent[]>(
    () => getMoveEvents(liveGrows, equipment),
    [liveGrows, equipment]
  )
  const moveByGrow = useMemo(
    () => new Map(moveEvents.map(m => [m.growId, m])),
    [moveEvents]
  )

  const upcoming = useMemo(
    () => allEvents.filter(e => differenceInDays(startOfDay(e.date), viewDate) >= 0).slice(0, 8),
    [allEvents, viewDate]
  )

  const selectedGrow = liveGrows.find(g => g.id === selectedGrowId) ?? null

  function onPlanned(g: Grow) {
    setLiveGrows(prev => [...prev, g])
    setPlanOpen(false)
  }

  async function deleteGrow(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('grows').delete().eq('id', id)
    if (!error) {
      setLiveGrows(prev => prev.filter(g => g.id !== id))
      setSelectedGrowId(null)
    }
  }

  if (liveGrows.length === 0 && !planOpen) {
    return (
      <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
        <Header onPlan={() => setPlanOpen(true)} />
        <div className="rounded-xl border p-10 text-center mt-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <Layers className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No grows to plan yet</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => setPlanOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              Plan a run
            </button>
            <Link href="/grows/new" className="px-4 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              Start a grow
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto space-y-5">
      <Header onPlan={() => setPlanOpen(true)} />

      {/* Live stats band */}
      <StatsBand grows={liveGrows} equipment={equipment} geneticsHistory={geneticsHistory} />

      {/* Tent floor plan */}
      <div className="rounded-xl border p-4 overflow-x-auto" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <TentFloorPlan
          tents={equipment}
          grows={liveGrows}
          viewDate={viewDate}
          moveByGrow={moveByGrow}
          selectedGrowId={selectedGrowId}
          onSelectGrow={setSelectedGrowId}
        />
        <StageLegend />
      </div>

      {/* Scrubber */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <TimeScrubber
          daysOffset={daysOffset}
          setDaysOffset={setDaysOffset}
          minDays={MIN_DAYS}
          maxDays={MAX_DAYS}
          events={allEvents}
        />
      </div>

      {/* Selected grow detail + AI tips */}
      {selectedGrow && (
        <div className="space-y-3">
          <GrowDetailCard grow={selectedGrow} viewDate={viewDate}
            onClose={() => setSelectedGrowId(null)} onDelete={() => deleteGrow(selectedGrow.id)} />
          {selectedGrow.status !== 'planned' && (
            <PipelineTips growId={selectedGrow.id} growName={selectedGrow.name} />
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Gantt */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Timeline</h2>
          <GanttStrip
            grows={liveGrows}
            daysOffset={daysOffset}
            minDays={MIN_DAYS}
            maxDays={MAX_DAYS}
            selectedGrowId={selectedGrowId}
            onSelectGrow={setSelectedGrowId}
          />
        </div>

        {/* Upcoming events */}
        <div>
          <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Upcoming from {daysOffset === 0 ? 'today' : format(viewDate, 'MMM d')}
          </h2>
          <div className="rounded-xl border divide-y" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {upcoming.length === 0 && (
              <p className="text-xs p-4" style={{ color: 'var(--text-muted)' }}>Nothing scheduled ahead.</p>
            )}
            {upcoming.map((ev, i) => {
              const days = differenceInDays(startOfDay(ev.date), viewDate)
              const move = ev.type === 'flip' ? moveByGrow.get(ev.growId) : undefined
              return (
                <button
                  key={i}
                  onClick={() => setSelectedGrowId(ev.growId)}
                  className="flex items-center gap-3 p-3 w-full text-left hover:bg-[--surface-raised] transition-colors"
                >
                  <span className="text-base shrink-0" style={{ filter: 'saturate(1.4)' }}>{EVENT_META[ev.type].icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                      {move?.toTentName ? `${ev.growName}: move → ${move.toTentName}` : ev.label}
                    </p>
                    <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span>{format(ev.date, 'EEE, MMM d')}{ev.estimated ? ' · est.' : ''}</span>
                      {move?.overCapacity && (
                        <span className="font-bold px-1 rounded" style={{ background: 'rgba(231,111,81,0.18)', color: 'var(--danger)' }}>
                          NO ROOM ({move.plants}/{move.capacity})
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: `${ev.color}22`, color: ev.color }}
                  >
                    {days === 0 ? 'now' : `${days}d`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {planOpen && (
        <PlanModal
          equipment={equipment}
          allGenetics={allGenetics}
          onClose={() => setPlanOpen(false)}
          onPlanned={onPlanned}
        />
      )}
    </div>
  )
}

function Header({ onPlan }: { onPlan: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Pipeline</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Scrub forward to plan cuts, transplants & harvests
        </p>
      </div>
      <button onClick={onPlan} className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
        style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
        <Plus className="w-3.5 h-3.5" /> Plan a run
      </button>
    </div>
  )
}

function StageLegend() {
  const stages: { key: keyof typeof STAGE_COLOR; label: string }[] = [
    { key: 'clone', label: 'Clone' },
    { key: 'veg', label: 'Veg' },
    { key: 'flower', label: 'Flower' },
    { key: 'flush', label: 'Flush' },
    { key: 'harvest', label: 'Harvest' },
    { key: 'future', label: 'Planned' },
  ]
  return (
    <div className="flex gap-3 flex-wrap justify-center mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
      {stages.map(s => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLOR[s.key] }} />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function GrowDetailCard({ grow, viewDate, onClose, onDelete }: {
  grow: Grow; viewDate: Date; onClose: () => void; onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const stage = getStageAtDate(grow, viewDate)
  const { clone, veg, flip, harvest, harvestEstimated } = resolveDates(grow)
  const dates: { label: string; date: Date | null; est?: boolean }[] = [
    { label: 'Cloned', date: clone },
    { label: 'Veg', date: veg },
    { label: 'Flip', date: flip },
    { label: 'Harvest', date: harvest, est: harvestEstimated },
  ]

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: STAGE_COLOR[stage] }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full" style={{ background: STAGE_COLOR[stage], boxShadow: `0 0 8px ${STAGE_COLOR[stage]}` }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{grow.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {grow.genetics?.strain_name ?? '—'} · {grow.plant_count} plant{grow.plant_count !== 1 ? 's' : ''}
              {grow.container_size_gal ? ` · ${grow.container_size_gal} gal` : ''} · {STAGE_LABEL[stage]} on {format(viewDate, 'MMM d')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href={`/grows/${grow.id}/log`} className="text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <ClipboardList className="w-3 h-3" /> Log
          </Link>
          <Link href={`/grows/${grow.id}`} className="text-xs flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
            Open <ChevronRight className="w-3 h-3" />
          </Link>
          <Link href={`/grows/${grow.id}/edit`} className="text-xs" style={{ color: 'var(--text-secondary)' }}>Edit</Link>
          <button onClick={onClose} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {dates.map(d => (
          <div key={d.label} className="rounded-lg p-2" style={{ background: 'var(--surface-raised)' }}>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.label}{d.est ? ' (est)' : ''}</p>
            <p className="text-xs font-mono font-medium" style={{ color: 'var(--text)' }}>
              {d.date ? format(d.date, 'MMM d') : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Delete */}
      <div className="flex justify-end mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Delete this grow permanently?</span>
            <button onClick={() => setConfirming(false)} className="text-xs px-2 py-1 rounded-md border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
            <button onClick={onDelete} className="text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1"
              style={{ background: 'var(--danger)', color: '#0a0f0d' }}>
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-xs flex items-center gap-1"
            style={{ color: 'var(--danger)' }}>
            <Trash2 className="w-3 h-3" /> Delete grow
          </button>
        )}
      </div>
    </div>
  )
}

function PlanModal({ equipment, allGenetics, onClose, onPlanned }: {
  equipment: EquipmentProfile[]
  allGenetics: Genetics[]
  onClose: () => void
  onPlanned: (g: Grow) => void
}) {
  const vegTents = equipment.filter(t => (t.role ?? 'both') === 'veg' || (t.role ?? 'both') === 'both')
  const flowerTents = equipment.filter(t => (t.role ?? 'both') === 'flower' || (t.role ?? 'both') === 'both')

  const [form, setForm] = useState<PlanForm>({
    vegTentId: vegTents[0]?.id ?? '',
    equipmentId: flowerTents[0]?.id ?? '',
    geneticsId: '',
    plantCount: 4,
    potSizeGal: flowerTents[0]?.pot_size_gal ?? 5,
    cloneDate: format(new Date(), 'yyyy-MM-dd'),
    vegWeeks: 4,
    flowerWeeks: 9,
  })
  const [saving, setSaving] = useState(false)

  const cloneDate = parseISO(form.cloneDate)
  const flipDate = addWeeks(cloneDate, form.vegWeeks)
  const harvestDate = addWeeks(flipDate, form.flowerWeeks)

  async function save() {
    if (!form.equipmentId || !form.cloneDate) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const genetics = allGenetics.find(g => g.id === form.geneticsId)
    const name = genetics
      ? `${genetics.strain_name} — ${format(cloneDate, 'MMM yyyy')}`
      : `Planned Run — ${format(cloneDate, 'MMM yyyy')}`

    const { data, error } = await supabase
      .from('grows')
      .insert({
        user_id: user.id,
        name,
        genetics_id: form.geneticsId || null,
        veg_tent_id: form.vegTentId || null,
        equipment_profile_id: form.equipmentId || null,
        status: 'planned',
        plant_count: form.plantCount,
        container_size_gal: form.potSizeGal,
        clone_date:     format(cloneDate, 'yyyy-MM-dd'),
        veg_start_date: format(cloneDate, 'yyyy-MM-dd'),
        flip_date:      format(flipDate, 'yyyy-MM-dd'),
        harvest_date:   format(harvestDate, 'yyyy-MM-dd'),
      } as never)
      .select('*, genetics(*)')
      .single()

    setSaving(false)
    if (!error && data) onPlanned(data as Grow)
  }

  const inputStyle = { background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="rounded-2xl border w-full max-w-md p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Plan a run</h2>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLOR.veg }} /> Veg tent
            </label>
            <select value={form.vegTentId} onChange={e => setForm(f => ({ ...f, vegTentId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
              <option value="">— None —</option>
              {vegTents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLOR.flower }} /> Flower tent
            </label>
            <select value={form.equipmentId} onChange={e => setForm(f => ({ ...f, equipmentId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
              {flowerTents.length === 0 && <option value="">Set up a flower tent first</option>}
              {flowerTents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Strain (optional)</label>
          <select value={form.geneticsId} onChange={e => setForm(f => ({ ...f, geneticsId: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            <option value="">— None —</option>
            {allGenetics.map(g => <option key={g.id} value={g.id}>{g.strain_name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Clone date</label>
            <input type="date" value={form.cloneDate} onChange={e => setForm(f => ({ ...f, cloneDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Plants</label>
            <input type="number" min={1} value={form.plantCount} onChange={e => setForm(f => ({ ...f, plantCount: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Veg weeks</label>
            <input type="number" min={0} value={form.vegWeeks} onChange={e => setForm(f => ({ ...f, vegWeeks: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Flower weeks</label>
            <input type="number" min={1} value={form.flowerWeeks} onChange={e => setForm(f => ({ ...f, flowerWeeks: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
          </div>
        </div>

        {/* Pot size — drives how pots render to scale in the tent */}
        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Pot size (gal)</label>
          <div className="flex gap-1.5 flex-wrap">
            {POT_SIZES.map(gal => (
              <button key={gal} type="button" onClick={() => setForm(f => ({ ...f, potSizeGal: gal }))}
                className="px-2.5 py-1 rounded-lg text-xs font-mono border transition-all"
                style={{
                  background:  form.potSizeGal === gal ? 'var(--accent-muted)' : 'transparent',
                  borderColor: form.potSizeGal === gal ? 'var(--accent)' : 'var(--border)',
                  color:       form.potSizeGal === gal ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                {gal}
              </button>
            ))}
          </div>
          {form.equipmentId && (() => {
            const ft = flowerTents.find(t => t.id === form.equipmentId)
            const cap = ft?.max_plants
            if (cap != null && form.plantCount > cap) {
              return <p className="text-[10px]" style={{ color: 'var(--danger)' }}>
                ⚠ {form.plantCount} plants exceeds {ft?.name}'s capacity of {cap}
              </p>
            }
            return null
          })()}
        </div>

        {/* Computed schedule preview */}
        <div className="rounded-lg p-3 grid grid-cols-3 gap-2" style={{ background: 'var(--surface-raised)' }}>
          {[
            { label: 'Clone', date: cloneDate, color: STAGE_COLOR.clone },
            { label: 'Flip', date: flipDate, color: STAGE_COLOR.flower },
            { label: 'Harvest', date: harvestDate, color: STAGE_COLOR.harvest },
          ].map(s => (
            <div key={s.label}>
              <p className="text-[10px]" style={{ color: s.color }}>{s.label}</p>
              <p className="text-xs font-mono font-medium" style={{ color: 'var(--text)' }}>{format(s.date, 'MMM d')}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          <button onClick={save} disabled={saving || !form.equipmentId}
            className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            {saving ? 'Planning…' : 'Add to pipeline'}
          </button>
        </div>
      </div>
    </div>
  )
}
