'use client'

import { useRef, useCallback } from 'react'
import { addDays, format, differenceInDays, startOfDay } from 'date-fns'
import { EVENT_META, type PipelineEvent } from '@/lib/pipeline/stages'

interface Props {
  daysOffset: number
  setDaysOffset: (n: number) => void
  minDays: number
  maxDays: number
  events: PipelineEvent[]
}

export function TimeScrubber({ daysOffset, setDaysOffset, minDays, maxDays, events }: Props) {
  const today = startOfDay(new Date())
  const viewDate = addDays(today, daysOffset)
  const trackRef = useRef<HTMLDivElement>(null)
  const span = maxDays - minDays

  const pct = ((daysOffset - minDays) / span) * 100

  // Map each event to a 0..100 position on the track
  const ticks = events
    .map(ev => {
      const off = differenceInDays(startOfDay(ev.date), today)
      return { ev, off, p: ((off - minDays) / span) * 100 }
    })
    .filter(t => t.off >= minDays && t.off <= maxDays)

  const setFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    setDaysOffset(Math.round(minDays + ratio * span))
  }, [minDays, span, setDaysOffset])

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0) return
    setFromClientX(e.clientX)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setDaysOffset(Math.min(maxDays, daysOffset + (e.shiftKey ? 7 : 1))) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setDaysOffset(Math.max(minDays, daysOffset - (e.shiftKey ? 7 : 1))) }
    if (e.key === 'Home')       { e.preventDefault(); setDaysOffset(0) }
  }

  const relLabel =
    daysOffset === 0 ? 'Today'
    : daysOffset > 0 ? `+${daysOffset}d`
    : `${daysOffset}d`

  return (
    <div className="select-none">
      {/* Date read-out */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setDaysOffset(0)}
          className="text-xs px-2.5 py-1 rounded-md border transition-colors"
          style={{
            borderColor: daysOffset === 0 ? 'var(--accent)' : 'var(--border)',
            color: daysOffset === 0 ? 'var(--accent)' : 'var(--text-muted)',
            background: daysOffset === 0 ? 'var(--accent-muted)' : 'transparent',
          }}
        >
          Today
        </button>
        <div className="text-center">
          <div className="text-base font-bold font-mono" style={{ color: 'var(--text)' }}>
            {format(viewDate, 'EEE, MMM d yyyy')}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{relLabel}</div>
        </div>
        <div className="flex gap-1">
          <ArrowBtn label="−7d" onClick={() => setDaysOffset(Math.max(minDays, daysOffset - 7))} />
          <ArrowBtn label="+7d" onClick={() => setDaysOffset(Math.min(maxDays, daysOffset + 7))} />
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={minDays}
        aria-valuemax={maxDays}
        aria-valuenow={daysOffset}
        aria-label="Scrub through time"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="relative h-12 rounded-lg cursor-pointer outline-none"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
      >
        {/* Event density ticks */}
        {ticks.map((t, i) => (
          <div
            key={i}
            className="absolute bottom-1 w-[2px] rounded-full pointer-events-none"
            style={{
              left: `${t.p}%`,
              height: t.ev.type === 'harvest' ? 22 : t.ev.type === 'flip' ? 18 : 13,
              background: t.ev.color,
              opacity: 0.85,
              transform: 'translateX(-1px)',
            }}
            title={`${EVENT_META[t.ev.type].icon} ${t.ev.label} — ${format(t.ev.date, 'MMM d')}`}
          />
        ))}

        {/* Today marker (offset 0) */}
        {0 >= minDays && 0 <= maxDays && (
          <div
            className="absolute top-0 bottom-0 w-px pointer-events-none"
            style={{ left: `${((0 - minDays) / span) * 100}%`, background: 'var(--text-muted)', opacity: 0.4 }}
          />
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        >
          <div className="w-0.5 h-full" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
          <div
            className="absolute top-1/2 left-1/2 w-3.5 h-3.5 rounded-full"
            style={{
              transform: 'translate(-50%,-50%)',
              background: 'var(--accent)',
              boxShadow: '0 0 10px var(--accent)',
              border: '2px solid var(--bg)',
            }}
          />
        </div>
      </div>

      {/* Axis labels */}
      <div className="flex justify-between mt-1.5 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
        <span>{format(addDays(today, minDays), 'MMM d')}</span>
        <span>{format(addDays(today, Math.round((minDays + maxDays) / 2)), 'MMM yyyy')}</span>
        <span>{format(addDays(today, maxDays), 'MMM d')}</span>
      </div>
    </div>
  )
}

function ArrowBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded-md border transition-colors font-mono"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    >
      {label}
    </button>
  )
}
