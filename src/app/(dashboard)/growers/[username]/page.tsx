import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { format, parseISO } from 'date-fns'
import { Star, Download, MapPin, Sprout, FlaskConical, Users } from 'lucide-react'
import { FollowButton } from '@/components/community/follow-button'
import type { Profile, Recipe } from '@/types/database'

export default async function GrowerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch the target profile
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profileRaw) notFound()
  const profile = profileRaw as Profile

  // Parallel: public recipes, follower count, following count, is current user following
  const [
    { data: recipesRaw },
    { count: followerCount },
    { count: followingCount },
    { data: followRow },
    { data: sharesRaw },
  ] = await Promise.all([
    supabase.from('recipes')
      .select('id, title, genetics, medium, difficulty, rating_avg, rating_count, downloads, veg_weeks, flower_weeks, tags, created_at')
      .eq('author_id', profile.id)
      .eq('is_public', true)
      .order('downloads', { ascending: false })
      .limit(20),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id),
    supabase.from('follows').select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .maybeSingle(),
    supabase.from('community_shares')
      .select('id, title, cover_photo, upvotes, snapshot')
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const recipes = (recipesRaw ?? []) as Recipe[]
  const shares = (sharesRaw ?? []) as unknown as { id: string; title: string; cover_photo: string | null; upvotes: number; snapshot: { yield?: { dry_oz?: number | null } | null } | null }[]
  const isFollowing = !!followRow
  const followers = followerCount ?? 0
  const following = followingCount ?? 0

  const initials = (profile.display_name ?? profile.username).slice(0, 2).toUpperCase()
  const isOwnProfile = user.id === profile.id

  return (
    <div className="px-4 md:px-6 py-5 max-w-3xl mx-auto space-y-6">
      {/* Profile header */}
      <div
        className="rounded-2xl border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                {profile.display_name ?? profile.username}
              </h1>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                @{profile.username}
              </span>
            </div>
            {profile.bio && (
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {profile.bio}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {profile.location && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <MapPin className="w-3 h-3" /> {profile.location}
                </span>
              )}
              {profile.experience_level && (
                <span className="text-xs capitalize px-2 py-0.5 rounded"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  {profile.experience_level}
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Joined {format(parseISO(profile.created_at), 'MMM yyyy')}
              </span>
            </div>
          </div>

          {!isOwnProfile && (
            <FollowButton
              targetUserId={profile.id}
              currentUserId={user.id}
              initialIsFollowing={isFollowing}
              initialFollowerCount={followers}
            />
          )}
          {isOwnProfile && (
            <Link
              href="/settings"
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Edit profile
            </Link>
          )}
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          {[
            { icon: FlaskConical, label: 'Recipes', value: recipes.length },
            { icon: Users, label: 'Followers', value: followers },
            { icon: Sprout, label: 'Following', value: following },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--text-muted)' }} />
              <div className="text-lg font-semibold font-mono" style={{ color: 'var(--text)' }}>{value}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Showcases */}
      {shares.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Grow Showcases
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {shares.map(s => (
              <Link key={s.id} href={`/canopy/${s.id}`}>
                <div className="rounded-xl border overflow-hidden transition-transform hover:scale-[1.02]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="h-24 relative" style={{ background: 'var(--surface-raised)' }}>
                    {s.cover_photo ? <img src={s.cover_photo} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Sprout className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></div>}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{s.title}</p>
                    <div className="flex items-center justify-between mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {s.snapshot?.yield?.dry_oz != null ? <span>{s.snapshot.yield.dry_oz}oz</span> : <span />}
                      <span>▲ {s.upvotes}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recipes */}
      <div>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Public Recipes
        </h2>

        {recipes.length === 0 && (
          <div
            className="rounded-xl border p-8 text-center"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <FlaskConical className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No public recipes yet.</p>
          </div>
        )}

        <div className="space-y-2">
          {recipes.map(r => (
            <Link key={r.id} href={`/recipes/${r.id}`}>
              <div
                className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors hover:border-[--accent]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                {/* Rating */}
                <div className="text-center shrink-0 w-10">
                  <div className="text-sm font-semibold font-mono" style={{ color: 'var(--gold)' }}>
                    {r.rating_avg > 0 ? r.rating_avg.toFixed(1) : '—'}
                  </div>
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className="w-2 h-2"
                        style={{ color: n <= Math.round(r.rating_avg) ? 'var(--gold)' : 'var(--border)', fill: n <= Math.round(r.rating_avg) ? 'var(--gold)' : 'transparent' }} />
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{r.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {r.genetics?.strain && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.genetics.strain}</span>
                    )}
                    {r.medium?.type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                        style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}>
                        {r.medium.type}
                      </span>
                    )}
                    {r.flower_weeks && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.flower_weeks}w flower</span>
                    )}
                  </div>
                </div>

                {/* Downloads */}
                <div className="flex items-center gap-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  <Download className="w-3 h-3" />
                  <span className="text-xs font-mono">{r.downloads}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
