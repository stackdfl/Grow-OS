'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, FlaskConical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function GrowActions({ growId }: { growId: string }) {
  const router = useRouter()
  const [recreating, setRecreating] = useState(false)
  const [capturing, setCapturing] = useState(false)

  async function recreate() {
    setRecreating(true)
    try {
      const res = await fetch('/api/grows/recreate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ growId }),
      })
      const d = await res.json()
      if (res.ok && d.id) { toast.success('New run added to your pipeline'); router.push(`/grows/${d.id}`) }
      else toast.error(d.error ?? 'Could not recreate')
    } catch { toast.error('Could not recreate') }
    setRecreating(false)
  }

  async function capture() {
    setCapturing(true)
    try {
      const res = await fetch('/api/recipes/capture', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ growId }),
      })
      const d = await res.json()
      if (res.ok && d.id) { toast.success('Recipe captured from this grow'); router.push(`/recipes/${d.id}`) }
      else toast.error(d.error ?? 'Could not capture recipe')
    } catch { toast.error('Could not capture recipe') }
    setCapturing(false)
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={recreate} disabled={recreating}
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-muted)' }}>
        {recreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Recreate grow
      </button>
      <button onClick={capture} disabled={capturing}
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}>
        {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} Save as recipe
      </button>
    </div>
  )
}
