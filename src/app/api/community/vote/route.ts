import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const TABLE: Record<string, string> = {
  share: 'community_shares',
  post: 'community_posts',
  comment: 'community_comments',
}
const REACTIONS = new Set(['like', 'love', 'fire', 'helpful', 'funny', 'disagree'])

// Set / change / toggle a reaction; keep denormalized total (upvotes) in sync
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetType, targetId, reaction = 'like' } = await req.json() as { targetType: string; targetId: string; reaction?: string }
  const table = TABLE[targetType]
  if (!table || !targetId || !REACTIONS.has(reaction)) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { data: existing } = await supabase.from('community_votes')
    .select('id, reaction').eq('user_id', user.id).eq('target_type', targetType).eq('target_id', targetId).maybeSingle()

  const { data: row } = await supabase.from(table).select('upvotes').eq('id', targetId).maybeSingle()
  const current = (row as { upvotes: number } | null)?.upvotes ?? 0

  let myReaction: string | null
  let upvotes = current
  const ex = existing as { id: string; reaction: string } | null

  if (ex && ex.reaction === reaction) {
    // toggle off
    await supabase.from('community_votes').delete().eq('id', ex.id)
    upvotes = Math.max(0, current - 1); myReaction = null
  } else if (ex) {
    // switch reaction (count unchanged)
    await supabase.from('community_votes').update({ reaction } as never).eq('id', ex.id)
    myReaction = reaction
  } else {
    await supabase.from('community_votes').insert([{ user_id: user.id, target_type: targetType, target_id: targetId, reaction } as never])
    upvotes = current + 1; myReaction = reaction
  }
  await supabase.from(table).update({ upvotes } as never).eq('id', targetId)

  return NextResponse.json({ reaction: myReaction, upvotes })
}

// Current user's reaction for targets, plus per-type breakdown for one target
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const targetType = req.nextUrl.searchParams.get('targetType') ?? ''
  const targetId = req.nextUrl.searchParams.get('targetId')

  if (targetId) {
    const { data: all } = await supabase.from('community_votes')
      .select('reaction').eq('target_type', targetType).eq('target_id', targetId)
    const breakdown: Record<string, number> = {}
    for (const v of (all ?? []) as { reaction: string }[]) breakdown[v.reaction] = (breakdown[v.reaction] ?? 0) + 1
    let mine: string | null = null
    if (user) {
      const { data } = await supabase.from('community_votes').select('reaction')
        .eq('user_id', user.id).eq('target_type', targetType).eq('target_id', targetId).maybeSingle()
      mine = (data as { reaction: string } | null)?.reaction ?? null
    }
    return NextResponse.json({ breakdown, mine })
  }
  return NextResponse.json({ breakdown: {}, mine: null })
}
