'use client'

import { useState, useMemo } from 'react'
import { Calculator, Thermometer, Droplets, FlaskConical } from 'lucide-react'

// SVP at temperature in Celsius
function svp(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}
function fToC(f: number): number { return (f - 32) / 1.8 }
function vpd(tempF: number, leafOffsetF: number, rh: number): number {
  const airC  = fToC(tempF)
  const leafC = fToC(tempF + leafOffsetF)
  return svp(leafC) - (rh / 100) * svp(airC)
}

const VPD_ZONES = [
  { label: 'Under-transpiration', min: 0,    max: 0.4,  color: '#3b82f6' },
  { label: 'Propagation',         min: 0.4,  max: 0.8,  color: '#22c55e' },
  { label: 'Veg / Early Flower',  min: 0.8,  max: 1.2,  color: '#52B788' },
  { label: 'Mid Flower',          min: 1.2,  max: 1.6,  color: '#f59e0b' },
  { label: 'Late Flower',         min: 1.6,  max: 2.0,  color: '#ef4444' },
  { label: 'Over-transpiration',  min: 2.0,  max: 99,   color: '#7f1d1d' },
]

function getZone(v: number) {
  return VPD_ZONES.find(z => v >= z.min && v < z.max) ?? VPD_ZONES[VPD_ZONES.length - 1]
}

const PH_TARGETS: Array<{ medium: string; veg: string; flower: string }> = [
  { medium: 'Coco Coir',       veg: '5.8 – 6.0', flower: '6.0 – 6.2' },
  { medium: 'Rockwool / NFT',  veg: '5.5 – 5.8', flower: '5.8 – 6.0' },
  { medium: 'DWC / Hydro',     veg: '5.5 – 6.0', flower: '5.8 – 6.2' },
  { medium: 'Living Soil',     veg: '6.3 – 6.8', flower: '6.5 – 7.0' },
  { medium: 'Pro-Mix / Peat',  veg: '6.0 – 6.5', flower: '6.2 – 6.8' },
]

const EC_TARGETS: Array<{ stage: string; coco: string; soil: string; hydro: string }> = [
  { stage: 'Seedling / Clone', coco: '0.4 – 0.8', soil: '0.2 – 0.4', hydro: '0.4 – 0.8' },
  { stage: 'Early Veg',        coco: '0.8 – 1.2', soil: '0.6 – 1.0', hydro: '0.8 – 1.2' },
  { stage: 'Late Veg',         coco: '1.2 – 1.6', soil: '1.0 – 1.4', hydro: '1.2 – 1.6' },
  { stage: 'Early Flower',     coco: '1.4 – 1.8', soil: '1.2 – 1.6', hydro: '1.4 – 1.8' },
  { stage: 'Peak Flower',      coco: '1.8 – 2.4', soil: '1.6 – 2.0', hydro: '1.8 – 2.4' },
  { stage: 'Flush',            coco: '< 0.3',      soil: '< 0.3',     hydro: '< 0.3'     },
]

