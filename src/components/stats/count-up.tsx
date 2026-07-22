'use client'

import { useEffect, useRef, useState } from 'react'

export function CountUp({ value, decimals = 0, duration = 1100 }: {
  value: number; decimals?: number; duration?: number
}) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    function tick(t: number) {
      if (startRef.current === null) startRef.current = t
      const p = Math.min(1, (t - startRef.current) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setDisplay(value * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <>{display.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>
}
