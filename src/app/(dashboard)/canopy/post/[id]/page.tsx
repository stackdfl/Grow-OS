import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft, Pin, Lock, CheckCircle2 } from 'lucide-react'
import { ReactionBar } from '@/components/community/reaction-bar'
import { CommentThread } from '@/components/community/comment-thread'
import { ThreadActions } from '@/components/community/thread-actions'
import { Markdown } from '@/components/community/markdown'
import { PREFIX_META } from '@/lib/community/prefixes'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: postRaw } = await supabase
    .from('community_posts')
    .select('*, author:profiles!author_id(username, display_name, avatar_url), category:forum_categories(slug, name)')
    .eq('id', id).maybeSingle()
  if (!postRaw) notFound()

  const post = postRaw as unknown as {
    id: string; author_id: string; category: { slug: string; name: string } | null
    title: string; body: string; photos: string[]; prefix: string | null
    is_pinned: boolean; is_locked: boolean; solved_comment_id: string | null
    upvotes: number; created_at: string
    author: { username: string; display_name: string | null } | null
  }

  const [{ data: commentsRaw }, { data: votes }] = await Promise.all([
    supabase.from('community_comments')
      .select('*, author:profiles!author_id(username, display_name, avatar_url)')
      .eq('target_type', 'post').eq('target_id', id).order('created_at', { ascending: true }),
    supabase.from('community_votes').select('reaction, user_id').eq('target_type', 'post').eq('target_id', id),
  ])
  const comments = (commentsRaw ?? []) as never[]

  const breakdown: Record<string, number> = {}
  let mine: string | null = null
  for (const v of (votes ?? []) as { reaction: string; user_id: string }[]) {
    breakdown[v.reaction] = (breakdown[v.reaction] ?? 0) + 1
    if (v.user_id === user.id) mine = v.reaction
  }

  const pfx = post.prefix ? PREFIX_META[post.prefix] : null
  const isAuthor = post.author_id === user.id

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={post.category ? `/canopy/c/${post.category.slug}` : '/canopy'} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-muted)' }}>
          {post.category?.name ?? 'Thread'}
        </h1>
        {isAuthor && <ThreadActions postId={post.id} initialLocked={post.is_locked} />}
      </div>

      <div className="rounded-2xl border p-5 mb-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {post.is_pinned && <Pin className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />}
          {pfx && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${pfx.color}22`, color: pfx.color }}>{pfx.label}</span>}
          {post.solved_comment_id && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
              <CheckCircle2 className="w-3 h-3" /> Solved
            </span>
          )}
          {post.is_locked && <Lock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>{post.title}</h2>
        <div className="flex items-center gap-2 mb-3">
          <Link href={`/growers/${post.author?.username}`} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            @{post.author?.username ?? 'grower'}
          </Link>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
        </div>

        {post.body && <Markdown>{post.body}</Markdown>}

        {post.photos?.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {post.photos.map((url, i) => <img key={i} src={url} alt="" className="w-full rounded-lg object-cover" style={{ aspectRatio: '1' }} />)}
          </div>
        )}

        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <ReactionBar targetType="post" targetId={post.id} initialTotal={post.upvotes} initialMine={mine} initialBreakdown={breakdown} />
        </div>
      </div>

      <CommentThread targetType="post" targetId={post.id} initialComments={comments}
        isThreadAuthor={isAuthor} locked={post.is_locked} solvedCommentId={post.solved_comment_id} />
    </div>
  )
}
