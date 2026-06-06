import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RecipeDetail } from '@/components/recipes/recipe-detail'
import type { Recipe, RecipeReview, Grow } from '@/types/database'

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [recipeResult, reviewsResult, growsResult] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .eq('id', id)
      .single(),
    supabase
      .from('recipe_reviews')
      .select('*, reviewer:profiles(id, username, display_name)')
      .eq('recipe_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('grows')
      .select('id, name, status')
      .eq('user_id', user.id)
      .not('status', 'in', '("complete","failed")')
      .order('created_at', { ascending: false }),
  ])

  if (recipeResult.error || !recipeResult.data) notFound()

  const recipe  = recipeResult.data as unknown as Recipe
  const reviews = (reviewsResult.data ?? []) as unknown as RecipeReview[]
  const grows   = (growsResult.data ?? []) as Pick<Grow, 'id' | 'name' | 'status'>[]

  const myReview = reviews.find(r => r.user_id === user.id)

  return (
    <RecipeDetail
      recipe={recipe}
      reviews={reviews}
      activeGrows={grows}
      currentUserId={user.id}
      myReview={myReview ?? null}
    />
  )
}
