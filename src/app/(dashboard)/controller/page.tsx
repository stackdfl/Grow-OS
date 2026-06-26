import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Plus, Cpu, Circle, Wifi } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Tent } from '@/types/database'

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 90 * 1000
}

export default async function ControllerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tentsRaw } = await supabase
    .from('tents')
    .select('*, grow:grows(id, name, status, flip_date)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const tents = (tentsRaw ?? []) as (Tent & { grow: { id: string; name: string; status: string; flip_date: string | null } | null })[]

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Controller</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Tent automation and live monitoring
          </p>
        </div>
        <Link
          href="/controller/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#0a0f0d' }}
        >
          <Plus className="w-4 h-4" /> Add Tent
        </Link>
      </div>

      {tents.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <Cpu className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No tents yet</p>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Register your first tent to start monitoring and automating your environment.
          </p>
          <Link
            href="/controller/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            <Plus className="w-4 h-4" /> Add Tent
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tents.map((tent) => {
            const online = isOnline(tent.last_seen)
            return (
              <Link
                key={tent.id}
                href={`/controller/${tent.id}`}
                className="block rounded-xl border p-4 transition-colors"
                style={{ background: 'var(--surface)', borderColor: online ? 'var(--accent)' : 'var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: online ? 'var(--accent-muted)' : 'var(--surface-raised)' }}
                    >
                      <Cpu className="w-4 h-4" style={{ color: online ? 'var(--accent)' : 'var(--text-muted)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{tent.name}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {tent.grow ? tent.grow.name : 'No grow linked'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <div className="flex items-center gap-1.5">
                      <Circle
                        className="w-2 h-2"
                        fill={online ? 'var(--accent)' : 'var(--text-muted)'}
                        style={{ color: online ? 'var(--accent)' : 'var(--text-muted)' }}
                      />
                      <span className="text-xs" style={{ color: online ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {online ? 'Live' : tent.last_seen ? formatDistanceToNow(new Date(tent.last_seen), { addSuffix: true }) : 'Never connected'}
                      </span>
                    </div>
                    <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
