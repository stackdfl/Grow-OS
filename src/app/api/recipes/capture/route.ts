import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { differenceInDays, parseISO, format } from 'date-fns'

const OZ = 28.35

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { growId } = await req.json() as { growId: string }
  if (!growId) return NextResponse.json({ error: 'growId required' }, { status: 400 })

  const { data: growRaw } = await supabase
    .from('grows').select('*, genetics(strain_name, breeder)').eq('id', growId).eq('user_id', user.id).single()
  if (!growRaw) return NextResponse.json({ error: 'Grow not found' }, { status: 404 })
  const g = growRaw as Record<string, unknown>
  const gen = (Array.isArray(g.genetics) ? g.genetics[0] : g.genetics) as { strain_name?: string; breeder?: string } | null

  const [{ data: feeds }, { data: waters }, { data: env }, { data: harvest }] = await Promise.all([
    supabase.from('feeding_logs').select('log_date, products, ph_in, ec_in').eq('grow_id', growId).order('log_date'),
    supabase.from('watering_logs').select('log_date, ph_in, ec_in, volume_per_plant_ml').eq('grow_id', growId).order('log_date'),
    supabase.from('env_readings').select('temp_f, rh_percent, vpd_kpa').eq('grow_id', growId).not('temp_f', 'is', null),
    supabase.from('harvest_reports').select('dry_weight_g, thc_percentage, harvest_date').eq('grow_id', growId).maybeSingle(),
  ])

  const start = (g.clone_date ?? g.veg_start_date ?? g.flip_date) as string | null
  const weekOf = (d: string) => start ? Math.floor(differenceInDays(parseISO(d), parseISO(start)) / 7) + 1 : 1

  // Feeding schedule grouped by week
  const feedByWeek = new Map<number, { name: string; amount: number; unit: string; frequency: string }[]>()
  for (const f of (feeds ?? []) as { log_date: string; products: { name: string; amount: number; unit: string }[] }[]) {
    const wk = weekOf(f.log_date)
    const arr = feedByWeek.get(wk) ?? []
    for (const p of f.products ?? []) {
      if (!arr.some(x => x.name === p.name)) arr.push({ name: p.name, amount: p.amount, unit: p.unit, frequency: 'weekly' })
    }
    feedByWeek.set(wk, arr)
  }
  const flipWeek = g.flip_date && start ? weekOf(g.flip_date as string) : 5
  const feeding_schedule = Array.from(feedByWeek.entries()).sort((a, b) => a[0] - b[0]).map(([week, products]) => ({
    week, stage: week < flipWeek ? 'veg' : 'flower', products,
  }))

  // Watering cadence
  const wDates = ((waters ?? []) as { log_date: string }[]).map(w => w.log_date)
  let avgGap: number | null = null
  if (wDates.length > 1) {
    const gaps: number[] = []
    for (let i = 1; i < wDates.length; i++) gaps.push(differenceInDays(parseISO(wDates[i]), parseISO(wDates[i - 1])))
    const valid = gaps.filter(x => x > 0 && x <= 10)
    if (valid.length) avgGap = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
  }
  const wRows = (waters ?? []) as { ph_in: number | null; ec_in: number | null; volume_per_plant_ml: number | null }[]
  const avg = (vals: (number | null)[]) => { const v = vals.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined }
  const watering_schedule = avgGap ? [{
    week: 1, frequency_days: avgGap,
    volume_per_plant_ml: avg(wRows.map(w => w.volume_per_plant_ml)),
    ph_target: avg(wRows.map(w => w.ph_in)) ? parseFloat(avg(wRows.map(w => w.ph_in))!.toFixed(1)) : undefined,
    ec_target: avg(wRows.map(w => w.ec_in)) ? parseFloat(avg(wRows.map(w => w.ec_in))!.toFixed(1)) : undefined,
  }] : []

  // Env (avg as a single representative week)
  const eRows = (env ?? []) as { temp_f: number | null; rh_percent: number | null; vpd_kpa: number | null }[]
  const env_schedule = eRows.length ? [{
    week: 1, stage: 'flower',
    temp_day_f: avg(eRows.map(e => e.temp_f)) ? Math.round(avg(eRows.map(e => e.temp_f))!) : undefined,
    rh_percent: avg(eRows.map(e => e.rh_percent)) ? Math.round(avg(eRows.map(e => e.rh_percent))!) : undefined,
    vpd_kpa: avg(eRows.map(e => e.vpd_kpa)) ? parseFloat(avg(eRows.map(e => e.vpd_kpa))!.toFixed(2)) : undefined,
  }] : []

  // Weeks + harvest
  const vegWeeks = g.flip_date && start ? Math.max(1, Math.round(differenceInDays(parseISO(g.flip_date as string), parseISO(start)) / 7)) : null
  const h = harvest as { dry_weight_g: number | null; thc_percentage: number | null; harvest_date: string | null } | null
  const flowerDays = g.flip_date && h?.harvest_date ? differenceInDays(parseISO(h.harvest_date), parseISO(g.flip_date as string)) : null
  const flowerWeeks = flowerDays ? Math.max(1, Math.round(flowerDays / 7)) : null
  const dryOz = h?.dry_weight_g ? h.dry_weight_g / OZ : null
  const yieldPerPlant = dryOz && (g.plant_count as number) ? dryOz / (g.plant_count as number) : null

  const { data, error } = await supabase.from('recipes').insert([{
    author_id: user.id,
    title: `${gen?.strain_name ?? g.name} — captured ${format(new Date(), 'MMM yyyy')}`,
    description: `Captured from an actual grow's logs.`,
    genetics: { strain: gen?.strain_name, breeder: gen?.breeder },
    medium: { type: g.medium_type ?? undefined },
    veg_weeks: vegWeeks,
    flower_weeks: flowerWeeks,
    total_weeks: vegWeeks && flowerWeeks ? vegWeeks + flowerWeeks : null,
    estimated_yield_oz_per_plant: yieldPerPlant != null ? parseFloat(yieldPerPlant.toFixed(1)) : null,
    feeding_schedule,
    watering_schedule,
    env_schedule,
    training_schedule: [],
    amendment_schedule: [],
    harvest_data: {
      flower_days: flowerDays ?? undefined,
      final_yield_oz: dryOz != null ? parseFloat(dryOz.toFixed(1)) : undefined,
      thc_pct: h?.thc_percentage ?? undefined,
    },
    is_public: false,
    version: '1.0',
  } as never]).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: (data as { id: string }).id })
}
