'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Star, X, Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EquipmentProfile, TentRole } from '@/types/database'

const LIGHT_TYPES = ['LED', 'HPS', 'CMH/LEC', 'T5/HO', 'CFL', 'Other']
const MEDIUM_TYPES = ['Living Soil', 'Coco Coir', 'Pro-Mix / Peat', 'Rockwool', 'DWC Hydro', 'Aeroponics', 'Other']
const ROLES: { value: TentRole; label: string; color: string }[] = [
  { value: 'veg',    label: 'Veg',    color: '#52B788' },
  { value: 'flower', label: 'Flower', color: '#9B5DE5' },
  { value: 'both',   label: 'Veg + Flower', color: '#6b8f7b' },
]

type FormState = {
  name: string
  role: TentRole
  tent_width_ft: string
  tent_length_ft: string
  tent_height_ft: string
  light_type: string
  light_wattage: string
  light_brand: string
  medium_type: string
  pot_size_gal: string
  max_plants: string
  notes: string
  is_default: boolean
}

const EMPTY_FORM: FormState = {
  name: '', role: 'both', tent_width_ft: '', tent_length_ft: '', tent_height_ft: '',
  light_type: '', light_wattage: '', light_brand: '',
  medium_type: '', pot_size_gal: '', max_plants: '',
  notes: '', is_default: false,
}

function profileToForm(p: EquipmentProfile): FormState {
  return {
    name:           p.name,
    role:           p.role ?? 'both',
    tent_width_ft:  p.tent_width_ft?.toString() ?? '',
    tent_length_ft: p.tent_length_ft?.toString() ?? '',
    tent_height_ft: p.tent_height_ft?.toString() ?? '',
    light_type:     p.light_type ?? '',
    light_wattage:  p.light_wattage?.toString() ?? '',
    light_brand:    p.light_brand ?? '',
    medium_type:    p.medium_type ?? '',
    pot_size_gal:   p.pot_size_gal?.toString() ?? '',
    max_plants:     p.max_plants?.toString() ?? '',
    notes:          p.notes ?? '',
    is_default:     p.is_default,
  }
}

