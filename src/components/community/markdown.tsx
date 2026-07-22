'use client'

import { useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Render @mentions as profile links and ||spoilers|| as click-to-reveal.
// We pre-split the text so spoilers/mentions work inside plain paragraphs.

function Spoiler({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <span onClick={() => setShown(s => !s)}
      className="cursor-pointer rounded px-1 transition-colors"
      style={{
        background: shown ? 'var(--surface-raised)' : 'var(--text-muted)',
        color: shown ? 'var(--text)' : 'transparent',
      }}>
      {children}
    </span>
  )
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on spoilers ||...|| and @mentions
  const out: React.ReactNode[] = []
  const regex = /(\|\|[^|]+\|\||@[a-z0-9_]+)/gi
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('||')) {
      out.push(<Spoiler key={`${keyBase}-s${i}`}>{tok.slice(2, -2)}</Spoiler>)
    } else {
      const handle = tok.slice(1)
      out.push(
        <Link key={`${keyBase}-m${i}`} href={`/growers/${handle}`} className="font-medium" style={{ color: 'var(--accent)' }}>
          @{handle}
        </Link>
      )
    }
    last = m.index + tok.length; i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function withInline(children: React.ReactNode, keyBase: string): React.ReactNode {
  if (typeof children === 'string') return renderInline(children, keyBase)
  if (Array.isArray(children)) return children.map((c, i) => typeof c === 'string' ? <span key={i}>{renderInline(c, `${keyBase}-${i}`)}</span> : c)
  return children
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed space-y-3" style={{ color: 'var(--text-secondary)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{withInline(children, 'p')}</p>,
          li: ({ children }) => <li className="ml-4 list-disc">{withInline(children, 'li')}</li>,
          strong: ({ children }) => <strong style={{ color: 'var(--text)' }}>{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{children}</a>
          ),
          h1: ({ children }) => <h2 className="text-lg font-bold mt-2" style={{ color: 'var(--text)' }}>{children}</h2>,
          h2: ({ children }) => <h3 className="text-base font-bold mt-2" style={{ color: 'var(--text)' }}>{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-bold mt-2" style={{ color: 'var(--text)' }}>{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 italic" style={{ borderColor: 'var(--accent)', color: 'var(--text-muted)' }}>{children}</blockquote>
          ),
          code: ({ className, children }) => {
            const block = (className ?? '').includes('language-')
            return block
              ? <code className="block rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto" style={{ background: 'var(--bg)', color: 'var(--text)' }}>{children}</code>
              : <code className="rounded px-1 text-xs font-mono" style={{ background: 'var(--surface-raised)', color: 'var(--accent)' }}>{children}</code>
          },
          img: ({ src, alt }) => <img src={src as string} alt={alt} className="rounded-lg max-h-96 my-2" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
