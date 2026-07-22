'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft } from 'lucide-react'
import { PhotoUploader } from '@/components/grows/photo-uploader'
import { PREFIXES } from '@/lib/community/prefixes'
import { toast } from 'sonner'

interface Cat { id: string; slug: string; name: string }

function NewThreadForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const [userId, setUserId] = useState('')
  const [cats, setCats] = useState<Cat[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [prefix, setPrefix] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase.from('forum_categories').select('id, slug, name').is('parent_id', null).order('sort_order')
      const list = (data ?? []) as Cat[]
      setCats(list)
      const wanted = params.get('category')
      setCategoryId((wanted && list.find(c => c.slug === wanted)?.id) || list[0]?.id || '')
    })()
  }, [])

  async function submit() {
    if (!title.trim()) { toast.error('Add a title'); return }
    if (!categoryId) { toast.error('Pick a category'); return }
    setSaving(true)
    const cat = cats.find(c => c.id === categoryId)
    const { data, error } = await supabase.from('community_posts').insert([{
      author_id: userId, category: cat?.slug ?? 'lounge', category_id: categoryId,
      prefix: prefix || null, title: title.trim(), body: body.trim(), photos,
      last_activity_at: new Date().toISOString(),
    } as never]).select('id').single()
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Thread posted')
    router.push(`/canopy/post/${(data as { id: string }).id}`)
  }

  const inputStyle = { background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div className="px-4 md:px-6 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/canopy" style={{ color: 'var(--text-muted)' }}><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>New thread</h1>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Prefix (optional)</label>
            <select value={prefix} onChange={e => setPrefix(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
              <option value="">— None —</option>
              {PREFIXES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
          className="w-full px-3 py-2.5 rounded-lg text-base font-medium outline-none" style={inputStyle} />

        <div>
          <textarea rows={9} value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your post… Markdown supported — **bold**, `code`, > quotes, lists, ||spoilers||, @mentions"
            className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Markdown supported · ||text|| for spoilers · @username to mention
          </p>
        </div>

        {userId && <PhotoUploader userId={userId} growId="forum" onUploaded={setPhotos} />}

        <div className="flex justify-end gap-2">
          <Link href="/canopy" className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</Link>
          <button onClick={submit} disabled={saving || !title.trim()}
            className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
            {saving ? 'Posting…' : 'Post thread'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewThreadPage() {
  return <Suspense><NewThreadForm /></Suspense>
}
