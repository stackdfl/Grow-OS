import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { differenceInDays, parseISO } from 'date-fns'

const OZ = 28.35

interface Include {
  photos?: boolean
  yields?: boolean
  schedule?: boolean
  env?: boolean
  notes?: boolean
}

// Is this grow already published?
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const growId = req.nextUrl.searchParams.get('growId')
  if (!growId) return NextResponse.json({ shared: false })
  const { data } = await supabase.from('community_shares')
    .select('id').eq('author_id', user.id).eq('source_grow_id', growId).maybeSingle()
  return NextResponse.json({ shared: !!data, id: data?.id ?? null })
}

// Unpublish — delete the snapshot
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const growId = req.nextUrl.searchParams.get('growId')
  if (!growId) return NextResponse.json({ error: 'growId required' }, { status: 400 })
  await supabase.from('community_shares').delete().eq('author_id', user.id).eq('source_grow_id', growId)
  return NextResponse.json({ ok: true })
}

// Publish — build a frozen snapshot of ONLY the consented fields
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { growId, include } = await req.json() as { growId: string; include: Include }
  if (!growId) return NextResponse.json({ error: 'growId required' }, { status: 400 })

  // Read the private grow (RLS = owner only)
  const { data: growRaw } = await supabase
    .from('grows').select('*, genetics(strain_name, breeder, type)').eq('id', growId).eq('user_id', user.id).single()
  if (!growRaw) return NextResponse.json({ error: 'Grow not found' }, { status: 404 })
  const grow = growRaw as Record<string, unknown>
  const gen = (Array.isArray(grow.genetics) ? grow.genetics[0] : grow.genetics) as { strain_name?: string; breeder?: string; type?: string } | null

  const start = (grow.clone_date ?? grow.veg_start_date ?? grow.flip_date) as string | null
  const harvestDate = (grow.actual_harvest_date ?? grow.harvest_date) as string | null
  const days = start ? differenceInDays(harvestDate ? parseISO(harvestDate) : new Date(), parseISO(start)) : null

  const snapshot: Record<string, unknown> = {
    strain: gen?.strain_name ?? null,
    breeder: gen?.breeder ?? null,
    type: gen?.type ?? null,
    status: grow.status,
    days,
    plants: grow.plant_count,
    pot_gal: grow.container_size_gal,
    medium: grow.medium_type,
  }

  let cover: string | null = (grow.cover_photo_url as string) ?? null

  // Photos
  if (include?.photos) {
    const { data: entries } = await supabase.from('journal_entries').select('photos').eq('grow_id', growId)
    const { data: harvest } = await supabase.from('harvest_reports').select('photos').eq('grow_id', growId).maybeSingle()
    const photos = [
      ...((harvest?.photos as string[]) ?? []),
      ...(((entries ?? []) as { photos: string[] }[]).flatMap(e => e.photos ?? [])),
    ].filter(Boolean)
    snapshot.photos = photos.slice(0, 12)
    if (!cover && photos.length) cover = photos[0]
  }

  // Yields
  if (include?.yields) {
    const { data: h } = await supabase.from('harvest_reports')
      .select('dry_weight_g, overall_rating, what_worked, what_to_change').eq('grow_id', growId).maybeSingle()
    if (h) {
      const dryOz = h.dry_weight_g ? h.dry_weight_g / OZ : null
      snapshot.yield = {
        dry_oz: dryOz != null ? parseFloat(dryOz.toFixed(1)) : null,
        per_plant: dryOz && (grow.plant_count as number) ? parseFloat((dryOz / (grow.plant_count as number)).toFixed(1)) : null,
        rating: h.overall_rating ?? null,
        what_worked: h.what_worked ?? null,
        what_to_change: h.what_to_change ?? null,
      }
    }
  }

  // Schedule summary
  if (include?.schedule) {
    const [{ data: water }, { data: feed }] = await Promise.all([
      supabase.from('watering_logs').select('log_date').eq('grow_id', growId).order('log_date'),
      supabase.from('feeding_logs').select('products').eq('grow_id', growId).limit(10),
    ])
    const dates = ((water ?? []) as { log_date: string }[]).map(w => w.log_date)
    let avgGap: number | null = null
    if (dates.length > 1) {
      const gaps: number[] = []
      for (let i = 1; i < dates.length; i++) gaps.push(differenceInDays(parseISO(dates[i]), parseISO(dates[i - 1])))
      const valid = gaps.filter(g => g > 0 && g <= 10)
      if (valid.length) avgGap = parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1))
    }
    const nutes = new Set<string>()
    for (const f of (feed ?? []) as { products: { name: string }[] }[]) for (const p of f.products ?? []) nutes.add(p.name)
    snapshot.schedule = { water_freq_days: avgGap, nutrients: Array.from(nutes).slice(0, 12) }
  }

  // Environment summary
  if (include?.env) {
    const { data: env } = await supabase.from('env_readings')
      .select('temp_f, rh_percent, vpd_kpa').eq('grow_id', growId).not('temp_f', 'is', null)
    const rows = (env ?? []) as { temp_f: number | null; rh_percent: number | null; vpd_kpa: number | null }[]
    const avg = (vals: (number | null)[]) => {
      const v = vals.filter((x): x is number => x != null)
      return v.length ? parseFloat((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)) : null
    }
    if (rows.length) snapshot.env = { temp_f: avg(rows.map(r => r.temp_f)), rh: avg(rows.map(r => r.rh_percent)), vpd: avg(rows.map(r => r.vpd_kpa)) }
  }

  // Notes
  if (include?.notes) {
    const { data: h } = await supabase.from('harvest_reports').select('notes').eq('grow_id', growId).maybeSingle()
    if (h?.notes) snapshot.notes = h.notes
  }

  // Replace any existing share for this grow (re-publish)
  await supabase.from('community_shares').delete().eq('author_id', user.id).eq('source_grow_id', growId)

  const { data, error } = await supabase.from('community_shares').insert([{
    author_id: user.id,
    source_grow_id: growId,
    type: 'grow_story',
    title: `${gen?.strain_name ?? grow.name}`,
    strain_name: gen?.strain_name ?? null,
    cover_photo: cover,
    snapshot,
  } as never]).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: (data as { id: string }).id })
}
