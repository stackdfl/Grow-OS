import { differenceInDays, parseISO, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'

export interface EnvironmentProfile {
  avg_temp_f: number | null
  avg_rh_percent: number | null
  avg_vpd_kpa: number | null
  sample_count: number
}

export interface WateringProfile {
  avg_freq_days: number | null
  avg_ph_drift: number | null
  ph_drift_direction: 'up' | 'down' | 'stable' | null
  avg_ec_runoff_delta: number | null
  salt_buildup_risk: 'low' | 'moderate' | 'high' | null
  sample_count: number
}

export interface CalendarProfile {
  completion_rate: number | null
  skip_rate: number | null
  total_events: number
}

export interface GeneticsOutcome {
  genetics_id: string | null
  strain_name: string
  grow_count: number
  avg_yield_oz_per_plant: number | null
  avg_flower_days: number | null
  avg_rating: number | null
}

export interface CalibrationData {
  environment: EnvironmentProfile
  watering: WateringProfile
  calendar: CalendarProfile
  genetics_history: GeneticsOutcome[]
  grow_count: number
  completed_grows: number
  last_updated: string
}

function mean(vals: number[]): number | null {
  const valid = vals.filter(v => isFinite(v) && !isNaN(v))
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

export async function computeCalibration(userId: string): Promise<CalibrationData> {
  const supabase = await createClient()
  const cutoff = subDays(new Date(), 90).toISOString().slice(0, 10)

  // ── Fetch all data in parallel ────────────────────────────────────────────
  const [
    waterRes,
    envRes,
    calRes,
    growsRes,
    harvestRes,
  ] = await Promise.all([
    supabase
      .from('watering_logs')
      .select('grow_id, log_date, ph_in, runoff_ph, ec_in, runoff_ec')
      .eq('user_id', userId)
      .gte('log_date', cutoff)
      .order('log_date', { ascending: true }),

    supabase
      .from('env_readings')
      .select('temp_f, rh_percent, vpd_kpa')
      .eq('user_id', userId)
      .gte('reading_time', new Date(Date.now() - 90 * 86400000).toISOString())
      .not('temp_f', 'is', null),

    supabase
      .from('calendar_events')
      .select('completed, skipped, event_date')
      .eq('user_id', userId)
      .lt('event_date', new Date().toISOString().slice(0, 10)),

    supabase
      .from('grows')
      .select('id, status, flip_date, genetics_id, genetics(strain_name)')
      .eq('user_id', userId),

    supabase
      .from('harvest_reports')
      .select('grow_id, dry_weight_g, overall_rating, harvest_date')
      .eq('user_id', userId),
  ])

  // ── Environment ───────────────────────────────────────────────────────────
  const envRows = envRes.data ?? []
  const environment: EnvironmentProfile = {
    avg_temp_f:     mean(envRows.map(r => r.temp_f).filter(Boolean) as number[]),
    avg_rh_percent: mean(envRows.map(r => r.rh_percent).filter(Boolean) as number[]),
    avg_vpd_kpa:    mean(envRows.map(r => r.vpd_kpa).filter(Boolean) as number[]),
    sample_count:   envRows.length,
  }

  // ── Watering ──────────────────────────────────────────────────────────────
  const waterRows = waterRes.data ?? []

  // Frequency: group by grow, compute gaps between consecutive logs
  const byGrow: Record<string, string[]> = {}
  for (const log of waterRows) {
    if (!byGrow[log.grow_id]) byGrow[log.grow_id] = []
    byGrow[log.grow_id].push(log.log_date)
  }
  const freqGaps: number[] = []
  for (const dates of Object.values(byGrow)) {
    dates.sort()
    for (let i = 1; i < dates.length; i++) {
      const gap = differenceInDays(parseISO(dates[i]), parseISO(dates[i - 1]))
      if (gap > 0 && gap <= 10) freqGaps.push(gap) // drop outliers
    }
  }
  const avgFreq = mean(freqGaps)

  // pH drift
  const phDrifts = waterRows
    .filter(r => r.ph_in != null && r.runoff_ph != null)
    .map(r => (r.runoff_ph as number) - (r.ph_in as number))
  const avgPhDrift = mean(phDrifts)
  const phDir: WateringProfile['ph_drift_direction'] =
    avgPhDrift == null ? null
    : avgPhDrift > 0.2 ? 'up'
    : avgPhDrift < -0.2 ? 'down'
    : 'stable'

  // EC delta (runoff - input)
  const ecDeltas = waterRows
    .filter(r => r.ec_in != null && r.runoff_ec != null)
    .map(r => (r.runoff_ec as number) - (r.ec_in as number))
  const avgEcDelta = mean(ecDeltas)
  const saltRisk: WateringProfile['salt_buildup_risk'] =
    avgEcDelta == null ? null
    : avgEcDelta > 0.6 ? 'high'
    : avgEcDelta > 0.3 ? 'moderate'
    : 'low'

  const watering: WateringProfile = {
    avg_freq_days:       avgFreq,
    avg_ph_drift:        avgPhDrift != null ? parseFloat(avgPhDrift.toFixed(2)) : null,
    ph_drift_direction:  phDir,
    avg_ec_runoff_delta: avgEcDelta != null ? parseFloat(avgEcDelta.toFixed(2)) : null,
    salt_buildup_risk:   saltRisk,
    sample_count:        waterRows.length,
  }

  // ── Calendar adherence ────────────────────────────────────────────────────
  const calRows = calRes.data ?? []
  const pastDue = calRows.filter(e => !e.completed && !e.skipped)
  const completed = calRows.filter(e => e.completed).length
  const skipped   = calRows.filter(e => e.skipped).length
  const total     = calRows.length
  const calendar: CalendarProfile = {
    completion_rate: total > 0 ? parseFloat((completed / total).toFixed(2)) : null,
    skip_rate:       total > 0 ? parseFloat((skipped / total).toFixed(2)) : null,
    total_events:    total,
  }

  // ── Grows summary ─────────────────────────────────────────────────────────
  const grows = growsRes.data ?? []
  const growCount = grows.length
  const completedGrows = grows.filter(g => g.status === 'complete').length

  // ── Genetics outcomes from harvest reports ────────────────────────────────
  const harvests = harvestRes.data ?? []

  // Map grow_id → grow data
  const growMap = new Map(grows.map(g => [g.id, g]))

  // Group outcomes by strain
  const strainMap = new Map<string, {
    genetics_id: string | null
    strain_name: string
    yields: number[]
    flower_days: number[]
    ratings: number[]
  }>()

  for (const h of harvests) {
    const grow = growMap.get(h.grow_id)
    if (!grow) continue

    const geneticsRaw = grow.genetics
    const genetics = (Array.isArray(geneticsRaw) ? geneticsRaw[0] : geneticsRaw) as { strain_name: string } | null
    const strainName = genetics?.strain_name ?? 'Unknown'
    const key = grow.genetics_id ?? strainName

    if (!strainMap.has(key)) {
      strainMap.set(key, {
        genetics_id: grow.genetics_id,
        strain_name: strainName,
        yields: [], flower_days: [], ratings: [],
      })
    }
    const entry = strainMap.get(key)!

    // Yield per plant
    if (h.dry_weight_g && grow) {
      const plantCount = (grow as unknown as { plant_count?: number }).plant_count
      if (plantCount && plantCount > 0) {
        entry.yields.push(h.dry_weight_g / 28.35 / plantCount)
      }
    }

    // Flower days: harvest_date - flip_date
    if (h.harvest_date && (grow as unknown as { flip_date?: string }).flip_date) {
      const fd = differenceInDays(
        parseISO(h.harvest_date),
        parseISO((grow as unknown as { flip_date: string }).flip_date)
      )
      if (fd > 0 && fd < 150) entry.flower_days.push(fd)
    }

    if (h.overall_rating) entry.ratings.push(h.overall_rating)
  }

  const genetics_history: GeneticsOutcome[] = Array.from(strainMap.values()).map(s => ({
    genetics_id:           s.genetics_id,
    strain_name:           s.strain_name,
    grow_count:            s.yields.length || s.flower_days.length || s.ratings.length || 1,
    avg_yield_oz_per_plant: mean(s.yields) != null ? parseFloat(mean(s.yields)!.toFixed(2)) : null,
    avg_flower_days:        mean(s.flower_days) != null ? Math.round(mean(s.flower_days)!) : null,
    avg_rating:             mean(s.ratings) != null ? parseFloat(mean(s.ratings)!.toFixed(1)) : null,
  }))

  return {
    environment,
    watering,
    calendar,
    genetics_history,
    grow_count:      growCount,
    completed_grows: completedGrows,
    last_updated:    new Date().toISOString(),
  }
}

export function formatCalibrationForPrompt(data: CalibrationData): string {
  if (data.grow_count === 0 && data.watering.sample_count === 0) {
    return '' // not enough data yet
  }

  const lines: string[] = [
    `GROWER CALIBRATION (from ${data.grow_count} grows, ${data.completed_grows} completed — updated ${new Date(data.last_updated).toLocaleDateString()}):`,
  ]

  // Environment
  if (data.environment.sample_count > 5) {
    const parts: string[] = []
    if (data.environment.avg_temp_f != null) parts.push(`avg temp ${data.environment.avg_temp_f.toFixed(1)}°F`)
    if (data.environment.avg_rh_percent != null) parts.push(`avg RH ${data.environment.avg_rh_percent.toFixed(0)}%`)
    if (data.environment.avg_vpd_kpa != null) parts.push(`avg VPD ${data.environment.avg_vpd_kpa.toFixed(2)} kPa`)
    if (parts.length > 0) lines.push(`- Environment (${data.environment.sample_count} readings): ${parts.join(', ')}`)
  }

  // Watering
  if (data.watering.sample_count > 3) {
    if (data.watering.avg_freq_days != null) {
      lines.push(`- Watering frequency: every ${data.watering.avg_freq_days.toFixed(1)} days on average`)
    }
    if (data.watering.ph_drift_direction && data.watering.ph_drift_direction !== 'stable') {
      lines.push(`- pH tends to drift ${data.watering.ph_drift_direction} (avg ${Math.abs(data.watering.avg_ph_drift ?? 0).toFixed(2)} pH units from input to runoff)`)
    }
    if (data.watering.salt_buildup_risk) {
      lines.push(`- Salt buildup risk: ${data.watering.salt_buildup_risk}${data.watering.avg_ec_runoff_delta != null ? ` (EC runoff avg ${data.watering.avg_ec_runoff_delta > 0 ? '+' : ''}${data.watering.avg_ec_runoff_delta.toFixed(2)} vs input)` : ''}`)
    }
  }

  // Calendar
  if (data.calendar.total_events > 10 && data.calendar.completion_rate != null) {
    lines.push(`- Task completion rate: ${(data.calendar.completion_rate * 100).toFixed(0)}% (${data.calendar.total_events} past events)`)
  }

  // Genetics history
  if (data.genetics_history.length > 0) {
    const strainLines = data.genetics_history.slice(0, 5).map(g => {
      const parts: string[] = []
      if (g.avg_yield_oz_per_plant != null) parts.push(`${g.avg_yield_oz_per_plant.toFixed(1)} oz/plant`)
      if (g.avg_flower_days != null) parts.push(`${g.avg_flower_days}d flower`)
      if (g.avg_rating != null) parts.push(`rated ${g.avg_rating}/10`)
      return `${g.strain_name}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`
    }).join('; ')
    lines.push(`- Strain history: ${strainLines}`)
  }

  return lines.join('\n')
}
