'use client'

import { useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  targetUserId: string
  currentUserId: string
  initialIsFollowing: boolean
  initialFollowerCount: number
}

export function FollowButton({ targetUserId, currentUserId, initialIsFollowing, initialFollowerCount }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  if (currentUserId === targetUserId) return null

  async function toggle() {
    setLoading(true)
    if (isFollowing) {
      setIsFollowing(false)
      setFollowerCount(c => c - 1)
      await supabase.from('follows').delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
    } else {
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetUserId } as never)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
      style={{
        background: isFollowing ? 'var(--surface-raised)' : 'var(--accent)',
        borderColor: isFollowing ? 'var(--border)' : 'var(--accent)',
        color: isFollowing ? 'var(--text-secondary)' : '#0a0f0d',
      }}
    >
      {isFollowing
        ? <><UserCheck className="w-4 h-4" /> Following</>
        : <><UserPlus className="w-4 h-4" /> Follow</>}
    </button>
  )
}
