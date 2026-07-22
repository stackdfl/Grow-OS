import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { differenceInDays, parseISO } from 'date-fns'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { growId } = await req.json() as { growId: string }
  if (!growId) return NextResponse.json({ error: 'growId required' }, { status: 400 })

  // Pull the grow + recent context
  const [growRes, waterRes, feedRes, envRes] = await Promise.all([
    supabase.from('grows')
      .select('name, status, medium_type, plant_count, container_size_gal, clone_date, veg_start_date, flip_date, harvest_date, genetics(strain_name, breeder, type)')
      .eq('id', growId).eq('user_id', user.id).single(),
    supabase.from('watering_logs').select('log_date, ph_in, runoff_ph, ec_in, runoff_ec')
      .eq('grow_id', growId).order('log_date', { ascending: false }).limit(5),
    supabase.from('feeding_logs').select('log_date, products, ec_in')
      .eq('grow_id', growId).order('log_date', { ascending: false }).limit(3),
    supabase.from('env_readings').select('temp_f, rh_percent, vpd_kpa')
      .eq('grow_id', growId).order('reading_time', { ascending: false }).limit(1),
  ])

  const grow = growRes.data as Record<string, unknown> | null
  if (!grow) return NextResponse.json({ error: 'Grow not found' }, { status: 404 })

  const geneticsRaw = grow.genetics
  const genetics = (Array.isArray(geneticsRaw) ? geneticsRaw[0] : geneticsRaw) as { strain_name?: string; breeder?: string; type?: string } | null

  // Derived timing
  const today = new Date()
  let timing = ''
  if (grow.flip_date && ['flower', 'flush'].includes(grow.status as string)) {
    const d = differenceInDays(today, parseISO(grow.flip_date as string))
    timing = `Flower day ${d} (week ${Math.floor(d / 7) + 1})`
  } else if (grow.veg_start_date && grow.status === 'veg') {
    timing = `Veg day ${differenceInDays(today, parseISO(grow.veg_start_date as string))}`
  }
  let daysToHarvest = ''
  if (grow.harvest_date) {
    const d = differenceInDays(parseISO(grow.harvest_date as string), today)
    if (d >= 0) daysToHarvest = `${d} days to estimated harvest`
  }

  const water = (waterRes.data ?? []) as { log_date: string; ph_in: number | null; runoff_ph: number | null; ec_in: number | null; runoff_ec: number | null }[]
  const env = (envRes.data ?? [])[0] as { temp_f: number | null; rh_percent: number | null; vpd_kpa: number | null } | undefined

  const context = [
    `Strain: ${genetics?.strain_name ?? 'unknown'}${genetics?.type ? ` (${genetics.type})` : ''}`,
    `Stage: ${grow.status}${timing ? ` — ${timing}` : ''}`,
    daysToHarvest,
    `Medium: ${grow.medium_type ?? 'unknown'}, ${grow.plant_count} plant(s)${grow.container_size_gal ? ` in ${grow.container_size_gal} gal` : ''}`,
    env ? `Latest env: ${env.temp_f ?? '?'}°F, ${env.rh_percent ?? '?'}% RH, VPD ${env.vpd_kpa ?? '?'} kPa` : 'No environment readings yet',
    water.length ? `Recent watering pH in→runoff: ${water.slice(0, 3).map(w => `${w.ph_in ?? '?'}→${w.runoff_ph ?? '?'}`).join(', ')}` : 'No watering logged recently',
    water.length ? `Recent EC in→runoff: ${water.slice(0, 3).map(w => `${w.ec_in ?? '?'}→${w.runoff_ec ?? '?'}`).join(', ')}` : '',
  ].filter(Boolean).join('\n')

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `You are a master cannabis cultivator giving quick, specific, actionable tips for ONE grow at its current point in the cycle. Return ONLY a JSON array of 2-4 tip objects: [{"tip":"<one concise actionable sentence>","why":"<short reason>"}]. Be specific to the stage and the data. No fluff, no greetings, no markdown. If data looks off (pH drift, VPD out of band for stage, salt buildup), call it out.`,
      messages: [{ role: 'user', content: `Here is the grow:\n${context}\n\nGive me 2-4 sharp tips for right now.` }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)
    const tips = match ? JSON.parse(match[0]) : []
    return NextResponse.json({ tips })
  } catch (e) {
    return NextResponse.json({ error: 'AI unavailable', detail: String(e) }, { status: 500 })
  }
}
