'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Library, Plus, Star, Edit2, Trash2,
  Sprout, CheckCircle2, FlaskConical,
} from 'lucide-react'
import type { Recipe, Grow } from '@/types/database'

type GrowRow = Pick<Grow, 'id' | 'name' | 'status'> & { recipe_id: string | null }

interface Props {
  ownRecipes:   Recipe[]
  savedItems:   { saved_at: string; recipe: Recipe }[]
  activeGrows:  GrowRow[]
  currentUserId: string
}

type Tab = 'all' | 'mine' | 'saved' | 'in-use'

const DIFF_COLORS: Record<string, string> = {
  beginner:     '#52B788',
  intermediate: '#f59e0b',
  advanced:     '#ef4444',
  expert:       '#8b5cf6',
}

export function RecipeLibrary({ ownRecipes, savedItems, activeGrows, currentUserId }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const [tab, setTab]           = useState<Tab>('all')
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Build deduplicated "all" list: own recipes first, then saved (not already owned)
  const ownIds   = new Set(ownRecipes.map(r => r.id))
  const savedRecipes = savedItems.map(s => s.recipe).filter(r => !ownIds.has(r.id))
  const allRecipes   = [...ownRecipes, ...savedRecipes]

  // Map recipe IDs → grows using them
  const recipeToGrows: Record<string, GrowRow[]> = {}
  for (const g of activeGrows) {
    if (g.recipe_id) {
      ;(recipeToGrows[g.recipe_id] ??= []).push(g)
    }
  }

  const inUseIds = new Set(Object.keys(recipeToGrows))

  function getDisplayList(): Recipe[] {
    switch (tab) {
      case 'mine':   return ownRecipes
      case 'saved':  return savedRecipes
      case 'in-use': return allRecipes.filter(r => inUseIds.has(r.id))
      default:       return allRecipes
    }
  }

  async function unsave(recipeId: string) {
    setRemovingId(recipeId)
    await supabase.from('recipe_saves').delete()
      .eq('recipe_id', recipeId).eq('user_id', currentUserId)
    router.refresh()
    setRemovingId(null)
  }

  const list = getDisplayList()

  const tabCounts = {
    all:     allRecipes.length,
    mine:    ownRecipes.length,
    saved:   savedRecipes.length,
    'in-use': allRecipes.filter(r => inUseIds.has(r.id)).length,
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-3 h-14">
            <Link
              href="/recipes"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', background: 'var(--surface)' }}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Library className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />
            <h1 className="font-semibold" style={{ color: 'var(--text)' }}>My Library</h1>
            <div className="flex-1" />
            <Link
              href="/recipes/new"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Recipe
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 pb-3">
            {(['all', 'mine', 'saved', 'in-use'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
                style={{
                  background: tab === t ? 'var(--accent-muted)' : 'var(--surface)',
                  color:      tab === t ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {t.replace('-', ' ')}
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{
                    background: tab === t ? 'var(--accent)' : 'var(--border)',
                    color:      tab === t ? '#0a0f0d' : 'var(--text-muted)',
                  }}
                >
                  {tabCounts[t]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-5">
        {list.length === 0 && (
          <div
            className="rounded-xl border p-12 text-center"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <Library className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>
              {tab === 'mine'   ? 'No recipes created yet' :
               tab === 'saved'  ? 'No saved recipes' :
               tab === 'in-use' ? 'No recipes in active grows' :
               'Your library is empty'}
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {tab === 'saved'
                ? 'Browse the board and save recipes you want to try'
                : 'Create a recipe to share with the community'}
            </p>
            <Link
              href={tab === 'saved' ? '/recipes' : '/recipes/new'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}
            >
              {tab === 'saved' ? 'Browse Board' : 'Create Recipe'}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(recipe => {
            const isOwn    = ownIds.has(recipe.id)
            const growsUsing = recipeToGrows[recipe.id] ?? []
            const inUse    = growsUsing.length > 0
            const rating   = recipe.rating_avg ?? 0
            const stars    = Math.round(rating)
            const weeks    = [
              recipe.veg_weeks    ? `${recipe.veg_weeks}V`   : null,
              recipe.flower_weeks ? `${recipe.flower_weeks}F` : null,
            ].filter(Boolean).join('+')

            return (
              <div
                key={recipe.id}
                className="rounded-xl border overflow-hidden flex flex-col"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                {/* Card header */}
                <div
                  className="px-4 py-3 border-b flex items-start justify-between gap-2"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm leading-snug" style={{ color: 'var(--text)' }}>
                      {recipe.title}
                    </div>
                    {recipe.genetics?.strain && (
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {recipe.genetics.strain}
                        {recipe.genetics.breeder && ` · ${recipe.genetics.breeder}`}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  {inUse ? (
                    <span
                      className="shrink-0 flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full"
                      style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                    >
                      <CheckCircle2 className="w-3 h-3" /> In Use
                    </span>
                  ) : isOwn ? (
                    <span
                      className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-full"
                      style={{ background: 'rgba(82,183,136,0.15)', color: 'var(--accent)' }}
                    >
                      My Recipe
                    </span>
                  ) : (
                    <span
                      className="shrink-0 text-[10px] font-medium px-2 py-1 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                    >
                      Saved
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="px-4 py-3 flex-1 space-y-2">
                  {/* Meta row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {recipe.difficulty && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          background: `${DIFF_COLORS[recipe.difficulty]}22`,
                          color:      DIFF_COLORS[recipe.difficulty],
                        }}
                      >
                        {recipe.difficulty}
                      </span>
                    )}
                    {recipe.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star
                          className="w-3 h-3"
                          style={{ fill: '#f59e0b', color: '#f59e0b' }}
                        />
                        <span className="font-mono font-medium" style={{ color: 'var(--text)' }}>
                          {rating.toFixed(1)}
                        </span>
                        <span>({recipe.rating_count})</span>
                      </span>
                    )}
                    {weeks && <span className="font-mono">{weeks}</span>}
                    {recipe.estimated_yield_oz_per_plant && (
                      <span className="font-mono">~{recipe.estimated_yield_oz_per_plant}oz</span>
                    )}
                  </div>

                  {/* In-use grows */}
                  {inUse && (
                    <div className="space-y-1">
                      {growsUsing.map(g => (
                        <Link
                          key={g.id}
                          href={`/grows/${g.id}`}
                          className="flex items-center gap-1.5 text-xs"
                          style={{ color: 'var(--accent)' }}
                        >
                          <Sprout className="w-3 h-3 shrink-0" />
                          {g.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card actions */}
                <div
                  className="px-4 py-3 border-t flex items-center gap-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Link
                    href={`/grows/new?recipe_id=${recipe.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'var(--accent)', color: '#0a0f0d' }}
                  >
                    <Sprout className="w-3.5 h-3.5" />
                    Use in Grow
                  </Link>

                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
                    title="View recipe"
                  >
                    <FlaskConical className="w-4 h-4" />
                  </Link>

                  {isOwn && (
                    <Link
                      href={`/recipes/${recipe.id}/edit`}
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
                      title="Edit recipe"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Link>
                  )}

                  {!isOwn && (
                    <button
                      onClick={() => unsave(recipe.id)}
                      disabled={removingId === recipe.id}
                      className="p-2 rounded-lg transition-colors disabled:opacity-40"
                      style={{ background: 'rgba(231,111,81,0.1)', color: 'var(--danger)' }}
                      title="Remove from library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
