'use client'

import { useMemo, useRef, useEffect } from 'react'
import { addDays, differenceInDays, format, startOfDay, startOfMonth, eachMonthOfInterval } from 'date-fns'
import type { Grow } from '@/types/database'
import {
  resolveDates, getGrowEvents, getStageAtDate, STAGE_COLOR, EVENT_META,
  type PipelineStage,
} from '@/lib/pipeline/stages'

const DAY_PX = 5            // horizontal px per day
const ROW_H = 34
const LABEL_W = 116

interface Props {
  grows: Grow[]
  daysOffset: number
  minDays: number
  maxDays: number
  selectedGrowId: string | null
  onSelectGrow: (id: string | null) => void
}

export function GanttStrip({ grows, daysOffset, minDays, maxDays, selectedGrowId, onSelectGrow }: Props) {
  const today = startOfDay(new Date())
  const rangeStart = addDays(today, minDays)
  const rangeEnd = addDays(today, maxDays)
  const totalDays = maxDays - minDays
  const trackW = totalDays * DAY_PX
  const scrollRef = useRef<HTMLDivElement>(null)

  const dayToX = (d: Date) => (differenceInDays(startOfDay(d), rangeStart)) * DAY_PX

  const months = useMemo(
    () => eachMonthOfInterval({ start: startOfMonth(rangeStart), end: rangeEnd }),
    [rangeStart.getTime(), rangeEnd.getTime()]
  )

  const playheadX = (daysOffset - minDays) * DAY_PX

  // Keep the playhead roughly centered as the user scrubs
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = playheadX - el.clientWidth / 2
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [playheadX])

  // Sort grows by their start so the chart reads top-to-bottom in time
  const sorted = useMemo(() => {
    return [...grows].sort((a, b) => {
      const da = resolveDates(a).clone ?? resolveDates(a).flip ?? new Date(8.64e15)
      const db = resolveDates(b).clone ?? resolveDates(b).flip ?? new Date(8.64e15)
      return da.getTime() - db.getTime()
    })
  }, [grows])

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex">
        {/* Fixed label column */}
        <div className="shrink-0 border-r" style={{ width: LABEL_W, borderColor: 'var(--border)' }}>
          <div className="h-6 border-b" style={{ borderColor: 'var(--border)' }} />
          {sorted.map(g => (
            <button
              key={g.id}
              onClick={() => onSelectGrow(selectedGrowId === g.id ? null : g.id)}
              className="flex flex-col justify-center px-3 w-full text-left border-b transition-colors"
              style={{
                height: ROW_H,
                borderColor: 'var(--border)',
                background: selectedGrowId === g.id ? 'var(--accent-muted)' : 'transparent',
              }}
            >
              <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{g.name}</span>
              {g.genetics?.strain_name && (
                <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{g.genetics.strain_name}</span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="overflow-x-auto flex-1">
          <div className="relative" style={{ width: trackW }}>
            {/* Month axis */}
            <div className="h-6 border-b relative" style={{ borderColor: 'var(--border)' }}>
              {months.map((m, i) => {
                const x = dayToX(m)
                if (x < 0 || x > trackW) return null
                return (
                  <div key={i} className="absolute top-0 h-full flex items-center" style={{ left: x }}>
                    <div className="h-full w-px" style={{ background: 'var(--border)' }} />
                    <span className="text-[10px] font-mono pl-1" style={{ color: 'var(--text-muted)' }}>
                      {format(m, 'MMM')}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Rows */}
            {sorted.map(g => (
              <GrowBar
                key={g.id}
                grow={g}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                dayToX={dayToX}
                selected={selectedGrowId === g.id}
                onClick={() => onSelectGrow(selectedGrowId === g.id ? null : g.id)}
              />
            ))}

            {/* Today line */}
            {0 >= minDays && 0 <= maxDays && (
              <div
                className="absolute top-6 bottom-0 w-px pointer-events-none"
                style={{ left: (0 - minDays) * DAY_PX, background: 'var(--text-muted)', opacity: 0.35 }}
              />
            )}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
              style={{ left: playheadX, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function GrowBar({ grow, rangeStart, rangeEnd, dayToX, selected, onClick }: {
  grow: Grow
  rangeStart: Date
  rangeEnd: Date
  dayToX: (d: Date) => number
  selected: boolean
  onClick: () => void
}) {
  const { clone, veg, flip, harvest, harvestEstimated } = resolveDates(grow)

  // Build colored segments [start,end,stage]
  const segments: { from: Date; to: Date; stage: PipelineStage }[] = []
  const startPt = clone ?? veg ?? (flip ? addDays(flip, -28) : null)
  const endPt = harvest ?? (flip ? addDays(flip, 63) : null)

  if (startPt && endPt) {
    // Walk day-buckets at stage boundaries
    const bounds: { d: Date }[] = [{ d: startPt }]
    if (veg && veg > startPt) bounds.push({ d: veg })
    if (flip && flip > startPt) bounds.push({ d: flip })
    bounds.push({ d: endPt })
    const uniq = bounds
      .map(b => b.d)
      .sort((a, b) => a.getTime() - b.getTime())
      .filter((d, i, arr) => i === 0 || d.getTime() !== arr[i - 1].getTime())

    for (let i = 0; i < uniq.length - 1; i++) {
      const from = uniq[i]
      const to = uniq[i + 1]
      const midStage = getStageAtDate(grow, addDays(from, Math.max(1, Math.floor(differenceInDays(to, from) / 2))))
      segments.push({ from, to, stage: midStage })
    }
  }

  const events = getGrowEvents(grow)
  const clamp = (d: Date) => new Date(Math.max(rangeStart.getTime(), Math.min(rangeEnd.getTime(), d.getTime())))

  return (
    <div
      onClick={onClick}
      className="relative border-b cursor-pointer"
      style={{ height: ROW_H, borderColor: 'var(--border)', background: selected ? 'rgba(82,183,136,0.05)' : 'transparent' }}
    >
      {/* Segments */}
      {segments.map((seg, i) => {
        const x1 = dayToX(clamp(seg.from))
        const x2 = dayToX(clamp(seg.to))
        const w = Math.max(0, x2 - x1)
        if (w <= 0) return null
        return (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: x1,
              top: ROW_H / 2 - 5,
              width: w,
              height: 10,
              background: STAGE_COLOR[seg.stage],
              opacity: 0.85,
            }}
          />
        )
      })}

      {/* Estimated tail (dotted) when harvest is a guess */}
      {harvestEstimated && flip && harvest && (
        <div
          className="absolute"
          style={{
            left: dayToX(clamp(flip)),
            top: ROW_H / 2 - 1,
            width: Math.max(0, dayToX(clamp(harvest)) - dayToX(clamp(flip))),
            height: 2,
            backgroundImage: 'repeating-linear-gradient(90deg, var(--text-muted) 0 3px, transparent 3px 6px)',
            opacity: 0.4,
          }}
        />
      )}

      {/* Event markers */}
      {events.map((ev, i) => {
        const d = startOfDay(ev.date)
        if (d < rangeStart || d > rangeEnd) return null
        const x = dayToX(d)
        return (
          <div
            key={i}
            className="absolute -translate-x-1/2 flex items-center justify-center pointer-events-none"
            style={{ left: x, top: ROW_H / 2 - 8, width: 16, height: 16 }}
            title={`${ev.label} — ${format(ev.date, 'MMM d')}`}
          >
            <span style={{ fontSize: 11, lineHeight: 1, filter: 'saturate(1.4)' }}>{EVENT_META[ev.type].icon}</span>
          </div>
        )
      })}
    </div>
  )
}
