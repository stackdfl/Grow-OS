import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatDistanceToNow, differenceInDays, parseISO, addWeeks, isBefore, isAfter, startOfDay } from 'date-fns'
import { Sprout, Plus, Droplets, AlertTriangle, CheckSquare, ChevronRight, Zap } from 'lucide-react'
import type { Grow, CalendarEvent, WateringLog } from '@/types/database'

const STAGE_COLORS: Record<string, string> = {
  seedling: 'var(--accent)',
  clone:    'var(--accent)',
  veg:      'var(--accent)',
  flower:   'var(--purple)',
  flush:    'var(--gold)',
  harvest:  'var(--gold)',
  drying:   'var(--warning)',
  curing:   'var(--warning)',
  complete: 'var(--text-muted)',
  failed:   'var(--danger)',
}

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling', clone: 'Clone', veg: 'Veg',
  flower: 'Flower', flush: 'Flush', harvest: 'Harvest',
  drying: 'Drying', curing: 'Curing', complete: 'Complete', failed: 'Failed',
}

function getDayOfStage(grow: Grow): { label: string; days: number } | null {
  const today = startOfDay(new Date())
  if (grow.flip_date && ['flower', 'flush'].includes(grow.status)) {
    const days = differenceInDays(today, parseISO(grow.flip_date))
    const week = Math.floor(days / 7) + 1
    return { label: `Day ${days} of Flower (Week ${week})`, days }
  }
  if (grow.veg_start_date && grow.status === 'veg') {
    const days = differenceInDays(today, parseISO(grow.veg_start_date))
    return { label: `Day ${days} of Veg`, days }
  }
  if (grow.clone_date && grow.status === 'clone') {
    const days = differenceInDays(today, parseISO(grow.clone_date))
    return { label: `Day ${days} in Clone`, days }
  }
  return null
}

