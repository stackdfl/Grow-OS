import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Leaf, Sprout, Droplets, Sun, Dna, BookOpen, FlaskConical, Repeat,
  LifeBuoy, GraduationCap, Wrench, Coffee, ArrowBigUp, Trophy, ChevronRight,
} from 'lucide-react'
import { AgeGate } from '@/components/community/age-gate'

const ICONS: Record<string, typeof Leaf> = {
  Sprout, Droplets, Sun, Dna, BookOpen, FlaskConical, Leaf, Repeat, LifeBuoy, GraduationCap, Wrench, Coffee,
}

interface Category {
  id: string; slug: string; name: string; description: string | null; icon: string | null; color: string | null
}
interface ShareCard {
  id: string; title: string; cover_photo: string | null; upvotes: number
  snapshot: { yield?: { dry_oz?: number | null } | null } | null
}

export default async function CanopyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('community_acknowledged').eq('id', user.id).single()
  if (!(profile as { community_acknowledged?: boolean } | null)?.community_acknowledged) return <AgeGate />

  const [{ data: catsRaw }, { data: postCats }, { data: sharesRaw }] = await Promise.all([
    supabase.from('forum_categories').select('id, slug, name, description, icon, color').is('parent_id', null).order('sort_order'),
    supabase.from('community_posts').select('category_id'),
    supabase.from('community_shares').select('id, title, cover_photo, upvotes, snapshot').order('created_at', { ascending: false }).limit(6),
  ])
  const cats = (catsRaw ?? []) as Category[]
  const shares = (sharesRaw ?? []) as unknown as ShareCard[]

  const counts = new Map<string, number>()
  for (const p of (postCats ?? []) as { category_id: string | null }[]) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl border p-5" style={{ background: 'linear-gradient(135deg, var(--accent-muted), var(--surface))', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Canopy</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>The Grow OS community — forums, journals & showcases.</p>
      </div>

      {/* Showcases strip */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Featured showcases</h2>
          <Link href="/canopy/showcases" className="text-xs flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
            All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {shares.length === 0 ? (
          <p className="text-xs rounded-xl border p-4" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            No grows shared yet — open a grow&apos;s Story and hit Share to Canopy.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {shares.map(s => (
              <Link key={s.id} href={`/canopy/${s.id}`} className="shrink-0 w-40">
                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="h-24 relative" style={{ background: 'var(--surface-raised)' }}>
                    {s.cover_photo ? <img src={s.cover_photo} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Sprout className="w-6 h-6" style={{ color: 'var(--text-muted)' }} /></div>}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{s.title}</p>
                    <div className="flex items-center justify-between mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {s.snapshot?.yield?.dry_oz != null ? <span className="flex items-center gap-0.5"><Trophy className="w-3 h-3" />{s.snapshot.yield.dry_oz}oz</span> : <span />}
                      <span className="flex items-center gap-0.5"><ArrowBigUp className="w-3 h-3" />{s.upvotes}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Category directory */}
      <div>
        <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Forums</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cats.map(c => {
            const Icon = ICONS[c.icon ?? ''] ?? Leaf
            const color = c.color ?? 'var(--accent)'
            return (
              <Link key={c.id} href={`/canopy/c/${c.slug}`}>
                <div className="rounded-xl border p-4 flex items-center gap-3 transition-colors hover:border-[--accent]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}1f` }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
                  </div>
                  <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{counts.get(c.id) ?? 0}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
