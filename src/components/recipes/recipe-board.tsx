'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  FlaskConical, Library, Plus, Search,
  Flame, Clock, TrendingUp, Bookmark, BookmarkCheck,
  ChevronRight, Star,
} from 'lucide-react'
import type { Recipe } from '@/types/database'

const METHODS = [
  { label: 'Living Soil', value: 'living-soil' },
  { label: 'Coco', value: 'coco' },
  { label: 'Hydro', value: 'hydro' },
  { label: 'DWC', value: 'dwc' },
  { label: 'Pro-Mix', value: 'promix' },
]

const ENVS = [
  { label: 'Indoor', value: 'indoor' },
  { label: 'Outdoor', value: 'outdoor' },
  { label: 'Greenhouse', value: 'greenhouse' },
]

const DIFF_COLORS: Record<string, string> = {
  beginner: '#52B788',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
  expert: '#8b5cf6',
}

interface Props {
  recipes: Recipe[]
  savedIds: string[]
  currentUserId: string
  initialSort: string
  initialTag?: string
}

export function RecipeBoard({ recipes, savedIds: initialSavedIds, currentUserId, initialSort, initialTag }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const [savedIds, setSavedIds]         = useState(() => new Set(initialSavedIds))
  const [search, setSearch]             = useState('')
  const [methodFilter, setMethodFilter] = useState<string | null>(initialTag && METHODS.some(m => m.value === initialTag) ? initialTag : null)
  const [envFilter, setEnvFilter]       = useState<string | null>(initialTag && ENVS.some(e => e.value === initialTag) ? initialTag : null)
  const [sort, setSort]                 = useState(initialSort)

  const filtered = useMemo(() => {
    return recipes.filter(r => {
      if (methodFilter && !r.tags.includes(methodFilter)) return false
      if (envFilter    && !r.tags.includes(envFilter))    return false
      if (search) {
        const q      = search.toLowerCase()
        const title  = r.title.toLowerCase()
        const strain = (r.genetics?.strain ?? '').toLowerCase()
        const author = (r.author?.username ?? '').toLowerCase()
        if (!title.includes(q) && !strain.includes(q) && !author.includes(q)) return false
      }
      return true
    })
  }, [recipes, methodFilter, envFilter, search])

  const groups = useMemo(() => {
    const map: Record<string, Recipe[]> = {}
    for (const r of filtered) {
      const key = r.genetics?.strain?.trim() || 'Unspecified Strain'
      ;(map[key] ??= []).push(r)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  async function toggleSave(recipeId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const isSaved = savedIds.has(recipeId)
    setSavedIds(prev => {
      const next = new Set(prev)
      isSaved ? next.delete(recipeId) : next.add(recipeId)
      return next
    })
    if (isSaved) {
      await supabase.from('recipe_saves').delete()
        .eq('recipe_id', recipeId).eq('user_id', currentUserId)
    } else {
      await supabase.from('recipe_saves').insert(
        { user_id: currentUserId, recipe_id: recipeId } as never
      )
    }
  }

  function changeSort(newSort: string) {
    setSort(newSort)
    const tag = methodFilter ?? envFilter
    router.push(`/recipes?sort=${newSort}${tag ? `&tag=${tag}` : ''}`)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Sticky header */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-4xl mx-auto px-4">
          {/* Title row */}
          <div className="flex items-center gap-3 h-14">
            <FlaskConical className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />
            <h1 className="font-semibold" style={{ color: 'var(--text)' }}>Recipe Board</h1>
            <div className="flex-1" />
            <Link
              href="/recipes/library"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <Library className="w-3.5 h-3.5" />
              My Library
              {savedIds.size > 0 && (
                <span
                  className="ml-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                >
                  {savedIds.size}
                </span>
              )}
            </Link>
            <Link
              href="/recipes/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </Link>
          </div>

          {/* Filter + sort row */}
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            {/* Sort tabs */}
            <div
              className="flex gap-0.5 p-0.5 rounded-lg shrink-0"
              style={{ background: 'var(--surface)' }}
            >
              {([
                ['hot', 'Hot', Flame],
                ['new', 'New', Clock],
                ['top', 'Top', TrendingUp],
              ] as const).map(([val, label, Icon]) => (
                <button
                  key={val}
                  onClick={() => changeSort(val)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: sort === val ? 'var(--accent-muted)' : 'transparent',
                    color:      sort === val ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Method chips */}
            <div className="flex gap-1 flex-wrap">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMethodFilter(methodFilter === m.value ? null : m.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background:  methodFilter === m.value ? 'var(--accent-muted)' : 'var(--surface)',
                    color:       methodFilter === m.value ? 'var(--accent)' : 'var(--text-muted)',
                    border:      `1px solid ${methodFilter === m.value ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Env chips */}
            <div className="flex gap-1 flex-wrap">
              {ENVS.map(e => (
                <button
                  key={e.value}
                  onClick={() => setEnvFilter(envFilter === e.value ? null : e.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: envFilter === e.value ? 'rgba(99,102,241,0.15)' : 'var(--surface)',
                    color:      envFilter === e.value ? '#818cf8' : 'var(--text-muted)',
                    border:     `1px solid ${envFilter === e.value ? '#818cf8' : 'var(--border)'}`,
                  }}
                >
                  {e.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none w-40"
                style={{
                  background: 'var(--surface)',
                  border:     '1px solid var(--border)',
                  color:      'var(--text)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {groups.length === 0 && (
          <div
            className="rounded-xl border p-12 text-center"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <FlaskConical className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No recipes found</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {search || methodFilter || envFilter
                ? 'Try adjusting your filters'
                : 'Be the first to post a recipe'}
            </p>
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}
            >
              <Plus className="w-4 h-4" /> Create a recipe
            </Link>
          </div>
        )}

        {groups.map(([strain, strainRecipes]) => (
          <div
            key={strain}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Strain header */}
            <div
              className="flex items-center gap-3 px-4 py-2.5 border-b"
              style={{
                borderColor: 'var(--border)',
                background:  'var(--surface-raised)',
              }}
            >
              <span
                className="text-xs font-bold tracking-wider"
                style={{ color: 'var(--text)' }}
              >
                {strain.toUpperCase()}
              </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {strainRecipes.length} {strainRecipes.length === 1 ? 'recipe' : 'recipes'}
              </span>
            </div>

            {/* Recipe rows */}
            <div style={{ background: 'var(--surface)' }}>
              {strainRecipes.map((recipe, idx) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
                  isSaved={savedIds.has(recipe.id)}
                  onToggleSave={toggleSave}
                  isLast={idx === strainRecipes.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecipeRow({
  recipe,
  isSaved,
  onToggleSave,
  isLast,
}: {
  recipe: Recipe
  isSaved: boolean
  onToggleSave: (id: string, e: React.MouseEvent) => void
  isLast: boolean
}) {
  const rating = recipe.rating_avg ?? 0
  const stars  = Math.round(rating)
  const weeks  = [
    recipe.veg_weeks    ? `${recipe.veg_weeks}V`    : null,
    recipe.flower_weeks ? `${recipe.flower_weeks}F`  : null,
  ].filter(Boolean).join('+')

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className={`flex items-start gap-3 px-4 py-4 transition-colors hover:bg-white/[0.02] ${!isLast ? 'border-b' : ''}`}
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Rating column */}
      <div className="w-11 shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
        <span
          className="text-base font-bold font-mono leading-none"
          style={{ color: rating >= 4 ? 'var(--accent)' : rating >= 3 ? '#f59e0b' : 'var(--text-muted)' }}
        >
          {rating ? rating.toFixed(1) : '—'}
        </span>
        <div className="flex gap-px">
          {[1, 2, 3, 4, 5].map(s => (
            <Star
              key={s}
              className="w-2 h-2"
              style={{ fill: s <= stars ? '#f59e0b' : 'none', color: s <= stars ? '#f59e0b' : 'var(--border)' }}
            />
          ))}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {recipe.rating_count}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm leading-snug" style={{ color: 'var(--text)' }}>
            {recipe.title}
          </span>
          {recipe.difficulty && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: `${DIFF_COLORS[recipe.difficulty]}22`,
                color:      DIFF_COLORS[recipe.difficulty],
              }}
            >
              {recipe.difficulty}
            </span>
          )}
          {recipe.is_verified && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'rgba(82,183,136,0.15)', color: 'var(--accent)' }}
            >
              verified
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {recipe.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
            >
              {tag}
            </span>
          ))}
          {weeks && (
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {weeks}
            </span>
          )}
          {recipe.estimated_yield_oz_per_plant && (
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              ~{recipe.estimated_yield_oz_per_plant}oz/plant
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>@{recipe.author?.username ?? 'unknown'}</span>
          <span>·</span>
          <span>{recipe.downloads} saves</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
        <button
          onClick={(e) => onToggleSave(recipe.id, e)}
          className="p-1.5 rounded-lg transition-colors"
          style={{
            background: isSaved ? 'var(--accent-muted)' : 'var(--surface-raised)',
            color:      isSaved ? 'var(--accent)' : 'var(--text-muted)',
          }}
          title={isSaved ? 'Remove from library' : 'Save to library'}
        >
          {isSaved
            ? <BookmarkCheck className="w-4 h-4" />
            : <Bookmark className="w-4 h-4" />
          }
        </button>
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </div>
    </Link>
  )
}
