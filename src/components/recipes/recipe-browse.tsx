'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Star, Download, FlaskConical, Search } from 'lucide-react'
import type { Recipe } from '@/types/database'

// ─── Filter config ────────────────────────────────────────────────────────────
const ENV_TAGS   = ['indoor', 'outdoor', 'greenhouse'] as const
const MEDIUM_TAGS = ['living-soil', 'coco', 'hydro', 'dwc', 'promix'] as const
const MEDIUM_LABELS: Record<string, string> = {
  'living-soil': 'Living Soil',
  'coco':        'Coco',
  'hydro':       'Hydro',
  'dwc':         'DWC',
  'promix':      'Pro-Mix',
}
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'] as const
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     'var(--accent)',
  intermediate: 'var(--gold)',
  advanced:     'var(--warning)',
  expert:       'var(--danger)',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StarRating({ avg, count }: { avg: number; count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className="w-3 h-3"
          style={{
            color: n <= Math.round(avg) ? 'var(--gold)' : 'var(--border)',
            fill:  n <= Math.round(avg) ? 'var(--gold)' : 'transparent',
          }}
        />
      ))}
      <span className="text-[10px] ml-0.5" style={{ color: 'var(--text-muted)' }}>
        ({count})
      </span>
    </div>
  )
}

function RecipeCard({ recipe, currentUserId }: { recipe: Recipe; currentUserId: string }) {
  const isOwn    = recipe.author_id === currentUserId
  const medium   = recipe.medium?.type ?? 'Unknown'
  const envTag   = recipe.tags?.find(t => ENV_TAGS.includes(t as never))
  const diffColor = recipe.difficulty ? DIFFICULTY_COLORS[recipe.difficulty] : 'var(--text-muted)'

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="flex flex-col rounded-xl border overflow-hidden transition-all hover:border-[--accent] group"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', textDecoration: 'none' }}
    >
      {/* Cover / hero */}
      <div
        className="h-28 flex items-center justify-center relative"
        style={{
          background: recipe.cover_photo_url
            ? `url(${recipe.cover_photo_url}) center/cover`
            : 'linear-gradient(135deg, var(--accent-muted) 0%, var(--surface-raised) 100%)',
        }}
      >
        {!recipe.cover_photo_url && (
          <FlaskConical className="w-8 h-8 opacity-30" style={{ color: 'var(--accent)' }} />
        )}
        {isOwn && (
          <span
            className="absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
          >
            MINE
          </span>
        )}
        {recipe.is_verified && (
          <span
            className="absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(82,183,136,0.2)', color: 'var(--accent)' }}
          >
            VERIFIED
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div>
          <h3 className="text-sm font-semibold leading-tight line-clamp-1" style={{ color: 'var(--text)' }}>
            {recipe.title}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {recipe.genetics?.strain ?? 'Unknown strain'}
            {recipe.genetics?.breeder ? ` · ${recipe.genetics.breeder}` : ''}
          </p>
        </div>

        <StarRating avg={recipe.rating_avg} count={recipe.rating_count} />

        <div className="flex flex-wrap gap-1 mt-0.5">
          {recipe.difficulty && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded capitalize"
              style={{ background: `${diffColor}22`, color: diffColor }}
            >
              {recipe.difficulty}
            </span>
          )}
          {envTag && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded capitalize"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
            >
              {envTag}
            </span>
          )}
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
          >
            {medium}
          </span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {recipe.veg_weeks ? `${recipe.veg_weeks}V` : ''}
            {recipe.veg_weeks && recipe.flower_weeks ? '+' : ''}
            {recipe.flower_weeks ? `${recipe.flower_weeks}F` : ''}
            {recipe.estimated_yield_oz_per_plant ? ` · ~${recipe.estimated_yield_oz_per_plant}oz/plant` : ''}
          </span>
          <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Download className="w-3 h-3" />
            <span className="text-[10px]">{recipe.downloads}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  recipes: Recipe[]
  currentUserId: string
  initialTag?: string
  initialDifficulty?: string
  initialSort: string
}

export function RecipeBrowse({ recipes, currentUserId, initialTag, initialDifficulty, initialSort }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [activeTag,  setActiveTag]  = useState(initialTag ?? '')
  const [activeDiff, setActiveDiff] = useState(initialDifficulty ?? '')
  const [sort, setSort]             = useState(initialSort)

  function navigate(tag: string, diff: string, s: string) {
    const p = new URLSearchParams()
    if (tag)  p.set('tag', tag)
    if (diff) p.set('difficulty', diff)
    if (s !== 'rating') p.set('sort', s)
    router.push(`/recipes${p.toString() ? `?${p}` : ''}`)
  }

  function toggleTag(t: string)  { const v = activeTag  === t ? '' : t; setActiveTag(v);  navigate(v, activeDiff, sort) }
  function toggleDiff(d: string) { const v = activeDiff === d ? '' : d; setActiveDiff(v); navigate(activeTag, v, sort) }
  function changeSort(s: string) { setSort(s); navigate(activeTag, activeDiff, s) }

  // Client-side search filter on top of server results
  const visible = recipes.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title.toLowerCase().includes(q) ||
      (r.genetics?.strain ?? '').toLowerCase().includes(q) ||
      (r.genetics?.breeder ?? '').toLowerCase().includes(q)
    )
  })

  function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
        style={{
          background:  active ? 'var(--accent-muted)' : 'var(--surface-raised)',
          borderColor: active ? 'var(--accent)'       : 'var(--border)',
          color:       active ? 'var(--accent)'        : 'var(--text-secondary)',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Recipes</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Community grow recipes · follow one to replicate results
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--accent)', color: '#0a0f0d' }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Recipe
        </Link>
      </div>

      {/* Filters */}
      <div
        className="px-4 py-3 border-b space-y-2.5 shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search strain, recipe name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm border outline-none"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>

        {/* Environment tags */}
        <div className="flex flex-wrap gap-1.5">
          {ENV_TAGS.map(t => (
            <Chip key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={activeTag === t} onClick={() => toggleTag(t)} />
          ))}
          {MEDIUM_TAGS.map(t => (
            <Chip key={t} label={MEDIUM_LABELS[t]} active={activeTag === t} onClick={() => toggleTag(t)} />
          ))}
        </div>

        {/* Difficulty + sort row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {DIFFICULTIES.map(d => (
              <Chip
                key={d}
                label={d.charAt(0).toUpperCase() + d.slice(1)}
                active={activeDiff === d}
                onClick={() => toggleDiff(d)}
              />
            ))}
          </div>
          <div className="ml-auto">
            <select
              value={sort}
              onChange={e => changeSort(e.target.value)}
              className="px-2 py-1 rounded-lg text-xs border outline-none"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <option value="rating">Top Rated</option>
              <option value="newest">Newest</option>
              <option value="downloads">Most Downloaded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ color: 'var(--text-muted)' }}>
            <FlaskConical className="w-10 h-10 opacity-30" />
            <p className="text-sm">No recipes found.</p>
            <Link href="/recipes/new" className="text-xs underline" style={{ color: 'var(--accent)' }}>
              Create the first one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {visible.map(r => (
              <RecipeCard key={r.id} recipe={r} currentUserId={currentUserId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
