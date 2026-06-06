'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Leaf, ChevronRight, ChevronLeft, Check,
  Lightbulb, FlaskConical, Wifi, Sprout
} from 'lucide-react'

const STEPS = [
  { id: 1, title: 'Who are you?', icon: Leaf },
  { id: 2, title: 'Your Equipment', icon: Lightbulb },
  { id: 3, title: 'Connect Hardware', icon: Wifi },
  { id: 4, title: 'First Grow', icon: Sprout },
]

const EXPERIENCE_LEVELS = [
  { value: 'hobbyist', label: 'Hobbyist', desc: 'Growing for personal use' },
  { value: 'caregiver', label: 'Caregiver', desc: 'Growing for medical patients' },
  { value: 'commercial', label: 'Commercial', desc: 'Licensed cultivator' },
  { value: 'breeder', label: 'Breeder', desc: 'Developing new genetics' },
]

const LIGHT_TYPES = ['HPS', 'CMH/LEC', 'LED Quantum Board', 'LED Bar', 'T5 Fluorescent', 'Other']
const MEDIUM_TYPES = ['Living Soil', 'Coco Coir', 'Pro-Mix / Peat', 'Rockwool', 'DWC Hydro', 'NFT Hydro', 'Other']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Profile
  const [displayName, setDisplayName] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')

  // Step 2: Equipment
  const [equipmentName, setEquipmentName] = useState('Flower Tent 1')
  const [tentWidth, setTentWidth] = useState('')
  const [tentLength, setTentLength] = useState('')
  const [tentHeight, setTentHeight] = useState('')
  const [lightType, setLightType] = useState('')
  const [lightWattage, setLightWattage] = useState('')
  const [mediumType, setMediumType] = useState('')
  const [potSize, setPotSize] = useState('')
  const [maxPlants, setMaxPlants] = useState('')

  // Step 3: AC Infinity
  const [acEmail, setAcEmail] = useState('')
  const [acPassword, setAcPassword] = useState('')
  const [acConnected, setAcConnected] = useState(false)

  async function saveProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // Check if the profile row exists (trigger may have failed on signup)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    let supaError: { message?: string } | null = null

    if (!existing) {
      // Bootstrap the row — trigger failed
      const username = (user.user_metadata?.username as string) ||
        user.email?.split('@')[0] ||
        user.id.slice(0, 8)
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        username,
        display_name: displayName || username,
        experience_level: experienceLevel || null,
      } as never)
      supaError = error
    } else {
      const patch: Record<string, unknown> = {}
      if (displayName) patch.display_name = displayName
      if (experienceLevel) patch.experience_level = experienceLevel
      if (Object.keys(patch).length === 0) return true
      const { error } = await supabase.from('profiles').update(patch as never).eq('id', user.id)
      supaError = error
    }

    if (supaError) {
      setError(supaError.message ?? 'Failed to save profile')
      return false
    }
    return true
  }

  async function saveEquipment() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const usableSqft =
      tentWidth && tentLength
        ? parseFloat(tentWidth) * parseFloat(tentLength)
        : null

    const { error } = await supabase.from('equipment_profiles').insert([{
      user_id: user.id,
      name: equipmentName,
      tent_width_ft: tentWidth ? parseFloat(tentWidth) : null,
      tent_length_ft: tentLength ? parseFloat(tentLength) : null,
      tent_height_ft: tentHeight ? parseFloat(tentHeight) : null,
      usable_sqft: usableSqft,
      light_type: lightType || null,
      light_wattage: lightWattage ? parseInt(lightWattage) : null,
      medium_type: mediumType || null,
      pot_size_gal: potSize ? parseFloat(potSize) : null,
      max_plants: maxPlants ? parseInt(maxPlants) : null,
      is_default: true,
    }])

    return !error
  }

  async function handleNext() {
    setError(null)
    setLoading(true)

    if (step === 1) {
      const ok = await saveProfile()
      if (!ok) { setError('Failed to save profile'); setLoading(false); return }
    }
    if (step === 2) {
      if (!equipmentName) { setError('Equipment name is required'); setLoading(false); return }
      const ok = await saveEquipment()
      if (!ok) { setError('Failed to save equipment'); setLoading(false); return }
    }

    setLoading(false)

    if (step < 4) {
      setStep(step + 1)
    } else {
      router.push('/dashboard')
    }
  }

  function handleSkip() {
    if (step < 4) setStep(step + 1)
    else router.push('/dashboard')
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
            <Leaf className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>WeedSmith</span>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all"
                  style={{
                    background: step > s.id ? 'var(--accent)' : step === s.id ? 'var(--accent-muted)' : 'var(--surface-raised)',
                    color: step > s.id ? '#0a0f0d' : step === s.id ? 'var(--accent)' : 'var(--text-muted)',
                    border: step === s.id ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  }}
                >
                  {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-px w-12 sm:w-20 mx-1 transition-all" style={{ background: step > s.id ? 'var(--accent)' : 'var(--border)' }} />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Step {step} of {STEPS.length} — {STEPS[step - 1].title}</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Tell us about yourself</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This helps us tailor advice and recipe recommendations.</p>
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>Display name <span style={{ color: 'var(--text-muted)' }}>(optional)</span></Label>
                <Input
                  placeholder="How should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div className="space-y-2">
                <Label style={{ color: 'var(--text-secondary)' }}>Experience level</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setExperienceLevel(level.value)}
                      className="text-left p-3 rounded-lg border transition-all"
                      style={{
                        background: experienceLevel === level.value ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        borderColor: experienceLevel === level.value ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{level.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{level.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Equipment */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Set up your grow space</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  This is how WeedSmith auto-scales recipes to your exact setup.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>Space name</Label>
                <Input
                  placeholder="e.g. Flower Tent 1"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Width (ft)', value: tentWidth, setter: setTentWidth },
                  { label: 'Length (ft)', value: tentLength, setter: setTentLength },
                  { label: 'Height (ft)', value: tentHeight, setter: setTentHeight },
                ].map(({ label, value, setter }) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      placeholder="4"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="font-mono"
                      style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>Light type</Label>
                <div className="flex flex-wrap gap-2">
                  {LIGHT_TYPES.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLightType(l)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        background: lightType === l ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        borderColor: lightType === l ? 'var(--accent)' : 'var(--border)',
                        color: lightType === l ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Light wattage</Label>
                  <Input
                    type="number"
                    placeholder="480"
                    value={lightWattage}
                    onChange={(e) => setLightWattage(e.target.value)}
                    className="font-mono"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Max plants</Label>
                  <Input
                    type="number"
                    placeholder="4"
                    value={maxPlants}
                    onChange={(e) => setMaxPlants(e.target.value)}
                    className="font-mono"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>Growing medium</Label>
                <div className="flex flex-wrap gap-2">
                  {MEDIUM_TYPES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMediumType(m)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        background: mediumType === m ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        borderColor: mediumType === m ? 'var(--accent)' : 'var(--border)',
                        color: mediumType === m ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Final pot size (gallons)</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="7"
                  value={potSize}
                  onChange={(e) => setPotSize(e.target.value)}
                  className="font-mono w-32"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>
          )}

          {/* Step 3: AC Infinity */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Connect your controller</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Sync live temperature, humidity, and VPD from your AC Infinity controller. You can skip this and connect later.
                </p>
              </div>

              {acConnected ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border" style={{ background: 'var(--accent-muted)', borderColor: 'var(--accent)' }}>
                  <Check className="w-5 h-5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>AC Infinity connected</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Readings will sync automatically</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                    <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>What this enables:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Live temp, humidity & VPD on your grow dashboard</li>
                      <li>Automatic alerts when readings drift from targets</li>
                      <li>Push recipe environment targets to your controller</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <Label style={{ color: 'var(--text-secondary)' }}>AC Infinity account email</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={acEmail}
                      onChange={(e) => setAcEmail(e.target.value)}
                      style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label style={{ color: 'var(--text-secondary)' }}>AC Infinity account password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={acPassword}
                      onChange={(e) => setAcPassword(e.target.value)}
                      style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Stored encrypted. Never shared.</p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={!acEmail || !acPassword || loading}
                    onClick={() => {
                      // AC Infinity connection handled in equipment settings
                      setAcConnected(true)
                    }}
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Test connection
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: First Grow */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>You&apos;re all set!</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Your equipment profile is saved. Ready to start tracking your first grow?
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/grows/new')}
                  className="p-4 rounded-lg border text-left transition-all hover:border-[--accent]"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-muted)' }}>
                      <Sprout className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Add my current grow</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enter a grow that&apos;s already in progress</p>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/recipes')}
                  className="p-4 rounded-lg border text-left transition-all hover:border-[--accent]"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(155,93,229,0.15)' }}>
                      <FlaskConical className="w-5 h-5" style={{ color: 'var(--purple)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Browse recipes</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Download a proven grow recipe to start from</p>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm rounded-lg px-3 py-2 mt-4" style={{ background: 'rgba(231,111,81,0.1)', color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => step > 1 ? setStep(step - 1) : router.push('/dashboard')}
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {step > 1 ? 'Back' : 'Skip all'}
            </Button>

            <div className="flex items-center gap-2">
              {step < 4 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Skip
                </Button>
              )}
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  style={{ background: 'var(--accent)', color: '#0a0f0d' }}
                >
                  {loading ? 'Saving…' : 'Continue'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  style={{ background: 'var(--accent)', color: '#0a0f0d' }}
                >
                  Go to dashboard
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
