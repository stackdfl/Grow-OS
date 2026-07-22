'use client'

import { useState } from 'react'

export const REACTIONS = [
  { key: 'like',     emoji: '👍', label: 'Like' },
  { key: 'love',     emoji: '❤️', label: 'Love' },
  { key: 'fire',     emoji: '🔥', label: 'Fire' },
  { key: 'helpful',  emoji: '💡', label: 'Helpful' },
  { key: 'funny',    emoji: '😂', label: 'Funny' },
  { key: 'disagree', emoji: '🤔', label: 'Disagree' },
] as const

export function ReactionBar({ targetType, targetId, initialTotal, initialMine, initialBreakdown }: {
  targetType: 'share' | 'post' | 'comment'
  targetId: string
  initialTotal: number
  initialMine?: string | null
  initialBreakdown?: Record<string, number>
}) {
  const [total, setTotal] = useState(initialTotal)
  const [mine, setMine] = useState<string | null>(initialMine ?? null)
  const [breakdown, setBreakdown] = useState<Record<string, number>>(initialBreakdown ?? {})
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function react(reaction: string) {
    if (busy) return
    setBusy(true); setOpen(false)
    const prevMine = mine
    // optimistic breakdown
    setBreakdown(b => {
      const next = { ...b }
      if (prevMine) next[prevMine] = Math.max(0, (next[prevMine] ?? 1) - 1)
      if (prevMine !== reaction) next[reaction] = (next[reaction] ?? 0) + 1
      return next
    })
    setMine(prevMine === reaction ? null : reaction)
    setTotal(t => prevMine === reaction ? t - 1 : prevMine ? t : t + 1)
    try {
      const res = await fetch('/api/community/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reaction }),
      })
      if (res.ok) { const d = await res.json(); setMine(d.reaction); setTotal(d.upvotes) }
    } catch { /* keep optimistic */ }
    setBusy(false)
  }

  const mineEmoji = REACTIONS.find(r => r.key === mine)?.emoji
  const topReactions = REACTIONS.filter(r => (breakdown[r.key] ?? 0) > 0).slice(0, 4)

  return (
    <div className="relative inline-flex items-center gap-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm border transition-colors"
        style={{
          background: mine ? 'var(--accent-muted)' : 'var(--surface-raised)',
          borderColor: mine ? 'var(--accent)' : 'var(--border)',
          color: mine ? 'var(--accent)' : 'var(--text-muted)',
        }}>
        <span>{mineEmoji ?? '👍'}</span>
        <span className="font-mono font-bold text-xs">{total}</span>
      </button>

      {topReactions.length > 0 && (
        <div className="flex items-center -space-x-1">
          {topReactions.map(r => (
            <span key={r.key} className="text-sm" title={`${breakdown[r.key]} ${r.label}`}>{r.emoji}</span>
          ))}
        </div>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1.5 z-20 flex gap-1 rounded-xl border p-1.5 shadow-lg"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {REACTIONS.map(r => (
              <button key={r.key} onClick={() => react(r.key)} title={r.label}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-transform hover:scale-125"
                style={{ background: mine === r.key ? 'var(--accent-muted)' : 'transparent' }}>
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
