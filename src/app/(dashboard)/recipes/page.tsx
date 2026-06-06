import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RecipeBoard } from '@/components/recipes/recipe-board'
import type { Recipe } from '@/types/database'

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const tag        = params.tag
  const sort       = params.sort ?? 'hot'

  let query = supabase
    .from('recipes')
    .select('*, author:profiles(id, username, display_name)')
    .or(`is_public.eq.true,author_id.eq.${user.id}`)

  if (tag) query = query.contains('tags', [tag]) as typeof query

  if (sort === 'new')  query = query.order('created_at', { ascending: false })
  else if (sort === 'top') query = query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false })
  else                 query = query.order('downloads', { ascending: false }).order('rating_avg', { ascending: false })

  const [recipesResult, savesResult] = await Promise.all([
    query.limit(100),
    supabase.from('recipe_saves').select('recipe_id').eq('user_id', user.id),
  ])

  const recipes  = (recipesResult.data ?? []) as unknown as Recipe[]
  const savedIds = (savesResult.data ?? []).map((s: { recipe_id: string }) => s.recipe_id)

  return (
    <RecipeBoard
      recipes={recipes}
      savedIds={savedIds}
      currentUserId={user.id}
      initialSort={sort}
      initialTag={tag}
    />
  )
}
