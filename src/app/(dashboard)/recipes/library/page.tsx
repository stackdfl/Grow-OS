import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RecipeLibrary } from '@/components/recipes/recipe-library'
import type { Recipe, Grow } from '@/types/database'

export default async function RecipeLibraryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [ownResult, savedResult, growsResult] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, author:profiles(id, username, display_name)')
      .eq('author_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('recipe_saves')
      .select('saved_at, recipe:recipes(*, author:profiles(id, username, display_name))')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false }),
    supabase
      .from('grows')
      .select('id, name, status, recipe_id')
      .eq('user_id', user.id)
      .not('status', 'in', '("complete","failed")')
      .order('created_at', { ascending: false }),
  ])

  type GrowRow = Pick<Grow, 'id' | 'name' | 'status'> & { recipe_id: string | null }

  const ownRecipes  = (ownResult.data ?? [])   as unknown as Recipe[]
  const savedItems  = (savedResult.data ?? [])  as unknown as { saved_at: string; recipe: Recipe }[]
  const activeGrows = (growsResult.data ?? [])  as unknown as GrowRow[]

  return (
    <RecipeLibrary
      ownRecipes={ownRecipes}
      savedItems={savedItems}
      activeGrows={activeGrows}
      currentUserId={user.id}
    />
  )
}
