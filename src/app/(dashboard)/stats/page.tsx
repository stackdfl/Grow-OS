import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { parseISO, format } from 'date-fns'
import { Trophy, Award, Scale, Sprout, DollarSign, Star, TrendingUp } from 'lucide-react'
import { CountUp } from '@/components/stats/count-up'

interface HarvestRow {
  id: string
  grow_id: string
  harvest_date: string | null
  dry_weight_g: number | null
  overall_rating: number | null
  photos: string[]
  grows: {
    name: string
    plant_count: number
    genetics: { strain_name: string } | { strain_name: string }[] | null
  } | null
}

function strainOf(h: HarvestRow): string {
  const g = h.grows?.genetics
  const gen = Array.isArray(g) ? g[0] : g
  return gen?.strain_name ?? h.grows?.name ?? 'Unknown'
}

const OZ = 28.35

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year: yearParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [harvestRes, expensesRes] = await Promise.all([
    supabase
      .from('harvest_reports')
      .select('id, grow_id, harvest_date, dry_weight_g, overall_rating, photos, grows(name, plant_count, genetics(strain_name))')
      .eq('user_id', user.id)
      .order('harvest_date', { ascending: false }),
    supabase.from('grow_expenses').select('grow_id, amount_usd').eq('user_id', user.id),
  ])

  const all = (harvestRes.data ?? []) as unknown as HarvestRow[]

  // Spend per grow
  const spendByGrow = new Map<string, number>()
  for (const e of (expensesRes.data ?? []) as { grow_id: string; amount_usd: number }[]) {
    spendByGrow.set(e.grow_id, (spendByGrow.get(e.grow_id) ?? 0) + Number(e.amount_usd))
  }

  // Available years
  const years = Array.from(new Set(all.map(h => h.harvest_date ? new Date(h.harvest_date).getFullYear() : null)
    .filter((y): y is number => y != null))).sort((a, b) => b - a)
  const currentYear = new Date().getFullYear()
  const year = yearParam ? parseInt(yearParam) : (years[0] ?? currentYear)

  const yearHarvests = all.filter(h => h.harvest_date && new Date(h.harvest_date).getFullYear() === year)

  // Aggregates
  const totalDryG = yearHarvests.reduce((s, h) => s + (h.dry_weight_g ?? 0), 0)
  const totalOz = totalDryG / OZ
  const growsCount = yearHarvests.length
  const plantsCount = yearHarvests.reduce((s, h) => s + (h.grows?.plant_count ?? 0), 0)
  const avgYieldPerPlant = plantsCount > 0 ? totalOz / plantsCount : 0
  const totalSpend = yearHarvests.reduce((s, h) => s + (spendByGrow.get(h.grow_id) ?? 0), 0)
  const costPerOz = totalOz > 0 && totalSpend > 0 ? totalSpend / totalOz : null
  const ratings = yearHarvests.map(h => h.overall_rating).filter((r): r is number => r != null)
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

  // Best strain by total oz
  const byStrain = new Map<string, { oz: number; ratingSum: number; ratingN: number }>()
  for (const h of yearHarvests) {
    const s = strainOf(h)
    const cur = byStrain.get(s) ?? { oz: 0, ratingSum: 0, ratingN: 0 }
    cur.oz += (h.dry_weight_g ?? 0) / OZ
    if (h.overall_rating != null) { cur.ratingSum += h.overall_rating; cur.ratingN++ }
    byStrain.set(s, cur)
  }
  const bestStrain = Array.from(byStrain.entries()).sort((a, b) => b[1].oz - a[1].oz)[0]

  // Records
  const biggest = [...yearHarvests].sort((a, b) => (b.dry_weight_g ?? 0) - (a.dry_weight_g ?? 0))[0]
  const topRated = [...yearHarvests].sort((a, b) => (b.overall_rating ?? 0) - (a.overall_rating ?? 0))[0]

  return (
    <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto space-y-6">
      {/* Header + year selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Grow Stats</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your harvest year in review</p>
        </div>
        <div className="flex gap-1.5">
          {[...new Set([currentYear, ...years])].sort((a, b) => b - a).map(y => (
            <Link key={y} href={`/stats?year=${y}`}
              className="px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors"
              style={{
                background: y === year ? 'var(--accent-muted)' : 'transparent',
                borderColor: y === year ? 'var(--accent)' : 'var(--border)',
                color: y === year ? 'var(--accent)' : 'var(--text-muted)',
              }}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      {/* Hero odometer */}
      <div className="rounded-2xl border p-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--accent-muted), var(--surface))', borderColor: 'var(--accent)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 0%, rgba(82,183,136,0.18), transparent 70%)' }} />
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="w-5 h-5" style={{ color: 'var(--gold)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Harvested in {year}</span>
        </div>
        <div className="text-6xl md:text-7xl font-black font-mono tracking-tight" style={{ color: 'var(--text)' }}>
          <CountUp value={totalOz} decimals={1} />
          <span className="text-2xl md:text-3xl ml-2" style={{ color: 'var(--accent)' }}>oz</span>
        </div>
        <p className="text-sm mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
          {totalDryG.toFixed(0)} g · {(totalOz / 16).toFixed(2)} lb
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Sprout} label="Grows finished" value={`${growsCount}`} />
        <Stat icon={Scale} label="Avg / plant" value={`${avgYieldPerPlant.toFixed(1)} oz`} accent />
        <Stat icon={Star} label="Avg rating" value={avgRating != null ? `${avgRating.toFixed(1)}/10` : '—'} />
        <Stat icon={DollarSign} label="Cost / oz" value={costPerOz != null ? `$${costPerOz.toFixed(2)}` : '—'} />
      </div>

      {/* Best strain + records */}
      {growsCount > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          {bestStrain && (
            <Highlight icon={Award} tint="var(--gold)" title="Top producer"
              main={bestStrain[0]} sub={`${bestStrain[1].oz.toFixed(1)} oz total`} />
          )}
          {biggest && (
            <Highlight icon={TrendingUp} tint="var(--accent)" title="Biggest harvest"
              main={strainOf(biggest)} sub={biggest.dry_weight_g ? `${(biggest.dry_weight_g / OZ).toFixed(1)} oz dry` : '—'} />
          )}
          {topRated?.overall_rating != null && (
            <Highlight icon={Star} tint="#f59e0b" title="Highest rated"
              main={strainOf(topRated)} sub={`${topRated.overall_rating}/10`} />
          )}
        </div>
      )}

      {/* Trophy case */}
      <div>
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          Trophy case ({growsCount})
        </h2>
        {growsCount === 0 ? (
          <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No harvests logged for {year} yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Close out a grow to start the ticker.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {yearHarvests.map(h => {
              const oz = h.dry_weight_g ? (h.dry_weight_g / OZ).toFixed(1) : '—'
              const cover = h.photos?.[0]
              return (
                <Link key={h.id} href={`/grows/${h.grow_id}/story`}>
                  <div className="rounded-xl border overflow-hidden transition-transform hover:scale-[1.02]"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="h-24 relative" style={{ background: cover ? undefined : 'var(--surface-raised)' }}>
                      {cover
                        ? <img src={cover} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Sprout className="w-6 h-6" style={{ color: 'var(--text-muted)' }} /></div>}
                      {h.overall_rating != null && (
                        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(0,0,0,0.6)', color: '#f59e0b' }}>★ {h.overall_rating}</span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{strainOf(h)}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>{oz} oz</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {h.harvest_date ? format(parseISO(h.harvest_date), 'MMM d') : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, accent }: {
  icon: typeof Sprout; label: string; value: string; accent?: boolean
}) {
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono" style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</p>
    </div>
  )
}

function Highlight({ icon: Icon, tint, title, main, sub }: {
  icon: typeof Award; tint: string; title: string; main: string; sub: string
}) {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}22` }}>
        <Icon className="w-5 h-5" style={{ color: tint }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{title}</p>
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{main}</p>
        <p className="text-xs font-mono" style={{ color: tint }}>{sub}</p>
      </div>
    </div>
  )
}
