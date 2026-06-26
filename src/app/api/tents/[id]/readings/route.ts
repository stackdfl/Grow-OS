/**
 * ESP32 POST contract:
 *
 * POST /api/tents/{tent_id}/readings
 * Authorization: Bearer {api_key}
 * Content-Type: application/json
 *
 * Body:
 * {
 *   temp_f: number,           // ambient temperature in Fahrenheit
 *   rh_percent: number,       // relative humidity 0-100
 *   vpd_kpa: number,          // VPD calculated on device (we recalculate server-side for consistency)
 *   fan_speed: number,        // current fan speed 0-100 (informational)
 *   light_level: number,      // current light level 0-100 (informational)
 *   humidifier_on: boolean    // current humidifier state
 * }
 *
 * Response:
 * {
 *   fan_speed: number,
 *   light_level: number,
 *   humidifier_on: boolean,
 *   clip_fan_1_on: boolean,
 *   clip_fan_2_on: boolean,
 *   auto_mode: boolean
 * }
 */

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const OFFLINE_THRESHOLD_SECONDS = 90

function calcVpd(temp_f: number, rh_percent: number): number {
  const temp_c = (temp_f - 32) * 5 / 9
  return (1 - rh_percent / 100) * 0.6108 * Math.exp(17.27 * temp_c / (temp_c + 237.3))
}

function calcLightLevel(
  nowMinutes: number,
  lightsOnMinutes: number,
  lightsOffMinutes: number,
  sunriseMinutes: number,
  sunsetMinutes: number
): number {
  const isLightsOnBeforeOff = lightsOnMinutes < lightsOffMinutes

  let onMin: number, offMin: number
  if (isLightsOnBeforeOff) {
    onMin = lightsOnMinutes
    offMin = lightsOffMinutes
  } else {
    // Overnight schedule: lights on at e.g. 18:00, off at 06:00
    onMin = lightsOnMinutes
    offMin = lightsOffMinutes + 24 * 60
    if (nowMinutes < lightsOnMinutes) nowMinutes += 24 * 60
  }

  if (nowMinutes < onMin || nowMinutes >= offMin) return 0

  const minutesOn = nowMinutes - onMin
  const totalOn = offMin - onMin
  const minutesUntilOff = totalOn - minutesOn

  if (minutesOn < sunriseMinutes) {
    return Math.round((minutesOn / sunriseMinutes) * 100)
  }
  if (minutesUntilOff < sunsetMinutes) {
    return Math.round((minutesUntilOff / sunsetMinutes) * 100)
  }
  return 100
}

function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tentId } = await params

  const authHeader = req.headers.get('authorization') ?? ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!apiKey) return NextResponse.json({ error: 'Missing API key' }, { status: 401 })

  // Service role client — bypasses RLS; ESP32 has no user session
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Validate api_key against tent id
  const { data: tent } = await supabase
    .from('tents')
    .select('id, user_id, grow_id')
    .eq('id', tentId)
    .eq('api_key', apiKey)
    .single()

  if (!tent) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const body = await req.json() as {
    temp_f: number
    rh_percent: number
    vpd_kpa?: number
    fan_speed?: number
    light_level?: number
    humidifier_on?: boolean
  }

  const { temp_f, rh_percent } = body
  const temp_c = (temp_f - 32) * 5 / 9
  const vpd_kpa = calcVpd(temp_f, rh_percent)

  // Insert env reading
  await supabase.from('env_readings').insert({
    user_id: tent.user_id,
    grow_id: tent.grow_id ?? null,
    tent_id: tent.id,
    reading_time: new Date().toISOString(),
    temp_f,
    temp_c,
    rh_percent,
    vpd_kpa,
    source: 'grow_os',
    raw_data: body,
  })

  // Mark tent online
  await supabase
    .from('tents')
    .update({ is_online: true, last_seen: new Date().toISOString() })
    .eq('id', tent.id)

  // Fetch device_states and tent_schedules
  const [{ data: devices }, { data: schedule }] = await Promise.all([
    supabase.from('device_states').select('*').eq('tent_id', tent.id).single(),
    supabase.from('tent_schedules').select('*').eq('tent_id', tent.id).single(),
  ])

  if (!devices || !schedule) {
    return NextResponse.json({ error: 'Tent config missing' }, { status: 500 })
  }

  if (!devices.auto_mode) {
    return NextResponse.json({
      fan_speed: devices.fan_speed,
      light_level: devices.light_level,
      humidifier_on: devices.humidifier_on,
      clip_fan_1_on: devices.clip_fan_1_on,
      clip_fan_2_on: devices.clip_fan_2_on,
      auto_mode: false,
    })
  }

  // Auto mode: calculate commands server-side

  // Resolve flower week: prefer linked grow's flip_date over manual schedule setting
  let flowerWeek = schedule.flower_week
  if (tent.grow_id) {
    const { data: grow } = await supabase
      .from('grows')
      .select('flip_date')
      .eq('id', tent.grow_id)
      .single()

    if (grow?.flip_date) {
      const daysSinceFlip = Math.floor(
        (Date.now() - new Date(grow.flip_date).getTime()) / (1000 * 60 * 60 * 24)
      )
      flowerWeek = Math.max(1, Math.ceil(daysSinceFlip / 7))
    }
  }

  const weekKey = String(Math.min(flowerWeek, 10))
  const vpdTarget = (schedule.vpd_targets as Record<string, { min: number; max: number }>)[weekKey]

  // Light level based on time and schedule
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const lightsOnMinutes = timeStringToMinutes(schedule.lights_on)
  const lightsOffMinutes = timeStringToMinutes(schedule.lights_off)
  const lightLevel = calcLightLevel(
    nowMinutes,
    lightsOnMinutes,
    lightsOffMinutes,
    schedule.sunrise_minutes,
    schedule.sunset_minutes
  )

  const isDayTime = lightLevel > 0

  // VPD-based fan and humidifier control
  let fanSpeed = devices.fan_speed
  let humidifierOn = devices.humidifier_on

  if (vpdTarget) {
    if (vpd_kpa > vpdTarget.max) {
      // Too dry: slow fan, run humidifier
      fanSpeed = Math.max(20, devices.fan_speed - 20)
      humidifierOn = true
    } else if (vpd_kpa < vpdTarget.min) {
      // Too humid: speed up fan, kill humidifier
      fanSpeed = Math.min(80, devices.fan_speed + 20)
      humidifierOn = false
    }
    // In range: hold current values
  }

  // Clip fans follow lights
  const clipFansOn = isDayTime

  const response = {
    fan_speed: fanSpeed,
    light_level: lightLevel,
    humidifier_on: humidifierOn,
    clip_fan_1_on: clipFansOn,
    clip_fan_2_on: clipFansOn,
    auto_mode: true,
  }

  // Persist computed auto state back to device_states so UI reflects it
  await supabase
    .from('device_states')
    .update({ ...response, updated_at: new Date().toISOString() })
    .eq('tent_id', tent.id)

  return NextResponse.json(response)
}
