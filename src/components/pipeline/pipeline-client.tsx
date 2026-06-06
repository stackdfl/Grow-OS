'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  differenceInDays, format, addDays, addWeeks,
  parseISO, eachMonthOfInterval,
} from 'date-fns'
import { Plus, Scissors, GitBranch, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EquipmentProfile, Grow, Genetics } from '@/types/database'

// ─── Layout ──────────────────────────────────────────────────────────────────
const DAY_PX   = 26
const ROW_H    = 88
const HEADER_H = 54
const LABEL_W  = 164
const PADDING  = 45   // days padding before/after

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PALETTE = ['#52B788','#9B5DE5','#F4A261','#F9C74F','#4CC9F0','#E76F51','#90BE6D','#F72585']

function strainColor(name = 'Unknown'): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function potRec(sqft: number, plants: number) {
  const s = sqft / Math.max(plants, 1)
  if (s < 1.5) return { size: '1 gal', note: 'Tight — good for heavy training' }
  if (s < 2.5) return { size: '3 gal', note: 'Ideal for 8–9 wk strains' }
  if (s < 3.5) return { size: '5 gal', note: 'Sweet spot' }
  if (s < 5)   return { size: '7 gal', note: 'Great for living soil' }
  return            { size: '10 gal', note: 'Full expression' }
}

function growStart(g: Grow): Date {
  const d = g.clone_date ?? g.veg_start_date
  return d ? parseISO(d) : parseISO(g.created_at)
}

