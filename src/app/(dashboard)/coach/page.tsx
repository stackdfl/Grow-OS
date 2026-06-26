'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, User, Sprout, Zap, Droplets, Thermometer, Scissors } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  { icon: Sprout,      text: "My plants are yellowing in week 3 of flower — what's wrong?" },
  { icon: Thermometer, text: 'What VPD should I target during late flower?' },
  { icon: Droplets,    text: 'How often should I water coco in veg?' },
  { icon: Scissors,    text: "When should I stop training and let the plant focus on buds?" },
  { icon: Zap,         text: 'My EC runoff is climbing — should I flush?' },
]

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: isUser ? 'var(--surface-raised)' : 'var(--accent-muted)',
          color: isUser ? 'var(--text-muted)' : 'var(--accent)',
        }}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        style={{
          background: isUser ? 'var(--accent)' : 'var(--surface-raised)',
          color: isUser ? '#0a0f0d' : 'var(--text)',
        }}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    const userMsg: Message = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setStreaming(true)

    // Add empty assistant message to stream into
    setMessages(m => [...m, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const current = accumulated
        setMessages(m => {
          const updated = [...m]
          updated[updated.length - 1] = { role: 'assistant', content: current }
          return updated
        })
      }
    } catch {
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.' }
        return updated
      })
    }

    setStreaming(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full min-h-0" style={{ color: 'var(--text)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
        >
          <Bot className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Grow Coach</h1>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Knows your active grows · Powered by Claude</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-10">
            <div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                <Bot className="w-7 h-7" />
              </div>
              <p className="text-sm text-center font-medium" style={{ color: 'var(--text)' }}>
                Ask me anything about your grow
              </p>
              <p className="text-xs text-center mt-1" style={{ color: 'var(--text-muted)' }}>
                I have context on your active grows and upcoming tasks
              </p>
            </div>

            <div className="w-full max-w-lg space-y-2">
              {STARTERS.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  onClick={() => send(text)}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors hover:border-[--accent]"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{ background: 'var(--surface-raised)' }}
            >
              <div className="flex gap-1.5 items-center h-5">
                {[0, 150, 300].map(d => (
                  <div
                    key={d}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: 'var(--accent)', animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 border-t px-4 py-3"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div
          className="flex items-end gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: streaming ? 'var(--border)' : 'var(--accent)', background: 'var(--surface-raised)' }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your grow…"
            disabled={streaming}
            className="flex-1 resize-none bg-transparent outline-none text-sm py-0.5"
            style={{
              color: 'var(--text)',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            className="p-1.5 rounded-lg transition-all disabled:opacity-30"
            style={{ background: 'var(--accent)', color: '#0a0f0d' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
