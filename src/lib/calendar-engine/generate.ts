import { addDays, subDays, format } from 'date-fns'
import type {
  CalendarEventType, EventPriority,
  RecipeFeedingWeek, RecipeWateringWeek, RecipeTrainingEvent, RecipeEnvWeek,
} from '@/types/database'

export interface GrowCalendarConfig {
  growId: string
  userId: string
  flipDate: Date
  cloneDate?: Date
  vegStartDate?: Date
  flowerWeeks?: number
  vegWeeks?: number
  cloneRootWeeks?: number
  mediumType?: string
  strainNotes?: {
    isNSensitive?: boolean
    calMagRisk?: boolean
    flushWeeks?: number
  }
}

interface CalendarEventInsert {
  grow_id: string
  user_id: string
  event_date: string
  event_type: CalendarEventType
  title: string
  description: string | null
  priority: EventPriority
  is_auto_generated: boolean
  completed: boolean
  skipped: boolean
}

function fmt(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function event(
  growId: string,
  userId: string,
  date: Date,
  type: CalendarEventType,
  title: string,
  priority: EventPriority,
  description?: string,
): CalendarEventInsert {
  return {
    grow_id: growId,
    user_id: userId,
    event_date: fmt(date),
    event_type: type,
    title,
    description: description ?? null,
    priority,
    is_auto_generated: true,
    completed: false,
    skipped: false,
  }
}

export function generateCalendar(config: GrowCalendarConfig): CalendarEventInsert[] {
  const {
    growId,
    userId,
    flipDate,
    cloneDate,
    vegStartDate,
    flowerWeeks = 9,
    vegWeeks = 4,
    cloneRootWeeks = 2,
    mediumType = 'soil',
    strainNotes = {},
  } = config

  const flushWeeks = strainNotes.flushWeeks ?? 1.5
  const flushStartDays = Math.round(flowerWeeks * 7 - flushWeeks * 7)
  const harvestDays = flowerWeeks * 7

  const events: CalendarEventInsert[] = []
  const isLivingSoil = mediumType.toLowerCase().includes('soil') || mediumType.toLowerCase().includes('living')

  // ── PRE-FLIP ─────────────────────────────────────────────────────────────

  // Take clones
  const cloneTakeDate = subDays(flipDate, (vegWeeks + cloneRootWeeks) * 7)
  if (!cloneDate || cloneTakeDate < flipDate) {
    events.push(event(growId, userId, cloneTakeDate, 'clone_take',
      'Take clone batch', 'high',
      `Cut clones ${vegWeeks + cloneRootWeeks} weeks before flip. Root for ${cloneRootWeeks} weeks.`))
  }

  // Dome off / clones rooted
  const domeOffDate = addDays(cloneTakeDate, cloneRootWeeks * 7)
  events.push(event(growId, userId, domeOffDate, 'clone_transplant',
    'Dome off — clones rooted', 'medium',
    'Remove dome, transplant to 1-gal pots. Begin feeding lightly.'))

  // Transplant to final pot
  const transplantDate = subDays(flipDate, 5)
  events.push(event(growId, userId, transplantDate, 'transplant',
    'Transplant to final pot', 'high',
    'Move to final containers. Water thoroughly to establish roots before flip.'))

  // Acclimate
  const acclimateDate = subDays(flipDate, 3)
  events.push(event(growId, userId, acclimateDate, 'observation',
    'Pre-flip acclimate check', 'medium',
    'Confirm canopy is even. Tuck or top any dominant colas. Ensure no light leaks.'))

  // ── FLIP ─────────────────────────────────────────────────────────────────

  events.push(event(growId, userId, flipDate, 'flip',
    '🔁 FLIP — Switch to 12/12', 'critical',
    'Change timer to 12 hours on / 12 hours off. Verify no light leaks in tent.'))

  // ── FLOWER WEEKS ─────────────────────────────────────────────────────────

  for (let week = 1; week <= flowerWeeks; week++) {
    const weekStart = addDays(flipDate, (week - 1) * 7)

    // Week 1–2: stretch
    if (week === 1) {
      events.push(event(growId, userId, weekStart, 'observation',
        `Flower Wk ${week} — Stretch begins`, 'medium',
        'Plants will stretch 50–100%. Begin low-stress training to open canopy. Watch internodal spacing.'))
    }

    if (week === 2) {
      events.push(event(growId, userId, weekStart, 'lst',
        `Flower Wk ${week} — Train canopy`, 'medium',
        'Tuck fan leaves, spread branches. Maximum light penetration now sets up final yields.'))
    }

    // Week 3: top dress #1 + cal-mag risk
    if (week === 3) {
      if (isLivingSoil) {
        events.push(event(growId, userId, weekStart, 'top_dress',
          `Flower Wk ${week} — Top Dress #1`, 'high',
          'Top dress: Power Bloom + kelp meal + worm castings. Water in with 1 tsp/gal molasses. Scratch in lightly.'))
      }
      if (strainNotes.calMagRisk) {
        events.push(event(growId, userId, addDays(weekStart, 2), 'observation',
          `💊 Cal-Mag Risk Window`, 'high',
          'This strain is prone to Ca/Mg deficiency in weeks 3–4. Check newest growth for interveinal yellowing.'))
      }
      if (strainNotes.isNSensitive) {
        events.push(event(growId, userId, addDays(weekStart, 2), 'observation',
          `⚠️ N-Sensitive Strain — Watch Tip Burn`, 'high',
          'Reduce nitrogen. Watch for clawing or tip burn. Back off heavy N feeds.'))
      }
    }

    // Week 4–5: bud stacking
    if (week === 4) {
      events.push(event(growId, userId, weekStart, 'defoliate',
        `Flower Wk ${week} — Defoliate lowers`, 'medium',
        'Remove lower fan leaves below canopy. Redirect energy upward to developing buds.'))
    }

    if (week === 5) {
      if (isLivingSoil) {
        events.push(event(growId, userId, weekStart, 'top_dress',
          `Flower Wk ${week} — Top Dress #2`, 'high',
          'Top dress: Bone meal + worm castings. Phosphorus and calcium for bud hardening.'))
      }
      events.push(event(growId, userId, addDays(weekStart, 3), 'observation',
        `Flower Wk ${week} — Bud check`, 'low',
        'Buds should be stacking hard. Check for any signs of mold or pest pressure.'))
    }

    // Week 6: ripening
    if (week === 6) {
      events.push(event(growId, userId, weekStart, 'observation',
        `Flower Wk ${week} — Ripening phase`, 'medium',
        'Trichome check begins. Look for milky trichomes. Reduce RH to 42–45% to prevent mold.'))
    }

    // Living soil molasses every 2 weeks
    if (isLivingSoil && week % 2 === 0 && week < flushStartDays / 7) {
      events.push(event(growId, userId, addDays(weekStart, 2), 'water',
        `Wk ${week} — Molasses water`, 'low',
        '1 tsp/gal unsulfured molasses. Feeds soil microbes, boosts terpene production.'))
    }

    // Mid-flower trellis check
    if (week === 4) {
      events.push(event(growId, userId, addDays(weekStart, 1), 'trellis',
        `Flower Wk ${week} — Trellis / SCROG check`, 'low',
        'Weave new growth through trellis net. Final training before buds lock in.'))
    }
  }

  // ── FLUSH ────────────────────────────────────────────────────────────────

  const flushDate = addDays(flipDate, flushStartDays)
  events.push(event(growId, userId, flushDate, 'flush_start',
    '🚿 BEGIN FLUSH — Plain water only', 'critical',
    `Stop all nutrients. Plain water only for ${Math.round(flushWeeks * 7)} days until harvest. pH to 6.2–6.8.`))

  if (isLivingSoil) {
    events.push(event(growId, userId, addDays(flushDate, 1), 'observation',
      'Living soil — no flush needed', 'low',
      'Living soil does not require a water flush. Continue normal watering until harvest.'))
  }

  // ── HARVEST ─────────────────────────────────────────────────────────────

  const harvestDate = addDays(flipDate, harvestDays)
  events.push(event(growId, userId, harvestDate, 'harvest',
    '✂️ HARVEST WINDOW', 'critical',
    'Check trichomes: mostly cloudy/milky = peak THC. Amber trichomes = more body effect. Chop at soil line, leave roots.'))

  // ── POST-HARVEST ─────────────────────────────────────────────────────────

  events.push(event(growId, userId, addDays(harvestDate, 1), 'observation',
    'Begin drying — hang whole plant', 'high',
    'Hang inverted in 60°F / 60% RH darkness. Aim for 10–14 day dry. No fan blowing directly on buds.'))

  events.push(event(growId, userId, addDays(harvestDate, 7), 'observation',
    'Drying check — day 7', 'medium',
    'Small buds should be close to done. Check stems: bend = still wet, snap = dry. Do not rush.'))

  events.push(event(growId, userId, addDays(harvestDate, 10), 'observation',
    'Drying check — day 10 (target dry)', 'high',
    'Stems should snap cleanly. If ready, trim and jar. If not, check every day until stems snap.'))

  events.push(event(growId, userId, addDays(harvestDate, 12), 'cure_start',
    'Jar cure begins — burp daily', 'high',
    'Fill jars 75% full. Burp 15 min twice daily for first 2 weeks. Boveda 62% pack optional.'))

  events.push(event(growId, userId, addDays(harvestDate, 26), 'observation',
    'Cure checkpoint — reduce burping', 'medium',
    'After 2 weeks in jar, reduce to burping every 2–3 days. Minimum 4 weeks total cure for best flavor.'))

  // ── NEXT RUN PREP ────────────────────────────────────────────────────────

  const nextCloneDate = addDays(flipDate, 3 * 7)
  events.push(event(growId, userId, nextCloneDate, 'clone_take',
    '🔄 Take next clone batch (perpetual)', 'critical',
    'Take cuts from mother now to keep your perpetual cycle running. This batch will be ready for next flip.'))

  if (isLivingSoil) {
    events.push(event(growId, userId, addDays(harvestDate, 1), 'top_dress',
      'Soil recharge — chop and drop', 'medium',
      'Chop plant at base, leave roots to decompose. Top dress with compost, kelp, bokashi, and cover crop seeds.'))
  }

  // Sort by date
  events.sort((a, b) => a.event_date.localeCompare(b.event_date))

  return events
}

// ─── Recipe → Calendar bridge ─────────────────────────────────────────────────

export interface RecipeCalendarConfig {
  growId: string
  userId: string
  recipe: {
    veg_weeks?: number | null
    flower_weeks?: number | null
    feeding_schedule?: RecipeFeedingWeek[]
    watering_schedule?: RecipeWateringWeek[]
    training_schedule?: RecipeTrainingEvent[]
    env_schedule?: RecipeEnvWeek[]
  }
  cloneDate?: Date
  vegStartDate?: Date
  flipDate?: Date
}

const RECIPE_EVENT_TYPES: CalendarEventType[] = [
  'feed', 'water', 'environmental_change', 'lst', 'hst', 'defoliate', 'trellis', 'top',
]

export const RECIPE_CALENDAR_EVENT_TYPES = RECIPE_EVENT_TYPES

function isFlowerStage(stage: string): boolean {
  const s = stage.toLowerCase()
  return s.includes('flower') || s.includes('bloom')
}

function mapTrainingType(et: string): CalendarEventType {
  const s = et.toLowerCase()
  if (s === 'lst' || s.includes('low stress')) return 'lst'
  if (s === 'hst' || s.includes('supercrop') || s.includes('high stress')) return 'hst'
  if (s.includes('defoliat')) return 'defoliate'
  if (s.includes('trellis') || s === 'scrog') return 'trellis'
  if (s === 'top' || s === 'topping') return 'top'
  return 'observation'
}

export function generateRecipeCalendar(config: RecipeCalendarConfig): CalendarEventInsert[] {
  const { growId, userId, recipe, cloneDate, vegStartDate, flipDate } = config
  const vegAnchor = cloneDate ?? vegStartDate
  const vegWeeks = recipe.veg_weeks ?? 4
  const events: CalendarEventInsert[] = []

  // Week+stage → actual Date
  function weekDate(week: number, stage: string): Date | null {
    if (isFlowerStage(stage)) {
      if (!flipDate) return null
      return addDays(flipDate, (week - 1) * 7)
    }
    if (!vegAnchor) return null
    return addDays(vegAnchor, (week - 1) * 7)
  }

  // Week number without stage (uses veg_weeks boundary)
  function weekDateByNumber(week: number): Date | null {
    if (week <= vegWeeks && vegAnchor) {
      return addDays(vegAnchor, (week - 1) * 7)
    }
    if (flipDate) {
      return addDays(flipDate, (week - vegWeeks - 1) * 7)
    }
    return null
  }

  // ── Feeding ───────────────────────────────────────────────────────────────
  for (const w of recipe.feeding_schedule ?? []) {
    const d = weekDate(w.week, w.stage)
    if (!d) continue
    const productSummary = w.products
      .map(p => `${p.name}${p.amount > 0 ? ` ${p.amount}${p.unit}` : ''}`)
      .join(', ')
    events.push(event(growId, userId, d, 'feed',
      `Feed — Wk ${w.week} (${w.stage})`, 'medium',
      productSummary || undefined))
  }

  // ── Watering ──────────────────────────────────────────────────────────────
  for (const w of recipe.watering_schedule ?? []) {
    const anchor = weekDateByNumber(w.week)
    if (!anchor) continue
    const desc = [
      w.frequency_days ? `Every ${w.frequency_days} days` : null,
      w.volume_per_plant_ml ? `${w.volume_per_plant_ml}mL/plant` : null,
      w.ph_target ? `pH ${w.ph_target}` : null,
      w.ec_target ? `EC ${w.ec_target}` : null,
      w.notes ?? null,
    ].filter(Boolean).join(' · ')
    // Generate water events across the week based on frequency
    const freq = Math.max(1, w.frequency_days ?? 2)
    for (let offset = 0; offset < 7; offset += freq) {
      events.push(event(growId, userId, addDays(anchor, offset), 'water',
        `Water — Wk ${w.week}`, 'low', desc || undefined))
    }
  }

  // ── Environment targets ───────────────────────────────────────────────────
  for (const w of recipe.env_schedule ?? []) {
    const d = weekDate(w.week, w.stage)
    if (!d) continue
    const desc = [
      w.temp_day_f ? `Day ${w.temp_day_f}°F` : null,
      w.temp_night_f ? `Night ${w.temp_night_f}°F` : null,
      w.rh_percent ? `RH ${w.rh_percent}%` : null,
      w.ppfd ? `PPFD ${w.ppfd}` : null,
      w.light_hours ? `${w.light_hours}h light` : null,
    ].filter(Boolean).join(' · ')
    events.push(event(growId, userId, d, 'environmental_change',
      `Env targets — Wk ${w.week} (${w.stage})`, 'low', desc || undefined))
  }

  // ── Training events ───────────────────────────────────────────────────────
  for (const t of recipe.training_schedule ?? []) {
    if (!flipDate) continue
    const d = addDays(flipDate, t.day_from_flip)
    events.push(event(growId, userId, d, mapTrainingType(t.event_type),
      t.event_type.replace(/_/g, ' '), 'medium', t.description))
  }

  events.sort((a, b) => a.event_date.localeCompare(b.event_date))
  return events
}
