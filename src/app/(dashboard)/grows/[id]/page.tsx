import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { differenceInDays, parseISO, startOfDay, format, addDays } from 'date-fns'
import {
  ChevronLeft, Droplets, Thermometer, Wind, CalendarDays,
  Sprout, FlaskConical, BookOpen, Zap, Leaf, GlassWater, Pencil
} from 'lucide-react'
import type { Grow, Genetics, EquipmentProfile, CalendarEvent, WateringLog, EnvReading } from '@/types/database'
import { SyncRecipeButton } from '@/components/grows/sync-recipe-button'

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling', clone: 'Clone', veg: 'Veg', flower: 'Flower',
  flush: 'Flush', harvest: 'Harvest', drying: 'Drying', curing: 'Curing',
  complete: 'Complete', failed: 'Failed',
}
const STAGE_ORDER = ['clone','seedling','veg','flower','flush','harvest','drying','curing','complete']
const STAGE_COLORS: Record<string, string> = {
  seedling: 'var(--accent)', clone: 'var(--accent)', veg: 'var(--accent)',
  flower: 'var(--purple)', flush: 'var(--gold)', harvest: 'var(--gold)',
  drying: 'var(--warning)', curing: 'var(--warning)',
  complete: 'var(--text-muted)', failed: 'var(--danger)',
}

