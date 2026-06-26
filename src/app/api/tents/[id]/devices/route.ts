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

  // Verify ownership
  const { data: tent } = await supabase
    .from('tents')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!tent) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as {
    fan_speed?: number
    light_level?: number
    humidifier_on?: boolean
    clip_fan_1_on?: boolean
    clip_fan_2_on?: boolean
    auto_mode?: boolean
  }

  const { data, error } = await supabase
    .from('device_states')
    .upsert({ tent_id: id, ...body, updated_at: new Date().toISOString() })
    .eq('tent_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
