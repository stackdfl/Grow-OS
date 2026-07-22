import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { differenceInDays, parseISO } from 'date-fns'
import { ChevronLeft, Trophy, Scale, Star, CalendarClock } from 'lucide-react'

const OZ = 28.35
const MIN_RUNS = 3

interface HarvestJoin {
  grow_id: string; dry_weight_g: number | null; overall_rating: number | null; harvest_date: string | null
  grows: {
    plant_count: number; flip_date: string | null; genetics_id: string | null
    genetics: { strain_name: string } | { strain_name: string }[] | null
  } | null
}

function strainName(h: HarvestJoin): string {
  const g = h.grows?.genetics
  const gen = Array.isArray(g) ? g[0] : g
  return gen?.strain_name ?? 'Unknown'
}
function mean(v: number[]): number | null { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }

export default async function StrainLeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('harvest_reports')
    .select('grow_id, dry_weight_g, overall_rating, harvest_date, grows(plant_count, flip_date, genetics_id, genetics(strain_name))')
    .eq('user_id', user.id)
  const harvests = ((data ?? []) as unknown as HarvestJoin[]).filter(h => h.dry_weight_g != null)

  // Group by strain
  const map = new Map<string, { id: string | null; perPlant: number[]; flower: number[]; rating: number[] }>()
  for (const h of harvests) {
    const name = strainName(h)
    const cur = map.get(name) ?? { id: h.grows?.genetics_id ?? null, perPlant: [], flower: [], rating: [] }
    if (!cur.id && h.grows?.genetics_id) cur.id = h.grows.genetics_id
    const oz = (h.dry_weight_g ?? 0) / OZ
    if (h.grows?.plant_count) cur.perPlant.push(oz / h.grows.plant_count)
    if (h.grows?.flip_date && h.harvest_date) {
      const fd = differenceInDays(parseISO(h.harvest_date), parseISO(h.grows.flip_date))
      if (fd > 0 && fd < 150) cur.flower.push(fd)
    }
    if (h.overall_rating != null) cur.rating.push(h.overall_rating)
    map.set(name, cur)
  }

  const rows = Array.from(map.entries()).map(([name, v]) => ({
    name,
    id: v.id,
    runs: v.perPlant.length || v.rating.length || v.flower.length,
    avgPerPlant: mean(v.perPlant),
    avgFlower: mean(v.flower),
    avgRating: mean(v.rating),
  }))

  const ranked = rows.filter(r => r.runs >= MIN_RUNS).sort((a, b) => (b.avgPerPlant ?? 0) - (a.avgPerPlant ?? 0))
  const gathering = rows.filter(r => r.runs < MIN_RUNS && r.runs > 0).sort((a, b) => b.runs - a.runs)

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/strains" style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-5 h-5" /></Link>
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" style={{ color: 'var(--gold)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Strain Leaderboard</h1>
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Ranked by avg yield per plant. Only strains with {MIN_RUNS}+ completed runs are ranked — the rest are still gathering data.
      </p>

      {ranked.length === 0 && gathering.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text)' }}>No completed harvests yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Close out grows to rank your strains.</p>
        </div>
      ) : (
        <>
          {/* Ranked */}
          <div className="space-y-2">
            {ranked.map((r, i) => (
              <Row key={r.name} rank={i + 1} {...r} ranked />
            ))}
            {ranked.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                No strain has {MIN_RUNS}+ runs yet — keep growing to build the rankings.
              </p>
            )}
          </div>

          {/* Gathering data */}
          {gathering.length > 0 && (
            <div>
              <h2 className="text-xs font-medium uppercase tracking-wide mb-2 mt-6" style={{ color: 'var(--text-muted)' }}>
                Still gathering data (&lt;{MIN_RUNS} runs)
              </h2>
              <div className="space-y-2">
                {gathering.map(r => <Row key={r.name} {...r} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({ rank, name, id, runs, avgPerPlant, avgFlower, avgRating, ranked }: {
  rank?: number; name: string; id: string | null; runs: number
  avgPerPlant: number | null; avgFlower: number | null; avgRating: number | null; ranked?: boolean
}) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  const inner = (
    <div className="rounded-xl border p-3 flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)', opacity: ranked ? 1 : 0.75 }}>
      {ranked && (
        <div className="w-7 text-center shrink-0">
          {medal ? <span className="text-lg">{medal}</span> : <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-muted)' }}>{rank}</span>}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{name}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Based on {runs} run{runs !== 1 ? 's' : ''}{ranked ? '' : ' · low confidence'}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs font-mono shrink-0">
        {avgPerPlant != null && <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }}><Scale className="w-3 h-3" />{avgPerPlant.toFixed(1)}oz</span>}
        {avgFlower != null && <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><CalendarClock className="w-3 h-3" />{Math.round(avgFlower)}d</span>}
        {avgRating != null && <span className="flex items-center gap-1" style={{ color: '#f59e0b' }}><Star className="w-3 h-3" />{avgRating.toFixed(1)}</span>}
      </div>
    </div>
  )
  return id ? <Link href={`/strains/${id}`}>{inner}</Link> : inner
}
