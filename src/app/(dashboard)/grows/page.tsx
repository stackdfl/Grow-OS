import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { differenceInDays, parseISO, startOfDay } from 'date-fns'
import { Plus, Sprout, Filter } from 'lucide-react'
import type { Grow, Genetics } from '@/types/database'

const STAGE_COLORS: Record<string, string> = {
  seedling: 'var(--accent)', clone: 'var(--accent)', veg: 'var(--accent)',
  flower: 'var(--purple)', flush: 'var(--gold)', harvest: 'var(--gold)',
  drying: 'var(--warning)', curing: 'var(--warning)',
  complete: 'var(--text-muted)', failed: 'var(--danger)',
}

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling', clone: 'Clone', veg: 'Veg', flower: 'Flower',
  flush: 'Flush', harvest: 'Harvest', drying: 'Drying', curing: 'Curing',
  complete: 'Complete', failed: 'Failed',
}

const STATUS_ORDER = ['seedling','clone','veg','flower','flush','harvest','drying','curing','complete','failed']

export default async function GrowsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { filter } = await searchParams
  const activeFilter = filter ?? 'active'

  const query = supabase
    .from('grows')
    .select('*, genetics(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (activeFilter === 'active') {
    query.not('status', 'in', '("complete","failed")')
  } else if (activeFilter === 'complete') {
    query.in('status', ['complete', 'failed'])
  }

  const { data: growsRaw } = await query
  const grows = (growsRaw ?? []) as (Grow & { genetics: Genetics | null })[]

  const today = startOfDay(new Date())

  const FILTERS = [
    { key: 'active', label: 'Active' },
    { key: 'all', label: 'All' },
    { key: 'complete', label: 'Completed' },
  ]

  return (
    <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Grows</h1>
        <Link href="/grows/new">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4" />
            New Grow
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/grows?filter=${f.key}`}>
            <button
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={{
                background: activeFilter === f.key ? 'var(--accent-muted)' : 'transparent',
                borderColor: activeFilter === f.key ? 'var(--accent)' : 'var(--border)',
                color: activeFilter === f.key ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {f.label}
            </button>
          </Link>
        ))}
      </div>

      {/* List */}
      {grows.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-muted)' }}>
            <Sprout className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No grows yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Track your first grow to get started.</p>
          <Link href="/grows/new">
            <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              + New Grow
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {grows.map((grow) => {
            const stageColor = STAGE_COLORS[grow.status] ?? 'var(--text-muted)'
            let stageDetail = ''
            if (grow.flip_date && ['flower', 'flush'].includes(grow.status)) {
              const days = differenceInDays(today, parseISO(grow.flip_date))
              stageDetail = `Day ${days} · Week ${Math.floor(days / 7) + 1}`
            } else if (grow.veg_start_date && grow.status === 'veg') {
              stageDetail = `Day ${differenceInDays(today, parseISO(grow.veg_start_date))} of Veg`
            } else if (grow.clone_date) {
              stageDetail = `Since ${new Date(grow.clone_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            }

            const daysToHarvest = grow.harvest_date
              ? differenceInDays(parseISO(grow.harvest_date), today)
              : null

            return (
              <Link key={grow.id} href={`/grows/${grow.id}`}>
                <div
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors hover:border-[--accent]"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {/* Status dot */}
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor }} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{grow.name}</span>
                      {grow.genetics && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{grow.genetics.strain_name}</span>
                      )}
                    </div>
                    {stageDetail && (
                      <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{stageDetail}</p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-3 shrink-0">
                    {daysToHarvest !== null && daysToHarvest >= 0 && (
                      <span className="text-xs font-mono" style={{ color: 'var(--gold)' }}>{daysToHarvest}d</span>
                    )}
                    <span
                      className="px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{ background: `${stageColor}20`, color: stageColor }}
                    >
                      {STAGE_LABELS[grow.status]}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{grow.plant_count}p</span>
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
