import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await req.json() as { messages: Array<{ role: 'user' | 'assistant'; content: string }> }

  // Fetch user's active grows for context
  const { data: grows } = await supabase
    .from('grows')
    .select('name, status, medium_type, plant_count, clone_date, veg_start_date, flip_date, harvest_date, genetics(strain_name, breeder)')
    .eq('user_id', user.id)
    .not('status', 'in', '("complete","failed")')
    .limit(5)

  // Fetch upcoming calendar events
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const { data: events } = await supabase
    .from('calendar_events')
    .select('title, event_date, event_type, priority, grows(name)')
    .eq('user_id', user.id)
    .eq('completed', false)
    .gte('event_date', today)
    .lte('event_date', in7)
    .order('event_date', { ascending: true })
    .limit(10)

  // Build system prompt with grow context
  const growContext = grows && grows.length > 0
    ? `\n\nUSER'S ACTIVE GROWS:\n${grows.map((g: Record<string, unknown>) => {
        const gen = g.genetics as { strain_name?: string; breeder?: string } | null
        const parts = [
          `- ${g.name} (${g.status})`,
          gen?.strain_name ? `strain: ${gen.strain_name}` : null,
          gen?.breeder ? `breeder: ${gen.breeder}` : null,
          g.medium_type ? `medium: ${g.medium_type}` : null,
          g.plant_count ? `${g.plant_count} plants` : null,
          g.flip_date ? `flipped: ${g.flip_date}` : null,
          g.harvest_date ? `est. harvest: ${g.harvest_date}` : null,
        ].filter(Boolean).join(', ')
        return parts
      }).join('\n')}`
    : ''

  const eventContext = events && events.length > 0
    ? `\n\nUPCOMING TASKS (next 7 days):\n${events.map((e: Record<string, unknown>) => {
        const grow = e.grows as { name?: string } | null
        return `- ${e.event_date}: ${e.title}${grow?.name ? ` (${grow.name})` : ''}`
      }).join('\n')}`
    : ''

  const systemPrompt = `You are Grow OS's AI Grow Coach — a knowledgeable, practical cannabis cultivation advisor. You help indoor growers improve their results through evidence-based advice.

Your expertise covers:
- Cannabis biology and plant physiology
- VPD, light, nutrition, and environment optimization
- Growing mediums: living soil, coco, DWC, hydro, and hybrid approaches
- Training techniques: LST, HST, SCROG, topping, defoliation
- Pest/disease identification and IPM
- Harvest timing via trichome assessment
- Drying, curing, and post-harvest
- Genetics and strain selection

Guidelines:
- Be direct and specific — growers want actionable answers
- Reference actual numbers (VPD ranges, EC targets, PPFD values, temps)
- Acknowledge when something depends on the specific setup
- Flag potential issues proactively if context suggests a problem
- Keep responses concise unless depth is clearly needed${growContext}${eventContext}`

  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
