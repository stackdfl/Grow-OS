'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Cpu, Copy, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { Grow } from '@/types/database'

export default function NewTentPage() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')
  const [growId, setGrowId] = useState('')
  const [grows, setGrows] = useState<Grow[]>([])
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [tentId, setTentId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadGrows() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('grows')
        .select('id, name, status, flip_date')
        .eq('user_id', user.id)
        .not('status', 'in', '("complete","failed")')
        .order('created_at', { ascending: false })
      setGrows((data ?? []) as Grow[])
    }
    loadGrows()
  }, [])

  async function handleCreate() {
    if (!name.trim()) { toast.error('Tent name is required'); return }
    setLoading(true)

    const res = await fetch('/api/tents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), grow_id: growId || undefined }),
    })

    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to create tent'); setLoading(false); return }

    setApiKey(data.api_key)
    setTentId(data.id)
    setLoading(false)
  }

  async function copyKey() {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    toast.success('API key copied')
    setTimeout(() => setCopied(false), 2000)
  }

  if (apiKey && tentId) {
    return (
      <div className="px-4 md:px-6 py-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
            <Cpu className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Tent created</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Save your API key before leaving this page</p>
          </div>
        </div>

        <div className="rounded-xl border p-5 mb-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div
            className="flex items-start gap-2.5 p-3 rounded-lg"
            style={{ background: 'rgba(244,162,97,0.1)', border: '1px solid rgba(244,162,97,0.3)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--warning)' }}>
              This API key will not be shown again. Copy it now and flash it to your ESP32. You can regenerate it from the tent settings if you lose it.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label style={{ color: 'var(--text-secondary)' }}>API Key</Label>
            <div className="flex items-center gap-2">
              <code
                className="flex-1 px-3 py-2.5 rounded-lg text-xs font-mono overflow-x-auto"
                style={{ background: 'var(--surface-raised)', color: 'var(--accent)', borderColor: 'var(--border)', border: '1px solid var(--border)' }}
              >
                {apiKey}
              </code>
              <button
                onClick={copyKey}
                className="p-2.5 rounded-lg transition-colors shrink-0"
                style={{ background: copied ? 'var(--accent-muted)' : 'var(--surface-raised)', color: copied ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>ESP32 setup</p>
            <div className="text-xs space-y-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <p>1. Flash your ESP32 with the Grow OS firmware</p>
              <p>2. In config, set <code className="font-mono px-1 rounded" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>TENT_ID</code> to <code className="font-mono px-1 rounded" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>{tentId}</code></p>
              <p>3. Set <code className="font-mono px-1 rounded" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>API_KEY</code> to the key above</p>
              <p>4. The ESP32 POSTs to <code className="font-mono px-1 rounded" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>/api/tents/{tentId}/readings</code> every 30s</p>
            </div>
          </div>
        </div>

        <Button
          className="w-full font-medium"
          onClick={() => router.push(`/controller/${tentId}`)}
          style={{ background: 'var(--accent)', color: '#0a0f0d' }}
        >
          Go to tent dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
          <Cpu className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Add Tent</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Register a new tent controller</p>
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="space-y-1.5">
          <Label style={{ color: 'var(--text-secondary)' }}>Tent name <span style={{ color: 'var(--danger)' }}>*</span></Label>
          <Input
            placeholder="e.g. Flower Tent A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>

        <div className="space-y-1.5">
          <Label style={{ color: 'var(--text-secondary)' }}>Link to grow <span style={{ color: 'var(--text-muted)' }}>(optional)</span></Label>
          <select
            value={growId}
            onChange={(e) => setGrowId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', border: '1px solid var(--border)', color: growId ? 'var(--text)' : 'var(--text-muted)' }}
          >
            <option value="">No grow linked yet</option>
            {grows.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.status})</option>
            ))}
          </select>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Links readings to a grow and auto-calculates flower week from flip date.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={() => router.push('/controller')}
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 font-medium"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            {loading ? 'Creating…' : 'Create Tent'}
          </Button>
        </div>
      </div>
    </div>
  )
}
