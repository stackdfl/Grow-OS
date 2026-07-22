import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tent } = await supabase
    .from('tents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!tent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    lights_on?: string
    lights_off?: string
    sunrise_minutes?: number
    sunset_minutes?: number
    flower_week?: number
    vpd_targets?: Record<string, { min: number; max: number }>
    grow_id?: string | null
  }

  const { grow_id, ...scheduleFields } = body

  await supabase
    .from('tent_schedules')
    .update({ ...scheduleFields, updated_at: new Date().toISOString() })
    .eq('tent_id', id)

  if (grow_id !== undefined) {
    await supabase.from('tents').update({ grow_id: grow_id || null }).eq('id', id)
  }

  const { data } = await supabase
    .from('tent_schedules')
    .select('*')
    .eq('tent_id', id)
    .single()

  return NextResponse.json(data)
}
