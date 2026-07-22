'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Leaf, ShieldCheck } from 'lucide-react'

export function AgeGate() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  async function accept() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ community_acknowledged: true } as never).eq('id', user.id)
    router.refresh()
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border p-8 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--accent-muted)' }}>
          <Leaf className="w-7 h-7" style={{ color: 'var(--accent)' }} />
        </div>
        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>Welcome to Canopy</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          The Grow OS community — grow showcases, strain talk, and harvest flexes from real growers.
        </p>
        <div className="rounded-xl border p-4 mb-5 text-left space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          {[
            'I am 21 years of age or older.',
            'This is an educational cultivation community — no sales or transactions.',
            'I understand cannabis laws vary by location.',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t}</span>
            </div>
          ))}
        </div>
        <button onClick={accept} disabled={saving}
          className="w-full py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
          {saving ? 'Entering…' : 'Enter Canopy'}
        </button>
      </div>
    </div>
  )
}
