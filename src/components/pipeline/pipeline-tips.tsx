'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'

interface Tip { tip: string; why?: string }

export function PipelineTips({ growId, growName }: { growId: string; growName: string }) {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const cache = useRef<Map<string, Tip[]>>(new Map())

  async function fetchTips(force = false) {
    if (!force && cache.current.has(growId)) {
      setTips(cache.current.get(growId)!)
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/pipeline/tips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ growId }),
      })
      const data = await res.json()
      if (data.tips) { cache.current.set(growId, data.tips); setTips(data.tips) }
      else setError(data.error ?? 'No tips available')
    } catch {
      setError('Could not reach the AI')
    }
    setLoading(false)
  }

  useEffect(() => { fetchTips() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [growId])

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'rgba(155,93,229,0.3)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--purple)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>AI tips for {growName}</span>
        </div>
        <button onClick={() => fetchTips(true)} disabled={loading} className="disabled:opacity-50" title="Refresh">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                   : <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
        </button>
      </div>

      {loading && tips.length === 0 && (
        <div className="flex items-center gap-2 text-sm py-2" style={{ color: 'var(--text-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Reading the grow…
        </div>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>}

      <div className="space-y-2.5">
        {tips.map((t, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(155,93,229,0.15)' }}>
              <span className="text-[10px] font-bold" style={{ color: 'var(--purple)' }}>{i + 1}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--text)' }}>{t.tip}</p>
              {t.why && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.why}</p>}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
        AI suggestions — use your judgment.
      </p>
    </div>
  )
}
