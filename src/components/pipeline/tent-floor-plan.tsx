'use client'

import { useMemo } from 'react'
import { differenceInDays, startOfDay } from 'date-fns'
import type { Grow, EquipmentProfile } from '@/types/database'
import {
  getStageAtDate, getPotBadge, resolveDates, tentOccupancyAt, growTentAt,
  STAGE_COLOR, STAGE_HEIGHT, STAGE_LABEL,
  type PipelineStage, type MoveEvent,
} from '@/lib/pipeline/stages'

const PX_PER_FT = 60
const TENT_PAD = 22
const LABEL_H = 30
const BANNER_H = 18
const GAP_FT = 0.18   // spacing between pots (ft)

const ROLE_TINT: Record<string, { a: string; b: string; chip: string; label: string }> = {
  veg:    { a: '#a7f3d0', b: '#52B788', chip: '#52B788', label: 'VEG' },
  flower: { a: '#e9d5ff', b: '#9B5DE5', chip: '#9B5DE5', label: 'FLOWER' },
  both:   { a: '#fef9e7', b: '#a7f3d0', chip: '#6b8f7b', label: 'VEG + FLOWER' },
}

/** Real-world pot diameter in feet from gallon size (≈ 7·∛gal inches). */
function potDiameterFt(gal: number | null): number {
  const g = Math.max(0.5, gal ?? 5)
  return (7 * Math.cbrt(g)) / 12
}

interface Props {
  tents: EquipmentProfile[]
  grows: Grow[]
  viewDate: Date
  moveByGrow: Map<string, MoveEvent>
  selectedGrowId: string | null
  onSelectGrow: (id: string | null) => void
}

export function TentFloorPlan({ tents, grows, viewDate, moveByGrow, selectedGrowId, onSelectGrow }: Props) {
  const unassigned = useMemo(() => grows.filter(g => {
    const s = getStageAtDate(g, viewDate)
    if (s === 'future' || s === 'done') return false
    return growTentAt(g, viewDate) === null
  }), [grows, viewDate])

  return (
    <div className="flex gap-5 flex-wrap items-start justify-center">
      {tents.map(tent => (
        <TentSvg
          key={tent.id}
          tent={tent}
          grows={grows}
          viewDate={viewDate}
          moveByGrow={moveByGrow}
          selectedGrowId={selectedGrowId}
          onSelectGrow={onSelectGrow}
        />
      ))}
      {unassigned.length > 0 && (
        <UnassignedBox
          grows={unassigned}
          viewDate={viewDate}
          selectedGrowId={selectedGrowId}
          onSelectGrow={onSelectGrow}
        />
      )}
    </div>
  )
}

interface Cell {
  cx: number
  cy: number
  r: number
  grow: Grow | null          // null = empty (ghost) slot
  stage: PipelineStage | null
}

/**
 * Lay out `cells` in a centered, non-overlapping grid scaled to the tent floor.
 * Pots are drawn at true physical size; the whole grid shrinks uniformly only
 * if it would otherwise overflow (i.e. tent is over capacity) — never overlap.
 */
function layoutGrid(
  pots: { grow: Grow | null; gal: number | null }[],
  floorX: number,
  floorW: number,
  floorH: number,
  topOffset: number,
  viewDate: Date,
): Cell[] {
  const n = pots.length
  if (!n) return []

  const radiiPx = pots.map(p => (potDiameterFt(p.gal) / 2) * PX_PER_FT)
  const maxR = Math.max(...radiiPx)
  const cellPx = maxR * 2 + GAP_FT * PX_PER_FT

  let cols = Math.max(1, Math.floor(floorW / cellPx))
  cols = Math.min(cols, n)
  const rows = Math.ceil(n / cols)

  const blockW = cols * cellPx
  const blockH = rows * cellPx
  const scale = Math.min(1, floorW / blockW, floorH / blockH)
  const sCell = cellPx * scale

  const gridW = cols * sCell
  const gridH = rows * sCell
  const startX = floorX + (floorW - gridW) / 2 + sCell / 2
  const startY = topOffset + (floorH - gridH) / 2 + sCell / 2

  return pots.map((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const r = Math.max(5, (potDiameterFt(p.gal) / 2) * PX_PER_FT * scale)
    return {
      cx: startX + col * sCell,
      cy: startY + row * sCell,
      r,
      grow: p.grow,
      stage: p.grow ? getStageAtDate(p.grow, viewDate) : null,
    }
  })
}

