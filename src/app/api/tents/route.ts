import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, grow_id } = await req.json() as { name: string; grow_id?: string }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Tent name is required' }, { status: 400 })
  }

  const { data: tent, error: tentError } = await supabase
    .from('tents')
    .insert({ user_id: user.id, name: name.trim(), grow_id: grow_id || null })
    .select('id, name, api_key')
    .single()

  if (tentError || !tent) {
    return NextResponse.json({ error: tentError?.message ?? 'Failed to create tent' }, { status: 500 })
  }

  // Seed default device_states and tent_schedules rows
  await Promise.all([
    supabase.from('device_states').insert({ tent_id: tent.id }),
    supabase.from('tent_schedules').insert({ tent_id: tent.id }),
  ])

  return NextResponse.json(tent, { status: 201 })
}
