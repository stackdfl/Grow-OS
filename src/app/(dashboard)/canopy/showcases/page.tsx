import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'
import { ChevronLeft, Sprout, ArrowBigUp, Trophy, MessageCircle } from 'lucide-react'

interface ShareCard {
  id: string; title: string; cover_photo: string | null; upvotes: number; comment_count: number; created_at: string
  snapshot: { yield?: { dry_oz?: number | null; rating?: number | null } | null } | null
  author: { username: string } | null
}

export default async function ShowcasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('community_shares')
    .select('id, title, cover_photo, upvotes, comment_count, created_at, snapshot, author:profiles!author_id(username)')
    .order('created_at', { ascending: false }).limit(80)
  const shares = (data ?? []) as unknown as ShareCard[]

  return (
    <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/canopy" style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Grow Showcases</h1>
      </div>

      {shares.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Sprout className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text)' }}>No grows shared yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shares.map(s => (
            <Link key={s.id} href={`/canopy/${s.id}`}>
              <div className="rounded-xl border overflow-hidden transition-transform hover:scale-[1.02] h-full" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="h-40 relative" style={{ background: 'var(--surface-raised)' }}>
                  {s.cover_photo ? <img src={s.cover_photo} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Sprout className="w-8 h-8" style={{ color: 'var(--text-muted)' }} /></div>}
                  {s.snapshot?.yield?.rating != null && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: '#f59e0b' }}>★ {s.snapshot.yield.rating}</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{s.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs" style={{ color: 'var(--accent)' }}>@{s.author?.username ?? 'grower'}</span>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.snapshot?.yield?.dry_oz != null && <span className="flex items-center gap-0.5"><Trophy className="w-3 h-3" /> {s.snapshot.yield.dry_oz}oz</span>}
                      <span className="flex items-center gap-0.5"><ArrowBigUp className="w-3.5 h-3.5" /> {s.upvotes}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {s.comment_count}</span>
                    </div>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
