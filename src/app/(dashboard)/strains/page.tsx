'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Leaf, Plus, Search, X, ChevronRight, Dna,
  FlaskConical, Eye, EyeOff, Star, Trophy
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Genetics } from '@/types/database'

const GENETICS_TYPES = ['indica', 'sativa', 'hybrid', 'auto'] as const

function TypeBadge({ type }: { type: string | null }) {
  const colors: Record<string, string> = {
    indica: '#818cf8', sativa: 'var(--accent)', hybrid: 'var(--gold)', auto: 'var(--warning)',
  }
  if (!type) return null
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded capitalize"
      style={{ background: `${colors[type] ?? 'var(--border)'}22`, color: colors[type] ?? 'var(--text-muted)' }}>
      {type}
    </span>
  )
}

export default function StrainsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [strains, setStrains]   = useState<Genetics[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)

  // Form state
  const [name, setName]         = useState('')
  const [breeder, setBreeder]   = useState('')
  const [genType, setGenType]   = useState<string>('')
  const [lineage, setLineage]   = useState('')
  const [thc, setThc]           = useState('')
  const [phenoNotes, setPhenoNotes] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isCloneOnly, setIsCloneOnly] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('genetics')
      .select('*')
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .order('strain_name', { ascending: true })
    setStrains((data ?? []) as Genetics[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return strains.filter(s => {
      if (typeFilter && s.type !== typeFilter) return false
      if (q && !s.strain_name.toLowerCase().includes(q) && !(s.breeder ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [strains, query, typeFilter])

  function resetForm() {
    setName(''); setBreeder(''); setGenType(''); setLineage('')
    setThc(''); setPhenoNotes(''); setIsPublic(false); setIsCloneOnly(false)
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data } = await supabase
      .from('genetics')
      .insert([{
        user_id: user.id,
        strain_name: name.trim(),
        breeder: breeder.trim() || null,
        type: (genType as Genetics['type']) || null,
        lineage: lineage.trim() || null,
        thc_percentage: thc ? parseFloat(thc) : null,
        phenotype_notes: phenoNotes.trim() || null,
        is_public: isPublic,
        is_clone_only: isCloneOnly,
        terpene_profile: [],
      } as never])
      .select()
      .single()

    if (data) {
      setStrains(p => [data as Genetics, ...p].sort((a, b) => a.strain_name.localeCompare(b.strain_name)))
      resetForm()
      setAdding(false)
    }
    setSaving(false)
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Strain Library</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {strains.length} strain{strains.length !== 1 ? 's' : ''} in your library
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/strains/leaderboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <Trophy className="w-4 h-4" style={{ color: 'var(--gold)' }} /> Leaderboard
          </Link>
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Strain
          </Button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>New Strain</span>
            <button onClick={() => { resetForm(); setAdding(false) }}>
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Strain name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Blue Dream"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Breeder</Label>
              <Input value={breeder} onChange={e => setBreeder(e.target.value)} placeholder="Barneys Farm"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Type</Label>
              <div className="flex gap-2 flex-wrap">
                {GENETICS_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setGenType(genType === t ? '' : t)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all"
                    style={{
                      background: genType === t ? 'var(--accent-muted)' : 'var(--surface-raised)',
                      borderColor: genType === t ? 'var(--accent)' : 'var(--border)',
                      color: genType === t ? 'var(--accent)' : 'var(--text-secondary)',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>THC %</Label>
              <Input type="number" step="0.5" placeholder="22" value={thc} onChange={e => setThc(e.target.value)}
                className="font-mono"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Lineage</Label>
            <Input value={lineage} onChange={e => setLineage(e.target.value)} placeholder="OG Kush × Blueberry"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-muted)' }}>Phenotype notes</Label>
            <textarea rows={2} value={phenoNotes} onChange={e => setPhenoNotes(e.target.value)}
              placeholder="Growth characteristics, known phenos, what to watch for…"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
              style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="flex items-center gap-4">
            {[
              { label: 'Clone only', val: isCloneOnly, set: setIsCloneOnly },
              { label: 'Share publicly', val: isPublic, set: setIsPublic },
            ].map(({ label, val, set }) => (
              <button key={label} type="button" onClick={() => set(!val)}
                className="flex items-center gap-2 text-sm"
                style={{ color: val ? 'var(--accent)' : 'var(--text-muted)' }}>
                <div className="w-4 h-4 rounded border flex items-center justify-center transition-all"
                  style={{ borderColor: val ? 'var(--accent)' : 'var(--border)', background: val ? 'var(--accent)' : 'transparent' }}>
                  {val && <span className="text-[10px] text-[#0a0f0d] font-bold">✓</span>}
                </div>
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { resetForm(); setAdding(false) }} style={{ color: 'var(--text-muted)' }}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim()} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {saving ? 'Saving…' : 'Save Strain'}
            </Button>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search strains…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>
        <div className="flex gap-1.5">
          {(['', ...GENETICS_TYPES] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
              className="px-3 py-2 rounded-lg text-xs font-medium border capitalize transition-all"
              style={{
                background: typeFilter === t ? 'var(--accent-muted)' : 'var(--surface)',
                borderColor: typeFilter === t ? 'var(--accent)' : 'var(--border)',
                color: typeFilter === t ? 'var(--accent)' : 'var(--text-secondary)',
              }}>
              {t === '' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Dna className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            {query || typeFilter ? 'No strains match your filter.' : 'No strains in your library yet.'}
          </p>
          {!query && !typeFilter && (
            <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add your first strain
            </Button>
          )}
        </div>
      )}

      {/* Strain list */}
      <div className="space-y-2">
        {filtered.map(strain => (
          <Link key={strain.id} href={`/strains/${strain.id}`}
            className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors hover:border-[--accent]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--surface-raised)' }}
            >
              <Leaf className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{strain.strain_name}</span>
                <TypeBadge type={strain.type} />
                {strain.is_clone_only && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>clone only</span>
                )}
                {strain.is_public && (
                  <Eye className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {strain.breeder && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{strain.breeder}</span>
                )}
                {strain.lineage && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {strain.lineage}</span>
                )}
                {strain.thc_percentage !== null && (
                  <span className="text-xs font-mono" style={{ color: 'var(--gold)' }}>
                    THC {strain.thc_percentage}%
                  </span>
                )}
              </div>
              {strain.phenotype_notes && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {strain.phenotype_notes}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
