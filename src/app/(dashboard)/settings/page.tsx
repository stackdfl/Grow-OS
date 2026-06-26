'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, User } from 'lucide-react'
import { toast } from 'sonner'
import type { Profile } from '@/types/database'

const EXPERIENCE_LEVELS = ['hobbyist', 'caregiver', 'commercial', 'breeder'] as const

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername]       = useState('')
  const [bio, setBio]                 = useState('')
  const [location, setLocation]       = useState('')
  const [experience, setExperience]   = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        const p = data as Profile
        setProfile(p)
        setDisplayName(p.display_name ?? '')
        setUsername(p.username ?? '')
        setBio(p.bio ?? '')
        setLocation(p.location ?? '')
        setExperience(p.experience_level ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        username: username.trim() || profile.username,
        bio: bio.trim() || null,
        location: location.trim() || null,
        experience_level: experience || null,
      } as never)
      .eq('id', profile.id)

    setSaving(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Profile saved')
      router.push(`/growers/${username.trim() || profile.username}`)
    }
  }

  const inputStyle = {
    background: 'var(--surface-raised)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        Loading…
      </div>
    )
  }

  const initials = (displayName || username || '?').slice(0, 2).toUpperCase()

  return (
    <div className="px-4 md:px-6 py-5 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Profile settings</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#0a0f0d' }}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
          >
            {initials}
          </div>
        )}
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {displayName || username || 'Your profile'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Avatar is pulled from your account (Gravatar / OAuth)
          </p>
        </div>
      </div>

      {/* Fields */}
      <div
        className="rounded-xl border p-5 space-y-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
            style={inputStyle}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Username</label>
          <div className="flex items-center gap-1">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>@</span>
            <input
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none font-mono"
              style={inputStyle}
            />
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Lowercase letters, numbers, underscores only
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Bio</label>
          <textarea
            rows={3}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell the community about yourself and your setup…"
            className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
            style={inputStyle}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Location</label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="City, State or Country"
            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
            style={inputStyle}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Experience level</label>
          <div className="flex gap-2 flex-wrap">
            {EXPERIENCE_LEVELS.map(lvl => (
              <button
                key={lvl}
                type="button"
                onClick={() => setExperience(experience === lvl ? '' : lvl)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all"
                style={{
                  background: experience === lvl ? 'var(--accent-muted)' : 'var(--surface-raised)',
                  borderColor: experience === lvl ? 'var(--accent)' : 'var(--border)',
                  color: experience === lvl ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Profile link */}
      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Your public profile: <span style={{ color: 'var(--accent)' }}>/growers/{username || profile?.username}</span>
      </p>
    </div>
  )
}
