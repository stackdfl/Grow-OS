'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, X, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  growId: string
  onUploaded: (urls: string[]) => void
  existingUrls?: string[]
}

export function PhotoUploader({ userId, growId, onUploaded, existingUrls = [] }: Props) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>(existingUrls)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(files: FileList) {
    const newUrls: string[] = []
    setUploading(true)
    setError('')

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large (max 10MB)`)
        continue
      }
      if (!file.type.startsWith('image/')) continue

      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/${growId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { data, error: uploadErr } = await supabase.storage
        .from('grow-photos')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (uploadErr) { setError(uploadErr.message); continue }

      const { data: urlData } = supabase.storage.from('grow-photos').getPublicUrl(data.path)
      newUrls.push(urlData.publicUrl)
    }

    const all = [...previews, ...newUrls]
    setPreviews(all)
    onUploaded(all)
    setUploading(false)
  }

  function remove(url: string) {
    const next = previews.filter(u => u !== url)
    setPreviews(next)
    onUploaded(next)
  }

  return (
    <div className="space-y-2">
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map(url => (
            <div key={url} className="relative group w-20 h-20">
              <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.7)' }}
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-50"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface-raised)' }}
      >
        {uploading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
          : <><Camera className="w-4 h-4" /> Add photos</>}
      </button>

      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}
