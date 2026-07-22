import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, Sprout, Trophy, Droplets, Thermometer, Leaf } from 'lucide-react'
import { UpvoteButton } from '@/components/community/upvote-button'
import { CommentThread } from '@/components/community/comment-thread'

interface Snapshot {
  strain?: string | null; breeder?: string | null; type?: string | null
  status?: string; days?: number | null; plants?: number | null; pot_gal?: number | null; medium?: string | null
  photos?: string[]
  yield?: { dry_oz?: number | null; per_plant?: number | null; rating?: number | null; what_worked?: string | null; what_to_change?: string | null } | null
  schedule?: { water_freq_days?: number | null; nutrients?: string[] } | null
  env?: { temp_f?: number | null; rh?: number | null; vpd?: number | null } | null
  notes?: string | null
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shareRaw } = await supabase
    .from('community_shares')
    .select('*, author:profiles!author_id(username, display_name, avatar_url)')
    .eq('id', id).maybeSingle()
  if (!shareRaw) notFound()

  const share = shareRaw as unknown as {
    id: string; title: string; strain_name: string | null; cover_photo: string | null; snapshot: Snapshot
    upvotes: number
    author: { username: string; display_name: string | null; avatar_url: string | null } | null
  }
  const s = share.snapshot ?? {}

  const [{ data: commentsRaw }, { data: vote }] = await Promise.all([
    supabase.from('community_comments')
      .select('*, author:profiles!author_id(username, display_name, avatar_url)')
      .eq('target_type', 'share').eq('target_id', id).order('created_at', { ascending: true }),
    supabase.from('community_votes').select('id')
      .eq('user_id', user.id).eq('target_type', 'share').eq('target_id', id).maybeSingle(),
  ])
  const comments = (commentsRaw ?? []) as never[]

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/canopy" style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text)' }}>Grow Showcase</h1>
        <UpvoteButton targetType="share" targetId={share.id} initialUpvotes={share.upvotes} initialVoted={!!vote} />
      </div>

      {/* Hero */}
      <div className="rounded-2xl border overflow-hidden mb-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="h-48 relative" style={{ background: 'var(--surface-raised)' }}>
          {share.cover_photo
            ? <img src={share.cover_photo} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Sprout className="w-10 h-10" style={{ color: 'var(--text-muted)' }} /></div>}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,15,13,0.92), transparent 55%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-2xl font-bold" style={{ color: '#fff' }}>{s.strain ?? share.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {s.breeder && <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{s.breeder}</span>}
              <Link href={`/growers/${share.author?.username}`} className="text-sm" style={{ color: 'var(--accent)' }}>
                @{share.author?.username ?? 'grower'}
              </Link>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x" style={{ borderColor: 'var(--border)' }}>
          <Stat label="Days" value={s.days != null ? `${s.days}` : '—'} />
          <Stat label="Plants" value={s.plants != null ? `${s.plants}` : '—'} />
          <Stat label="Yield" value={s.yield?.dry_oz != null ? `${s.yield.dry_oz}oz` : '—'} accent />
          <Stat label="Rating" value={s.yield?.rating != null ? `${s.yield.rating}/10` : '—'} />
        </div>
      </div>

      <div className="space-y-4">
        {/* Reflection */}
        {s.yield?.what_worked && (
          <Card title="✓ What worked" tint="var(--accent)">{s.yield.what_worked}</Card>
        )}
        {s.yield?.what_to_change && (
          <Card title="↻ What they'd change" tint="var(--warning)">{s.yield.what_to_change}</Card>
        )}

        {/* Schedule */}
        {s.schedule && (s.schedule.nutrients?.length || s.schedule.water_freq_days != null) && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Droplets className="w-3.5 h-3.5" /> Feed & water
            </p>
            {s.schedule.water_freq_days != null && (
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                Watered every ~{s.schedule.water_freq_days} days
              </p>
            )}
            {s.schedule.nutrients && s.schedule.nutrients.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.schedule.nutrients.map(n => (
                  <span key={n} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>{n}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Environment */}
        {s.env && (
          <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Thermometer className="w-3.5 h-3.5" /> Avg environment
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Temp" value={s.env.temp_f != null ? `${s.env.temp_f}°F` : '—'} />
              <Stat label="RH" value={s.env.rh != null ? `${s.env.rh}%` : '—'} />
              <Stat label="VPD" value={s.env.vpd != null ? `${s.env.vpd}` : '—'} />
            </div>
          </div>
        )}

        {/* Notes */}
        {s.notes && <Card title="Notes" tint="var(--text-muted)">{s.notes}</Card>}

        {/* Photos */}
        {s.photos && s.photos.length > 0 && (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Gallery</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {s.photos.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full rounded-lg object-cover" style={{ aspectRatio: '1' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
        <CommentThread targetType="share" targetId={share.id} initialComments={comments} />
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-8 opacity-60">
        <Leaf className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Shared on Canopy · Grow OS</span>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="py-3 text-center">
      <p className="text-base font-bold font-mono" style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</p>
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function Card({ title, tint, children }: { title: string; tint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className="text-xs mb-1 font-medium" style={{ color: tint }}>{title}</p>
      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{children}</p>
    </div>
  )
}