export default function ToolsPage() {
  const [tempF, setTempF]     = useState('77')
  const [rh, setRh]           = useState('60')
  const [leafOff, setLeafOff] = useState('2')

  const [fromGal, setFromGal]     = useState('')
  const [fromOzPerGal, setFromOzPerGal] = useState('')

  const vpdVal = useMemo(() => {
    const t = parseFloat(tempF)
    const r = parseFloat(rh)
    const l = parseFloat(leafOff)
    if (isNaN(t) || isNaN(r) || r <= 0 || r > 100) return null
    return vpd(t, isNaN(l) ? 2 : l, r)
  }, [tempF, rh, leafOff])

  const zone = vpdVal !== null ? getZone(vpdVal) : null

  // ml/L from oz/gal conversion: 1 oz/gal = 7.489 ml/L
  const mlPerL = fromOzPerGal ? (parseFloat(fromOzPerGal) * 7.489).toFixed(2) : ''
  // gallons to liters
  const liters = fromGal ? (parseFloat(fromGal) * 3.785).toFixed(1) : ''

  return (
    <div className="px-4 md:px-6 py-5 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Grower Tools</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Quick calculators and reference tables</p>
      </div>

      {/* VPD Calculator */}
      <section className="rounded-xl border p-5 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>VPD Calculator</h2>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Air temp (°F)', val: tempF, set: setTempF, ph: '77' },
            { label: 'Relative humidity (%)', val: rh, set: setRh, ph: '60' },
            { label: 'Leaf offset (°F)', val: leafOff, set: setLeafOff, ph: '2', tip: 'Leaf is usually 2°F cooler than air' },
          ].map(({ label, val, set, ph, tip }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</label>
              <input type="number" step="0.5" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              {tip && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{tip}</p>}
            </div>
          ))}
        </div>

        {vpdVal !== null && zone && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: `${zone.color}18`, border: `1px solid ${zone.color}44` }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: zone.color }}>{zone.label}</span>
              <span className="text-3xl font-bold font-mono" style={{ color: zone.color }}>
                {vpdVal.toFixed(2)} kPa
              </span>
            </div>
          </div>
        )}

        {/* Zone legend */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>VPD zones</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {VPD_ZONES.slice(0, -1).map(z => (
              <div key={z.label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{ background: `${z.color}12` }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: z.color }} />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium truncate" style={{ color: z.color }}>{z.label}</p>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {z.min} – {z.max < 99 ? z.max : '∞'} kPa
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pH Reference */}
      <section className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>pH Targets by Medium</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Medium</th>
                <th className="text-left py-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>Veg</th>
                <th className="text-left py-2 text-xs font-semibold" style={{ color: '#818cf8' }}>Flower</th>
              </tr>
            </thead>
            <tbody>
              {PH_TARGETS.map(row => (
                <tr key={row.medium} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 pr-4 text-sm" style={{ color: 'var(--text)' }}>{row.medium}</td>
                  <td className="py-2.5 pr-4 font-mono text-sm" style={{ color: 'var(--accent)' }}>{row.veg}</td>
                  <td className="py-2.5 font-mono text-sm" style={{ color: '#818cf8' }}>{row.flower}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* EC Reference */}
      <section className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>EC Targets by Stage</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Stage</th>
                <th className="text-left py-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>Coco / Hydro</th>
                <th className="text-left py-2 text-xs font-semibold" style={{ color: '#52B788' }}>Soil</th>
                <th className="text-left py-2 text-xs font-semibold" style={{ color: '#818cf8' }}>DWC</th>
              </tr>
            </thead>
            <tbody>
              {EC_TARGETS.map(row => (
                <tr key={row.stage} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 pr-4 text-sm" style={{ color: 'var(--text)' }}>{row.stage}</td>
                  <td className="py-2.5 pr-4 font-mono text-sm" style={{ color: 'var(--accent)' }}>{row.coco}</td>
                  <td className="py-2.5 pr-4 font-mono text-sm" style={{ color: '#52B788' }}>{row.soil}</td>
                  <td className="py-2.5 font-mono text-sm" style={{ color: '#818cf8' }}>{row.hydro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unit converters */}
      <section className="rounded-xl border p-5 space-y-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Unit Converters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* oz/gal → ml/L */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>oz/gal → ml/L</p>
            <div className="flex items-center gap-2">
              <input type="number" step="0.1" placeholder="1.0" value={fromOzPerGal} onChange={e => setFromOzPerGal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>oz/gal</span>
            </div>
            {mlPerL && (
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>= {mlPerL} ml/L</p>
            )}
          </div>

          {/* Gallons → Liters */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Gallons → Liters</p>
            <div className="flex items-center gap-2">
              <input type="number" step="0.5" placeholder="5" value={fromGal} onChange={e => setFromGal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text)' }} />
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>gal</span>
            </div>
            {liters && (
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--accent)' }}>= {liters} L</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
