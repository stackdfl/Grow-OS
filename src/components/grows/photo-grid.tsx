'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  urls: string[]
  maxVisible?: number
}

export function PhotoGrid({ urls, maxVisible = 4 }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const visible = urls.slice(0, maxVisible)
  const overflow = urls.length - maxVisible

  const prev = useCallback(() => {
    setLightbox(i => (i === null ? null : (i - 1 + urls.length) % urls.length))
  }, [urls.length])

  const next = useCallback(() => {
    setLightbox(i => (i === null ? null : (i + 1) % urls.length))
  }, [urls.length])

  useEffect(() => {
    if (lightbox === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, prev, next])

  if (urls.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {visible.map((url, i) => (
          <button key={url} type="button" onClick={() => setLightbox(i)} className="relative">
            <img
              src={url}
              alt=""
              className="w-16 h-16 object-cover rounded-lg"
              style={{ border: '1px solid var(--border)' }}
            />
            {i === maxVisible - 1 && overflow > 0 && (
              <div className="absolute inset-0 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.55)' }}>
                <span className="text-sm font-bold text-white">+{overflow}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Prev */}
          {urls.length > 1 && (
            <button
              className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              onClick={e => { e.stopPropagation(); prev() }}
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}

          <img
            src={urls[lightbox]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />

          {/* Next */}
          {urls.length > 1 && (
            <button
              className="absolute right-4 w-10 h-10 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)' }}
              onClick={e => { e.stopPropagation(); next() }}
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
            {lightbox + 1} / {urls.length}
          </div>
        </div>
      )}
    </>
  )
}
