'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, Unlock } from 'lucide-react'

export function ThreadActions({ postId, initialLocked }: { postId: string; initialLocked: boolean }) {
  const supabase = createClient()
  const [locked, setLocked] = useState(initialLocked)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    const next = !locked
    setLocked(next)
    await supabase.from('community_posts').update({ is_locked: next } as never).eq('id', postId)
    setBusy(false)
  }

  return (
    <button onClick={toggle} disabled={busy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
      {locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
    </button>
  )
}
