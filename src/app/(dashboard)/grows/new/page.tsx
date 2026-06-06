'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight, Leaf, Plus, X, Star, CheckCircle2 } from 'lucide-react'
import { generateCalendar } from '@/lib/calendar-engine/generate'
import type { Genetics, EquipmentProfile, Recipe } from '@/types/database'

const STEPS = [
  'Name & Genetics',
  'Equipment',
  'Dates',
  'Medium',
  'Environment',
  'Recipe',
]

const GROW_STATUSES = [
  { value: 'clone', label: 'Clone / Cutting' },
  { value: 'seedling', label: 'Seedling' },
  { value: 'veg', label: 'Vegetative' },
  { value: 'flower', label: 'Flowering' },
  { value: 'flush', label: 'Flush' },
]

const MEDIUM_OPTIONS = ['Living Soil', 'Coco Coir', 'Pro-Mix / Peat', 'Rockwool', 'DWC Hydro', 'Other']

export default function NewGrowPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Data
  const [genetics, setGenetics]   = useState<Genetics[]>([])
  const [equipment, setEquipment] = useState<EquipmentProfile[]>([])
  const [libraryRecipes, setLibraryRecipes] = useState<Recipe[]>([])

  // Step 5: Recipe
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(searchParams.get('recipe_id') ?? '')

  // Step 0: Name & Genetics
  const [name, setName] = useState('')
  const [selectedGenetics, setSelectedGenetics] = useState<string>('')
  const [currentStatus, setCurrentStatus] = useState('clone')
  const [plantCount, setPlantCount] = useState('1')
  const [spaceLabel, setSpaceLabel] = useState('')
  // New genetics inline
  const [addingGenetics, setAddingGenetics] = useState(false)
  const [newStrainName, setNewStrainName] = useState('')
  const [newBreeder, setNewBreeder] = useState('')
  const [newType, setNewType] = useState('hybrid')

  // Step 1: Equipment
  const [selectedEquipment, setSelectedEquipment] = useState<string>('')

  // Step 2: Dates
  const [cloneDate, setCloneDate] = useState('')
  const [vegStartDate, setVegStartDate] = useState('')
  const [flipDate, setFlipDate] = useState('')
  const [harvestDate, setHarvestDate] = useState('')
  const [flowerWeeks, setFlowerWeeks] = useState('9')

  // Step 3: Medium
  const [mediumType, setMediumType] = useState('')
  const [mediumIngredients, setMediumIngredients] = useState<{ name: string; percentage: string }[]>([
    { name: '', percentage: '' },
  ])
  const [containerSize, setContainerSize] = useState('')

  // Step 4: Environment targets
  const [vegTempDay, setVegTempDay] = useState('75')
  const [vegTempNight, setVegTempNight] = useState('68')
  const [vegRh, setVegRh] = useState('65')
  const [flowerTempDay, setFlowerTempDay] = useState('76')
  const [flowerTempNight, setFlowerTempNight] = useState('68')
  const [flowerRh, setFlowerRh] = useState('50')
  const [lateFlowerRh, setLateFlowerRh] = useState('42')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: gen }, { data: eq }, { data: ownData }, { data: savedData }] = await Promise.all([
        supabase.from('genetics').select('*').eq('user_id', user.id).order('strain_name'),
        supabase.from('equipment_profiles').select('*').eq('user_id', user.id).order('name'),
        supabase.from('recipes').select('*, author:profiles(id, username, display_name)').eq('author_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('recipe_saves').select('recipe:recipes(*, author:profiles(id, username, display_name))').eq('user_id', user.id).order('saved_at', { ascending: false }),
      ])
      setGenetics((gen ?? []) as Genetics[])
      setEquipment((eq ?? []) as EquipmentProfile[])
      if (eq && eq.length > 0) {
        const def = (eq as EquipmentProfile[]).find((e) => e.is_default) ?? (eq as EquipmentProfile[])[0]
        setSelectedEquipment(def.id)
      }
      const own   = (ownData ?? []) as unknown as Recipe[]
      const ownIds = new Set(own.map(r => r.id))
      const saved = ((savedData ?? []) as unknown as { recipe: Recipe }[])
        .map(s => s.recipe)
        .filter(r => r && !ownIds.has(r.id))
      setLibraryRecipes([...own, ...saved])
    }
    load()
  }, [])

  async function addNewGenetics() {
    if (!newStrainName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('genetics')
      .insert([{
        user_id: user.id,
        strain_name: newStrainName.trim(),
        breeder: newBreeder.trim() || null,
        type: newType,
      }])
      .select()
      .single()

    if (!error && data) {
      const newGen = data as Genetics
      setGenetics((prev) => [...prev, newGen])
      setSelectedGenetics(newGen.id)
      setAddingGenetics(false)
      setNewStrainName('')
      setNewBreeder('')
    }
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const envTargets = {
      veg: {
        temp_day_f: parseFloat(vegTempDay) || undefined,
        temp_night_f: parseFloat(vegTempNight) || undefined,
        rh_percent: parseFloat(vegRh) || undefined,
      },
      flower: {
        temp_day_f: parseFloat(flowerTempDay) || undefined,
        temp_night_f: parseFloat(flowerTempNight) || undefined,
        rh_percent: parseFloat(flowerRh) || undefined,
      },
      late_flower: {
        temp_day_f: parseFloat(flowerTempDay) || undefined,
        temp_night_f: parseFloat(flowerTempNight) || undefined,
        rh_percent: parseFloat(lateFlowerRh) || undefined,
      },
    }

    const ingredients = mediumIngredients
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name, percentage: i.percentage ? parseFloat(i.percentage) : undefined }))

    const { data: grow, error: growError } = await supabase
      .from('grows')
      .insert([{
        user_id: user.id,
        name: name.trim(),
        genetics_id: selectedGenetics || null,
        equipment_profile_id: selectedEquipment || null,
        status: currentStatus,
        plant_count: parseInt(plantCount) || 1,
        space_label: spaceLabel.trim() || null,
        clone_date: cloneDate || null,
        veg_start_date: vegStartDate || null,
        flip_date: flipDate || null,
        harvest_date: harvestDate || null,
        medium_type: mediumType || null,
        medium_ingredients: ingredients,
        container_size_gal: containerSize ? parseFloat(containerSize) : null,
        env_targets: envTargets,
        recipe_id: selectedRecipeId || null,
        is_following_recipe: !!selectedRecipeId,
      }])
      .select()
      .single()

    if (growError || !grow) {
      setError(growError?.message ?? 'Failed to create grow')
      setLoading(false)
      return
    }

    // Generate calendar if flip date is set
    if (flipDate) {
      const events = generateCalendar({
        growId: grow.id,
        userId: user.id,
        flipDate: new Date(flipDate),
        cloneDate: cloneDate ? new Date(cloneDate) : undefined,
        vegStartDate: vegStartDate ? new Date(vegStartDate) : undefined,
        flowerWeeks: parseInt(flowerWeeks) || 9,
        mediumType: mediumType || 'soil',
      })

      if (events.length > 0) {
        await supabase.from('calendar_events').insert(events)
      }
    }

    router.push(`/grows/${grow.id}`)
  }

  function canProceed() {
    if (step === 0) return name.trim().length > 0
    return true
  }

  const totalSteps = STEPS.length

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step > 0 ? setStep(step - 1) : router.back()} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>New Grow</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Step {step + 1} of {totalSteps} — {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-6 overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${((step + 1) / totalSteps) * 100}%`, background: 'var(--accent)' }}
        />
      </div>

      {/* Card */}
      <div className="rounded-xl border p-5 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

        {/* STEP 0: Name & Genetics */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label style={{ color: 'var(--text-secondary)' }}>Grow name <span style={{ color: 'var(--danger)' }}>*</span></Label>
              <Input
                placeholder="e.g. GMO Tent 1 — June 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label style={{ color: 'var(--text-secondary)' }}>Genetics</Label>
                <button
                  type="button"
                  onClick={() => setAddingGenetics(!addingGenetics)}
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'var(--accent)' }}
                >
                  <Plus className="w-3 h-3" /> Add new
                </button>
              </div>

              {addingGenetics && (
                <div className="rounded-lg border p-3 space-y-2" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>New strain</span>
                    <button onClick={() => setAddingGenetics(false)}><X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button>
                  </div>
                  <Input
                    placeholder="Strain name"
                    value={newStrainName}
                    onChange={(e) => setNewStrainName(e.target.value)}
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                  <Input
                    placeholder="Breeder (optional)"
                    value={newBreeder}
                    onChange={(e) => setNewBreeder(e.target.value)}
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                  <div className="flex gap-2">
                    {['indica','sativa','hybrid','auto'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewType(t)}
                        className="px-2 py-1 rounded text-xs capitalize border"
                        style={{
                          background: newType === t ? 'var(--accent-muted)' : 'transparent',
                          borderColor: newType === t ? 'var(--accent)' : 'var(--border)',
                          color: newType === t ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addNewGenetics}
                    disabled={!newStrainName.trim()}
                    style={{ background: 'var(--accent)', color: '#0a0f0d' }}
                  >
                    Add strain
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedGenetics('')}
                  className="text-left px-3 py-2 rounded-lg border text-sm transition-colors"
                  style={{
                    background: selectedGenetics === '' ? 'var(--surface-raised)' : 'transparent',
                    borderColor: selectedGenetics === '' ? 'var(--accent)' : 'transparent',
                    color: 'var(--text-muted)',
                  }}
                >
                  Unknown / TBD
                </button>
                {genetics.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGenetics(g.id)}
                    className="text-left px-3 py-2 rounded-lg border text-sm transition-colors"
                    style={{
                      background: selectedGenetics === g.id ? 'var(--accent-muted)' : 'transparent',
                      borderColor: selectedGenetics === g.id ? 'var(--accent)' : 'transparent',
                      color: selectedGenetics === g.id ? 'var(--text)' : 'var(--text-secondary)',
                    }}
                  >
                    <span className="font-medium">{g.strain_name}</span>
                    {g.breeder && <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{g.breeder}</span>}
                    {g.type && (
                      <span className="text-xs ml-2 capitalize px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}>
                        {g.type}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>Current stage</Label>
                <div className="space-y-1">
                  {GROW_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setCurrentStatus(s.value)}
                      className="w-full text-left px-3 py-1.5 rounded-lg border text-sm transition-colors"
                      style={{
                        background: currentStatus === s.value ? 'var(--accent-muted)' : 'transparent',
                        borderColor: currentStatus === s.value ? 'var(--accent)' : 'transparent',
                        color: currentStatus === s.value ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label style={{ color: 'var(--text-secondary)' }}>Plant count</Label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={plantCount}
                    onChange={(e) => setPlantCount(e.target.value)}
                    className="font-mono"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: 'var(--text-secondary)' }}>Space label</Label>
                  <Input
                    placeholder="e.g. Tent A"
                    value={spaceLabel}
                    onChange={(e) => setSpaceLabel(e.target.value)}
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Equipment */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Select the equipment profile for this grow. Recipes will be scaled to this setup.
            </p>
            {equipment.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No equipment profiles yet.</p>
                <button
                  type="button"
                  onClick={() => router.push('/equipment')}
                  className="text-sm underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Set up equipment →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {equipment.map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => setSelectedEquipment(eq.id)}
                    className="w-full text-left p-4 rounded-xl border transition-colors"
                    style={{
                      background: selectedEquipment === eq.id ? 'var(--accent-muted)' : 'var(--surface-raised)',
                      borderColor: selectedEquipment === eq.id ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>{eq.name}</div>
                    <div className="text-xs mt-1 space-x-3" style={{ color: 'var(--text-muted)' }}>
                      {eq.tent_width_ft && eq.tent_length_ft && (
                        <span className="font-mono">{eq.tent_width_ft}×{eq.tent_length_ft}ft</span>
                      )}
                      {eq.light_type && <span>{eq.light_type}</span>}
                      {eq.light_wattage && <span className="font-mono">{eq.light_wattage}W</span>}
                      {eq.medium_type && <span>{eq.medium_type}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Dates */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Enter known dates. The calendar auto-generates when you set a flip date.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: 'Clone / sprout date', value: cloneDate, setter: setCloneDate },
                { label: 'Veg start date', value: vegStartDate, setter: setVegStartDate },
              ].map(({ label, value, setter }) => (
                <div key={label} className="space-y-1.5">
                  <Label style={{ color: 'var(--text-secondary)' }}>{label}</Label>
                  <Input
                    type="date"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="font-mono"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
              ))}

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>
                  Flip date (12/12)
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                    Generates calendar
                  </span>
                </Label>
                <Input
                  type="date"
                  value={flipDate}
                  onChange={(e) => setFlipDate(e.target.value)}
                  className="font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>Flower weeks</Label>
                <div className="flex gap-2 flex-wrap">
                  {['7','8','9','10','11','12'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setFlowerWeeks(w)}
                      className="px-3 py-1.5 rounded-lg border text-sm font-mono"
                      style={{
                        background: flowerWeeks === w ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        borderColor: flowerWeeks === w ? 'var(--accent)' : 'var(--border)',
                        color: flowerWeeks === w ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      {w}w
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--text-secondary)' }}>Est. harvest date <span style={{ color: 'var(--text-muted)' }}>(optional override)</span></Label>
                <Input
                  type="date"
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="font-mono"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {flipDate && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                Calendar will auto-generate {parseInt(flowerWeeks) * 7 + 14} events from flip date.
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Medium */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label style={{ color: 'var(--text-secondary)' }}>Medium type</Label>
              <div className="flex flex-wrap gap-2">
                {MEDIUM_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMediumType(m)}
                    className="px-3 py-1.5 rounded-lg border text-sm"
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
              <Label style={{ color: 'var(--text-secondary)' }}>Container size (gallons)</Label>
              <Input
                type="number"
                step="0.5"
                placeholder="7"
                value={containerSize}
                onChange={(e) => setContainerSize(e.target.value)}
                className="font-mono w-32"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label style={{ color: 'var(--text-secondary)' }}>Mix breakdown <span style={{ color: 'var(--text-muted)' }}>(optional)</span></Label>
                <button
                  type="button"
                  onClick={() => setMediumIngredients((p) => [...p, { name: '', percentage: '' }])}
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'var(--accent)' }}
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              {mediumIngredients.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Ingredient (e.g. Perlite)"
                    value={ing.name}
                    onChange={(e) => {
                      const copy = [...mediumIngredients]
                      copy[i].name = e.target.value
                      setMediumIngredients(copy)
                    }}
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                  <Input
                    type="number"
                    placeholder="%"
                    value={ing.percentage}
                    onChange={(e) => {
                      const copy = [...mediumIngredients]
                      copy[i].percentage = e.target.value
                      setMediumIngredients(copy)
                    }}
                    className="font-mono w-20 shrink-0"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                  {mediumIngredients.length > 1 && (
                    <button type="button" onClick={() => setMediumIngredients((p) => p.filter((_, j) => j !== i))}>
                      <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: Environment targets */}
        {step === 4 && (
          <div className="space-y-5">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Set target ranges. Used to evaluate VPD and trigger alerts.
            </p>

            {[
              { label: 'Veg targets', tempDay: vegTempDay, setTempDay: setVegTempDay, tempNight: vegTempNight, setTempNight: setVegTempNight, rh: vegRh, setRh: setVegRh },
              { label: 'Flower targets (weeks 1–6)', tempDay: flowerTempDay, setTempDay: setFlowerTempDay, tempNight: flowerTempNight, setTempNight: setFlowerTempNight, rh: flowerRh, setRh: setFlowerRh },
            ].map(({ label, tempDay, setTempDay, tempNight, setTempNight, rh, setRh }) => (
              <div key={label} className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Day °F</Label>
                    <Input type="number" value={tempDay} onChange={(e) => setTempDay(e.target.value)} className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Night °F</Label>
                    <Input type="number" value={tempNight} onChange={(e) => setTempNight(e.target.value)} className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>RH %</Label>
                    <Input type="number" value={rh} onChange={(e) => setRh(e.target.value)} className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  </div>
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Late flower RH (weeks 6+)</p>
              <div className="w-32 space-y-1">
                <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>RH %</Label>
                <Input type="number" value={lateFlowerRh} onChange={(e) => setLateFlowerRh(e.target.value)} className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Recipe */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Pick a recipe from your library to follow during this grow. Skip to choose one later.
            </p>

            {/* Skip / none option */}
            <button
              type="button"
              onClick={() => setSelectedRecipeId('')}
              className="w-full text-left p-3 rounded-xl border text-sm transition-colors"
              style={{
                background:  !selectedRecipeId ? 'var(--surface-raised)' : 'transparent',
                borderColor: !selectedRecipeId ? 'var(--accent)' : 'var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              No recipe — freestyle it
            </button>

            {libraryRecipes.length === 0 ? (
              <div className="p-4 rounded-xl border text-center text-sm" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
                <p className="mb-2" style={{ color: 'var(--text-muted)' }}>Your library is empty.</p>
                <Link href="/recipes" className="text-xs underline" style={{ color: 'var(--accent)' }}>
                  Browse the recipe board →
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {libraryRecipes.map((recipe) => {
                  const selected = selectedRecipeId === recipe.id
                  const rating   = recipe.rating_avg ?? 0
                  const weeks    = [
                    recipe.veg_weeks    ? `${recipe.veg_weeks}V`   : null,
                    recipe.flower_weeks ? `${recipe.flower_weeks}F` : null,
                  ].filter(Boolean).join('+')
                  return (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => setSelectedRecipeId(recipe.id)}
                      className="w-full text-left p-3 rounded-xl border transition-colors"
                      style={{
                        background:  selected ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        borderColor: selected ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                            {recipe.title}
                          </div>
                          {recipe.genetics?.strain && (
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {recipe.genetics.strain}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {rating > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Star className="w-3 h-3" style={{ fill: '#f59e0b', color: '#f59e0b' }} />
                                {rating.toFixed(1)}
                              </span>
                            )}
                            {weeks && <span className="font-mono">{weeks}</span>}
                            {recipe.tags.slice(0, 2).map(t => (
                              <span key={t} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>{t}</span>
                            ))}
                          </div>
                        </div>
                        {selected && (
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(231,111,81,0.1)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between mt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => step > 0 ? setStep(step - 1) : router.back()}
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>

        {step < totalSteps - 1 ? (
          <Button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            Continue
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            {loading ? 'Creating…' : 'Create Grow'}
            <Leaf className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
