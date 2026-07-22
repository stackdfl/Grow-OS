interface Task {
  title: string
  event_date: string
  grow_name: string
  is_overdue: boolean
}

export function buildDigestEmail(displayName: string, tasks: Task[]): { subject: string; html: string; text: string } {
  const today = tasks.filter(t => !t.is_overdue)
  const overdue = tasks.filter(t => t.is_overdue)

  const count = today.length
  const subject = count > 0
    ? `${count} task${count !== 1 ? 's' : ''} today — Grow OS`
    : overdue.length > 0
    ? `${overdue.length} overdue task${overdue.length !== 1 ? 's' : ''} — Grow OS`
    : 'Good morning — Grow OS'

  const name = displayName || 'Grower'

  // Group today's tasks by grow
  const byGrow = new Map<string, Task[]>()
  for (const t of today) {
    const g = t.grow_name
    if (!byGrow.has(g)) byGrow.set(g, [])
    byGrow.get(g)!.push(t)
  }

  const todayHtml = Array.from(byGrow.entries()).map(([grow, items]) => `
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#52B788;text-transform:uppercase;margin-bottom:6px">${grow}</div>
      ${items.map(t => `<div style="padding:6px 0;border-bottom:1px solid #1a2e25;font-size:14px;color:#c8d8c8">• ${t.title}</div>`).join('')}
    </div>
  `).join('')

  const overdueHtml = overdue.length > 0 ? `
    <div style="margin-top:24px;padding:12px 16px;border-radius:8px;background:#2a1a1a">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#ef4444;text-transform:uppercase;margin-bottom:8px">
        Overdue (${overdue.length})
      </div>
      ${overdue.map(t => `<div style="padding:4px 0;font-size:13px;color:#9ca3af">• ${t.grow_name} — ${t.title}</div>`).join('')}
    </div>
  ` : ''

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="margin-bottom:24px">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:#52B788;text-transform:uppercase">Grow OS</span>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;color:#e8f5e8">Good morning, ${name}</h1>
      <p style="margin:0;font-size:14px;color:#6b8f7b">Here's your grow schedule for today.</p>
    </div>

    ${count > 0 ? `
    <div style="margin-bottom:24px">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#9ca3af;text-transform:uppercase;margin-bottom:12px">Today's tasks</div>
      ${todayHtml}
    </div>
    ` : `<p style="color:#6b8f7b;font-size:14px">No tasks scheduled for today — enjoy the day off!</p>`}

    ${overdueHtml}

    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #1a2e25;text-align:center">
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://growos.app'}"
        style="display:inline-block;padding:10px 24px;background:#52B788;color:#0a0f0d;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">
        Open Grow OS
      </a>
      <p style="margin-top:16px;font-size:11px;color:#374151">
        You're receiving this because you enabled the morning digest in settings.<br>
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://growos.app'}/settings" style="color:#52B788;text-decoration:none">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`

  // Plain text
  const lines: string[] = [`Good morning, ${name}`, '', "Here's your schedule for today:", '']
  for (const [grow, items] of byGrow.entries()) {
    lines.push(grow.toUpperCase())
    for (const t of items) lines.push(`  • ${t.title}`)
    lines.push('')
  }
  if (overdue.length > 0) {
    lines.push(`OVERDUE (${overdue.length}):`)
    for (const t of overdue) lines.push(`  • ${t.grow_name} — ${t.title}`)
    lines.push('')
  }
  lines.push(`Open Grow OS: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://growos.app'}`)

  return { subject, html, text: lines.join('\n') }
}
