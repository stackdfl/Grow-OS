'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Send, CornerDownRight, CheckCircle2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ReactionBar } from './reaction-bar'

interface Comment {
  id: string; author_id: string; parent_id: string | null; body: string; upvotes: number; created_at: string
  author: { username: string; display_name: string | null; avatar_url: string | null } | null
}

export function CommentThread({ targetType, targetId, initialComments, isThreadAuthor = false, locked = false, solvedCommentId = null }: {
  targetType: 'share' | 'post'
  targetId: string
  initialComments: Comment[]
  isThreadAuthor?: boolean
  locked?: boolean
  solvedCommentId?: string | null
}) {
  const supabase = createClient()
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [solved, setSolved] = useState<string | null>(solvedCommentId)

  const top = comments.filter(c => !c.parent_id)
  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id)
  const ordered = solved ? [...top].sort((a, b) => (a.id === solved ? -1 : b.id === solved ? 1 : 0)) : top

  async function submit(parentId: string | null, text: string) {
    if (!text.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/community/comment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, parentId, body: text }),
      })
      const d = await res.json()
      if (d.comment) { setComments(prev => [...prev, d.comment]); setBody(''); setReplyTo(null) }
    } catch { /* noop */ }
    setPosting(false)
  }

  async function markSolved(commentId: string) {
    const next = solved === commentId ? null : commentId
    setSolved(next)
    if (targetType === 'post') {
      await supabase.from('community_posts').update({ solved_comment_id: next } as never).eq('id', targetId)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      {locked ? (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}>
          <Lock className="w-4 h-4" /> This thread is locked — no new replies.
        </div>
      ) : (
        <Composer value={body} onChange={setBody} onSubmit={() => submit(null, body)} posting={posting} placeholder="Add a comment…" />
      )}

      <div className="space-y-3">
        {ordered.map(c => (
          <div key={c.id}>
            <CommentRow c={c} solved={solved === c.id}
              canSolve={isThreadAuthor && targetType === 'post'} onSolve={() => markSolved(c.id)}
              onReply={locked ? undefined : () => setReplyTo(replyTo === c.id ? null : c.id)} />
            {repliesOf(c.id).map(r => (
              <div key={r.id} className="ml-7 mt-2 flex gap-1.5">
                <CornerDownRight className="w-3.5 h-3.5 mt-2 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div className="flex-1"><CommentRow c={r} /></div>
              </div>
            ))}
            {replyTo === c.id && !locked && (
              <div className="ml-7 mt-2"><ReplyComposer onSubmit={text => submit(c.id, text)} posting={posting} /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CommentRow({ c, onReply, solved, canSolve, onSolve }: {
  c: Comment; onReply?: () => void; solved?: boolean; canSolve?: boolean; onSolve?: () => void
}) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: solved ? 'var(--accent)' : 'var(--border)' }}>
      <div className="flex items-center gap-2 mb-1">
        {solved && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
            <CheckCircle2 className="w-3 h-3" /> Answer
          </span>
        )}
        <Link href={`/growers/${c.author?.username}`} className="text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
          @{c.author?.username ?? 'grower'}
        </Link>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: 'var(--text-secondary)' }}>{c.body}</p>
      <div className="flex items-center gap-3">
        <ReactionBar targetType="comment" targetId={c.id} initialTotal={c.upvotes} />
        {onReply && <button onClick={onReply} className="text-xs" style={{ color: 'var(--text-muted)' }}>Reply</button>}
        {canSolve && (
          <button onClick={onSolve} className="text-xs flex items-center gap-1" style={{ color: solved ? 'var(--accent)' : 'var(--text-muted)' }}>
            <CheckCircle2 className="w-3 h-3" /> {solved ? 'Unmark' : 'Mark as answer'}
          </button>
        )}
      </div>
    </div>
  )
}

function Composer({ value, onChange, onSubmit, posting, placeholder }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; posting: boolean; placeholder: string
}) {
  return (
    <div className="flex gap-2">
      <textarea rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }} />
      <button onClick={onSubmit} disabled={posting || !value.trim()}
        className="px-3 rounded-lg flex items-center justify-center disabled:opacity-40 shrink-0" style={{ background: 'var(--accent)', color: '#0a0f0d' }}>
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}

function ReplyComposer({ onSubmit, posting }: { onSubmit: (t: string) => void; posting: boolean }) {
  const [text, setText] = useState('')
  return <Composer value={text} onChange={setText} onSubmit={() => onSubmit(text)} posting={posting} placeholder="Write a reply…" />
}
