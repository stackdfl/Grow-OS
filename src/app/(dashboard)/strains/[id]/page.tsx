import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ChevronLeft, Leaf, Scale, CalendarClock, Star, Sprout, ArrowBigUp, Trophy } from 'lucide-react'
import type { Genetics } from '@/types/database'

const OZ = 28.35

interface GrowRow {
  id: string; name: string; plant_count: number
  flip_date: string | null; harvest_date: string | null; actual_harvest_date: string | null; status: string
}
interface HarvestRow { grow_id: string; dry_weight_g: number | null; overall_rating: number | null; harvest_date: string | null }

function mean(v: number[]): number | null { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }

export default async function StrainHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: genRaw } = await supabase.from('genetics').select('*').eq('id', id).maybeSingle()
  if (!genRaw) notFound()
  const strain = genRaw as Genetics

  const { data: growsRaw } = await supabase
    .from('grows').select('id, name, plant_count, flip_date, harvest_date, actual_harvest_date, status')
    .eq('user_id', user.id).eq('genetics_id', id)
  const grows = (growsRaw ?? []) as GrowRow[]
  const growIds = grows.map(g => g.id)

  const [{ data: harvestsRaw }, { data: sharesRaw }] = await Promise.all([
    growIds.length
      ? supabase.from('harvest_reports').select('grow_id, dry_weight_g, overall_rating, harvest_date').in('grow_id', growIds)
      : Promise.resolve({ data: [] }),
    supabase.from('community_shares')
      .select('id, title, cover_photo, upvotes, snapshot, author:profiles!author_id(username)')
      .eq('strain_name', strain.strain_name).order('upvotes', { ascending: false }).limit(8),
  ])
  const harvests = (harvestsRaw ?? []) as HarvestRow[]
  const shares = (sharesRaw ?? []) as unknown as { id: string; title: string; cover_photo: string | null; upvotes: number; snapshot: { yield?: { dry_oz?: number | null } | null } | null; author: { username: string } | null }[]

  const growById = new Map(grows.map(g => [g.id, g]))

  // Per-run rows
  const runs = harvests.filter(h => h.dry_weight_g != null).map(h => {
    const g = growById.get(h.grow_id)
    const oz = (h.dry_weight_g ?? 0) / OZ
    const perPlant = g && g.plant_count ? oz / g.plant_count : null
    const flowerDays = g?.flip_date && h.harvest_date ? differenceInDays(parseISO(h.harvest_date), parseISO(g.flip_date)) : null
    return { growId: h.grow_id, name: g?.name ?? 'Grow', date: h.harvest_date, oz, perPlant, rating: h.overall_rating, flowerDays }
  }).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const runCount = runs.length
  const avgPerPlant = mean(runs.map(r => r.perPlant).filter((x): x is number => x != null))
  const avgFlower = mean(runs.map(r => r.flowerDays).filter((x): x is number => x != null && x > 0 && x < 150))
  const avgRating = mean(runs.map(r => r.rating).filter((x): x is number => x != null))
  const confident = runCount >= 3

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/strains" style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text)' }}>Strain Hub</h1>
        <Link href="/strains/leaderboard" className="text-xs" style={{ color: 'var(--accent)' }}>Leaderboard →</Link>
      </div>

      {/* Strain header */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
            <Leaf className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{strain.strain_name}</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {[strain.breeder, strain.type, strain.lineage].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
        {strain.phenotype_notes && (
          <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>{strain.phenotype_notes}</p>
        )}
      </div>

      {/* Your performance */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Your performance</h3>
          <ConfidenceBadge runs={runCount} />
        </div>
        {runCount === 0 ? (
          <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <Sprout className="w-7 h-7 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No completed runs yet. Harvest a grow of this strain to build its profile.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <AggTile icon={Scale} label="Avg / plant" value={avgPerPlant != null ? `${avgPerPlant.toFixed(1)} oz` : '—'} dim={!confident} accent />
              <AggTile icon={CalendarClock} label="Avg flower" value={avgFlower != null ? `${Math.round(avgFlower)}d` : '—'} dim={!confident} />
              <AggTile icon={Star} label="Avg rating" value={avgRating != null ? `${avgRating.toFixed(1)}/10` : '—'} dim={!confident} />
            </div>
            {/* Per-run history */}
            <div className="space-y-2">
              {runs.map(r => (
                <Link key={r.growId} href={`/grows/${r.growId}/story`}>
                  <div className="rounded-xl border p-3 flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{r.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.date ? format(parseISO(r.date), 'MMM d, yyyy') : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                      {r.perPlant != null && <span style={{ color: 'var(--accent)' }}>{r.perPlant.toFixed(1)}oz/pl</span>}
                      {r.flowerDays != null && r.flowerDays > 0 && <span style={{ color: 'var(--text-muted)' }}>{r.flowerDays}d</span>}
                      {r.rating != null && <span style={{ color: '#f59e0b' }}>★{r.rating}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Community showcases of this strain */}
      {shares.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Community grows of {strain.strain_name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {shares.map(s => (
              <Link key={s.id} href={`/canopy/${s.id}`}>
                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="h-20 relative" style={{ background: 'var(--surface-raised)' }}>
                    {s.cover_photo ? <img src={s.cover_photo} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Sprout className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></div>}
                  </div>
                  <div className="p-2 flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--accent)' }}>@{s.author?.username ?? 'grower'}</span>
                    <span className="flex items-center gap-0.5"><ArrowBigUp className="w-3 h-3" /> {s.upvotes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfidenceBadge({ runs }: { runs: number }) {
  const high = runs >= 3
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: high ? 'var(--accent-muted)' : 'var(--surface-raised)', color: high ? 'var(--accent)' : 'var(--text-muted)' }}>
      {runs === 0 ? 'No data' : `Based on ${runs} run${runs !== 1 ? 's' : ''}${high ? '' : ' · low confidence'}`}
    </span>
  )
}

function AggTile({ icon: Icon, label, value, accent, dim }: {
  icon: typeof Scale; label: string; value: string; accent?: boolean; dim?: boolean
}) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)', opacity: dim ? 0.7 : 1 }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-lg font-bold font-mono" style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</p>
    </div>
  )
}
