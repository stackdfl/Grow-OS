import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeCalibration } from '@/lib/calibration/engine'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const calibration = await computeCalibration(user.id)

    await supabase
      .from('user_calibrations')
      .upsert({
        user_id:          user.id,
        calibration_data: calibration,
        grow_count:       calibration.grow_count,
        completed_grows:  calibration.completed_grows,
        last_computed_at: new Date().toISOString(),
      } as never, { onConflict: 'user_id' })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Calibration compute error:', err)
    return NextResponse.json({ error: 'Compute failed' }, { status: 500 })
  }
}