function growEnd(g: Grow): Date {
  if (g.actual_harvest_date) return parseISO(g.actual_harvest_date)
  if (g.harvest_date)        return parseISO(g.harvest_date)
  if (g.flip_date)           return addDays(parseISO(g.flip_date), 63)
  return addDays(growStart(g), 91)
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props {
  equipment: EquipmentProfile[]
  grows: Grow[]
  allGenetics: Genetics[]
}

interface PlanForm {
  equipmentId: string
  geneticsId: string
  plantCount: number
  cloneDate: string
  vegWeeks: number
  flowerWeeks: number
}

// ─── Component ───────────────────────────────────────────────────────────────
export function PipelineClient({ equipment, grows, allGenetics }: Props) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [perpetual, setPerpetual] = useState(true)
  const [selectedLane, setSelectedLane] = useState<string | null>(null)
  const [planModal, setPlanModal] = useState<Partial<PlanForm> | null>(null)
  const [saving, setSaving] = useState(false)
  const [liveGrows, setLiveGrows] = useState<Grow[]>(grows)

  const today = useMemo(() => new Date(), [])

  // Timeline bounds
  const { origin, timelineEnd, totalDays } = useMemo(() => {
    const allDates = liveGrows.flatMap(g => [growStart(g), growEnd(g)])
    const earliest = allDates.length
      ? new Date(Math.min(...allDates.map(d => d.getTime())))
      : addDays(today, -30)
    const latest = allDates.length
      ? new Date(Math.max(...allDates.map(d => d.getTime())))
      : addDays(today, 180)
    const origin = addDays(earliest, -PADDING)
    const end    = addDays(latest, PADDING + 120)
    return { origin, timelineEnd: end, totalDays: differenceInDays(end, origin) }
  }, [liveGrows, today])

  const toPx = (date: Date) => differenceInDays(date, origin) * DAY_PX
  const todayX = toPx(today)

  // Scroll to center on today
  useEffect(() => {
    if (timelineRef.current) {
      const center = todayX - timelineRef.current.clientWidth / 2 + LABEL_W
      timelineRef.current.scrollLeft = Math.max(0, center)
    }
  }, [todayX])

  // Month labels
  const months = useMemo(
    () => eachMonthOfInterval({ start: origin, end: timelineEnd }),
    [origin, timelineEnd]
  )

  // Grows keyed by equipment profile
  const growsByEquip = useMemo(() => {
    const map = new Map<string, Grow[]>()
    for (const ep of equipment) map.set(ep.id, [])
    for (const g of liveGrows) {
      if (g.equipment_profile_id && map.has(g.equipment_profile_id)) {
        map.get(g.equipment_profile_id)!.push(g)
      }
    }
    return map
  }, [equipment, liveGrows])

  // Perpetual action recommendations
  const actions = useMemo(() => {
    if (!perpetual) return []
    type Action = { label: string; date: Date; type: 'clone' | 'flip' | 'harvest' }
    const out: Action[] = []

    const flowerTents = equipment.filter(
      ep => (ep.usable_sqft ?? 0) >= 6 || ((ep.tent_width_ft ?? 0) * (ep.tent_length_ft ?? 0) >= 6)
    )

    for (const tent of flowerTents) {
      const tentGrows = (growsByEquip.get(tent.id) ?? [])
        .filter(g => !['complete','failed','planned'].includes(g.status))
        .sort((a, b) => growEnd(b).getTime() - growEnd(a).getTime())

      const latest = tentGrows[0]
      if (!latest) continue

      const harvestDate  = growEnd(latest)
      const nextClone    = addDays(harvestDate, -14) // cut 2 wks before harvest so they're ready
      const nextStart    = addDays(harvestDate, 7)   // 1 wk cleanup after harvest
      const nextFlip     = addWeeks(nextStart, 4)    // 4 wk veg

      if (latest.flip_date) {
        out.push({ type: 'harvest', label: `Harvest ${tent.name}`, date: harvestDate })
      }
      out.push({ type: 'clone', label: `Cut clones → next ${tent.name}`, date: nextClone })
      out.push({ type: 'flip',  label: `Flip ${tent.name} — next run`,   date: nextFlip })
    }

    return out
      .filter(a => a.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 7)
  }, [perpetual, equipment, growsByEquip, today])

  // ─── Plan run ──────────────────────────────────────────────────────────────
  async function handlePlanRun() {
    if (!planModal?.equipmentId || !planModal.cloneDate) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const vegWks    = planModal.vegWeeks ?? 4
    const flowerWks = planModal.flowerWeeks ?? 9
    const cloneDate = parseISO(planModal.cloneDate)
    const flipDate  = addWeeks(cloneDate, vegWks)
    const harvestDate = addWeeks(flipDate, flowerWks)
    const genetics  = allGenetics.find(g => g.id === planModal.geneticsId)
    const name = genetics
      ? `${genetics.strain_name} — ${format(cloneDate, 'MMM yyyy')}`
      : `Planned Run — ${format(cloneDate, 'MMM yyyy')}`

    const { data, error } = await supabase
      .from('grows')
      .insert({
        user_id: user.id,
        name,
        genetics_id: planModal.geneticsId || null,
        equipment_profile_id: planModal.equipmentId,
        status: 'planned',
        plant_count: planModal.plantCount ?? 4,
        clone_date:    format(cloneDate,    'yyyy-MM-dd'),
        flip_date:     format(flipDate,     'yyyy-MM-dd'),
        harvest_date:  format(harvestDate,  'yyyy-MM-dd'),
      } as never)
      .select('*, genetics(*)')
      .single()

    if (!error && data) setLiveGrows(prev => [...prev, data as Grow])
    setSaving(false)
    setPlanModal(null)
  }

  const selectedEquip = equipment.find(e => e.id === selectedLane)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0" style={{ color: 'var(--text)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h1 className="text-lg font-semibold">Pipeline</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Plant lifecycle · click a lane to select it
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPerpetual(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={{
              background:   perpetual ? 'var(--accent-muted)' : 'var(--surface-raised)',
              borderColor:  perpetual ? 'var(--accent)'       : 'var(--border)',
              color:        perpetual ? 'var(--accent)'        : 'var(--text-secondary)',
            }}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Perpetual
          </button>
          <button
            onClick={() =>
              setPlanModal({
                equipmentId: equipment[0]?.id ?? '',
                vegWeeks: 4,
                flowerWeeks: 9,
                plantCount: equipment[0]?.max_plants ?? 4,
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Plan Run
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Timeline ── */}
        <div
          ref={timelineRef}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-auto"
        >
          <div
            style={{
              position: 'relative',
              width:  LABEL_W + totalDays * DAY_PX,
              minHeight: HEADER_H + Math.max(equipment.length, 1) * ROW_H,
            }}
          >
            {/* Month header (sticky top) */}
            <div
              className="sticky top-0 z-20 flex"
              style={{
                height: HEADER_H,
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {/* Lane label column spacer */}
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  borderRight: '1px solid var(--border)',
                }}
              />

              {/* Month + week ticks */}
              <div style={{ flex: 1, position: 'relative' }}>
                {months.map(mo => {
                  const x = toPx(mo)
                  const daysInMo = differenceInDays(
                    new Date(mo.getFullYear(), mo.getMonth() + 1, 1),
                    mo
                  )
                  return (
                    <div
                      key={mo.toISOString()}
                      style={{
                        position: 'absolute',
                        left: x,
                        top: 0,
                        width: daysInMo * DAY_PX,
                        height: HEADER_H,
                        borderRight: '1px solid var(--border)',
                        padding: '8px 10px 0',
                        pointerEvents: 'none',
                      }}
                    >
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {format(mo, 'MMM')}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {format(mo, 'yyyy')}
                      </div>
                    </div>
                  )
                })}

                {/* Week tick marks */}
                {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: i * 7 * DAY_PX,
                      bottom: 0,
                      width: 1,
                      height: 10,
                      background: 'var(--border)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Today line */}
            <div
              style={{
                position: 'absolute',
                left: LABEL_W + todayX,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--accent)',
                opacity: 0.75,
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: HEADER_H - 20,
                  left: -18,
                  background: 'var(--accent)',
                  color: '#0a0f0d',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                TODAY
              </div>
            </div>

            {/* Empty state */}
            {equipment.length === 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ top: HEADER_H, color: 'var(--text-muted)' }}
              >
                <GitBranch className="w-10 h-10 opacity-30" />
                <p className="text-sm">No grow spaces set up yet.</p>
                <a href="/equipment" className="text-xs underline" style={{ color: 'var(--accent)' }}>
                  Add your first space →
                </a>
              </div>
            )}

            {/* Swim lanes */}
            {equipment.map((ep, idx) => {
              const laneGrows = (growsByEquip.get(ep.id) ?? [])
                .sort((a, b) => growStart(a).getTime() - growStart(b).getTime())
              const isSelected = selectedLane === ep.id
              const sqft = ep.usable_sqft ??
                (ep.tent_width_ft && ep.tent_length_ft
                  ? ep.tent_width_ft * ep.tent_length_ft
                  : null)

              return (
                <div
                  key={ep.id}
                  style={{
                    position: 'absolute',
                    top: HEADER_H + idx * ROW_H,
                    left: 0,
                    right: 0,
                    height: ROW_H,
                    borderBottom: '1px solid var(--border)',
                  }}
                  onClick={() => setSelectedLane(isSelected ? null : ep.id)}
                >
                  {/* Lane label */}
                  <div
                    className="flex flex-col justify-center px-3 cursor-pointer transition-colors"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: LABEL_W,
                      height: ROW_H,
                      borderRight: '1px solid var(--border)',
                      background: isSelected ? 'var(--accent-muted)' : 'var(--surface)',
                      zIndex: 5,
                    }}
                  >
                    <div
                      className="text-xs font-semibold truncate"
                      style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {ep.name}
                    </div>
                    {sqft && (
                      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {ep.tent_width_ft}×{ep.tent_length_ft} ft
                        {ep.tent_height_ft ? ` · ${ep.tent_height_ft}h` : ''}
                      </div>
                    )}
                    {ep.max_plants && (
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        max {ep.max_plants} plants
                      </div>
                    )}
                  </div>

                  {/* Lane content */}
                  <div
                    style={{
                      position: 'absolute',
                      left: LABEL_W,
                      top: 0,
                      right: 0,
                      height: ROW_H,
                      background: idx % 2 === 1 ? 'rgba(255,255,255,0.012)' : 'transparent',
                    }}
                  >
                    {/* Grow blocks */}
                    {laneGrows.map(g => {
                      const start   = growStart(g)
                      const end     = growEnd(g)
                      const flip    = g.flip_date ? parseISO(g.flip_date) : null
                      const x       = toPx(start)
                      const totalW  = Math.max(differenceInDays(end, start) * DAY_PX, 56)
                      const vegW    = flip
                        ? Math.max(0, differenceInDays(flip, start) * DAY_PX)
                        : totalW * 0.32
                      const color   = strainColor(g.genetics?.strain_name ?? g.name)
                      const planned = g.status === 'planned'

                      return (
                        <a
                          key={g.id}
                          href={`/grows/${g.id}`}
                          title={`${g.name}\n${format(start, 'MMM d')} → ${format(end, 'MMM d')}`}
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            left: x,
                            top: 11,
                            width: totalW,
                            height: ROW_H - 22,
                            borderRadius: 8,
                            overflow: 'hidden',
                            opacity: planned ? 0.55 : 1,
                            border: planned
                              ? `1.5px dashed ${color}`
                              : `1.5px solid ${color}55`,
                            textDecoration: 'none',
                            display: 'block',
                          }}
                        >
                          {/* Veg gradient */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0, top: 0,
                              width: vegW, height: '100%',
                              background: `${color}1a`,
                            }}
                          />
                          {/* Flower gradient */}
                          <div
                            style={{
                              position: 'absolute',
                              left: vegW, top: 0,
                              right: 0, height: '100%',
                              background: `${color}40`,
                            }}
                          />
                          {/* Veg/flower divider */}
                          {flip && vegW > 0 && vegW < totalW && (
                            <div
                              style={{
                                position: 'absolute',
                                left: vegW,
                                top: 0, bottom: 0,
                                width: 1.5,
                                background: `${color}99`,
                              }}
                            />
                          )}
                          {/* Label */}
                          <div className="relative flex items-center h-full px-2 gap-1.5 z-10">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: color }}
                            />
                            <div className="min-w-0">
                              <div
                                className="text-[11px] font-semibold truncate"
                                style={{
                                  color: 'var(--text)',
                                  maxWidth: Math.max(totalW - 30, 32),
                                }}
                              >
                                {g.genetics?.strain_name ?? g.name}
                              </div>
                              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                {g.plant_count}p · {planned ? 'planned' : g.status}
                              </div>
                            </div>
                          </div>
                        </a>
                      )
                    })}

                    {/* Empty lane CTA */}
                    {laneGrows.length === 0 && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setPlanModal({
                            equipmentId: ep.id,
                            vegWeeks: 4,
                            flowerWeeks: 9,
                            plantCount: ep.max_plants ?? 4,
                          })
                        }}
                        className="absolute flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed text-xs transition-opacity hover:opacity-80"
                        style={{
                          left: 16, right: 16,
                          top: '50%', transform: 'translateY(-50%)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-muted)',
                          background: 'transparent',
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Plan a run in {ep.name}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div
          className="hidden lg:flex flex-col w-60 shrink-0 border-l overflow-y-auto"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >

          {/* Capacity calculator for selected lane */}
          {selectedEquip ? (() => {
            const sqft = selectedEquip.usable_sqft ??
              (selectedEquip.tent_width_ft && selectedEquip.tent_length_ft
                ? selectedEquip.tent_width_ft * selectedEquip.tent_length_ft
                : null)
            const maxP = selectedEquip.max_plants ?? 4

            return (
              <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div
                  className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {selectedEquip.name} · Capacity
                </div>
                {sqft ? (
                  <div className="space-y-1.5">
                    {([2, 3, 4, Math.min(maxP + (maxP < 6 ? 2 : 0), 8)] as number[])
                      .filter((v, i, a) => a.indexOf(v) === i && v > 0)
                      .sort((a, b) => a - b)
                      .map(n => {
                        const rec = potRec(sqft, n)
                        const highlight = n === maxP
                        return (
                          <div
                            key={n}
                            className="flex items-center justify-between text-xs rounded-lg px-2.5 py-2"
                            style={{
                              background: highlight ? 'var(--accent-muted)' : 'var(--surface-raised)',
                              borderLeft: highlight ? '2px solid var(--accent)' : '2px solid transparent',
                            }}
                          >
                            <span style={{ color: 'var(--text-secondary)' }}>{n} plants</span>
                            <div className="text-right">
                              <div
                                className="font-semibold"
                                style={{ color: highlight ? 'var(--accent)' : 'var(--text)' }}
                              >
                                {rec.size}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                                {rec.note}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    <p className="text-[9px] pt-1" style={{ color: 'var(--text-muted)' }}>
                      Based on {sqft} sqft floor · recommendations assume canopy training
                    </p>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Add tent dimensions in Equipment settings to see recommendations.
                  </p>
                )}
              </div>
            )
          })() : (
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Click a lane to see pot size recommendations for that space.
              </p>
            </div>
          )}

          {/* Perpetual actions */}
          <div className="p-4 flex-1">
            <div
              className="text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              {perpetual ? 'Upcoming actions' : 'Perpetual off'}
            </div>

            {!perpetual ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enable perpetual mode to see automated clone / flip / harvest recommendations.
              </p>
            ) : actions.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No active grows to project from. Add a grow to see upcoming actions.
              </p>
            ) : (
              <div className="space-y-2">
                {actions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface-raised)' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background:
                          action.type === 'clone' ? 'rgba(155,93,229,0.2)' :
                          action.type === 'flip'  ? 'rgba(249,199,79,0.2)' :
                          'rgba(82,183,136,0.2)',
                      }}
                    >
                      {action.type === 'clone' ? (
                        <Scissors  className="w-2.5 h-2.5" style={{ color: 'var(--purple)' }} />
                      ) : action.type === 'flip' ? (
                        <GitBranch className="w-2.5 h-2.5" style={{ color: 'var(--gold)' }} />
                      ) : (
                        <Check     className="w-2.5 h-2.5" style={{ color: 'var(--accent)' }} />
                      )}
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)' }}>{action.label}</div>
                      <div className="font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {format(action.date, 'EEE, MMM d')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Plan Run Modal ── */}
      {planModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setPlanModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border p-6 space-y-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Plan a Run</h2>
              <button onClick={() => setPlanModal(null)} style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grow space */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Grow space
              </label>
              <select
                value={planModal.equipmentId ?? ''}
                onChange={e => setPlanModal(p => ({ ...p, equipmentId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <option value="">Select space…</option>
                {equipment.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
            </div>

            {/* Strain */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Strain
              </label>
              <select
                value={planModal.geneticsId ?? ''}
                onChange={e => setPlanModal(p => ({ ...p, geneticsId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <option value="">Select strain…</option>
                {allGenetics.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.strain_name}{g.breeder ? ` — ${g.breeder}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Clone date + plant count */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Clone date
                </label>
                <input
                  type="date"
                  value={planModal.cloneDate ?? ''}
                  onChange={e => setPlanModal(p => ({ ...p, cloneDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Plant count
                </label>
                <input
                  type="number"
                  min={1} max={20}
                  value={planModal.plantCount ?? 4}
                  onChange={e => setPlanModal(p => ({ ...p, plantCount: parseInt(e.target.value) || 4 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Veg + flower weeks */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Veg weeks
                </label>
                <input
                  type="number"
                  min={1} max={16}
                  value={planModal.vegWeeks ?? 4}
                  onChange={e => setPlanModal(p => ({ ...p, vegWeeks: parseInt(e.target.value) || 4 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Flower weeks
                </label>
                <input
                  type="number"
                  min={6} max={20}
                  value={planModal.flowerWeeks ?? 9}
                  onChange={e => setPlanModal(p => ({ ...p, flowerWeeks: parseInt(e.target.value) || 9 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Date preview */}
            {planModal.cloneDate && (() => {
              const cd = parseISO(planModal.cloneDate)
              const fd = addWeeks(cd, planModal.vegWeeks ?? 4)
              const hd = addWeeks(fd, planModal.flowerWeeks ?? 9)
              return (
                <div
                  className="text-xs p-3 rounded-lg space-y-1.5"
                  style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
                >
                  <div className="flex justify-between">
                    <span>Clone cut</span>
                    <span style={{ color: 'var(--text)' }}>{format(cd, 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Flip to flower</span>
                    <span style={{ color: 'var(--gold)' }}>{format(fd, 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Harvest window</span>
                    <span style={{ color: 'var(--accent)' }}>{format(hd, 'MMM d, yyyy')}</span>
                  </div>
                </div>
              )
            })()}

            <button
              onClick={handlePlanRun}
              disabled={saving || !planModal.equipmentId || !planModal.cloneDate}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}
            >
              {saving ? 'Saving…' : 'Save planned run'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