function getDaysUntilHarvest(grow: Grow): number | null {
  if (!grow.harvest_date) return null
  const days = differenceInDays(parseISO(grow.harvest_date), startOfDay(new Date()))
  return days
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = startOfDay(new Date())
  const todayStr = today.toISOString().split('T')[0]
  const in7Days = addWeeks(today, 1).toISOString().split('T')[0]

  // Fetch all active grows with genetics
  const { data: growsRaw } = await supabase
    .from('grows')
    .select('*, genetics(*)')
    .eq('user_id', user.id)
    .not('status', 'in', '("complete","failed")')
    .order('created_at', { ascending: false })
  const grows = (growsRaw ?? []) as (Grow & { genetics: import('@/types/database').Genetics | null })[]

  // Fetch today's + upcoming calendar events
  const { data: upcomingEventsRaw } = await supabase
    .from('calendar_events')
    .select('*, grows(id, name, status)')
    .eq('user_id', user.id)
    .eq('completed', false)
    .eq('skipped', false)
    .gte('event_date', todayStr)
    .lte('event_date', in7Days)
    .order('event_date', { ascending: true })
    .limit(50)
  const upcomingEvents = (upcomingEventsRaw ?? []) as (CalendarEvent & { grows: { id: string; name: string; status: string } | null })[]

  // Fetch last watering per grow
  const growIds = grows.map((g) => g.id)
  const lastWaterings: Record<string, WateringLog> = {}
  if (growIds.length > 0) {
    const { data: waterings } = await supabase
      .from('watering_logs')
      .select('*')
      .in('grow_id', growIds)
      .order('log_date', { ascending: false })

    for (const w of (waterings ?? []) as WateringLog[]) {
      if (!lastWaterings[w.grow_id]) lastWaterings[w.grow_id] = w
    }
  }

  const todayEvents = upcomingEvents.filter((e) => e.event_date === todayStr)
  const upcomingOnly = upcomingEvents.filter((e) => e.event_date > todayStr)

  // Alerts
  const alerts: string[] = []
  for (const grow of grows) {
    const lastWater = lastWaterings[grow.id]
    if (!lastWater) {
      if (['flower', 'veg', 'flush'].includes(grow.status)) {
        alerts.push(`${grow.name} — no watering logged yet`)
      }
    } else {
      const daysSince = differenceInDays(today, parseISO(lastWater.log_date))
      if (daysSince > 3 && ['flower', 'veg'].includes(grow.status)) {
        alerts.push(`${grow.name} — last watered ${daysSince} days ago`)
      }
    }
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/grows/new">
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            <Plus className="w-4 h-4" />
            New Grow
          </button>
        </Link>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2" style={{ background: 'rgba(244,162,97,0.08)', borderColor: 'rgba(244,162,97,0.3)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--warning)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--warning)' }}>Attention needed</span>
          </div>
          {alerts.map((a, i) => (
            <p key={i} className="text-sm pl-6" style={{ color: 'var(--text-secondary)' }}>{a}</p>
          ))}
        </div>
      )}

      {/* Today's Tasks */}
      {todayEvents.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Today — {todayEvents.filter(e => !e.completed).length} tasks
              </span>
            </div>
            <Link href="/calendar" className="text-xs" style={{ color: 'var(--accent)' }}>View all</Link>
          </div>
          <div className="space-y-1.5">
            {todayEvents.slice(0, 6).map((event) => (
              <TodayTask key={event.id} event={event as CalendarEvent & { grows: { id: string; name: string; status: string } | null }} />
            ))}
            {todayEvents.length > 6 && (
              <Link href="/calendar" className="block text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
                +{todayEvents.length - 6} more tasks today
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Active Grows */}
      {grows.length === 0 ? (
        <EmptyGrows />
      ) : (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Active Grows ({grows.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grows.map((grow) => {
              const stageInfo = getDayOfStage(grow)
              const daysToHarvest = getDaysUntilHarvest(grow)
              const lastWater = lastWaterings[grow.id]
              const daysSinceWater = lastWater
                ? differenceInDays(today, parseISO(lastWater.log_date))
                : null
              const growTodayTasks = todayEvents.filter((e) => e.grow_id === grow.id && !e.completed)

              return (
                <GrowCard
                  key={grow.id}
                  grow={grow}
                  stageInfo={stageInfo}
                  daysToHarvest={daysToHarvest}
                  daysSinceWater={daysSinceWater}
                  todayTasks={growTodayTasks}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming 7 days */}
      {upcomingOnly.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Next 7 days</span>
            <Link href="/calendar" className="text-xs" style={{ color: 'var(--accent)' }}>Full calendar</Link>
          </div>
          <div className="space-y-1.5">
            {upcomingOnly.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-1">
                <span className="text-xs font-mono w-16 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {new Date(event.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{event.title}</span>
                <PriorityDot priority={event.priority} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GrowCard({
  grow, stageInfo, daysToHarvest, daysSinceWater, todayTasks
}: {
  grow: Grow
  stageInfo: { label: string; days: number } | null
  daysToHarvest: number | null
  daysSinceWater: number | null
  todayTasks: CalendarEvent[]
}) {
  const stageColor = STAGE_COLORS[grow.status] ?? 'var(--text-muted)'
  const waterAlert = daysSinceWater !== null && daysSinceWater > 3

  return (
    <Link href={`/grows/${grow.id}`}>
      <div
        className="rounded-xl border p-4 hover:border-[--accent] transition-colors cursor-pointer space-y-3"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{grow.name}</p>
            {grow.genetics && (
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {(grow.genetics as { strain_name: string }).strain_name}
                {(grow.genetics as { cut_id?: string }).cut_id && ` · ${(grow.genetics as { cut_id: string }).cut_id}`}
              </p>
            )}
          </div>
          <span
            className="px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
            style={{ background: `${stageColor}20`, color: stageColor }}
          >
            {STAGE_LABELS[grow.status]}
          </span>
        </div>

        {/* Stage info */}
        {stageInfo && (
          <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{stageInfo.label}</p>
        )}

        {/* Harvest countdown */}
        {daysToHarvest !== null && daysToHarvest >= 0 && (
          <div className="flex items-center gap-1.5">
            <Sprout className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--gold)' }} />
            <span className="text-xs" style={{ color: 'var(--gold)' }}>
              {daysToHarvest === 0 ? 'Harvest today!' : `${daysToHarvest}d to harvest`}
            </span>
          </div>
        )}

        {/* Watering */}
        <div className="flex items-center gap-1.5">
          <Droplets className="w-3.5 h-3.5 shrink-0" style={{ color: waterAlert ? 'var(--warning)' : 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: waterAlert ? 'var(--warning)' : 'var(--text-muted)' }}>
            {daysSinceWater === null
              ? 'No watering logged'
              : daysSinceWater === 0
              ? 'Watered today'
              : `Last watered ${daysSinceWater}d ago`}
          </span>
        </div>

        {/* Today's tasks */}
        {todayTasks.length > 0 && (
          <div className="pt-2 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
            {todayTasks.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{t.title}</span>
              </div>
            ))}
            {todayTasks.length > 3 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>+{todayTasks.length - 3} more</p>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

function TodayTask({ event }: { event: CalendarEvent & { grows: { id: string; name: string; status: string } | null } }) {
  const priorityColor =
    event.priority === 'critical' ? 'var(--danger)' :
    event.priority === 'high' ? 'var(--warning)' :
    'var(--text-muted)'

  return (
    <Link href={`/grows/${event.grow_id}?tab=calendar`}>
      <div className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[--surface-raised] transition-colors">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: priorityColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{event.title}</p>
          {event.grows && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.grows.name}</p>
          )}
        </div>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
      </div>
    </Link>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === 'critical' ? 'var(--danger)' :
    priority === 'high' ? 'var(--warning)' :
    priority === 'medium' ? 'var(--accent)' :
    'var(--text-muted)'
  return <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
}

function EmptyGrows() {
  return (
    <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-muted)' }}>
        <Sprout className="w-6 h-6" style={{ color: 'var(--accent)' }} />
      </div>
      <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No active grows</p>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Start tracking your first grow or download a recipe.</p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/grows/new">
          <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            + New Grow
          </button>
        </Link>
        <Link href="/recipes">
          <button className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Browse Recipes
          </button>
        </Link>
      </div>
    </div>
  )
}
