'use client'

import { useState } from 'react'
import { ArrowBigUp } from 'lucide-react'

export function UpvoteButton({ targetType, targetId, initialUpvotes, initialVoted, size = 'md' }: {
  targetType: 'share' | 'post' | 'comment'
  targetId: string
  initialUpvotes: number
  initialVoted?: boolean
  size?: 'sm' | 'md'
}) {
  const [upvotes, setUpvotes] = useState(initialUpvotes)
  const [voted, setVoted] = useState(!!initialVoted)
  const [busy, setBusy] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (busy) return
    setBusy(true)
    // optimistic
    setVoted(v => !v); setUpvotes(u => u + (voted ? -1 : 1))
    try {
      const res = await fetch('/api/community/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId }),
      })
      if (res.ok) { const d = await res.json(); setVoted(d.voted); setUpvotes(d.upvotes) }
    } catch { /* keep optimistic */ }
    setBusy(false)
  }

  const sm = size === 'sm'
  return (
    <button onClick={toggle}
      className="flex items-center gap-1 rounded-lg transition-colors"
      style={{
        padding: sm ? '2px 6px' : '4px 8px',
        background: voted ? 'var(--accent-muted)' : 'var(--surface-raised)',
        color: voted ? 'var(--accent)' : 'var(--text-muted)',
      }}>
      <ArrowBigUp className={sm ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill={voted ? 'currentColor' : 'none'} />
      <span className={`font-mono font-bold ${sm ? 'text-xs' : 'text-sm'}`}>{upvotes}</span>
    </button>
  )
}
