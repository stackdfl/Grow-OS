'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, DollarSign, Plus, X, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Category = 'nutrients' | 'medium' | 'genetics' | 'equipment' | 'electricity' | 'other'

interface Expense {
  id: string
  expense_date: string
  category: Category
  item_name: string
  amount_usd: number
  notes: string | null
}

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'nutrients',    label: 'Nutrients',   color: 'var(--accent)' },
  { value: 'medium',      label: 'Medium',      color: '#8b5cf6' },
  { value: 'genetics',    label: 'Genetics',    color: '#ec4899' },
  { value: 'equipment',   label: 'Equipment',   color: '#f59e0b' },
  { value: 'electricity', label: 'Electricity', color: '#3b82f6' },
  { value: 'other',       label: 'Other',       color: 'var(--text-muted)' },
]

function catColor(cat: Category) {
  return CATEGORIES.find(c => c.value === cat)?.color ?? 'var(--text-muted)'
}
function catLabel(cat: Category) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

export default function GrowCostsPage() {
  const { id: growId } = useParams<{ id: string }>()
  const supabase = createClient()

  const [growName, setGrowName]     = useState('')
  const [plantCount, setPlantCount] = useState(1)
  const [expenses, setExpenses]     = useState<Expense[]>([])
  const [dryWeightG, setDryWeightG] = useState<number | null>(null)
  const [loading, setLoading]       = useState(true)

  // Form
  const [adding, setAdding]     = useState(false)
  const [date, setDate]         = useState(format(new Date(), 'yyyy-MM-dd'))
  const [category, setCategory] = useState<Category>('nutrients')
  const [itemName, setItemName] = useState('')
  const [amount, setAmount]     = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [growId])

  async function load() {
    const [growRes, expRes, harvestRes] = await Promise.all([
      supabase.from('grows').select('name, plant_count').eq('id', growId).single(),
      supabase.from('grow_expenses').select('*').eq('grow_id', growId).order('expense_date', { ascending: false }),
      supabase.from('harvest_reports').select('dry_weight_g').eq('grow_id', growId).maybeSingle(),
    ])
    if (growRes.data) {
      setGrowName(growRes.data.name ?? '')
      setPlantCount(growRes.data.plant_count ?? 1)
    }
    setExpenses((expRes.data ?? []) as Expense[])
    setDryWeightG(harvestRes.data?.dry_weight_g ?? null)
    setLoading(false)
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount_usd), 0)

  // Group by category
  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount_usd), 0),
  })).filter(c => c.total > 0)

  const costPerPlant = plantCount > 0 ? total / plantCount : null
  const dryWeightOz  = dryWeightG ? dryWeightG / 28.35 : null
  const costPerGram  = dryWeightG && dryWeightG > 0 ? total / dryWeightG : null
  const costPerOz    = dryWeightOz && dryWeightOz > 0 ? total / dryWeightOz : null

  async function submit() {
    const amt = parseFloat(amount)
    if (!itemName.trim() || isNaN(amt) || amt <= 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data, error } = await supabase
      .from('grow_expenses')
      .insert([{
        grow_id: growId,
        user_id: user.id,
        expense_date: date,
        category,
        item_name: itemName.trim(),
        amount_usd: amt,
        notes: notes.trim() || null,
      }])
      .select()
      .single()

    if (error) { toast.error(error.message); setSaving(false); return }
    if (data) {
      setExpenses(p => [data as Expense, ...p])
      setItemName(''); setAmount(''); setNotes('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setCategory('nutrients')
      setAdding(false)
      toast.success('Expense added')
    }
    setSaving(false)
  }

  async function remove(id: string) {
    await supabase.from('grow_expenses').delete().eq('id', id)
    setExpenses(p => p.filter(e => e.id !== id))
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/grows/${growId}`} style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {growName || 'Grow'} — Costs
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{expenses.length} expenses logged</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        )}
      </div>

      {/* Summary row */}
      {expenses.length > 0 && (
        <div className="rounded-xl border p-4 mb-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Total spent</p>
              <p className="text-xl font-bold font-mono" style={{ color: 'var(--accent)' }}>
                ${total.toFixed(2)}
              </p>
            </div>
            {costPerPlant !== null && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Per plant</p>
                <p className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>
                  ${costPerPlant.toFixed(2)}
                </p>
              </div>
            )}
            {costPerOz !== null && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Per oz</p>
                <p className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>
                  ${costPerOz.toFixed(2)}
                </p>
              </div>
            )}
            {costPerGram !== null && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Per gram</p>
                <p className="text-lg font-bold font-mono" style={{ color: 'var(--text)' }}>
                  ${costPerGram.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Category breakdown */}
          {byCategory.length > 1 && (
            <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              {byCategory.map(cat => (
                <div key={cat.value} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                  <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                  <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(cat.total / total) * 100}%`, background: cat.color }}
                    />
                  </div>
                  <span className="text-xs font-mono w-16 text-right" style={{ color: 'var(--text-muted)' }}>
                    ${cat.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border p-4 mb-5 space-y-3" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>New Expense</span>
            <button onClick={() => setAdding(false)}>
              <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Amount (USD)</label>
              <div className="flex items-center gap-1 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>$</span>
                <input type="number" min="0" step="0.01" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-sm outline-none font-mono"
                  style={{ color: 'var(--text)' }} />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Item</label>
            <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
              placeholder="e.g. GH Flora Series 3-part"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Category</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className="px-3 py-1 rounded-lg text-xs border"
                  style={{
                    background: category === cat.value ? `${cat.color}20` : 'transparent',
                    borderColor: category === cat.value ? cat.color : 'var(--border)',
                    color: category === cat.value ? cat.color : 'var(--text-muted)',
                  }}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Brand, quantity, where purchased…"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAdding(false)} style={{ color: 'var(--text-muted)' }}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !itemName.trim() || !amount}
              style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
              {saving ? 'Saving…' : 'Add Expense'}
            </Button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading…</div>}

      {!loading && expenses.length === 0 && !adding && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <TrendingDown className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No expenses logged yet</p>
          <Button onClick={() => setAdding(true)} style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            <Plus className="w-4 h-4 mr-1.5" /> Log first expense
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {expenses.map(exp => (
          <div key={exp.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: catColor(exp.category) }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{exp.item_name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${catColor(exp.category)}20`, color: catColor(exp.category) }}>
                  {catLabel(exp.category)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {format(parseISO(exp.expense_date + 'T12:00:00'), 'MMM d, yyyy')}
                </span>
                {exp.notes && (
                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{exp.notes}</span>
                )}
              </div>
            </div>
            <span className="text-sm font-bold font-mono shrink-0" style={{ color: 'var(--text)' }}>
              ${Number(exp.amount_usd).toFixed(2)}
            </span>
            <button onClick={() => remove(exp.id)} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        ))}
      </div>

      {!dryWeightG && expenses.length > 0 && (
        <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
          Log a harvest with dry weight to see cost per gram/oz
        </p>
      )}
    </div>
  )
}
