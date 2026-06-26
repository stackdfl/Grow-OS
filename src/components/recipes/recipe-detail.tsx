'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Star, Download, GitBranch, Pencil, Sprout,
  ChevronRight, Check, FlaskConical, Thermometer,
  Droplets, Zap, Calendar
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { generateRecipeCalendar, RECIPE_CALENDAR_EVENT_TYPES } from '@/lib/calendar-engine/generate'
import type { Recipe, RecipeReview, Grow } from '@/types/database'

// ─── Sub-components ───────────────────────────────────────────────────────────
function Stars({ value, interactive = false, onChange }: {
  value: number
  interactive?: boolean
  onChange?: (n: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-4 h-4 ${interactive ? 'cursor-pointer' : ''}`}
          style={{
            color: n <= (interactive ? hover || value : value) ? 'var(--gold)' : 'var(--border)',
            fill:  n <= (interactive ? hover || value : value) ? 'var(--gold)' : 'transparent',
            transition: 'color 0.1s',
          }}
          onMouseEnter={() => interactive && setHover(n)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onChange?.(n)}
        />
      ))}
    </div>
  )
}

function Badge({ label, color = 'var(--accent)' }: { label: string; color?: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded capitalize"
      style={{ background: `${color}22`, color }}
    >
      {label}
    </span>
  )
}

// ─── Schedule tabs ────────────────────────────────────────────────────────────
type Tab = 'overview' | 'feeding' | 'watering' | 'environment' | 'training'

const DIFF_COLORS: Record<string, string> = {
  beginner: 'var(--accent)',
  intermediate: 'var(--gold)',
  advanced: 'var(--warning)',
  expert: 'var(--danger)',
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  recipe: Recipe
  reviews: RecipeReview[]
  activeGrows: Pick<Grow, 'id' | 'name' | 'status'>[]
  currentUserId: string
  myReview: RecipeReview | null
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RecipeDetail({ recipe, reviews, activeGrows, currentUserId, myReview }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isOwn = recipe.author_id === currentUserId

  const [tab, setTab] = useState<Tab>('overview')
  const [applyGrowId, setApplyGrowId] = useState('')
  const [applying, setApplying]       = useState(false)
  const [forking, setForking]         = useState(false)
  const [showForkModal, setShowForkModal] = useState(false)
  const [forkRecipePlants, setForkRecipePlants] = useState(4)
  const [forkYourPlants, setForkYourPlants]     = useState(4)
  const [reviewRating, setReviewRating] = useState(myReview?.rating ?? 0)
  const [reviewText, setReviewText]   = useState(myReview?.review_text ?? '')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewDone, setReviewDone]   = useState(!!myReview)
  const [liveReviews, setLiveReviews] = useState(reviews)

  // ─── Actions ───────────────────────────────────────────────────────────────
  async function handleApply() {
    if (!applyGrowId) return
    setApplying(true)

    // Update grow + bump downloads in parallel
    const [, growRes] = await Promise.all([
      supabase.from('recipes').update({ downloads: recipe.downloads + 1 } as never).eq('id', recipe.id),
      supabase.from('grows').select('id, clone_date, veg_start_date, flip_date').eq('id', applyGrowId).single(),
    ])
    await supabase
      .from('grows')
      .update({ recipe_id: recipe.id, is_following_recipe: true } as never)
      .eq('id', applyGrowId)

    // Generate recipe-driven calendar events if grow has anchor dates
    const grow = growRes.data as { id: string; clone_date: string | null; veg_start_date: string | null; flip_date: string | null } | null
    if (grow) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Delete stale auto-generated recipe events
        await supabase
          .from('calendar_events')
          .delete()
          .eq('grow_id', applyGrowId)
          .eq('is_auto_generated', true)
          .in('event_type', RECIPE_CALENDAR_EVENT_TYPES)

        // Generate new events from recipe schedule
        const newEvents = generateRecipeCalendar({
          growId: applyGrowId,
          userId: user.id,
          recipe: {
            veg_weeks: recipe.veg_weeks,
            flower_weeks: recipe.flower_weeks,
            feeding_schedule: recipe.feeding_schedule,
            watering_schedule: recipe.watering_schedule,
            training_schedule: recipe.training_schedule,
            env_schedule: recipe.env_schedule,
          },
          cloneDate: grow.clone_date ? new Date(grow.clone_date) : undefined,
          vegStartDate: grow.veg_start_date ? new Date(grow.veg_start_date) : undefined,
          flipDate: grow.flip_date ? new Date(grow.flip_date) : undefined,
        })

        if (newEvents.length > 0) {
          await supabase.from('calendar_events').insert(newEvents as never)
        }
      }
    }

    setApplying(false)
    router.push(`/grows/${applyGrowId}`)
  }

  async function handleFork(scaleFactor = 1) {
    setForking(true)
    setShowForkModal(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setForking(false); return }

    // Auto-increment version: 1.0 → 1.1, 1.2 → 1.3, etc.
    const currentVersion = recipe.version ?? '1.0'
    const [major, minor] = currentVersion.split('.').map(Number)
    const nextVersion = `${major ?? 1}.${(minor ?? 0) + 1}`

    // Scale nutrient amounts proportionally (batch amounts scale with plant count)
    const scale = (n: number) => Math.round(n * scaleFactor * 100) / 100
    const scaledFeeding = (recipe.feeding_schedule ?? []).map(w => ({
      ...w,
      products: w.products.map(p => ({ ...p, amount: p.amount > 0 ? scale(p.amount) : p.amount })),
    }))
    const scaledAmendments = (recipe.amendment_schedule ?? []).map(w => ({
      ...w,
      products: w.products.map(p => ({ ...p, amount: p.amount > 0 ? scale(p.amount) : p.amount })),
    }))

    const { data, error } = await supabase
      .from('recipes')
      .insert({
        author_id: user.id,
        parent_recipe_id: recipe.id,
        title: `${recipe.title} (fork)`,
        description: recipe.description,
        genetics: recipe.genetics,
        medium: recipe.medium,
        difficulty: recipe.difficulty,
        veg_weeks: recipe.veg_weeks,
        flower_weeks: recipe.flower_weeks,
        total_weeks: recipe.total_weeks,
        feeding_schedule: scaledFeeding,
        env_schedule: recipe.env_schedule,
        watering_schedule: recipe.watering_schedule,
        training_schedule: recipe.training_schedule,
        amendment_schedule: scaledAmendments,
        harvest_data: recipe.harvest_data,
        key_success_factors: recipe.key_success_factors,
        common_failure_points: recipe.common_failure_points,
        estimated_yield_oz_per_plant: recipe.estimated_yield_oz_per_plant,
        tags: recipe.tags,
        is_public: false,
        version: nextVersion,
      } as never)
      .select('id')
      .single()

    setForking(false)
    if (!error && data) {
      router.push(`/recipes/${(data as { id: string }).id}/edit`)
    }
  }

  async function submitReview() {
    if (!reviewRating) return
    setSubmittingReview(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmittingReview(false); return }

    const payload = {
      recipe_id: recipe.id,
      user_id: user.id,
      rating: reviewRating,
      review_text: reviewText || null,
    }

    const { data, error } = myReview
      ? await supabase.from('recipe_reviews').update(payload as never).eq('id', myReview.id).select('*, reviewer:profiles(id, username, display_name)').single()
      : await supabase.from('recipe_reviews').insert(payload as never).select('*, reviewer:profiles(id, username, display_name)').single()

    if (!error && data) {
      setLiveReviews(prev => {
        const without = prev.filter(r => r.user_id !== user.id)
        return [data as unknown as RecipeReview, ...without]
      })
      setReviewDone(true)
    }
    setSubmittingReview(false)
  }

  // ─── Tab content ──────────────────────────────────────────────────────────
  function renderOverview() {
    return (
      <div className="space-y-6">
        {/* Description */}
        {recipe.description && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {recipe.description}
          </p>
        )}

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Veg weeks', value: recipe.veg_weeks ? `${recipe.veg_weeks} wks` : '—' },
            { label: 'Flower weeks', value: recipe.flower_weeks ? `${recipe.flower_weeks} wks` : '—' },
            { label: 'Total weeks', value: recipe.total_weeks ? `${recipe.total_weeks} wks` : '—' },
            { label: 'Est. yield', value: recipe.estimated_yield_oz_per_plant ? `~${recipe.estimated_yield_oz_per_plant} oz/plant` : '—' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg p-3 text-center"
              style={{ background: 'var(--surface-raised)' }}
            >
              <div className="text-lg font-semibold font-mono" style={{ color: 'var(--accent)' }}>{value}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Equipment requirements */}
        {recipe.equipment_requirements?.min_sqft && (
          <div className="rounded-lg p-4 border" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Equipment
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {recipe.equipment_requirements.min_sqft && <div>Min space: <strong>{recipe.equipment_requirements.min_sqft} sqft</strong></div>}
              {recipe.equipment_requirements.light_type && <div>Light: <strong>{recipe.equipment_requirements.light_type}</strong></div>}
              {recipe.equipment_requirements.container_size_gal && <div>Pot size: <strong>{recipe.equipment_requirements.container_size_gal} gal</strong></div>}
              {recipe.equipment_requirements.min_ppfd && <div>Min PPFD: <strong>{recipe.equipment_requirements.min_ppfd}</strong></div>}
            </div>
          </div>
        )}

        {/* Medium */}
        {recipe.medium?.type && (
          <div>
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Growing Medium
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {recipe.medium.type}
              {recipe.medium.amendment_notes ? ` — ${recipe.medium.amendment_notes}` : ''}
            </p>
            {recipe.medium.ingredients && recipe.medium.ingredients.length > 0 && (
              <div className="mt-2 space-y-1">
                {recipe.medium.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>{ing.name}</span>
                    {ing.percentage && <span style={{ color: 'var(--text-muted)' }}>{ing.percentage}%</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Success factors */}
        {recipe.key_success_factors && recipe.key_success_factors.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
              Key Success Factors
            </h3>
            <ul className="space-y-1.5">
              {recipe.key_success_factors.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Failure points */}
        {recipe.common_failure_points && recipe.common_failure_points.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--danger)' }}>
              Common Failure Points
            </h3>
            <ul className="space-y-1.5">
              {recipe.common_failure_points.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--danger)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI summary */}
        {recipe.ai_summary && (
          <div className="rounded-lg p-4 border" style={{ background: 'var(--accent-muted)', borderColor: 'var(--accent)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>AI Summary</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{recipe.ai_summary}</p>
          </div>
        )}
      </div>
    )
  }

  function renderFeeding() {
    const schedule = recipe.feeding_schedule ?? []
    if (schedule.length === 0) {
      return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No feeding schedule included in this recipe.</p>
    }
    return (
      <div className="space-y-2">
        {schedule.map((week, i) => (
          <div key={i} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{ background: 'var(--surface-raised)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent)' }}>
                  Week {week.week}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                >
                  {week.stage}
                </span>
              </div>
            </div>
            {week.products && week.products.length > 0 && (
              <div className="p-3 space-y-1.5">
                {week.products.map((p, j) => (
                  <div key={j} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{p.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {p.amount > 0 ? `${p.amount}${p.unit}` : ''}
                      {p.frequency ? ` · ${p.frequency}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  function renderWatering() {
    const schedule = recipe.watering_schedule ?? []
    if (schedule.length === 0) {
      return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No watering schedule included.</p>
    }
    return (
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}>
              {['Week', 'Freq', 'Vol/plant', 'pH', 'EC', 'Notes'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((w, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--accent)' }}>{w.week}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>every {w.frequency_days}d</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.volume_per_plant_ml ? `${w.volume_per_plant_ml}mL` : '—'}</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.ph_target ?? '—'}</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.ec_target ?? '—'}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{w.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderEnvironment() {
    const schedule = recipe.env_schedule ?? []
    if (schedule.length === 0) {
      return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No environment schedule included.</p>
    }
    return (
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}>
              {['Week', 'Stage', 'Temp Day', 'Temp Night', 'RH%', 'PPFD', 'Hrs'].map(h => (
                <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((w, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--accent)' }}>{w.week}</td>
                <td className="px-3 py-2 capitalize" style={{ color: 'var(--text-secondary)' }}>{w.stage}</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.temp_day_f ? `${w.temp_day_f}°F` : '—'}</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.temp_night_f ? `${w.temp_night_f}°F` : '—'}</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.rh_percent ? `${w.rh_percent}%` : '—'}</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.ppfd ?? '—'}</td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.light_hours ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderTraining() {
    const schedule = recipe.training_schedule ?? []
    if (schedule.length === 0) {
      return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No training schedule included.</p>
    }
    return (
      <div className="space-y-2">
        {schedule.map((t, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-lg border"
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
          >
            <div
              className="text-xs font-mono font-semibold px-2 py-1 rounded shrink-0"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              Day {t.day_from_flip > 0 ? `+${t.day_from_flip}` : t.day_from_flip}
            </div>
            <div>
              <div className="text-xs font-semibold capitalize" style={{ color: 'var(--text)' }}>
                {t.event_type.replace(/_/g, ' ')}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t.description}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const TAB_ICONS: Record<Tab, React.ReactNode> = {
    overview: <FlaskConical className="w-3.5 h-3.5" />,
    feeding: <Droplets className="w-3.5 h-3.5" />,
    watering: <Droplets className="w-3.5 h-3.5" />,
    environment: <Thermometer className="w-3.5 h-3.5" />,
    training: <Zap className="w-3.5 h-3.5" />,
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto" style={{ color: 'var(--text)' }}>
      {/* Hero */}
      <div
        className="relative h-40 shrink-0 flex items-end"
        style={{
          background: recipe.cover_photo_url
            ? `url(${recipe.cover_photo_url}) center/cover`
            : 'linear-gradient(135deg, var(--accent-muted) 0%, var(--surface) 100%)',
        }}
      >
        {!recipe.cover_photo_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <FlaskConical className="w-12 h-12 opacity-20" style={{ color: 'var(--accent)' }} />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(10,15,13,0.85) 0%, transparent 50%)' }}
        />
        <div className="relative px-6 pb-4 w-full">
          <h1 className="text-xl font-bold leading-tight">{recipe.title}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <Stars value={Math.round(recipe.rating_avg)} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {recipe.rating_count} reviews
            </span>
            <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Download className="w-3 h-3" />
              <span className="text-xs">{recipe.downloads}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta + actions */}
      <div
        className="px-6 py-3 border-b flex flex-wrap items-center gap-2 shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {recipe.genetics?.strain && (
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {recipe.genetics.strain}
              {recipe.genetics.breeder ? ` — ${recipe.genetics.breeder}` : ''}
            </span>
          )}
          {recipe.difficulty && (
            <Badge label={recipe.difficulty} color={DIFF_COLORS[recipe.difficulty]} />
          )}
          {recipe.medium?.type && (
            <Badge label={recipe.medium.type} color="var(--text-muted)" />
          )}
          {recipe.tags?.filter(t => ['indoor','outdoor','greenhouse'].includes(t)).map(t => (
            <Badge key={t} label={t} color="var(--text-muted)" />
          ))}
          {recipe.author && (
            <Link
              href={`/growers/${recipe.author.username}`}
              className="text-xs hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              by @{recipe.author.username}
            </Link>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isOwn && (
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
          )}
          <button
            onClick={() => setShowForkModal(true)}
            disabled={forking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <GitBranch className="w-3.5 h-3.5" />
            {forking ? 'Forking…' : 'Fork'}
          </button>

          {/* Apply to grow */}
          {activeGrows.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={applyGrowId}
                onChange={e => setApplyGrowId(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs border outline-none"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <option value="">Apply to grow…</option>
                {activeGrows.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {applyGrowId && (
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#0a0f0d' }}
                >
                  <Sprout className="w-3.5 h-3.5" />
                  {applying ? 'Applying…' : 'Apply'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b shrink-0 overflow-x-auto"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {(['overview', 'feeding', 'watering', 'environment', 'training'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium capitalize border-b-2 transition-colors whitespace-nowrap"
            style={{
              borderColor: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {TAB_ICONS[t]}
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {tab === 'overview'     && renderOverview()}
        {tab === 'feeding'      && renderFeeding()}
        {tab === 'watering'     && renderWatering()}
        {tab === 'environment'  && renderEnvironment()}
        {tab === 'training'     && renderTraining()}

        {/* Reviews section (always below tab content) */}
        <div className="mt-8 pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
            Reviews ({liveReviews.length})
          </h2>

          {/* Review form */}
          {!reviewDone ? (
            <div
              className="rounded-xl border p-4 mb-6 space-y-3"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Leave a review
              </p>
              <Stars value={reviewRating} interactive onChange={setReviewRating} />
              <textarea
                rows={3}
                placeholder="How did this recipe work for you? (optional)"
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <button
                onClick={submitReview}
                disabled={!reviewRating || submittingReview}
                className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#0a0f0d' }}
              >
                {submittingReview ? 'Submitting…' : myReview ? 'Update review' : 'Submit review'}
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 p-3 rounded-lg mb-4 text-xs"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              <Check className="w-3.5 h-3.5" />
              Your review is saved.
              <button onClick={() => setReviewDone(false)} className="ml-auto underline">Edit</button>
            </div>
          )}

          {/* Review list */}
          <div className="space-y-4">
            {liveReviews.map(review => (
              <div
                key={review.id}
                className="flex gap-3"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                >
                  {((review as unknown as { reviewer?: { username?: string } }).reviewer?.username?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                      @{(review as unknown as { reviewer?: { username?: string } }).reviewer?.username ?? 'Unknown'}
                    </span>
                    {review.rating && <Stars value={review.rating} />}
                    <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                      {format(parseISO(review.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {review.review_text && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{review.review_text}</p>
                  )}
                  {review.verified_grow && (
                    <span className="text-[9px] font-semibold" style={{ color: 'var(--accent)' }}>
                      ✓ Verified grow
                    </span>
                  )}
                </div>
              </div>
            ))}
            {liveReviews.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No reviews yet. Be the first.</p>
            )}
          </div>
        </div>
      </div>

      {/* Fork scale modal */}
      {showForkModal && (() => {
        const scaleFactor = forkRecipePlants > 0 ? forkYourPlants / forkRecipePlants : 1
        const pct = Math.round((scaleFactor - 1) * 100)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowForkModal(false) }}
          >
            <div
              className="rounded-2xl border p-6 w-full max-w-sm space-y-5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                  Scale this fork
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Nutrient amounts scale proportionally to your plant count.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Original recipe plants
                  </label>
                  <input
                    type="number" min={1} max={99} value={forkRecipePlants}
                    onChange={e => setForkRecipePlants(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono text-center"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Your plant count
                  </label>
                  <input
                    type="number" min={1} max={99} value={forkYourPlants}
                    onChange={e => setForkYourPlants(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono text-center"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>

              {/* Scale preview */}
              <div
                className="rounded-lg px-4 py-3 text-center"
                style={{ background: 'var(--surface-raised)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scale factor </span>
                <span className="text-base font-mono font-semibold" style={{ color: scaleFactor === 1 ? 'var(--text)' : scaleFactor > 1 ? 'var(--accent)' : 'var(--warning)' }}>
                  ×{scaleFactor.toFixed(2)}
                </span>
                {pct !== 0 && (
                  <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                    ({pct > 0 ? '+' : ''}{pct}% amounts)
                  </span>
                )}
                {scaleFactor === 1 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No scaling — fork is a direct copy</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowForkModal(false)}
                  className="flex-1 py-2 rounded-lg text-sm border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleFork(scaleFactor)}
                  disabled={forking}
                  className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#0a0f0d' }}
                >
                  {forking ? 'Forking…' : 'Fork & scale'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
