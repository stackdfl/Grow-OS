'use client'

import { useMemo } from 'react'
import { differenceInDays, startOfDay, format } from 'date-fns'
import { Sprout, Leaf, Flower2, Scale, CalendarClock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Grow, EquipmentProfile } from '@/types/database'
import type { GeneticsOutcome } from '@/lib/calibration/engine'
import { getStageAtDate, resolveDates, tentOccupancyAt } from '@/lib/pipeline/stages'

const OZ = 28.35
const DEFAULT_YIELD_OZ_PER_PLANT = 2.0

export function StatsBand({ grows, equipment, geneticsHistory }: {
  grows: Grow[]
  equipment: EquipmentProfile[]
  geneticsHistory: GeneticsOutcome[]
}) {
  const today = startOfDay(new Date())

  const stats = useMemo(() => {
    let vegPlants = 0, flowerPlants = 0, activePlants = 0
    let projOz = 0
    let nextHarvest: { days: number; name: string } | null = null

    const yieldFor = (g: Grow): number => {
      const hist = geneticsHistory.find(h =>
        (g.genetics_id && h.genetics_id === g.genetics_id) ||
        (g.genetics?.strain_name && h.strain_name === g.genetics.strain_name))
      return hist?.avg_yield_oz_per_plant ?? DEFAULT_YIELD_OZ_PER_PLANT
    }

    for (const g of grows) {
      const stage = getStageAtDate(g, today)
      const n = Math.max(0, g.plant_count || 0)
      if (stage === 'clone' || stage === 'veg') { vegPlants += n; activePlants += n }
      else if (stage === 'flower' || stage === 'flush' || stage === 'harvest') { flowerPlants += n; activePlants += n }

      // Projected yield for everything still growing toward harvest
      if (['clone', 'veg', 'flower', 'flush', 'harvest'].includes(stage)) {
        projOz += n * yieldFor(g)
      }

      // Next harvest among active grows
      const { harvest } = resolveDates(g)
      if (harvest && ['veg', 'flower', 'flush', 'harvest', 'clone'].includes(stage)) {
        const d = differenceInDays(harvest, today)
        if (d >= 0 && (!nextHarvest || d < nextHarvest.days)) {
          nextHarvest = { days: d, name: g.genetics?.strain_name ?? g.name }
        }
      }
    }

    const overCapacity = equipment.filter(t => tentOccupancyAt(t, grows, today).overCapacity)

    return { vegPlants, flowerPlants, activePlants, projOz, nextHarvest, overCapacity }
  }, [grows, equipment, geneticsHistory, today])

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
      <Tile icon={Sprout} label="Active plants" value={`${stats.activePlants}`} accent />
      <Tile icon={Leaf} label="In veg" value={`${stats.vegPlants}`} color="#52B788" />
      <Tile icon={Flower2} label="In flower" value={`${stats.flowerPlants}`} color="#9B5DE5" />
      <Tile
        icon={CalendarClock}
        label="Next harvest"
        value={stats.nextHarvest ? (stats.nextHarvest.days === 0 ? 'Today' : `${stats.nextHarvest.days}d`) : '—'}
        sub={stats.nextHarvest?.name}
        color="#F9C74F"
      />
      <Tile icon={Scale} label="Proj. yield" value={stats.projOz > 0 ? `${stats.projOz.toFixed(0)} oz` : '—'} />
      {stats.overCapacity.length > 0 ? (
        <Tile icon={AlertTriangle} label="Over capacity" value={`${stats.overCapacity.length} tent${stats.overCapacity.length !== 1 ? 's' : ''}`} color="#E76F51" danger />
      ) : (
        <Tile icon={CheckCircle2} label="Capacity" value="All clear" color="#52B788" />
      )}
    </div>
  )
}

function Tile({ icon: Icon, label, value, sub, color, accent, danger }: {
  icon: typeof Sprout; label: string; value: string; sub?: string
  color?: string; accent?: boolean; danger?: boolean
}) {
  return (
    <div className="rounded-xl border p-3" style={{
      background: 'var(--surface)',
      borderColor: danger ? 'rgba(231,111,81,0.4)' : 'var(--border)',
    }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color: color ?? 'var(--text-muted)' }} />
        <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-lg font-bold font-mono leading-tight" style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</p>
      {sub && <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}