function TentSvg({ tent, grows, viewDate, moveByGrow, selectedGrowId, onSelectGrow }: {
  tent: EquipmentProfile
  grows: Grow[]
  viewDate: Date
  moveByGrow: Map<string, MoveEvent>
  selectedGrowId: string | null
  onSelectGrow: (id: string | null) => void
}) {
  const occ = useMemo(() => tentOccupancyAt(tent, grows, viewDate), [tent, grows, viewDate])
  const role = (tent.role ?? 'both') as keyof typeof ROLE_TINT
  const tint = ROLE_TINT[role] ?? ROLE_TINT.both

  const wFt = tent.tent_width_ft ?? 4
  const lFt = tent.tent_length_ft ?? 4
  const floorW = wFt * PX_PER_FT
  const floorH = lFt * PX_PER_FT
  const headerH = LABEL_H + (occ.overCapacity ? BANNER_H : 0)
  // Guarantee enough width for the header text even on small tents
  const svgW = Math.max(floorW + TENT_PAD * 2, 188)
  const floorX = (svgW - floorW) / 2
  const svgH = floorH + TENT_PAD * 2 + headerH

  const filterId = `glow-${tent.id}`
  const lightId = `light-${tent.id}`
  const floorTop = headerH + TENT_PAD

  const cells = useMemo<Cell[]>(() => {
    // One pot per plant of each occupant grow
    const occupied: { grow: Grow | null; gal: number | null }[] = []
    for (const g of occ.grows) {
      const n = Math.max(1, g.plant_count || 1)
      for (let k = 0; k < n; k++) occupied.push({ grow: g, gal: g.container_size_gal })
    }
    // Pad with empty slots up to capacity so the room limit is visible
    const capacity = tent.max_plants ?? occupied.length
    const ghostCount = Math.max(0, capacity - occupied.length)
    const ghosts = Array.from({ length: ghostCount }, () => ({ grow: null, gal: tent.pot_size_gal }))
    return layoutGrid([...occupied, ...ghosts], floorX, floorW, floorH, floorTop, viewDate)
  }, [occ.grows, tent.max_plants, tent.pot_size_gal, floorX, floorW, floorH, floorTop, viewDate])

  const borderColor = occ.overCapacity ? 'var(--danger)' : 'var(--border)'

  // Only show an action badge on the FIRST pot of each grow (avoid overlap)
  const firstCellOfGrow = useMemo(() => {
    const m = new Map<string, number>()
    cells.forEach((c, i) => { if (c.grow && !m.has(c.grow.id)) m.set(c.grow.id, i) })
    return m
  }, [cells])

  return (
    <div className="shrink-0" style={{ width: svgW, maxWidth: '100%' }}>
      <svg
        width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ maxWidth: '100%', height: 'auto' }}
        role="img" aria-label={`${tent.name} floor plan`}
      >
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id={lightId} cx="50%" cy="42%" r="62%">
            <stop offset="0%"  stopColor={tint.a} stopOpacity="0.18" />
            <stop offset="45%" stopColor={tint.b} stopOpacity="0.07" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Header */}
        <text x={14} y={15} fontSize="12" fontWeight="700" fill="var(--text)">{tent.name}</text>
        <g transform={`translate(${14}, 20)`}>
          <RoleChip color={tint.chip} label={tint.label} />
        </g>
        <text x={svgW - 14} y={15} fontSize="11" fontWeight="700"
          fill={occ.overCapacity ? 'var(--danger)' : 'var(--text-muted)'} textAnchor="end">
          {tent.max_plants != null ? `${occ.plants}/${tent.max_plants}` : `${occ.plants}`} plants
        </text>
        <text x={svgW - 14} y={26} fontSize="9" fill="var(--text-muted)" textAnchor="end">
          {wFt}×{lFt} ft{tent.pot_size_gal ? ` · ${tent.pot_size_gal} gal` : ''}
        </text>

        {/* Over-capacity banner */}
        {occ.overCapacity && (
          <g transform={`translate(0, ${LABEL_H})`}>
            <rect x={floorX} y={0} width={floorW} height={BANNER_H - 4} rx="4"
              fill="var(--danger)" fillOpacity="0.18" stroke="var(--danger)" strokeWidth="0.75" />
            <text x={svgW / 2} y={11} fontSize="9.5" fontWeight="800" fill="var(--danger)"
              textAnchor="middle" letterSpacing="0.06em">
              ⚠ NOT ENOUGH ROOM — {occ.plants - (occ.capacity ?? 0)} OVER
            </text>
          </g>
        )}

        {/* Floor */}
        <rect x={floorX} y={floorTop} width={floorW} height={floorH} rx="8"
          fill="#0b1410" stroke={borderColor} strokeWidth="1.5" strokeDasharray="5 4" />
        <rect x={floorX} y={floorTop} width={floorW} height={floorH} rx="8"
          fill={`url(#${lightId})`} pointerEvents="none" />

        {cells.map((cell, i) =>
          cell.grow ? (
            <PotGlyph
              key={`${cell.grow.id}-${i}`}
              cell={cell} filterId={filterId} viewDate={viewDate}
              move={moveByGrow.get(cell.grow.id) ?? null}
              showBadge={firstCellOfGrow.get(cell.grow.id) === i}
              selected={selectedGrowId === cell.grow.id}
              onClick={() => onSelectGrow(selectedGrowId === cell.grow!.id ? null : cell.grow!.id)}
            />
          ) : (
            <circle key={`ghost-${i}`} cx={cell.cx} cy={cell.cy} r={cell.r}
              fill="none" stroke="var(--border)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.45" />
          )
        )}

        {cells.length === 0 && (
          <text x={svgW / 2} y={floorTop + floorH / 2} fontSize="11" fill="var(--text-muted)" textAnchor="middle">
            empty
          </text>
        )}
      </svg>

      {/* Strain legend */}
      {occ.grows.length > 0 && (
        <div className="mt-1 space-y-0.5 px-0.5">
          {occ.grows.map(g => {
            const s = getStageAtDate(g, viewDate)
            const name = g.genetics?.strain_name ?? g.name
            return (
              <button key={g.id} onClick={() => onSelectGrow(selectedGrowId === g.id ? null : g.id)}
                className="flex items-center gap-1.5 w-full text-left rounded px-1 py-0.5 transition-colors hover:bg-[--surface-raised]"
                style={{ background: selectedGrowId === g.id ? 'var(--surface-raised)' : 'transparent' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STAGE_COLOR[s] }} />
                <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{name}</span>
                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                  ×{g.plant_count}{g.container_size_gal ? ` · ${g.container_size_gal}g` : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RoleChip({ color, label }: { color: string; label: string }) {
  const w = label.length * 5.4 + 12
  return (
    <g>
      <rect width={w} height="13" rx="6.5" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="0.6" />
      <text x={w / 2} y="9.5" fontSize="8" fontWeight="800" fill={color} textAnchor="middle" letterSpacing="0.05em">
        {label}
      </text>
    </g>
  )
}

function UnassignedBox({ grows, viewDate, selectedGrowId, onSelectGrow }: {
  grows: Grow[]
  viewDate: Date
  selectedGrowId: string | null
  onSelectGrow: (id: string | null) => void
}) {
  const floorW = 4 * PX_PER_FT
  const floorH = 2.4 * PX_PER_FT
  const floorTop = LABEL_H + TENT_PAD
  const svgW = floorW + TENT_PAD * 2
  const svgH = floorH + TENT_PAD * 2 + LABEL_H

  const slots: { grow: Grow | null; gal: number | null }[] = []
  for (const g of grows) {
    const n = Math.max(1, g.plant_count || 1)
    for (let k = 0; k < n; k++) slots.push({ grow: g, gal: g.container_size_gal })
  }
  const cells = layoutGrid(slots, TENT_PAD, floorW, floorH, floorTop, viewDate)
  const firstCellOfGrow = new Map<string, number>()
  cells.forEach((c, i) => { if (c.grow && !firstCellOfGrow.has(c.grow.id)) firstCellOfGrow.set(c.grow.id, i) })

  return (
    <div className="shrink-0" style={{ width: svgW, maxWidth: '100%' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <defs>
          <filter id="glow-unassigned" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <text x={TENT_PAD} y={15} fontSize="12" fontWeight="700" fill="var(--warning)">Unassigned</text>
        <text x={svgW - TENT_PAD} y={15} fontSize="10" fill="var(--text-muted)" textAnchor="end">no tent set</text>
        <rect x={TENT_PAD} y={floorTop} width={floorW} height={floorH} rx="8"
          fill="#0b1410" stroke="var(--warning)" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.8" />
        {cells.map((cell, i) => cell.grow && (
          <PotGlyph
            key={`${cell.grow.id}-${i}`}
            cell={cell} filterId="glow-unassigned" viewDate={viewDate} move={null}
            showBadge={firstCellOfGrow.get(cell.grow.id) === i}
            selected={selectedGrowId === cell.grow.id}
            onClick={() => onSelectGrow(selectedGrowId === cell.grow!.id ? null : cell.grow!.id)}
          />
        ))}
      </svg>

      {grows.length > 0 && (
        <div className="mt-1 space-y-0.5 px-0.5">
          {grows.map(g => {
            const s = getStageAtDate(g, viewDate)
            const name = g.genetics?.strain_name ?? g.name
            return (
              <button key={g.id} onClick={() => onSelectGrow(selectedGrowId === g.id ? null : g.id)}
                className="flex items-center gap-1.5 w-full text-left rounded px-1 py-0.5 transition-colors hover:bg-[--surface-raised]"
                style={{ background: selectedGrowId === g.id ? 'var(--surface-raised)' : 'transparent' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STAGE_COLOR[s] }} />
                <span className="text-[11px] font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{name}</span>
                <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>×{g.plant_count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PotGlyph({ cell, filterId, viewDate, move, showBadge, selected, onClick }: {
  cell: Cell
  filterId: string
  viewDate: Date
  move: MoveEvent | null
  showBadge: boolean
  selected: boolean
  onClick: () => void
}) {
  const { cx, cy, r, grow, stage } = cell
  if (!grow || !stage) return null
  const color = STAGE_COLOR[stage]
  const heightFrac = STAGE_HEIGHT[stage]
  const isGhost = stage === 'future'

  const moveBadge = computeMoveBadge(stage, viewDate, move)
  const badge = showBadge ? (moveBadge ?? getPotBadge(grow, viewDate)) : null

  const barH = 4 + heightFrac * 26
  const barW = Math.max(3, r * 0.5)

  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      {!isGhost && stage !== 'done' && (
        <rect x={cx - barW / 2} y={cy - r - barH} width={barW} height={barH} rx={barW / 2}
          fill={color} opacity="0.55"
          style={{ transition: 'height 0.3s ease, fill 0.3s ease, y 0.3s ease' }} />
      )}

      <circle cx={cx} cy={cy} r={r}
        fill={color} fillOpacity={isGhost ? 0.12 : 0.92}
        stroke={isGhost ? 'var(--border)' : color} strokeWidth={selected ? 3 : 1.5}
        strokeDasharray={isGhost ? '3 3' : undefined}
        filter={isGhost ? undefined : `url(#${filterId})`}
        style={{ transition: 'fill 0.3s ease, fill-opacity 0.3s ease' }} />

      {selected && (
        <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="var(--text)" strokeWidth="1" opacity="0.5" />
      )}

      {badge?.pulse && (
        <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={badge.color} strokeWidth="2" className="pipeline-pulse" />
      )}

      {badge && (
        <g transform={`translate(${cx}, ${cy - r - barH - 9})`}>
          <BadgePill text={badge.text} color={badge.color} />
        </g>
      )}
    </g>
  )
}

function computeMoveBadge(stage: PipelineStage, viewDate: Date, move: MoveEvent | null): { text: string; color: string; pulse: boolean } | null {
  if (!move || !move.toTentName) return null
  if (stage !== 'veg' && stage !== 'clone') return null
  const days = differenceInDays(startOfDay(move.date), startOfDay(viewDate))
  if (days < 0 || days > 14) return null
  const tentShort = move.toTentName.length > 10 ? move.toTentName.slice(0, 9) + '…' : move.toTentName
  if (move.overCapacity) {
    return { text: `⚠ ${tentShort} full`, color: '#E76F51', pulse: days <= 5 }
  }
  return { text: `→ ${tentShort} ${days}d`, color: '#9B5DE5', pulse: false }
}

function BadgePill({ text, color }: { text: string; color: string }) {
  const w = text.length * 6.4 + 12
  return (
    <g transform={`translate(${-w / 2}, -9)`}>
      <rect width={w} height="16" rx="8" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="0.75" />
      <text x={w / 2} y="11.5" fontSize="9" fontWeight="700" fill={color} textAnchor="middle">{text}</text>
    </g>
  )
}

export { STAGE_COLOR, STAGE_LABEL, resolveDates }
