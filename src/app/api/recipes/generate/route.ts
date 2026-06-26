import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    strain, breeder, type: geneticsType,
    medium, lightType,
    vegWeeks, flowerWeeks,
    plantCount, containerSize,
    notes,
  } = body

  const prompt = `You are a cannabis cultivation expert. Generate a detailed, realistic grow recipe in JSON format.

Grow parameters:
- Strain: ${strain || 'Unknown'}${breeder ? ` (by ${breeder})` : ''}${geneticsType ? `, ${geneticsType}` : ''}
- Medium: ${medium || 'coco'}
- Light type: ${lightType || 'LED'}
- Veg weeks: ${vegWeeks || 4}
- Flower weeks: ${flowerWeeks || 8}
- Plant count: ${plantCount || 4}
- Container size: ${containerSize || 3} gal
${notes ? `- Notes: ${notes}` : ''}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "feeding_schedule": [
    {
      "week": 1,
      "stage": "veg",
      "products": [
        { "name": "product name", "amount": 2.5, "unit": "ml/L", "frequency": "every watering", "notes": "optional note" }
      ]
    }
  ],
  "watering_schedule": [
    {
      "week": 1,
      "frequency_days": 2,
      "volume_per_plant_ml": 500,
      "ph_target": 6.0,
      "ec_target": 0.8,
      "notes": "optional"
    }
  ],
  "env_targets": [
    {
      "week": 1,
      "stage": "veg",
      "temp_day_f": 78,
      "temp_night_f": 68,
      "rh_percent": 65,
      "vpd_kpa": 0.9,
      "ppfd": 400,
      "light_hours": 18
    }
  ],
  "training_plan": [
    {
      "day_from_flip": -14,
      "event_type": "topping",
      "description": "Top all plants above node 5",
      "photos_recommended": true
    }
  ],
  "amendment_schedule": [],
  "harvest_data": {
    "flower_days": 56,
    "flush_days": 7,
    "trichome_target": "mostly cloudy, 10-20% amber"
  },
  "equipment": {
    "light_type": "${lightType || 'LED'}",
    "container_size_gal": ${containerSize || 3}
  },
  "medium": {
    "type": "${medium || 'coco'}"
  }
}

Rules:
- feeding_schedule must cover all veg + flower weeks. Veg weeks: 1-${vegWeeks || 4}, flower weeks labeled stage "flower" week 1-${flowerWeeks || 8}.
- watering_schedule: same week range. coco feeds every 1-2 days; soil every 2-3 days.
- env_targets: cover all weeks. Flip to 12/12 at flower week 1. VPD increases in late flower (target 1.2-1.5 kPa).
- Use realistic nutrient brands (General Hydroponics, Fox Farm, Advanced Nutrients, Athena, etc.) appropriate for the medium.
- For coco/hydro: include cal-mag, base nutrients (grow/micro/bloom or similar), PK boosters in late flower.
- For soil: lighter feeding, possibly top-dressing amendments.
- training_plan: negative day_from_flip values = days before flip (veg training). Positive = days after flip (defoliation, etc.).
- Keep EC reasonable: veg 0.8-1.2, early flower 1.4-1.8, peak flower 2.0-2.4, flush below 0.5.
- Keep pH: coco/hydro 5.8-6.2, soil 6.2-6.8.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const generated = JSON.parse(jsonMatch[0])
    return NextResponse.json({ recipe: generated })
  } catch (err) {
    console.error('AI generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
