import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { addDays, differenceInDays, parseISO, format, startOfDay } from 'date-fns'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { growId } = await req.json() as { growId: string }
  if (!growId) return NextResponse.json({ error: 'growId required' }, { status: 400 })

  const { data: growRaw } = await supabase
    .from('grows').select('*, genetics(strain_name)').eq('id', growId).eq('user_id', user.id).single()
  if (!growRaw) return NextResponse.json({ error: 'Grow not found' }, { status: 404 })
  const g = growRaw as Record<string, unknown>

  const today = startOfDay(new Date())
  const startStr = (g.clone_date ?? g.veg_start_date ?? g.flip_date) as string | null
  const delta = startStr ? differenceInDays(today, parseISO(startStr)) : 0
  const shift = (d: unknown) => d ? format(addDays(parseISO(d as string), delta), 'yyyy-MM-dd') : null

  const gen = (Array.isArray(g.genetics) ? g.genetics[0] : g.genetics) as { strain_name?: string } | null
  const baseName = gen?.strain_name ?? (g.name as string) ?? 'Grow'

  const { data, error } = await supabase.from('grows').insert([{
    user_id: user.id,
    name: `${baseName} — ${format(today, 'MMM yyyy')}`,
    genetics_id: g.genetics_id ?? null,
    equipment_profile_id: g.equipment_profile_id ?? null,
    veg_tent_id: g.veg_tent_id ?? null,
    recipe_id: g.recipe_id ?? null,
    status: 'planned',
    plant_count: g.plant_count ?? 1,
    container_size_gal: g.container_size_gal ?? null,
    medium_type: g.medium_type ?? null,
    space_label: g.space_label ?? null,
    env_targets: g.env_targets ?? {},
    clone_date: shift(g.clone_date),
    veg_start_date: shift(g.veg_start_date),
    flip_date: shift(g.flip_date),
    harvest_date: shift(g.harvest_date),
    notes: `Recreated from a previous run.`,
  } as never]).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: (data as { id: string }).id })
}
