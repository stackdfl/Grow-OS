'use client'

import { useState, useEffect } from 'react'
import { Share2, X, Check, Loader2, Globe, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

type IncludeKey = 'photos' | 'yields' | 'schedule' | 'env' | 'notes'
const FIELDS: { key: IncludeKey; label: string; desc: string; default: boolean }[] = [
  { key: 'photos',   label: 'Photos',          desc: 'Journal & harvest photos',     default: true },
  { key: 'yields',   label: 'Yield numbers',   desc: 'Weight, oz/plant, rating',     default: true },
  { key: 'schedule', label: 'Feed schedule',   desc: 'Nutrients & watering cadence', default: true },
  { key: 'env',      label: 'Environment',     desc: 'Avg temp / RH / VPD',          default: true },
  { key: 'notes',    label: 'Personal notes',  desc: 'Your harvest notes',           default: false },
]

export function ShareToCanopy({ growId }: { growId: string }) {
  const [open, setOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [include, setInclude] = useState<Record<IncludeKey, boolean>>(
    Object.fromEntries(FIELDS.map(f => [f.key, f.default])) as Record<IncludeKey, boolean>
  )

  useEffect(() => {
    fetch(`/api/community/share?growId=${growId}`).then(r => r.json())
      .then(d => setShared(!!d.shared)).catch(() => {}).finally(() => setChecking(false))
  }, [growId])

  async function publish() {
    setSaving(true)
    const res = await fetch('/api/community/share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ growId, include }),
    })
    setSaving(false)
    if (res.ok) { setShared(true); setOpen(false); toast.success('Shared to Canopy 🌿') }
    else toast.error('Could not publish')
  }

  async function unpublish() {
    setSaving(true)
    const res = await fetch(`/api/community/share?growId=${growId}`, { method: 'DELETE' })
    setSaving(false)
    if (res.ok) { setShared(false); setOpen(false); toast.success('Pulled from Canopy') }
    else toast.error('Could not unpublish')
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={checking}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        style={shared
          ? { background: 'var(--accent-muted)', color: 'var(--accent)' }
          : { background: 'var(--accent)', color: '#0a0f0d' }}>
        {shared ? <><Globe className="w-3.5 h-3.5" /> Shared</> : <><Share2 className="w-3.5 h-3.5" /> Share to Canopy</>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setOpen(false)}>
          <div className="rounded-2xl border w-full max-w-md p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} /> {shared ? 'Manage share' : 'Share to Canopy'}
              </h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            {shared ? (
              <>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  This grow is currently public on Canopy. You can pull it down anytime — the public copy is deleted immediately.
                </p>
                <button onClick={unpublish} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: 'rgba(231,111,81,0.12)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />} Unpublish from Canopy
                </button>
              </>
            ) : (
              <>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Choose what to include. Only these fields are copied into a public snapshot — your live grow stays private and never syncs.
                </p>
                <div className="space-y-2">
                  {FIELDS.map(f => (
                    <button key={f.key} onClick={() => setInclude(p => ({ ...p, [f.key]: !p[f.key] }))}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors"
                      style={{
                        background: include[f.key] ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        borderColor: include[f.key] ? 'var(--accent)' : 'var(--border)',
                      }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                        style={{ background: include[f.key] ? 'var(--accent)' : 'transparent', border: include[f.key] ? 'none' : '1px solid var(--border)' }}>
                        {include[f.key] && <Check className="w-3.5 h-3.5" style={{ color: '#0a0f0d' }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{f.label}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                  This will be visible to everyone in the community.
                </p>
                <button onClick={publish} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />} Publish to Canopy
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
