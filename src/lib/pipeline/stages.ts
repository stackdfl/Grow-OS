import { addDays, differenceInDays, parseISO, startOfDay } from 'date-fns'
import type { Grow, EquipmentProfile } from '@/types/database'

// Stages we render in the planner (simplified from GrowStatus)
export type PipelineStage =
  | 'future'    // not started yet
  | 'clone'     // clone / seedling
  | 'veg'
  | 'flower'
  | 'flush'
  | 'harvest'   // ready to chop
  | 'done'      // chopped / drying / curing / complete

export const STAGE_COLOR: Record<PipelineStage, string> = {
  future:  '#3a4a42',
  clone:   '#22c55e',
  veg:     '#52B788',
  flower:  '#9B5DE5',
  flush:   '#F4A261',
  harvest: '#F9C74F',
  done:    '#6b7280',
}

export const STAGE_LABEL: Record<PipelineStage, string> = {
  future:  'Not started',
  clone:   'Clone',
  veg:     'Veg',
  flower:  'Flower',
  flush:   'Flush',
  harvest: 'Harvest',
  done:    'Done',
}

// Plant height as a 0..1 fraction of full size — drives the canopy bar
export const STAGE_HEIGHT: Record<PipelineStage, number> = {
  future:  0.05,
  clone:   0.15,
  veg:     0.5,
  flower:  0.85,
  flush:   1.0,
  harvest: 1.0,
  done:    0.0,
}

const DEFAULT_FLOWER_DAYS = 63 // 9 weeks if no harvest date set
const FLUSH_LEAD_DAYS = 10     // last N days of flower treated as flush
const CLONE_LEAD_DAYS = 14     // take cuts this many days before a flip
const HARVEST_WARN_DAYS = 14   // start warning this many days before harvest

export interface ResolvedDates {
  clone: Date | null
  veg: Date | null
  flip: Date | null
  harvest: Date | null
  harvestEstimated: boolean
}

/** Pull the key dates off a grow, estimating harvest from flip if unset. */
export function resolveDates(grow: Grow): ResolvedDates {
  const clone = grow.clone_date ? parseISO(grow.clone_date) : null
  const veg   = grow.veg_start_date ? parseISO(grow.veg_start_date) : null
  const flip  = grow.flip_date ? parseISO(grow.flip_date) : null

  let harvest: Date | null = null
  let harvestEstimated = false
  if (grow.actual_harvest_date) {
    harvest = parseISO(grow.actual_harvest_date)
  } else if (grow.harvest_date) {
    harvest = parseISO(grow.harvest_date)
  } else if (flip) {
    harvest = addDays(flip, DEFAULT_FLOWER_DAYS)
    harvestEstimated = true
  }

  return { clone, veg, flip, harvest, harvestEstimated }
}

/** What stage is this grow in on a given date? */
export function getStageAtDate(grow: Grow, date: Date): PipelineStage {
  const d = startOfDay(date)
  const { clone, veg, flip, harvest } = resolveDates(grow)

  // Terminal: once chopped it's done for planning purposes
  if (harvest && d >= harvest) {
    // small harvest window where it's "ready" exactly on the day, otherwise done
    return d.getTime() === harvest.getTime() ? 'harvest' : 'done'
  }
  if (flip) {
    if (d >= flip) {
      if (harvest && differenceInDays(harvest, d) <= FLUSH_LEAD_DAYS) return 'flush'
      return 'flower'
    }
  }
  if (veg && d >= veg) return 'veg'
  if (clone && d >= clone) return 'clone'

  // If only flip is known and we're before it, infer veg for the 3 weeks prior
  if (flip && d >= addDays(flip, -21)) return 'veg'

  return 'future'
}

// ── Events ──────────────────────────────────────────────────────────────────

export type PipelineEventType = 'cut' | 'transfer' | 'flip' | 'harvest'

export interface PipelineEvent {
  growId: string
  growName: string
  type: PipelineEventType
  date: Date
  label: string
  color: string
  estimated: boolean
}

export const EVENT_META: Record<PipelineEventType, { color: string; icon: string }> = {
  cut:      { color: '#22c55e', icon: '✂' },
  transfer: { color: '#38bdf8', icon: '⇄' },
  flip:     { color: '#9B5DE5', icon: '⚡' },
  harvest:  { color: '#F9C74F', icon: '🌾' },
}

/** Derive the actionable events for one grow. */
export function getGrowEvents(grow: Grow): PipelineEvent[] {
  const { clone, veg, flip, harvest, harvestEstimated } = resolveDates(grow)
  const events: PipelineEvent[] = []
  const name = grow.name

  // Take a cut — 2 weeks before flip, so the next round is rooted in time
  if (flip) {
    events.push({
      growId: grow.id, growName: name, type: 'cut',
      date: addDays(flip, -CLONE_LEAD_DAYS),
      label: `Take cuttings from ${name}`,
      color: EVENT_META.cut.color, estimated: false,
    })
  }

  // Transfer — transplant into veg containers at veg start
  if (veg) {
    events.push({
      growId: grow.id, growName: name, type: 'transfer',
      date: veg,
      label: `Transplant ${name} to veg`,
      color: EVENT_META.transfer.color, estimated: false,
    })
  } else if (clone) {
    // fallback: transplant ~14d after clone if no veg date
    events.push({
      growId: grow.id, growName: name, type: 'transfer',
      date: addDays(clone, 14),
      label: `Transplant ${name}`,
      color: EVENT_META.transfer.color, estimated: true,
    })
  }

  // Flip to flower
  if (flip) {
    events.push({
      growId: grow.id, growName: name, type: 'flip',
      date: flip,
      label: `Flip ${name} to flower`,
      color: EVENT_META.flip.color, estimated: false,
    })
  }

  // Harvest
  if (harvest) {
    events.push({
      growId: grow.id, growName: name, type: 'harvest',
      date: harvest,
      label: `Harvest ${name}`,
      color: EVENT_META.harvest.color, estimated: harvestEstimated,
    })
  }

  return events
}