export default function EquipmentPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<EquipmentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('equipment_profiles').select('*').order('created_at', { ascending: true })
    setProfiles((data ?? []) as EquipmentProfile[])
    setLoading(false)
  }

  function startNew() {
    setForm(EMPTY_FORM)
    setEditing('new')
  }

  function startEdit(p: EquipmentProfile) {
    setForm(profileToForm(p))
    setEditing(p.id)
  }

  function cancel() { setEditing(null) }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      user_id:        user.id,
      name:           form.name.trim(),
      role:           form.role,
      tent_width_ft:  form.tent_width_ft  ? parseFloat(form.tent_width_ft)  : null,
      tent_length_ft: form.tent_length_ft ? parseFloat(form.tent_length_ft) : null,
      tent_height_ft: form.tent_height_ft ? parseFloat(form.tent_height_ft) : null,
      usable_sqft:    (form.tent_width_ft && form.tent_length_ft)
                        ? parseFloat(form.tent_width_ft) * parseFloat(form.tent_length_ft)
                        : null,
      light_type:     form.light_type  || null,
      light_wattage:  form.light_wattage  ? parseFloat(form.light_wattage)  : null,
      light_brand:    form.light_brand || null,
      medium_type:    form.medium_type || null,
      pot_size_gal:   form.pot_size_gal   ? parseFloat(form.pot_size_gal)   : null,
      max_plants:     form.max_plants     ? parseInt(form.max_plants)        : null,
      notes:          form.notes.trim() || null,
      is_default:     form.is_default,
    }

    if (editing === 'new') {
      const { data, error } = await supabase.from('equipment_profiles').insert([payload as never]).select().single()
      if (!error && data) setProfiles(p => [...p, data as EquipmentProfile])
    } else {
      const { data, error } = await supabase.from('equipment_profiles').update(payload as never).eq('id', editing!).select().single()
      if (!error && data) setProfiles(p => p.map(x => x.id === editing ? data as EquipmentProfile : x))
    }

    // If setting as default, clear others
    if (form.is_default && editing !== 'new') {
      await supabase.from('equipment_profiles').update({ is_default: false } as never)
        .neq('id', editing!).eq('user_id', user.id)
      setProfiles(p => p.map(x => x.id === editing ? x : { ...x, is_default: false }))
    }

    setSaving(false)
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    await supabase.from('equipment_profiles').delete().eq('id', id)
    setProfiles(p => p.filter(x => x.id !== id))
  }

  async function setDefault(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('equipment_profiles').update({ is_default: false } as never).eq('user_id', user.id)
    await supabase.from('equipment_profiles').update({ is_default: true } as never).eq('id', id)
    setProfiles(p => p.map(x => ({ ...x, is_default: x.id === id })))
  }

  function f(key: keyof FormState, val: string | boolean) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Equipment</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Manage your tents and grow spaces
          </p>
        </div>
        {editing !== 'new' && (
          <Button
            onClick={startNew}
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Equipment
          </Button>
        )}
      </div>

      {/* New form */}
      {editing === 'new' && (
        <ProfileForm
          form={form}
          onChange={f}
          onSave={save}
          onCancel={cancel}
          saving={saving}
          isNew
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {/* Empty state */}
      {!loading && profiles.length === 0 && editing !== 'new' && (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <Zap className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>No equipment yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Add your grow tents and spaces
          </p>
          <Button onClick={startNew} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Equipment
          </Button>
        </div>
      )}

      {/* Profile cards */}
      <div className="space-y-4">
        {profiles.map(p => (
          <div
            key={p.id}
            className="rounded-xl border overflow-hidden"
            style={{
              borderColor: p.is_default ? 'var(--accent)' : 'var(--border)',
              background: 'var(--surface)',
            }}
          >
            {editing === p.id ? (
              <ProfileForm
                form={form}
                onChange={f}
                onSave={save}
                onCancel={cancel}
                saving={saving}
                isNew={false}
              />
            ) : (
              <ProfileCard
                profile={p}
                onEdit={() => startEdit(p)}
                onDelete={() => remove(p.id)}
                onSetDefault={() => setDefault(p.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProfileCard({
  profile: p,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  profile: EquipmentProfile
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  const sqft = p.tent_width_ft && p.tent_length_ft
    ? (p.tent_width_ft * p.tent_length_ft).toFixed(1)
    : null

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{p.name}</span>
            {(() => {
              const r = ROLES.find(x => x.value === (p.role ?? 'both')) ?? ROLES[2]
              return (
                <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: `${r.color}22`, color: r.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} /> {r.label}
                </span>
              )
            })()}
            {p.is_default && (
              <span
                className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                <Star className="w-2.5 h-2.5" fill="currentColor" /> Default
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!p.is_default && (
            <button
              onClick={onSetDefault}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
              title="Set as default"
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: 'rgba(231,111,81,0.1)', color: 'var(--danger)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(p.tent_width_ft && p.tent_length_ft) && (
          <Stat
            label="Tent"
            value={`${p.tent_width_ft}×${p.tent_length_ft}${p.tent_height_ft ? `×${p.tent_height_ft}` : ''}ft`}
            sub={sqft ? `${sqft} sqft` : undefined}
          />
        )}
        {p.light_type && (
          <Stat
            label="Light"
            value={p.light_type}
            sub={[p.light_wattage ? `${p.light_wattage}W` : null, p.light_brand].filter(Boolean).join(' · ') || undefined}
          />
        )}
        {p.medium_type && (
          <Stat label="Medium" value={p.medium_type} />
        )}
        {p.max_plants && (
          <Stat
            label="Capacity"
            value={`${p.max_plants} plants`}
            sub={p.pot_size_gal ? `${p.pot_size_gal} gal pots` : undefined}
          />
        )}
      </div>

      {p.notes && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{p.notes}</p>
      )}
    </div>
  )
}

function ProfileForm({
  form, onChange, onSave, onCancel, saving, isNew,
}: {
  form: FormState
  onChange: (key: keyof FormState, val: string | boolean) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  return (
    <div className="p-4 space-y-4 rounded-xl border" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {isNew ? 'New Equipment Profile' : 'Edit Profile'}
        </span>
        <button onClick={onCancel}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
      </div>

      <div className="space-y-1.5">
        <Label style={{ color: 'var(--text-secondary)' }}>Name <span style={{ color: 'var(--danger)' }}>*</span></Label>
        <Input
          placeholder="e.g. Flower Tent A"
          value={form.name}
          onChange={e => onChange('name', e.target.value)}
          autoFocus
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </div>

      <div className="space-y-1.5">
        <Label style={{ color: 'var(--text-secondary)' }}>Tent role</Label>
        <div className="flex gap-2">
          {ROLES.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange('role', r.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5"
              style={{
                background:  form.role === r.value ? `${r.color}22` : 'transparent',
                borderColor: form.role === r.value ? r.color : 'var(--border)',
                color:       form.role === r.value ? r.color : 'var(--text-muted)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Used by the pipeline to route plants from veg → flower
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Tent Dimensions (ft)</p>
        <div className="grid grid-cols-3 gap-2">
          {(['tent_width_ft', 'tent_length_ft', 'tent_height_ft'] as const).map((key, i) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>{['Width', 'Length', 'Height'][i]}</Label>
              <Input
                type="number"
                step="0.5"
                placeholder={['3', '3', '6'][i]}
                value={form[key]}
                onChange={e => onChange(key, e.target.value)}
                className="font-mono"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Light</p>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {LIGHT_TYPES.map(lt => (
              <button
                key={lt}
                type="button"
                onClick={() => onChange('light_type', form.light_type === lt ? '' : lt)}
                className="px-2.5 py-1 rounded-lg text-xs border"
                style={{
                  background:  form.light_type === lt ? 'var(--accent-muted)' : 'transparent',
                  borderColor: form.light_type === lt ? 'var(--accent)' : 'var(--border)',
                  color:       form.light_type === lt ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >{lt}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Wattage</Label>
              <Input type="number" placeholder="600" value={form.light_wattage} onChange={e => onChange('light_wattage', e.target.value)} className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Brand</Label>
              <Input placeholder="Mars Hydro" value={form.light_brand} onChange={e => onChange('light_brand', e.target.value)} style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Medium & Containers</p>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {MEDIUM_TYPES.map(mt => (
              <button
                key={mt}
                type="button"
                onClick={() => onChange('medium_type', form.medium_type === mt ? '' : mt)}
                className="px-2.5 py-1 rounded-lg text-xs border"
                style={{
                  background:  form.medium_type === mt ? 'var(--accent-muted)' : 'transparent',
                  borderColor: form.medium_type === mt ? 'var(--accent)' : 'var(--border)',
                  color:       form.medium_type === mt ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >{mt}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Pot size (gal)</Label>
              <Input type="number" step="0.5" placeholder="7" value={form.pot_size_gal} onChange={e => onChange('pot_size_gal', e.target.value)} className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Max plants</Label>
              <Input type="number" placeholder="4" value={form.max_plants} onChange={e => onChange('max_plants', e.target.value)} className="font-mono" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label style={{ color: 'var(--text-secondary)' }}>Notes</Label>
        <textarea
          rows={2}
          placeholder="Any additional details…"
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
          className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange('is_default', !form.is_default)}
          className="w-4 h-4 rounded border flex items-center justify-center"
          style={{
            background:  form.is_default ? 'var(--accent)' : 'transparent',
            borderColor: form.is_default ? 'var(--accent)' : 'var(--border)',
          }}
        >
          {form.is_default && <Check className="w-3 h-3 text-black" />}
        </button>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Set as default space</span>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" onClick={onCancel} style={{ color: 'var(--text-muted)' }}>Cancel</Button>
        <Button onClick={onSave} disabled={saving || !form.name.trim()} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}
