export const PREFIX_META: Record<string, { label: string; color: string }> = {
  question:  { label: 'Question',   color: '#38bdf8' },
  discussion:{ label: 'Discussion', color: 'var(--accent)' },
  guide:     { label: 'Guide',      color: 'var(--purple)' },
  help:      { label: 'Help',       color: 'var(--warning)' },
  showoff:   { label: 'Show-off',   color: 'var(--gold)' },
  wtb:       { label: 'WTB',        color: '#38bdf8' },
  wts:       { label: 'WTS',        color: 'var(--accent)' },
}

export const PREFIXES = Object.entries(PREFIX_META).map(([key, v]) => ({ key, ...v }))
