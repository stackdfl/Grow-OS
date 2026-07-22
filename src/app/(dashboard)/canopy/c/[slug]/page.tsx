import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft, Plus, ArrowBigUp, MessageCircle, Pin, Lock, CheckCircle2 } from 'lucide-react'
import { PREFIX_META } from '@/lib/community/prefixes'

interface Thread {
  id: string; title: string; body: string; prefix: string | null
  is_pinned: boolean; is_locked: boolean; solved_comment_id: string | null
  upvotes: number; comment_count: number; created_at: string; last_activity_at: string
  author: { username: string } | null
}

function hotScore(t: Thread): number {
  const ageH = (Date.now() - new Date(t.last_activity_at ?? t.created_at).getTime()) / 3.6e6
  return (t.upvotes + t.comment_count * 0.5 + 1) / Math.pow(ageH + 2, 1.4)
}

export default async function CategoryPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }>
}) {
  const { slug } = await params
  const { sort = 'hot' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: catRaw } = await supabase.from('forum_categories')
    .select('id, slug, name, description').eq('slug', slug).maybeSingle()
  if (!catRaw) notFound()
  const cat = catRaw as { id: string; slug: string; name: string; description: string | null }

  const { data: threadsRaw } = await supabase.from('community_posts')
    .select('id, title, body, prefix, is_pinned, is_locked, solved_comment_id, upvotes, comment_count, created_at, last_activity_at, author:profiles!author_id(username)')
    .eq('category_id', cat.id).limit(80)
  let threads = (threadsRaw ?? []) as unknown as Thread[]

  threads = threads.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    if (sort === 'top') return b.upvotes - a.upvotes
    if (sort === 'new') return (b.created_at).localeCompare(a.created_at)
    return hotScore(b) - hotScore(a)
  })

  const SORTS = [{ k: 'hot', l: 'Hot' }, { k: 'new', l: 'New' }, { k: 'top', l: 'Top' }]

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/canopy" style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{cat.name}</h1>
          {cat.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.description}</p>}
        </div>
        <Link href={`/canopy/new?category=${cat.slug}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
          <Plus className="w-4 h-4" /> New thread
        </Link>
      </div>

      {/* Sort */}
      <div className="flex gap-2">
        {SORTS.map(s => (
          <Link key={s.k} href={`/canopy/c/${cat.slug}?sort=${s.k}`}
            className="px-3 py-1 rounded-lg text-xs font-medium border"
            style={{
              background: sort === s.k ? 'var(--accent-muted)' : 'transparent',
              borderColor: sort === s.k ? 'var(--accent)' : 'var(--border)',
              color: sort === s.k ? 'var(--accent)' : 'var(--text-muted)',
            }}>{s.l}</Link>
        ))}
      </div>

      {threads.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <MessageCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--text)' }}>No threads yet</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Start the first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(t => {
            const pfx = t.prefix ? PREFIX_META[t.prefix] : null
            return (
              <Link key={t.id} href={`/canopy/post/${t.id}`}>
                <div className="rounded-xl border p-4 flex items-start gap-3 transition-colors hover:border-[--accent]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5 w-8">
                    <ArrowBigUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>{t.upvotes}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {t.is_pinned && <Pin className="w-3 h-3" style={{ color: 'var(--gold)' }} />}
                      {pfx && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${pfx.color}22`, color: pfx.color }}>{pfx.label}</span>}
                      {t.solved_comment_id && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />}
                      {t.is_locked && <Lock className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />}
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t.title}</p>
                    </div>
                    {t.body && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{t.body}</p>}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--accent)' }}>@{t.author?.username ?? 'grower'}</span>
                      <span>· {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
                      <span className="flex items-center gap-0.5">· <MessageCircle className="w-3 h-3" /> {t.comment_count}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