export default async function GrowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: growRaw } = await supabase
    .from('grows')
    .select('*, genetics(*), equipment_profile:equipment_profiles(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!growRaw) notFound()
  const grow = growRaw as Grow & { genetics: Genetics | null; equipment_profile: EquipmentProfile | null }

  const today = startOfDay(new Date())
  const todayStr = format(today, 'yyyy-MM-dd')
  const in7Days = format(addDays(today, 7), 'yyyy-MM-dd')

  const [
    { data: upcomingEventsRaw },
    { data: lastWateringRaw },
    { data: lastReadingRaw },
  ] = await Promise.all([
    supabase.from('calendar_events')
      .select('*')
      .eq('grow_id', id)
      .eq('completed', false)
      .eq('skipped', false)
      .gte('event_date', todayStr)
      .lte('event_date', in7Days)
      .order('event_date', { ascending: true })
      .limit(10),
    supabase.from('watering_logs')
      .select('*')
      .eq('grow_id', id)
      .order('log_date', { ascending: false })
      .limit(1),
    supabase.from('env_readings')
      .select('*')
      .eq('grow_id', id)
      .order('reading_time', { ascending: false })
      .limit(1),
  ])

  const upcomingEvents = (upcomingEventsRaw ?? []) as CalendarEvent[]
  const lastWatering = lastWateringRaw?.[0] as WateringLog | undefined
  const lastReading = lastReadingRaw?.[0] as EnvReading | undefined

  // Stage timeline
  const stageIndex = STAGE_ORDER.indexOf(grow.status)

  // Key date calculations
  let flowerDay: number | null = null
  let flowerWeek: number | null = null
  let daysUntilHarvest: number | null = null
  let totalDays: number | null = null

  if (grow.flip_date && ['flower', 'flush'].includes(grow.status)) {
    flowerDay = differenceInDays(today, parseISO(grow.flip_date))
    flowerWeek = Math.floor(flowerDay / 7) + 1
  }
  if (grow.harvest_date) {
    daysUntilHarvest = differenceInDays(parseISO(grow.harvest_date), today)
  }
  if (grow.clone_date) {
    totalDays = differenceInDays(today, parseISO(grow.clone_date))
  }

  const daysSinceWater = lastWatering
    ? differenceInDays(today, parseISO(lastWatering.log_date))
    : null

  const stageColor = STAGE_COLORS[grow.status] ?? 'var(--text-muted)'

  return (
    <div className="px-4 md:px-6 py-5 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/grows" className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold truncate" style={{ color: 'var(--text)' }}>{grow.name}</h1>
            <span className="px-2 py-0.5 rounded-md text-xs font-medium shrink-0" style={{ background: `${stageColor}20`, color: stageColor }}>
              {STAGE_LABELS[grow.status]}
            </span>
            <Link href={`/grows/${id}/edit`}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Pencil className="w-3 h-3" /> Edit
            </Link>
            {grow.recipe_id && (
              <SyncRecipeButton
                growId={grow.id}
                recipeId={grow.recipe_id}
                cloneDate={grow.clone_date}
                vegStartDate={grow.veg_start_date}
                flipDate={grow.flip_date}
              />
            )}
          </div>
          {grow.genetics && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {grow.genetics.strain_name}
              {grow.genetics.breeder && ` · ${grow.genetics.breeder}`}
              {grow.genetics.cut_id && ` · ${grow.genetics.cut_id}`}
            </p>
          )}
        </div>
      </div>

      {/* Stage timeline */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between overflow-x-auto gap-1 pb-1">
          {STAGE_ORDER.map((stage, i) => {
            const isPast = i < stageIndex
            const isCurrent = i === stageIndex
            const color = STAGE_COLORS[stage]
            return (
              <div key={stage} className="flex items-center shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full transition-all"
                    style={{
                      background: isCurrent ? color : isPast ? 'var(--text-muted)' : 'var(--border)',
                      boxShadow: isCurrent ? `0 0 6px ${color}` : 'none',
                    }}
                  />
                  <span
                    className="text-[10px] whitespace-nowrap"
                    style={{ color: isCurrent ? color : isPast ? 'var(--text-muted)' : 'var(--border)' }}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div className="w-6 h-px mx-1" style={{ background: isPast ? 'var(--text-muted)' : 'var(--border)' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {flowerDay !== null && (
            <Metric label="Flower day" value={`Day ${flowerDay}`} sub={`Week ${flowerWeek}`} mono />
          )}
          {daysUntilHarvest !== null && (
            <Metric
              label="Est. harvest"
              value={daysUntilHarvest <= 0 ? 'Ready!' : `${daysUntilHarvest}d`}
              sub={grow.harvest_date ? format(parseISO(grow.harvest_date), 'MMM d') : undefined}
              mono
              highlight={daysUntilHarvest <= 7 ? 'var(--gold)' : undefined}
            />
          )}
          {totalDays !== null && (
            <Metric label="Total days" value={`${totalDays}d`} mono />
          )}
          <Metric
            label="Last watered"
            value={daysSinceWater === null ? 'Never' : daysSinceWater === 0 ? 'Today' : `${daysSinceWater}d ago`}
            highlight={daysSinceWater !== null && daysSinceWater > 3 ? 'var(--warning)' : undefined}
          />
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Sprout, label: 'Plants', value: `${grow.plant_count}` },
          { icon: Leaf, label: 'Medium', value: grow.medium_type ?? '—' },
          { icon: Zap, label: 'Space', value: grow.space_label ?? grow.equipment_profile?.name ?? '—' },
          {
            icon: CalendarDays,
            label: 'Flip date',
            value: grow.flip_date ? format(parseISO(grow.flip_date), 'MMM d, yyyy') : '—',
          },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Latest env reading */}
      {lastReading && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Environment</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {format(parseISO(lastReading.reading_time), 'MMM d, h:mm a')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {lastReading.temp_f !== null && (
              <EnvStat icon={Thermometer} label="Temp" value={`${lastReading.temp_f}°F`} />
            )}
            {lastReading.rh_percent !== null && (
              <EnvStat icon={Wind} label="RH" value={`${lastReading.rh_percent}%`} />
            )}
            {lastReading.vpd_kpa !== null && (
              <EnvStat icon={Wind} label="VPD" value={`${lastReading.vpd_kpa} kPa`} />
            )}
          </div>
        </div>
      )}

      {/* Today's tasks */}
      {upcomingEvents.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Upcoming tasks</span>
            <Link href={`/grows/${id}/calendar`} className="text-xs" style={{ color: 'var(--accent)' }}>
              Full calendar
            </Link>
          </div>
          <div className="space-y-1.5">
            {upcomingEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 py-1">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    background: ev.priority === 'critical' ? 'var(--danger)'
                      : ev.priority === 'high' ? 'var(--warning)'
                      : 'var(--accent)',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{ev.title}</p>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {ev.event_date === todayStr ? 'Today' : format(parseISO(ev.event_date), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nav tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { href: `/grows/${id}/journal`, icon: BookOpen, label: 'Journal' },
          { href: `/grows/${id}/calendar`, icon: CalendarDays, label: 'Calendar' },
          { href: `/grows/${id}/watering`, icon: GlassWater, label: 'Watering' },
          { href: `/grows/${id}/feeding`, icon: Droplets, label: 'Feeding' },
          { href: `/grows/${id}/environment`, icon: Thermometer, label: 'Env' },
          { href: `/grows/${id}/harvest`, icon: FlaskConical, label: 'Harvest' },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <div
              className="rounded-xl border p-3 flex flex-col items-center gap-1.5 hover:border-[--accent] transition-colors cursor-pointer"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Icon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Notes */}
      {grow.notes && (
        <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Notes</p>
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{grow.notes}</p>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, sub, mono, highlight }: {
  label: string; value: string; sub?: string; mono?: boolean; highlight?: string
}) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p
        className={`text-base font-semibold ${mono ? 'font-mono' : ''}`}
        style={{ color: highlight ?? 'var(--text)' }}
      >
        {value}
      </p>
      {sub && <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

function EnvStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--text-muted)' }} />
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}
