import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _req: NextRequest,
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

  // Generate new key via Postgres gen_random_uuid()
  const { data, error } = await supabase
    .rpc('regenerate_tent_api_key', { tent_id: id })

  if (error) {
    // Fallback: generate in JS if RPC not available
    const newKey = crypto.randomUUID()
    const { data: updated, error: updateError } = await supabase
      .from('tents')
      .update({ api_key: newKey })
      .eq('id', id)
      .select('api_key')
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ api_key: updated.api_key })
  }

  return NextResponse.json({ api_key: data })
}
