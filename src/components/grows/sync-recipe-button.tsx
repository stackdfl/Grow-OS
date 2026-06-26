'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateRecipeCalendar, RECIPE_CALENDAR_EVENT_TYPES } from '@/lib/calendar-engine/generate'
import { useRouter } from 'next/navigation'

interface Props {
  growId: string
  recipeId: string
  cloneDate: string | null
  vegStartDate: string | null
  flipDate: string | null
}

export function SyncRecipeButton({ growId, recipeId, cloneDate, vegStartDate, flipDate }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function sync() {
    setSyncing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSyncing(false); return }

    const { data: recipe } = await supabase
      .from('recipes')
      .select('veg_weeks, flower_weeks, feeding_schedule, watering_schedule, training_schedule, env_schedule')
      .eq('id', recipeId)
      .single()

    if (recipe) {
      // Delete existing recipe-driven auto events
      await supabase
        .from('calendar_events')
        .delete()
        .eq('grow_id', growId)
        .eq('is_auto_generated', true)
        .in('event_type', RECIPE_CALENDAR_EVENT_TYPES)

      const newEvents = generateRecipeCalendar({
        growId,
        userId: user.id,
        recipe: {
          veg_weeks: recipe.veg_weeks,
          flower_weeks: recipe.flower_weeks,
          feeding_schedule: recipe.feeding_schedule ?? [],
          watering_schedule: recipe.watering_schedule ?? [],
          training_schedule: recipe.training_schedule ?? [],
          env_schedule: recipe.env_schedule ?? [],
        },
        cloneDate: cloneDate ? new Date(cloneDate) : undefined,
        vegStartDate: vegStartDate ? new Date(vegStartDate) : undefined,
        flipDate: flipDate ? new Date(flipDate) : undefined,
      })

      if (newEvents.length > 0) {
        await supabase.from('calendar_events').insert(newEvents as never)
      }
    }

    setSyncing(false)
    setDone(true)
    router.refresh()
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <button
      onClick={sync}
      disabled={syncing}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
      style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-muted)' }}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing…' : done ? 'Synced!' : 'Sync from recipe'}
    </button>
  )
}