/** Is this grow's harvest within the warning window of the view date? */
export function harvestProximity(grow: Grow, viewDate: Date): number | null {
  const { harvest } = resolveDates(grow)
  if (!harvest) return null
  const days = differenceInDays(harvest, startOfDay(viewDate))
  if (days < 0 || days > HARVEST_WARN_DAYS) return null
  return days
}

/** A badge to float over a pot at the current view date, if any. */
export interface PotBadge {
  text: string
  color: string
  pulse: boolean
}

// ── Tent occupancy & capacity ────────────────────────────────────────────────

/** Which tent does a grow physically occupy at this stage? */
export function tentForStage(grow: Grow, stage: PipelineStage): string | null {
  if (stage === 'clone' || stage === 'veg') {
    return grow.veg_tent_id ?? grow.equipment_profile_id ?? null
  }
  if (stage === 'flower' || stage === 'flush' || stage === 'harvest') {
    return grow.equipment_profile_id ?? null
  }
  return null // future / done — not occupying space
}

/** Which tent is a grow in on a given date (null if not in any). */
export function growTentAt(grow: Grow, date: Date): string | null {
  return tentForStage(grow, getStageAtDate(grow, date))
}

export interface TentOccupancy {
  grows: Grow[]
  plants: number
  capacity: number | null
  overCapacity: boolean
}

/** Who is in this tent on a date, and is it over capacity? */
export function tentOccupancyAt(tent: EquipmentProfile, grows: Grow[], date: Date): TentOccupancy {
  const occ = grows.filter(g => growTentAt(g, date) === tent.id)
  const plants = occ.reduce((s, g) => s + Math.max(0, g.plant_count || 0), 0)
  const capacity = tent.max_plants ?? null
  return {
    grows: occ,
    plants,
    capacity,
    overCapacity: capacity != null && plants > capacity,
  }
}

// ── Move events (veg tent → flower tent) ─────────────────────────────────────

export interface MoveEvent {
  growId: string
  growName: string
  date: Date           // the flip date — when the move happens
  fromTentName: string | null
  toTentId: string | null
  toTentName: string | null
  plants: number
  capacity: number | null
  overCapacity: boolean
  estimated: boolean
}

/**
 * For every grow that flips, produce a "move to flower tent" event and check
 * whether the destination flower tent has room on that day.
 */
export function getMoveEvents(grows: Grow[], tents: EquipmentProfile[]): MoveEvent[] {
  const byId = new Map(tents.map(t => [t.id, t]))
  const out: MoveEvent[] = []

  for (const grow of grows) {
    const { flip } = resolveDates(grow)
    if (!flip) continue
    const flowerTentId = grow.equipment_profile_id
    const flowerTent = flowerTentId ? byId.get(flowerTentId) ?? null : null
    const vegTentId = grow.veg_tent_id ?? null
    const vegTent = vegTentId ? byId.get(vegTentId) ?? null : null

    // Only a real "move" if veg and flower tents differ
    if (!flowerTent || (vegTentId && vegTentId === flowerTentId)) {
      // same tent or no flower tent → no physical move to plan
      continue
    }

    // Occupancy of the destination flower tent on the flip day (incl. this grow)
    const occupants = grows.filter(g => growTentAt(g, flip) === flowerTent.id)
    const plants = occupants.reduce((s, g) => s + Math.max(0, g.plant_count || 0), 0)
    const capacity = flowerTent.max_plants ?? null

    out.push({
      growId: grow.id,
      growName: grow.name,
      date: flip,
      fromTentName: vegTent?.name ?? null,
      toTentId: flowerTent.id,
      toTentName: flowerTent.name,
      plants,
      capacity,
      overCapacity: capacity != null && plants > capacity,
      estimated: false,
    })
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function getPotBadge(grow: Grow, viewDate: Date): PotBadge | null {
  const d = startOfDay(viewDate)
  const { clone, flip, harvest } = resolveDates(grow)

  // Harvest is the loudest signal
  if (harvest) {
    const dh = differenceInDays(harvest, d)
    if (dh <= 0 && dh > -3) return { text: 'HARVEST', color: '#F9C74F', pulse: true }
    if (dh > 0 && dh <= HARVEST_WARN_DAYS) return { text: `🌾 ${dh}d`, color: '#F9C74F', pulse: dh <= 5 }
  }

  // Flip approaching
  if (flip) {
    const df = differenceInDays(flip, d)
    if (df >= 0 && df <= 5) return { text: df === 0 ? '⚡ Flip' : `⚡ ${df}d`, color: '#9B5DE5', pulse: df === 0 }
    // Clone window: ~14d before flip
    const dc = differenceInDays(addDays(flip, -CLONE_LEAD_DAYS), d)
    if (dc >= 0 && dc <= 3) return { text: '✂ Cut', color: '#22c55e', pulse: false }
  }

  // Just transplanted
  if (clone) {
    const dt = differenceInDays(d, clone)
    if (dt >= 0 && dt <= 2) return { text: '✂ Cloned', color: '#22c55e', pulse: false }
  }

  return null
}
