import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildDigestEmail } from '@/lib/email/digest'
import { format, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const admin = createAdminClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const threeDaysAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd')

  // Get all users with digest enabled
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('email_digest_enabled', true)

  if (profilesError || !profiles?.length) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  const errors: string[] = []

  for (const profile of profiles) {
    try {
      // Get auth user for email
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(profile.id)
      if (!authUser?.email) continue

      // Fetch pending + overdue tasks across all grows
      const [todayRes, overdueRes] = await Promise.all([
        admin
          .from('calendar_events')
          .select('title, event_date, grows!inner(name)')
          .eq('user_id', profile.id)
          .eq('event_date', today)
          .eq('completed', false)
          .eq('skipped', false),

        admin
          .from('calendar_events')
          .select('title, event_date, grows!inner(name)')
          .eq('user_id', profile.id)
          .gte('event_date', threeDaysAgo)
          .lt('event_date', today)
          .eq('completed', false)
          .eq('skipped', false),
      ])

      const todayTasks = (todayRes.data ?? []).map((e: { title: string; event_date: string; grows: { name: string } | { name: string }[] }) => ({
        title: e.title,
        event_date: e.event_date,
        grow_name: (Array.isArray(e.grows) ? e.grows[0] : e.grows)?.name ?? 'Unknown',
        is_overdue: false,
      }))

      const overdueTasks = (overdueRes.data ?? []).map((e: { title: string; event_date: string; grows: { name: string } | { name: string }[] }) => ({
        title: e.title,
        event_date: e.event_date,
        grow_name: (Array.isArray(e.grows) ? e.grows[0] : e.grows)?.name ?? 'Unknown',
        is_overdue: true,
      }))

      const allTasks = [...todayTasks, ...overdueTasks]
      if (allTasks.length === 0) continue

      const { subject, html, text } = buildDigestEmail(profile.display_name ?? '', allTasks)

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Grow OS <digest@growos.app>',
          to: authUser.email,
          subject,
          html,
          text,
        }),
      })

      if (res.ok) sent++
      else errors.push(`${authUser.email}: ${await res.text()}`)
    } catch (e) {
      errors.push(`${profile.id}: ${e}`)
    }
  }

  return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined })
}
