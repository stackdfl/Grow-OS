import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ChevronLeft, Scissors, Sprout, Flower2, Zap, Trophy, Droplets, Leaf } from 'lucide-react'
import { ShareToCanopy } from '@/components/community/share-to-canopy'
import type { Grow, Genetics, JournalEntry, HarvestReport } from '@/types/database'

const OZ = 28.35

const MOOD: Record<string, { emoji: string; color: string }> = {
  thriving: { emoji: '🔥', color: '#52B788' },
  healthy:  { emoji: '🌿', color: '#52B788' },
  meh:      { emoji: '😐', color: '#F4A261' },
  issue:    { emoji: '⚠️', color: '#E76F51' },
}

interface Milestone {
  kind: 'milestone'
  date: string
  label: string
  icon: 'clone' | 'veg' | 'flip' | 'harvest'
  color: string
}
interface EntryItem { kind: 'entry'; date: string; entry: JournalEntry }
type Item = Milestone | EntryItem

const MS_ICON = { clone: Scissors, veg: Leaf, flip: Zap, harvest: Trophy }

export default async function GrowStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: growRaw } = await supabase
    .from('grows').select('*, genetics(*)').eq('id', id).eq('user_id', user.id).single()
  if (!growRaw) notFound()
  const grow = growRaw as Grow & { genetics: Genetics | null }

  const [{ data: entriesRaw }, { data: harvestRaw }] = await Promise.all([
    supabase.from('journal_entries').select('*').eq('grow_id', id).order('entry_date', { ascending: true }),
    supabase.from('harvest_reports').select('*').eq('grow_id', id).maybeSingle(),
  ])
  const entries = (entriesRaw ?? []) as JournalEntry[]
  const harvest = harvestRaw as HarvestReport | null

  // Build timeline
  const items: Item[] = []
  if (grow.clone_date) items.push({ kind: 'milestone', date: grow.clone_date, label: 'Planted', icon: 'clone', color: '#22c55e' })
  if (grow.veg_start_date) items.push({ kind: 'milestone', date: grow.veg_start_date, label: 'Veg began', icon: 'veg', color: '#52B788' })
  if (grow.flip_date) items.push({ kind: 'milestone', date: grow.flip_date, label: 'Flipped to flower', icon: 'flip', color: '#9B5DE5' })
  const harvestDate = grow.actual_harvest_date ?? grow.harvest_date
  if (harvestDate && (harvest || grow.status === 'complete')) {
    items.push({ kind: 'milestone', date: harvestDate, label: 'Harvested', icon: 'harvest', color: '#F9C74F' })
  }
  for (const e of entries) items.push({ kind: 'entry', date: e.entry_date, entry: e })
  items.sort((a, b) => a.date.localeCompare(b.date))

  // Hero stats
  const start = grow.clone_date ?? grow.veg_start_date ?? grow.flip_date
  const totalDays = start && harvestDate ? differenceInDays(parseISO(harvestDate), parseISO(start))
    : start ? differenceInDays(new Date(), parseISO(start)) : null
  const allPhotos = entries.flatMap(e => e.photos ?? [])
  const cover = grow.cover_photo_url ?? harvest?.photos?.[0] ?? allPhotos[0] ?? null
  const dryOz = harvest?.dry_weight_g ? harvest.dry_weight_g / OZ : null
  const yieldPerPlant = dryOz && grow.plant_count ? dryOz / grow.plant_count : null

  const dayOf = (date: string) => start ? differenceInDays(parseISO(date), parseISO(start)) : null

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/grows/${id}`} style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text)' }}>Grow Story</h1>
        <ShareToCanopy growId={id} />
      </div>

      {/* Hero */}
      <div className="rounded-2xl border overflow-hidden mb-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="h-44 relative" style={{ background: 'var(--surface-raised)' }}>
          {cover
            ? <img src={cover} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Sprout className="w-10 h-10" style={{ color: 'var(--text-muted)' }} /></div>}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,15,13,0.92), transparent 60%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-2xl font-bold" style={{ color: '#fff' }}>{grow.genetics?.strain_name ?? grow.name}</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {grow.genetics?.breeder ? `${grow.genetics.breeder} · ` : ''}{grow.name}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x" style={{ borderColor: 'var(--border)' }}>
          <HeroStat label="Days" value={totalDays != null ? `${totalDays}` : '—'} />
          <HeroStat label="Plants" value={`${grow.plant_count}`} />
          <HeroStat label="Yield" value={dryOz ? `${dryOz.toFixed(1)}oz` : '—'} accent />
          <HeroStat label="Rating" value={harvest?.overall_rating ? `${harvest.overall_rating}/10` : '—'} />
        </div>
        {yieldPerPlant != null && (
          <div className="px-4 py-2 text-center text-xs border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {yieldPerPlant.toFixed(1)} oz/plant{harvest?.what_worked ? ` · ${harvest.what_worked}` : ''}
          </div>
        )}
      </div>

      {/* Timeline */}
      {items.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No story yet — log days and add photos to build it.</p>
          <Link href={`/grows/${id}/log`} className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}>Log a day</Link>
        </div>
      ) : (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-px" style={{ background: 'var(--border)' }} />
          <div className="space-y-5">
            {items.map((item, i) => item.kind === 'milestone'
              ? <MilestoneRow key={`m-${i}`} m={item} day={dayOf(item.date)} />
              : <EntryRow key={item.entry.id} entry={item.entry} day={dayOf(item.date)} />)}
          </div>
        </div>
      )}

      {/* Watermark for screenshots */}
      <div className="flex items-center justify-center gap-1.5 mt-8 opacity-60">
        <Sprout className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Grown with Grow OS</span>
      </div>
    </div>
  )
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="py-3 text-center" style={{ borderColor: 'var(--border)' }}>
      <p className="text-base font-bold font-mono" style={{ color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</p>
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center"
      style={{ background: 'var(--bg)', border: `2px solid ${color}`, boxShadow: `0 0 8px ${color}66` }}>
      {children}
    </div>
  )
}

function MilestoneRow({ m, day }: { m: Milestone; day: number | null }) {
  const Icon = MS_ICON[m.icon]
  return (
    <div className="relative">
      <Dot color={m.color}><Icon className="w-3 h-3" style={{ color: m.color }} /></Dot>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold" style={{ color: m.color }}>{m.label}</span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {format(parseISO(m.date + 'T12:00:00'), 'MMM d')}{day != null && day >= 0 ? ` · day ${day}` : ''}
        </span>
      </div>
    </div>
  )
}

function EntryRow({ entry, day }: { entry: JournalEntry; day: number | null }) {
  const mood = (entry.structured_data as { mood?: string } | null)?.mood
  const moodInfo = mood ? MOOD[mood] : null
  const photos = entry.photos ?? []
  return (
    <div className="relative">
      <Dot color="var(--border)">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
      </Dot>
      <div className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
            {format(parseISO(entry.entry_date + 'T12:00:00'), 'EEE, MMM d')}{day != null && day >= 0 ? ` · day ${day}` : ''}
          </span>
          {moodInfo && <span className="text-sm">{moodInfo.emoji}</span>}
          <div className="flex gap-1 ml-auto">
            {entry.watering_logged && <Droplets className="w-3 h-3" style={{ color: '#818cf8' }} />}
            {entry.feeding_logged && <Zap className="w-3 h-3" style={{ color: 'var(--accent)' }} />}
            {entry.training_logged && <Scissors className="w-3 h-3" style={{ color: '#8b5cf6' }} />}
          </div>
        </div>
        {entry.raw_notes && (
          <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: 'var(--text-secondary)' }}>{entry.raw_notes}</p>
        )}
        {photos.length > 0 && (
          <div className={`grid gap-1.5 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {photos.slice(0, 4).map((url, i) => (
              <img key={i} src={url} alt="" className="w-full rounded-lg object-cover"
                style={{ aspectRatio: photos.length === 1 ? '16/10' : '1', maxHeight: photos.length === 1 ? 280 : undefined }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
