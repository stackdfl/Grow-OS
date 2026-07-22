import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const COUNT_TABLE: Record<string, string> = { share: 'community_shares', post: 'community_posts' }

// List comments for a target (with author)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const targetType = req.nextUrl.searchParams.get('targetType') ?? ''
  const targetId = req.nextUrl.searchParams.get('targetId') ?? ''
  if (!targetId) return NextResponse.json({ comments: [] })
  const { data } = await supabase.from('community_comments')
    .select('*, author:profiles!author_id(username, display_name, avatar_url)')
    .eq('target_type', targetType).eq('target_id', targetId)
    .order('created_at', { ascending: true })
  return NextResponse.json({ comments: data ?? [] })
}

// Post a comment
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetType, targetId, parentId, body } = await req.json() as {
    targetType: string; targetId: string; parentId?: string; body: string
  }
  if (!targetId || !body?.trim()) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { data, error } = await supabase.from('community_comments').insert([{
    author_id: user.id, target_type: targetType, target_id: targetId,
    parent_id: parentId ?? null, body: body.trim(),
  } as never]).select('*, author:profiles!author_id(username, display_name, avatar_url)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // bump denormalized count
  const table = COUNT_TABLE[targetType]
  if (table) {
    const { data: row } = await supabase.from(table).select('comment_count').eq('id', targetId).maybeSingle()
    const c = (row as { comment_count: number } | null)?.comment_count ?? 0
    await supabase.from(table).update({ comment_count: c + 1 } as never).eq('id', targetId)
  }

  return NextResponse.json({ comment: data })
}
