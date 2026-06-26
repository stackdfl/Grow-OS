import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, FlaskConical, Download, Star } from 'lucide-react'
import { FollowButton } from '@/components/community/follow-button'
import type { Profile } from '@/types/database'

export default async function CommunityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Top growers — by public recipe download count (approximate via join)
  const { data: growersRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, experience_level, location')
    .neq('id', user.id)
    .limit(30)

  const growers = (growersRaw ?? []) as Profile[]

  // Get public recipe counts + total downloads per grower
  const growerIds = growers.map(g => g.id)
  const { data: recipeSummaryRaw } = growerIds.length > 0
    ? await supabase.from('recipes')
        .select('author_id, downloads, rating_avg')
        .eq('is_public', true)
        .in('author_id', growerIds)
    : { data: [] }

  const recipeStats: Record<string, { count: number; downloads: number; rating: number }> = {}
  for (const r of (recipeSummaryRaw ?? []) as { author_id: string; downloads: number; rating_avg: number }[]) {
    if (!recipeStats[r.author_id]) recipeStats[r.author_id] = { count: 0, downloads: 0, rating: 0 }
    recipeStats[r.author_id].count++
    recipeStats[r.author_id].downloads += r.downloads
    recipeStats[r.author_id].rating = Math.max(recipeStats[r.author_id].rating, r.rating_avg)
  }

  // Only show growers with at least one public recipe
  const activeGrowers = growers
    .filter(g => (recipeStats[g.id]?.count ?? 0) > 0)
    .sort((a, b) => (recipeStats[b.id]?.downloads ?? 0) - (recipeStats[a.id]?.downloads ?? 0))

  // Get current user's follows
  const { data: myFollowsRaw } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
  const myFollows = new Set((myFollowsRaw ?? []).map((f: { following_id: string }) => f.following_id))

  // Get follower counts for displayed growers
  const { data: followerCountsRaw } = activeGrowers.length > 0
    ? await supabase.from('follows')
        .select('following_id')
        .in('following_id', activeGrowers.map(g => g.id))
    : { data: [] }
  const followerCounts: Record<string, number> = {}
  for (const f of (followerCountsRaw ?? []) as { following_id: string }[]) {
    followerCounts[f.following_id] = (followerCounts[f.following_id] ?? 0) + 1
  }

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Community</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Follow growers to see their latest recipes on your dashboard.
        </p>
      </div>

      {activeGrowers.length === 0 && (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <Users className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No community members with public recipes yet. Be the first to publish!
          </p>
        </div>
      )}

      <div className="space-y-3">
        {activeGrowers.map(g => {
          const stats = recipeStats[g.id] ?? { count: 0, downloads: 0, rating: 0 }
          const initials = (g.display_name ?? g.username).slice(0, 2).toUpperCase()
          const isFollowing = myFollows.has(g.id)
          const followers = followerCounts[g.id] ?? 0

          return (
            <div
              key={g.id}
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {/* Avatar */}
              <Link href={`/growers/${g.username}`} className="shrink-0">
                {g.avatar_url ? (
                  <img src={g.avatar_url} alt={g.username} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold"
                    style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                  >
                    {initials}
                  </div>
                )}
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link href={`/growers/${g.username}`} className="hover:underline">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {g.display_name ?? g.username}
                  </span>
                  <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>
                    @{g.username}
                  </span>
                </Link>
                {g.bio && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{g.bio}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <FlaskConical className="w-3 h-3" /> {stats.count} recipe{stats.count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Download className="w-3 h-3" /> {stats.downloads}
                  </span>
                  {stats.rating > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--gold)' }}>
                      <Star className="w-3 h-3" /> {stats.rating.toFixed(1)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Users className="w-3 h-3" /> {followers}
                  </span>
                </div>
              </div>

              {/* Follow */}
              <FollowButton
                targetUserId={g.id}
                currentUserId={user.id}
                initialIsFollowing={isFollowing}
                initialFollowerCount={followers}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
